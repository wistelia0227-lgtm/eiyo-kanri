// 料理・献立をまとめて取り込む／書き出す（削除可能）。解析は js/bulk.js。
// 入れる前に必ず「何がどう当たったか」を見せる。食品名から食品番号を当てるのは外しやすく、
// 黙って入れると栄養価が静かに狂うため（旧 nutrition-app のデータで実際に起きていた）。
(function () {
  'use strict';
  const U = window.U, h = U.h, DB = window.DB, M = window.Model, N = window.Nutri, V = window.View;
  const B = window.Bulk, Foods = window.Foods, Dishes = window.Dishes, Menu = window.Menu, App = window.App;
  const ms = () => window.Master.current;
  const UI = {};
  let tab = 'dish';

  const SAMPLE_DISH = [
    '料理名\t区分\t何人分\t食品番号\t食品名\t重量\tメモ',
    '筑前煮\t副菜\t1\t11221\t\t40\t根菜は乱切り',
    '筑前煮\t\t\t02017\t\t40\t',
    '筑前煮\t\t\t06214\t\t20\t',
    '筑前煮\t\t\t\tこいくちしょうゆ\t6\t',
    '筑前煮\t\t\t\t車糖 上白糖\t3\t'
  ].join('\n');
  const SAMPLE_MENU = ['日付\t食事\t食種\t料理名\t人数分', '2026-10-01\t昼\t常食\tごはん\t1', '2026-10-01\t昼\t常食\t筑前煮\t1'].join('\n');

  App.registerScreen('bulk', async function (params, root) {
    if (params[0] === 'dish' || params[0] === 'menu') tab = params[0];
    root.appendChild(h('header', { class: 'topbar' }, h('h1', null, 'まとめて取り込む'),
      h('div', { class: 'no-print' }, h('a', { class: 'btn', href: '#/dishes' }, '料理マスタ'))));
    root.appendChild(h('div', { class: 'toolrow' },
      h('a', { class: 'btn seg' + (tab === 'dish' ? ' on' : ''), href: '#/bulk/dish' }, '料理'),
      h('a', { class: 'btn seg' + (tab === 'menu' ? ' on' : ''), href: '#/bulk/menu' }, '献立')));
    if (tab === 'menu') return drawMenu(root);
    return drawDish(root);
  });

  // ---- 料理 ----
  async function drawDish(root) {
    const box = h('div');
    const ta = h('textarea', { class: 'input mono', rows: '8', placeholder: SAMPLE_DISH });
    let parsed = null;

    const preview = () => {
      const r = B.parse(ta.value);
      box.innerHTML = '';
      if (r.error) { box.appendChild(h('div', { class: 'card bad' }, r.error)); parsed = null; return; }
      parsed = B.toDishes(r.rows, N);
      const s = B.summary(parsed);
      box.appendChild(h('div', { class: 'card' + (s.bad ? ' warn' : '') },
        h('b', null, '料理 ' + s.dishes + ' 件　材料 ' + s.items + ' 行'),
        h('div', null, 'そのまま入れられる ' + s.ok + ' 件' +
          (s.bad ? '　／　直すところがある ' + s.bad + ' 件' : '') +
          (s.check ? '　／　当て推量で当たった材料 ' + s.check + ' 行（確かめてください）' : '')),
        s.empty ? h('div', { class: 'sub' }, '材料が 1 つも無い料理が ' + s.empty + ' 件あります。') : null));
      parsed.forEach((d) => box.appendChild(dishCard(d, preview)));
      box.appendChild(h('div', { class: 'toolrow' },
        h('button', { class: 'btn primary', disabled: !parsed.some((x) => x.ok), onclick: () => apply(parsed, false) },
          'そのまま入れられる ' + s.ok + ' 件を取り込む'),
        h('button', { class: 'btn', disabled: !parsed.some((x) => x.ok), onclick: () => apply(parsed, true) }, '同じ名前があれば上書きする')));
    };
    ta.addEventListener('change', preview);

    root.appendChild(h('div', { class: 'card info' },
      '表計算ソフトの表をそのまま貼り付けられます（タブ区切り・カンマ区切りのどちらでも）。' +
      '1 行 = 1 つの材料で、同じ料理名の行がまとまって 1 つの料理になります。' +
      '食品番号が空なら食品名から探します。入れる前に、何がどう当たったかを下に出します。'));
    root.appendChild(h('section', { class: 'card' },
      U.field('ここに貼る', ta, '見出しの行が要ります: 料理名 / 区分 / 何人分 / 食品番号 / 食品名 / 重量 / 主材料 / 調理法 / アレルギー / メモ'),
      h('div', { class: 'toolrow' },
        h('button', { class: 'btn', onclick: async () => {
          const t = await U.pickFile('.csv,.txt,.tsv');
          if (t == null) return;
          ta.value = t; preview();
        } }, 'ファイルから読む'),
        h('button', { class: 'btn', onclick: () => { ta.value = SAMPLE_DISH; preview(); } }, '見本を入れる'),
        h('button', { class: 'btn', onclick: async () => {
          const all = await Dishes.all();
          if (!all.length) { U.toast('料理がありません', true); return; }
          U.xlsx('料理マスタ.xlsx', [{ name: '料理', rows: B.toRows(all) }]);
        } }, '今ある料理を Excel で書き出す'),
        h('button', { class: 'btn', onclick: async () => {
          const all = await Dishes.all();
          if (!all.length) { U.toast('料理がありません', true); return; }
          U.download('料理マスタ.csv', U.csv(B.toRows(all)), 'text/csv');
        } }, 'CSV で書き出す'))));
    root.appendChild(box);

    async function apply(list, overwrite) {
      const good = list.filter((d) => d.ok);
      if (!good.length) return;
      const have = {};
      (await Dishes.all()).forEach((d) => { have[d.name] = d; });
      const dup = good.filter((d) => have[d.name]);
      if (dup.length && !overwrite) {
        if (!await U.confirm('同じ名前の料理が ' + dup.length + ' 件あります（' + dup.slice(0, 3).map((d) => d.name).join('、') + '…）。それは飛ばして、残りを入れます。', { okLabel: '入れる' })) return;
      } else if (dup.length && overwrite) {
        if (!await U.confirm(dup.length + ' 件を上書きします。前の材料は消えます。', { okLabel: '上書きする', danger: true })) return;
      }
      const put = [];
      good.forEach((d) => {
        const old = have[d.name];
        if (old && !overwrite) return;
        put.push({ id: old ? old.id : U.uid('d'), name: d.name, kana: (old && old.kana) || '', kind: d.kind,
          main: d.main, method: d.method, servings: Math.max(1, d.servings || 1),
          items: d.items.map((i) => ({ no: i.no, name: i.name, g: i.g })),
          allergy: d.allergy.slice(), memo: d.memo, updatedAt: Date.now() });
      });
      if (!put.length) { U.toast('入れるものがありません', true); return; }
      await DB.putMany('dishes', put);
      // 区分をマスタに足す
      const m = ms();
      const kinds = m.dishKinds || [];
      put.forEach((d) => { if (d.kind && kinds.indexOf(d.kind) < 0) kinds.push(d.kind); });
      m.dishKinds = kinds;
      await window.Master.save();
      U.toast(put.length + ' 件を取り込みました');
      App.go('#/dishes');
    }
  }

  // 1 つの料理の確認カード
  function dishCard(d, redraw) {
    const sum = d.items.every((i) => i.no) ? N.sum(d.items.map((i) => ({ no: i.no, g: i.g }))) : null;
    const per = sum ? N.scale(sum, 1 / Math.max(1, d.servings || 1)) : null;
    const rows = d.items.map((it) => {
      const cls = it.how === 'none' ? 'j-high' : (it.how === 'many' ? 'warn-text' : '');
      let cell;
      if (it.how === 'none') {
        cell = h('span', { class: 'bad-text' }, it.why || '見つかりません');
      } else if (it.how === 'many') {
        cell = h('select', { class: 'input', onchange: (e) => {
          const f = N.get(e.target.value);
          if (f) { it.no = f.no; it.name = f.name; it.how = 'picked'; d.check--; redraw(); }
        } }, it.cands.map((f) => h('option', { value: f.no, selected: f.no === it.no }, Foods.shortName(f.name))));
      } else {
        cell = h('span', null, Foods.shortName(it.name), h('span', { class: 'sub' }, ' ' + it.no));
      }
      const how = { no: '番号どおり', exact: '名前が同じ', one: '候補は 1 つ', many: '候補が ' + it.cands.length + ' 件', picked: 'えらび直した', none: '' }[it.how] || '';
      return h('tr', { class: cls }, h('td', null, it.given || h('span', { class: 'sub' }, '（空）')),
        h('td', null, cell), h('td', { class: 'sub' }, how),
        h('td', { class: 'num' + (it.noG ? ' bad-text' : '') }, it.noG ? '重量なし' : it.g + ' g'),
        h('td', { class: 'no-print' }, h('button', { class: 'btn small', onclick: async () => {
          const f = await Foods.pick();
          if (!f) return;
          it.no = f.no; it.name = f.name; it.how = 'picked'; if (it.cands.length) d.check--; redraw();
        } }, 'えらぶ')));
    });
    return h('section', { class: 'card' + (d.bad ? ' warn' : '') },
      h('h2', null, d.name, h('span', { class: 'sub' }, '　' + (d.kind || '区分なし') + '　' + (d.servings || 1) + ' 人分'),
        d.ok ? h('span', { class: 'tag ok' }, '入れられる') : h('span', { class: 'tag bad' }, '直すところ ' + d.bad)),
      h('table', { class: 'list' },
        h('thead', null, h('tr', null, ['書いてあった', '当たった食品', '当て方', '重量', ''].map((t) => h('th', null, t)))),
        h('tbody', null, rows)),
      per ? h('div', null, h('b', null, '1 人分 '), Foods.sumRow(per, Foods.shownKeys())) : null,
      d.memo ? h('div', { class: 'sub' }, 'メモ: ' + d.memo) : null);
  }

  // ---- 献立 ----
  async function drawMenu(root) {
    const m = ms(), meals = M.activeMeals(m);
    const box = h('div');
    const ta = h('textarea', { class: 'input mono', rows: '8', placeholder: SAMPLE_MENU });
    const year = h('input', { class: 'input num', type: 'number', value: U.today().slice(0, 4) });
    let plan = null;

    const preview = async () => {
      const r = B.parseMenu(ta.value);
      box.innerHTML = '';
      if (r.error) { box.appendChild(h('div', { class: 'card bad' }, r.error)); plan = null; return; }
      const byName = {};
      (await Dishes.all()).forEach((d) => { if (!byName[d.name]) byName[d.name] = d; });
      const cells = {}, bad = [];
      r.rows.forEach((row) => {
        const date = B.toDate(row.date, year.value);
        const mealId = B.toId(meals, row.meal) || meals[0].id;
        const sId = B.toId(m.shokushu, row.shokushu) || (m.shokushu[0] && m.shokushu[0].id);
        const dish = byName[String(row.dish || '').trim()];
        if (!date) { bad.push({ line: row.line, why: '日付が読めません: ' + row.date }); return; }
        if (!dish) { bad.push({ line: row.line, why: '料理マスタにありません: ' + row.dish }); return; }
        const key = date + '|' + mealId + '|' + sId;
        (cells[key] = cells[key] || []).push({ dishId: dish.id, name: dish.name, x: parseFloat(row.x) || 1 });
      });
      plan = { cells: cells, bad: bad };
      const days = {};
      Object.keys(cells).forEach((k) => { days[k.split('|')[0]] = true; });
      box.appendChild(h('div', { class: 'card' + (bad.length ? ' warn' : '') },
        h('b', null, Object.keys(days).length + ' 日分　' + Object.keys(cells).length + ' マス'),
        bad.length ? h('div', null, h('span', { class: 'bad-text' }, '入らない行 ' + bad.length + ' 件'),
          h('ul', null, bad.slice(0, 12).map((x) => h('li', null, x.line + ' 行目: ' + x.why))),
          bad.length > 12 ? h('div', { class: 'sub' }, 'ほか ' + (bad.length - 12) + ' 件') : null) : null,
        bad.some((x) => /料理マスタにありません/.test(x.why))
          ? h('div', { class: 'sub' }, '料理が足りない時は、先に「料理」のほうでまとめて入れてください。') : null));
      const keys = Object.keys(cells).sort();
      box.appendChild(h('div', { class: 'scroll-x' }, h('table', { class: 'list bordered' },
        h('thead', null, h('tr', null, ['日', '食事', '食種', '料理'].map((t) => h('th', null, t)))),
        h('tbody', null, keys.slice(0, 60).map((k) => {
          const p = k.split('|');
          return h('tr', null, h('td', null, U.fmtDate(p[0], true)), h('td', null, M.label(meals, p[1])),
            h('td', null, M.label(m.shokushu, p[2])),
            h('td', null, cells[k].map((c) => c.name + (c.x !== 1 ? ' ×' + c.x : '')).join('／')));
        })))));
      if (keys.length > 60) box.appendChild(h('div', { class: 'sub' }, 'ほか ' + (keys.length - 60) + ' マス'));
      box.appendChild(h('div', { class: 'toolrow' },
        h('button', { class: 'btn primary', disabled: !keys.length, onclick: () => applyMenu(cells, false) }, '空いているマスに入れる'),
        h('button', { class: 'btn', disabled: !keys.length, onclick: () => applyMenu(cells, true) }, '入っていても上書きする')));
    };
    ta.addEventListener('change', preview);
    year.addEventListener('change', preview);

    root.appendChild(h('div', { class: 'card info' },
      '日付・食事・食種・料理名 の表を貼ると、献立に入ります。料理名は 料理マスタ の名前と同じである必要があります。' +
      '「10/1」のように年が無い日付は、下の年を使います。'));
    root.appendChild(h('section', { class: 'card' },
      U.field('ここに貼る', ta, '見出しの行が要ります: 日付 / 食事 / 食種 / 料理名 / 人数分'),
      h('div', { class: 'grid2' }, U.field('年が書いていないときの年', year)),
      h('div', { class: 'toolrow' },
        h('button', { class: 'btn', onclick: async () => {
          const t = await U.pickFile('.csv,.txt,.tsv');
          if (t == null) return;
          ta.value = t; preview();
        } }, 'ファイルから読む'),
        h('button', { class: 'btn', onclick: () => { ta.value = SAMPLE_MENU; preview(); } }, '見本を入れる'),
        h('button', { class: 'btn', onclick: () => exportMenu(meals) }, '今の献立を書き出す'))));
    root.appendChild(box);

    async function applyMenu(cells, overwrite) {
      const keys = Object.keys(cells);
      const byDate = {};
      keys.forEach((k) => { const p = k.split('|'); (byDate[p[0]] = byDate[p[0]] || []).push({ key: k, m: p[1], s: p[2] }); });
      let filled = 0, kept = 0;
      if (!await U.confirm(Object.keys(byDate).length + ' 日分を献立に入れます。' +
        (overwrite ? '既に料理が入っているマスも上書きします。' : '既に入っているマスは触りません。'), { okLabel: '入れる', danger: overwrite })) return;
      for (const date of Object.keys(byDate).sort()) {
        const rec = await Menu.get(date);
        byDate[date].forEach((c) => {
          const key = Menu.cellKey(c.m, c.s);
          if ((rec.cells[key] || []).length && !overwrite) { kept++; return; }
          rec.cells[key] = cells[c.key].map((x) => ({ dishId: x.dishId, name: x.name, x: x.x }));
          filled++;
        });
        await DB.put('menus', rec);
      }
      U.toast(filled + ' マスに入れました' + (kept ? '（入っていた ' + kept + ' マスは残しました）' : ''));
      App.go('#/menu/' + Object.keys(byDate).sort()[0]);
    }
  }

  async function exportMenu(meals) {
    const m = ms();
    const all = await DB.getAll('menus');
    const rows = [['日付', '食事', '食種', '料理名', '人数分']];
    all.slice().sort((a, b) => a.date.localeCompare(b.date)).forEach((rec) => {
      m.shokushu.forEach((sh) => meals.forEach((ml) => {
        Menu.cellDishes(rec, ml.id, sh.id).forEach((c) => {
          rows.push([rec.date, ml.label, sh.label, c.name || '', c.x == null ? 1 : c.x]);
        });
      }));
    });
    if (rows.length === 1) { U.toast('献立がありません', true); return; }
    U.xlsx('献立.xlsx', [{ name: '献立', rows: rows }]);
  }

  App.registerNav({ order: 43.5, group: '献立と食材', label: 'まとめて', icon: '📥', hash: '#/bulk', match: ['bulk'], feature: 'menu' });
  window.BulkUi = UI;
})();
