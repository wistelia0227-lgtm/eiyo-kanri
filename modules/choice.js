// 選択メニューと嗜好調査（削除可能）。
// 選択メニュー: 1 つの食事に「魚か肉か」のような選ぶ料理を置き、聞き取り表を刷って希望を取り、食数と食札に反映する。
//   市販ソフトは「食種ごと選択メニュー最大 4 件」「選択メニューの聞き取り表を印刷できる」としている（調査 01・05）。
// 嗜好調査: 「結果を会議で検討し献立に反映」する帳票（横浜市の手引きの帳票一覧・調査 02 の 5.2）。
//   ここは 満足度の 5 段階 ＋ 好きな物・嫌いな物・要望 を人ごとに取り、語の出現回数でまとめる。
// 置き場所: 選択肢は menus[date].choice、誰が何を選んだかは daily[date].choice、嗜好調査は daily[date].kikou。
(function () {
  'use strict';
  const U = window.U, h = U.h, DB = window.DB, M = window.Model, N = window.Nutri, V = window.View;
  const Dishes = window.Dishes, Menu = window.Menu, App = window.App;
  const ms = () => window.Master.current;
  const C = {};

  C.MAX = 4;
  C.get = function (rec, mealId, sId) {
    const c = rec.choice && rec.choice[Menu.cellKey(mealId, sId)];
    return (c && c.options && c.options.length) ? c : null;
  };
  C.picksOf = async function (date) {
    const d = (await DB.get('daily', date)) || { date: date, extra: {} };
    d.choice = d.choice || {};
    return d;
  };
  C.pickOf = (daily, mealId, sId, rid) => ((daily.choice || {})[Menu.cellKey(mealId, sId)] || {})[rid] || '';
  // 選んだ人数
  C.tally = function (daily, mealId, sId, opts) {
    const p = (daily.choice || {})[Menu.cellKey(mealId, sId)] || {};
    const out = { none: 0 };
    opts.forEach((o) => { out[o.id] = 0; });
    return { count: out, apply: function (rids) {
      rids.forEach((rid) => { const v = p[rid]; if (v && out[v] != null) out[v]++; else out.none++; });
      return out;
    } };
  };

  // ---- 選択メニューの画面 ----
  App.registerScreen('choice', async function (params, root) {
    const date = params[0] || U.today();
    const m = ms(), meals = M.activeMeals(m);
    const rec = await Menu.get(date);
    const daily = await C.picksOf(date);
    const dishMap = {};
    (await Dishes.all()).forEach((d) => { dishMap[d.id] = d; });
    const residents = await DB.residents();

    root.appendChild(h('header', { class: 'topbar' }, h('h1', null, '選択メニュー　' + U.fmtDate(date, true)),
      h('div', { class: 'no-print' }, h('button', { class: 'btn', onclick: () => window.print() }, '印刷'), ' ',
        h('a', { class: 'btn', href: '#/menu/' + date }, '献立'))));
    root.appendChild(V.dateBar(date, (d) => App.go('#/choice/' + d)));

    const cells = [];
    m.shokushu.forEach((sh) => meals.forEach((ml) => {
      if (Menu.cellDishes(rec, ml.id, sh.id).length || C.get(rec, ml.id, sh.id)) cells.push({ sh: sh, ml: ml });
    }));
    if (!cells.length) {
      root.appendChild(h('div', { class: 'empty' }, 'この日の献立がまだ入っていません。', ' ',
        h('a', { class: 'btn no-print', href: '#/menu/' + date }, '献立を開く')));
      return;
    }
    root.appendChild(h('div', { class: 'card info no-print' },
      '「選ぶ料理を決める」で 2〜' + C.MAX + ' 件の料理を置くと、下に聞き取り表が出ます。' +
      '刷って希望を聞き、戻ってきたらここで押してください。人数は調理指示と食札に出ます。'));

    cells.forEach((x) => {
      const key = Menu.cellKey(x.ml.id, x.sh.id);
      const ch = C.get(rec, x.ml.id, x.sh.id);
      const sec = h('section', { class: 'card' }, h('h2', null, x.sh.label + '　' + x.ml.label + (ch ? '　' + ch.label : '')));
      if (!ch) {
        sec.appendChild(h('div', { class: 'sub' }, 'この食事に選択メニューはありません。'));
        sec.appendChild(h('div', { class: 'toolrow no-print' }, h('button', { class: 'btn', onclick: () => C.edit(rec, x.ml.id, x.sh.id, dishMap) }, '選ぶ料理を決める')));
        root.appendChild(sec);
        return;
      }
      // 対象の人
      const cen = M.census(residents, { d: date, m: x.ml.id }, m);
      const rows = cen.rows.filter((r) => r.diet && r.diet.shokushu === x.sh.id)
        .sort((a, b) => (a.r.unit + a.r.room).localeCompare(b.r.unit + b.r.room, 'ja'));
      const t = C.tally(daily, x.ml.id, x.sh.id, ch.options);
      const count = t.apply(rows.map((r) => r.r.id));
      // 人数と栄養価
      sec.appendChild(h('table', { class: 'list bordered' },
        h('thead', null, h('tr', null, ['選ぶ料理', '人数', 'エネルギー', 'たんぱく質', '食塩'].map((tt) => h('th', null, tt)))),
        h('tbody', null, ch.options.map((o) => {
          const d = dishMap[o.dishId];
          const s = d ? Dishes.sumOf(d) : null;
          return h('tr', null, h('th', null, o.name || (d && d.name) || '？'),
            h('td', { class: 'num' }, count[o.id] + ' 人'),
            h('td', { class: 'num' }, s ? N.fmt('kcal', s.values.kcal) : '—'),
            h('td', { class: 'num' }, s ? N.fmt('prot', s.values.prot) : '—'),
            h('td', { class: 'num' }, s ? N.fmt('nacl', s.values.nacl) : '—'));
        }),
        count.none ? h('tr', { class: 'sub' }, h('th', null, 'まだ聞けていない'), h('td', { class: 'num warn-text' }, count.none + ' 人'),
          h('td'), h('td'), h('td')) : null)));
      // 聞き取り表（刷って使う。画面では押して入れる）
      sec.appendChild(h('div', { class: 'scroll-x' }, h('table', { class: 'list bordered' },
        h('thead', null, h('tr', null, [h('th', null, '場所'), h('th', null, '氏名')]
          .concat(ch.options.map((o) => h('th', null, o.name || '？'))))),
        h('tbody', null, rows.map((r) => {
          const cur = C.pickOf(daily, x.ml.id, x.sh.id, r.r.id);
          return h('tr', null, h('td', null, V.where(r.r)), h('td', null, r.r.name),
            ch.options.map((o) => h('td', { class: 'checkbox-cell' },
              h('button', { class: 'btn seg small no-print' + (cur === o.id ? ' on' : ''), onclick: async () => {
                const d2 = (await DB.get('daily', date)) || { date: date, extra: {} };
                d2.choice = d2.choice || {}; d2.choice[key] = d2.choice[key] || {};
                if (d2.choice[key][r.r.id] === o.id) delete d2.choice[key][r.r.id];
                else d2.choice[key][r.r.id] = o.id;
                await DB.put('daily', d2); App.refresh();
              } }, cur === o.id ? '○' : '　'),
              h('span', { class: 'print-only' }, cur === o.id ? '○' : '□'))));
        })))));
      sec.appendChild(h('div', { class: 'toolrow no-print' },
        h('button', { class: 'btn', onclick: () => C.edit(rec, x.ml.id, x.sh.id, dishMap) }, '選ぶ料理を直す'),
        h('button', { class: 'btn danger-outline', onclick: async () => {
          if (!await U.confirm('この食事の選択メニューをやめます。聞いた希望も消えます。', { okLabel: 'やめる', danger: true })) return;
          delete rec.choice[key]; await DB.put('menus', rec);
          const d2 = (await DB.get('daily', date)) || { date: date, extra: {} };
          if (d2.choice) { delete d2.choice[key]; await DB.put('daily', d2); }
          App.refresh();
        } }, 'やめる')));
      root.appendChild(sec);
    });
  });

  C.edit = function (rec, mealId, sId, dishMap) {
    const m = ms();
    const key = Menu.cellKey(mealId, sId);
    rec.choice = rec.choice || {};
    const ch = rec.choice[key] || { label: '主菜を選ぶ', options: [] };
    const label = h('input', { class: 'input', type: 'text', value: ch.label, placeholder: '例: 主菜を選ぶ' });
    const box = h('div');
    let close, redraw;
    redraw = function () {
      box.innerHTML = '';
      box.appendChild(ch.options.length ? h('table', { class: 'list edit' },
        h('thead', null, h('tr', null, ['料理', '聞き取り表に出す名前', ''].map((t) => h('th', null, t)))),
        h('tbody', null, ch.options.map((o, i) => {
          const nm = h('input', { class: 'input', type: 'text', value: o.name || '' });
          nm.addEventListener('change', () => { o.name = nm.value.trim(); });
          return h('tr', null, h('td', null, (dishMap[o.dishId] || { name: '？' }).name), h('td', null, nm),
            h('td', null, h('button', { class: 'btn small', onclick: () => { ch.options.splice(i, 1); redraw(); } }, '外す')));
        })))
        : h('div', { class: 'empty' }, 'まだありません。2 件以上えらんでください。'));
    };
    redraw();
    close = U.modal(h('div', null,
      h('h2', null, U.fmtDate(rec.date, true) + ' ' + M.label(m.meals, mealId) + '　' + M.label(m.shokushu, sId) + '　選択メニュー'),
      U.field('聞き方の見出し', label),
      box,
      h('div', { class: 'toolrow' }, h('button', { class: 'btn primary', onclick: async () => {
        if (ch.options.length >= C.MAX) { U.toast(C.MAX + ' 件までです', true); return; }
        const picked = await Dishes.pick({ multi: true });
        if (!picked || !picked.length) { redraw(); return; }
        picked.slice(0, C.MAX - ch.options.length).forEach((d) => ch.options.push({ id: U.uid('o'), dishId: d.id, name: d.name }));
        redraw();
      } }, '＋ 料理をえらぶ')),
      h('div', { class: 'modal-btns' }, h('button', { class: 'btn', onclick: () => close() }, 'やめる'),
        h('button', { class: 'btn primary', onclick: async () => {
          if (ch.options.length < 2) { U.toast('2 件以上えらんでください', true); return; }
          ch.label = label.value.trim() || '主菜を選ぶ';
          rec.choice[key] = ch;
          await DB.put('menus', rec); close(); App.refresh();
        } }, '決める'))), { wide: true });
  };

  // 食札に「その人が選んだ料理」を出せるようにする
  if (window.Cards && window.Cards.ITEMS) window.Cards.ITEMS.push({ id: 'choice', label: '選んだ料理',
    get: function (c) {
      const d = C.cardCache && C.cardCache[c.slot.d];
      if (!d) return '';
      const ch = d.rec && C.get(d.rec, c.slot.m, c.d.shokushu);
      if (!ch) return '';
      const pid = C.pickOf(d.daily, c.slot.m, c.d.shokushu, c.r.id);
      const o = ch.options.find((x) => x.id === pid);
      return o ? (o.name || '') : '未選択';
    } });
  // 食札を描く前に、その日の選択を読んでおく（card() は同期で呼ばれるため）
  C.preload = async function (date) {
    C.cardCache = C.cardCache || {};
    C.cardCache[date] = { rec: await Menu.get(date), daily: await C.picksOf(date) };
  };

  // ---- 嗜好調査 ----
  C.KIKOU = [
    { id: 'satis', label: '食事の満足度', kind: 'five', words: ['とても悪い', '悪い', 'ふつう', '良い', 'とても良い'] },
    { id: 'amount', label: '量', kind: 'five', words: ['少なすぎる', 'やや少ない', 'ちょうど良い', 'やや多い', '多すぎる'] },
    { id: 'taste', label: '味付け', kind: 'five', words: ['薄すぎる', 'やや薄い', 'ちょうど良い', 'やや濃い', '濃すぎる'] },
    { id: 'like', label: '好きな食べ物', kind: 'chips' },
    { id: 'dislike', label: '嫌いな食べ物', kind: 'chips' },
    { id: 'want', label: '食べたいもの・要望', kind: 'text' }
  ];

  App.registerScreen('kikou', async function (params, root) {
    const date = params[0] || U.today();
    const m = ms(), meals = M.activeMeals(m);
    const daily = (await DB.get('daily', date)) || { date: date, extra: {} };
    daily.kikou = daily.kikou || {};
    const residents = (await DB.residents()).filter((r) => !r.archived && M.status(r, date, m.meals) === 'in')
      .sort((a, b) => (a.unit + a.room).localeCompare(b.unit + b.room, 'ja'));

    root.appendChild(h('header', { class: 'topbar' }, h('h1', null, '嗜好調査　' + U.fmtDate(date, true)),
      h('div', { class: 'no-print' }, h('button', { class: 'btn', onclick: () => window.print() }, '印刷'))));
    root.appendChild(V.dateBar(date, (d) => App.go('#/kikou/' + d)));
    root.appendChild(h('div', { class: 'card info no-print' },
      '聞いた内容を人ごとに入れると、下にまとまります。結果は給食会議で検討して献立に反映する決まりです。' +
      '空のまま刷れば、配って書いてもらう紙になります。'));

    const save = async () => { await DB.put('daily', daily); };
    residents.forEach((r) => {
      const v = daily.kikou[r.id] = daily.kikou[r.id] || {};
      const box = h('div', { class: 'grid2' });
      C.KIKOU.forEach((f) => {
        if (f.kind === 'five') {
          const row = h('div', { class: 'segrow' });
          f.words.forEach((w, i) => {
            const b = h('button', { type: 'button', class: 'btn seg small' + (v[f.id] === i + 1 ? ' on' : ''), onclick: async () => {
              v[f.id] = (v[f.id] === i + 1 ? 0 : i + 1);
              Array.prototype.forEach.call(row.children, (el, j) => el.classList.toggle('on', v[f.id] === j + 1));
              await save();
            } }, w);
            row.appendChild(b);
          });
          box.appendChild(U.field(f.label, row));
        } else if (f.kind === 'chips') {
          const ed = U.chipList(v[f.id] || [], [], '入力して Enter', async (list) => { v[f.id] = list; await save(); });
          box.appendChild(U.field(f.label, ed));
        } else {
          const el = h('input', { class: 'input', type: 'text', value: v[f.id] || '' });
          el.addEventListener('change', async () => { v[f.id] = el.value.trim(); await save(); });
          box.appendChild(U.field(f.label, el));
        }
      });
      root.appendChild(h('section', { class: 'card' }, h('h2', null, V.where(r) + '　' + V.sama(r.name)), box));
    });

    // まとめ
    root.appendChild(C.summary(daily.kikou, residents));
  });

  C.summary = function (kikou, residents) {
    const answered = residents.filter((r) => { const v = kikou[r.id]; return v && Object.keys(v).some((k) => v[k] && (!Array.isArray(v[k]) || v[k].length)); });
    const sec = h('section', { class: 'card' }, h('h2', null, 'まとめ'),
      h('div', { class: 'sub' }, residents.length + ' 人中 ' + answered.length + ' 人ぶん'));
    C.KIKOU.filter((f) => f.kind === 'five').forEach((f) => {
      const dist = [0, 0, 0, 0, 0];
      let sum = 0, n = 0;
      answered.forEach((r) => { const x = kikou[r.id][f.id]; if (x) { dist[x - 1]++; sum += x; n++; } });
      if (!n) return;
      sec.appendChild(h('div', null, h('b', null, f.label + '　平均 ' + (sum / n).toFixed(1)),
        h('div', { class: 'histo' }, f.words.map((w, i) => h('div', { class: 'hbar' },
          h('span', { class: 'hlabel' }, w), h('span', { class: 'hfill', style: 'width:' + (dist[i] / n * 60) + '%' }), h('span', null, dist[i] + '人'))))));
    });
    C.KIKOU.filter((f) => f.kind === 'chips').forEach((f) => {
      const count = {};
      answered.forEach((r) => (kikou[r.id][f.id] || []).forEach((w) => { count[w] = (count[w] || 0) + 1; }));
      const keys = Object.keys(count).sort((a, b) => count[b] - count[a]);
      if (!keys.length) return;
      sec.appendChild(h('div', null, h('b', null, f.label), ' ',
        keys.map((k) => h('span', { class: 'tag' }, k + ' ' + count[k]))));
    });
    const wants = answered.map((r) => ({ r: r, t: kikou[r.id].want })).filter((x) => x.t);
    if (wants.length) sec.appendChild(h('div', null, h('b', null, '要望'),
      h('ul', null, wants.map((x) => h('li', null, x.t + '（' + x.r.name + '）')))));
    return sec;
  };

  App.registerNav({ order: 70.5, feature: 'menu', label: '選択', icon: '🍱', hash: '#/choice', match: ['choice'] });
  App.registerNav({ order: 77.5, feature: 'reports', label: '嗜好', icon: '💬', hash: '#/kikou', match: ['kikou'] });
  window.Choice = C;
})();
