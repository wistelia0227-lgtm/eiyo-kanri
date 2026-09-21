// 献立（削除可能）: 日付×食事×食種に料理を並べ、1 食・1 日の栄養価を出して目標量と見比べる。
// menus ストア: { date, cells: { '食事ID/食種ID': [{dishId, name, x}] } } … x = 何人分（0.5 で半量）
// 給与栄養目標量は「今いる人」から出して master.targets に保存する。
(function () {
  'use strict';
  const U = window.U, h = U.h, DB = window.DB, M = window.Model, N = window.Nutri, V = window.View;
  const Foods = window.Foods, Dishes = window.Dishes, App = window.App;
  const ms = () => window.Master.current;
  const Menu = {};
  let shokushu = '', span = 7;

  Menu.cellKey = (mealId, sId) => mealId + '/' + sId;
  Menu.get = async function (date) { return (await DB.get('menus', date)) || { date: date, cells: {} }; };
  Menu.cellDishes = function (rec, mealId, sId) { return (rec.cells && rec.cells[Menu.cellKey(mealId, sId)]) || []; };
  // 1 食分の栄養価
  Menu.sumCell = function (list, dishMap) {
    let s = N.empty();
    (list || []).forEach((c) => {
      const d = dishMap[c.dishId];
      if (!d) return;
      s = N.add(s, N.scale(Dishes.sumOf(d), Number(c.x) || 1));
    });
    return s;
  };
  Menu.sumDay = function (rec, meals, sId, dishMap) {
    let s = N.empty();
    meals.forEach((ml) => { s = N.add(s, Menu.sumCell(Menu.cellDishes(rec, ml.id, sId), dishMap)); });
    return s;
  };
  // 使われている料理に含まれるアレルギー品目
  Menu.allergensOf = function (list, dishMap) {
    const out = [];
    (list || []).forEach((c) => { const d = dishMap[c.dishId]; if (d) d.allergy.forEach((a) => { if (out.indexOf(a) < 0) out.push(a); }); });
    return out;
  };

  // 目標量（食種ごと）。無ければ null
  Menu.targetOf = function (sId) {
    const t = (ms().targets || {})[sId];
    if (!t) return null;
    return N.dailyTarget({ age: t.age, sex: t.sex, energy: t.energy });
  };

  // ---- 給与栄養目標量を今いる人から出す ----
  Menu.targetDialog = async function (sId) {
    const m = ms(), today = U.today();
    const residents = (await DB.residents()).filter((r) => !r.archived && M.status(r, today, m.meals) === 'in');
    const weights = {};
    (await DB.getAll('measures')).forEach((x) => { if (x.kind === 'weight') { const p = weights[x.residentId]; if (!p || p.date < x.date) weights[x.residentId] = x; } });
    const palIndex = 0;
    const people = [], rows = [];
    residents.forEach((r) => {
      const age = M.age(r.birth, today), w = weights[r.id] ? weights[r.id].value : null;
      const sex = r.gender === 'm' ? 'm' : 'f';
      const e = (age != null && w) ? N.energyNeed({ age: age, sex: sex, weightKg: w, palIndex: palIndex }) : null;
      if (e) people.push({ age: age, sex: sex, weightKg: w, palIndex: palIndex });
      rows.push({ r: r, age: age, w: w, sex: sex, e: e });
    });
    const gt = N.groupTarget(people);
    const missing = rows.filter((x) => !x.e);
    let close;
    const chosen = h('input', { class: 'input num', type: 'number', step: '50', value: gt ? gt.mode : 1500 });
    const ageIn = h('input', { class: 'input num', type: 'number', value: rows.length ? Math.round(rows.filter((x) => x.age != null).reduce((s, x) => s + x.age, 0) / Math.max(1, rows.filter((x) => x.age != null).length)) : 80 });
    const sexIn = U.select([{ id: 'f', label: '女' }, { id: 'm', label: '男' }], rows.filter((x) => x.sex === 'm').length > rows.length / 2 ? 'm' : 'f', { noEmpty: true });
    const preview = h('div');
    const drawPreview = () => {
      const dt = N.dailyTarget({ age: parseInt(ageIn.value, 10) || 80, sex: sexIn.value, energy: parseInt(chosen.value, 10) || 0 });
      preview.innerHTML = '';
      preview.appendChild(h('div', { class: 'sub' }, '1 日の目標（' + N.DRI_VERSION + '、' + (dt.band ? dt.band.label : '') + '）'));
      preview.appendChild(Foods.sumRow({ values: Object.keys(dt.target).reduce((o, k) => { o[k] = dt.target[k][0] != null ? dt.target[k][0] : dt.target[k][1]; return o; }, {}), missing: {} },
        Object.keys(dt.target).filter((k) => N.key[k] != null)));
    };
    [chosen, ageIn, sexIn].forEach((el) => el.addEventListener('change', drawPreview));
    drawPreview();

    close = U.modal(h('div', null, h('h2', null, '給与栄養目標量を出す　' + M.label(m.shokushu, sId)),
      h('div', { class: 'sub' }, '今いる ' + residents.length + ' 人の年齢・性別・体重から、推定エネルギー必要量（基礎代謝基準値×体重×身体活動レベル）を出して 50kcal 単位に丸めました。手順は横浜市の手引きに沿っています。'),
      gt ? h('div', { class: 'card' },
        h('div', null, '人数 ' + gt.list.length + ' 人　最頻値 ' + gt.mode + ' kcal　荷重平均 ' + gt.mean + ' kcal　幅 ' + gt.min + '〜' + gt.max + ' kcal'),
        h('div', { class: 'histo' }, Object.keys(gt.dist).sort((a, b) => a - b).map((k) => h('div', { class: 'hbar' },
          h('span', { class: 'hlabel' }, k), h('span', { class: 'hfill', style: 'width:' + (gt.dist[k] / gt.list.length * 100) + '%' }), h('span', null, gt.dist[k] + '人')))),
        gt.spread > 400 ? h('div', { class: 'sub warn-text' }, '幅が ' + gt.spread + ' kcal あります。食種を分けるか、主食の量で調整することを考えてください（目安は ±200kcal）。') : null)
        : h('div', { class: 'card warn' }, '体重と生年月日がそろっている人がいないので、計算できません。'),
      missing.length ? h('div', { class: 'sub' }, '計算に入っていない人（体重か生年月日が無い）: ' + missing.map((x) => x.r.name).join('、')) : null,
      h('div', { class: 'grid3' }, U.field('この食種の目標エネルギー (kcal)', chosen), U.field('代表の年齢', ageIn, '他の栄養素の基準に使います'), U.field('代表の性別', sexIn)),
      preview,
      h('div', { class: 'modal-btns' }, h('button', { class: 'btn', onclick: () => close() }, 'やめる'),
        h('button', { class: 'btn primary', onclick: async () => {
          m.targets = m.targets || {};
          m.targets[sId] = { energy: parseInt(chosen.value, 10) || 0, age: parseInt(ageIn.value, 10) || 80, sex: sexIn.value, setAt: U.today() };
          await window.Master.save(); close(); U.toast('目標量を保存しました'); App.refresh();
        } }, 'この食種の目標にする'))), { wide: true });
  };

  // ---- セルの編集 ----
  // その食事に出る物を表す言葉（料理名・材料名・料理のアレルギー品目）
  Menu.wordsOf = function (list, dishMap) {
    const w = [];
    (list || []).forEach((c) => {
      const d = dishMap[c.dishId];
      if (!d) { if (c.name) w.push(c.name); return; }
      w.push(d.name);
      d.items.forEach((it) => { if (it.name) w.push(it.name); });
      d.allergy.forEach((a) => w.push(a));
    });
    return w;
  };

  async function editCell(date, mealId, sId, dishMap, residentsCache) {
    const rec = await Menu.get(date);
    const key = Menu.cellKey(mealId, sId);
    const m = ms();
    let close, redraw;
    const box = h('div'), sumBox = h('div');
    const list = () => (rec.cells[key] = rec.cells[key] || []);
    const save = async () => { await DB.put('menus', rec); };
    redraw = function () {
      const l = list();
      box.innerHTML = '';
      box.appendChild(l.length ? h('table', { class: 'list edit' },
        h('thead', null, h('tr', null, ['料理', '人数分', 'エネルギー', 'たんぱく質', '食塩', ''].map((t) => h('th', null, t)))),
        h('tbody', null, l.map((c, i) => {
          const d = dishMap[c.dishId];
          const s = d ? N.scale(Dishes.sumOf(d), Number(c.x) || 1) : null;
          return h('tr', null,
            h('td', null, d ? d.name : h('span', { class: 'bad-text' }, '消された料理'), d && d.allergy.length ? h('span', { class: 'tag bad' }, d.allergy.join('・')) : null),
            h('td', null, h('input', { class: 'input num', type: 'number', step: '0.1', min: '0', value: c.x == null ? 1 : c.x,
              onchange: async (e) => { c.x = parseFloat(e.target.value); await save(); redraw(); } })),
            h('td', null, s ? N.fmt('kcal', s.values.kcal) : '—'), h('td', null, s ? N.fmt('prot', s.values.prot) : '—'), h('td', null, s ? N.fmt('nacl', s.values.nacl) : '—'),
            h('td', null, h('button', { class: 'btn small', onclick: async () => { l.splice(i, 1); await save(); redraw(); } }, '外す')));
        }))) : h('div', { class: 'empty' }, 'まだ料理がありません。'));
      const s = Menu.sumCell(l, dishMap);
      sumBox.innerHTML = '';
      sumBox.appendChild(h('div', null, h('b', null, 'この食事の合計'), Foods.sumRow(s, Foods.shownKeys())));
      // 禁食・アレルギーに当たる人（献立と禁食一覧を人が突き合わせなくて済むように）
      const words = Menu.wordsOf(l, dishMap);
      const hitRows = M.restrictionsAt(residentsCache, { d: date, m: mealId }, m, words);
      if (hitRows.length) sumBox.appendChild(h('div', { class: 'card warn' },
        h('b', null, 'この食事が当たる人（' + hitRows.length + '人）'),
        h('table', { class: 'list' }, h('tbody', null, hitRows.map((x) => h('tr', null,
          h('td', null, V.where(x.r) + ' ' + x.r.name),
          h('td', null, x.hits.map((hh) => h('div', { class: hh.kind === 'allergy' ? 'bad-text' : 'warn-text' },
            (hh.kind === 'allergy' ? 'アレルギー ' : '禁食 ') + hh.word + '（' + hh.where.join('・') + '）' + (hh.sub ? ' → ' + hh.sub : '')))),
          h('td', { class: 'no-print' }, h('a', { class: 'btn small', href: '#/resident/' + x.r.id }, '開く')))))),
        h('div', { class: 'sub' }, '料理名・材料名・料理に付けたアレルギー品目との名前の一致で拾っています。加工品など名前に出ないものは漏れます。')));
      else if (l.length) sumBox.appendChild(h('div', { class: 'sub' }, '禁食・アレルギーに当たる人はいません（名前の一致で確認）。'));
    };
    redraw();
    close = U.modal(h('div', null,
      h('h2', null, U.fmtDate(date, true) + ' ' + M.label(m.meals, mealId) + '　' + M.label(m.shokushu, sId)),
      box, sumBox,
      h('div', { class: 'toolrow' },
        h('button', { class: 'btn primary', onclick: async () => {
          const d = await Dishes.pick();
          if (!d) { redraw(); return; }
          list().push({ dishId: d.id, name: d.name, x: 1 }); await save(); redraw();
        } }, '＋ 料理を足す'),
        h('button', { class: 'btn', onclick: async () => {
          const from = prompt('どの日からうつしますか（YYYY-MM-DD）', M.addDays(date, -7));
          if (!from) return;
          const src = await Menu.get(from);
          const l = (src.cells || {})[key] || [];
          if (!l.length) { U.toast('その日のこの食事には料理がありません', true); return; }
          rec.cells[key] = JSON.parse(JSON.stringify(l)); await save(); redraw();
        } }, '別の日からうつす')),
      h('div', { class: 'modal-btns' }, h('button', { class: 'btn primary', onclick: () => { close(); App.refresh(); } }, '閉じる'))), { wide: true });
  }

  // ---- 献立の画面 ----
  App.registerScreen('menu', async function (params, root) {
    const m = ms(), meals = M.activeMeals(m), today = U.today();
    const start = params[0] || today;
    const sId = shokushu || (m.shokushu[0] && m.shokushu[0].id);
    const dishMap = {};
    (await Dishes.all()).forEach((d) => { dishMap[d.id] = d; });
    const days = []; for (let i = 0; i < span; i++) days.push(M.addDays(start, i));
    const recs = {};
    for (const d of days) recs[d] = await Menu.get(d);
    const tgt = Menu.targetOf(sId);
    const residents = await DB.residents();
    // マスごとに「禁食・アレルギーに当たる人がいるか」を先に数える
    const warnDays = {};
    days.forEach((d) => meals.forEach((ml) => {
      const l = Menu.cellDishes(recs[d], ml.id, sId);
      if (!l.length) return;
      const n = M.restrictionsAt(residents, { d: d, m: ml.id }, m, Menu.wordsOf(l, dishMap)).length;
      if (n) warnDays[d + '/' + ml.id] = n;
    }));

    root.appendChild(h('header', { class: 'topbar' }, h('h1', null, '献立　' + U.fmtDate(start, true) + ' 〜 ' + U.fmtDate(days[days.length - 1])),
      h('div', { class: 'no-print' }, h('button', { class: 'btn', onclick: () => window.print() }, '印刷'), ' ',
        h('a', { class: 'btn', href: '#/dishes' }, '料理マスタ'))));
    root.appendChild(h('div', { class: 'toolrow no-print' },
      h('button', { class: 'btn', onclick: () => App.go('#/menu/' + M.addDays(start, -span)) }, '◀ 前'),
      h('button', { class: 'btn', onclick: () => App.go('#/menu/' + today) }, '今日から'),
      h('button', { class: 'btn', onclick: () => App.go('#/menu/' + M.addDays(start, span)) }, '次 ▶'),
      [7, 14].map((k) => h('button', { class: 'btn seg' + (span === k ? ' on' : ''), onclick: () => { span = k; App.refresh(); } }, k + '日')),
      h('span', { class: 'gap' }),
      h('span', { class: 'sub' }, '食種'),
      U.select(m.shokushu, sId, { noEmpty: true, onchange: (e) => { shokushu = e.target.value; App.refresh(); } })));

    // 目標量
    root.appendChild(h('div', { class: 'card' + (tgt ? '' : ' warn') },
      tgt ? h('div', null, h('b', null, M.label(m.shokushu, sId) + ' の 1 日の目標: '), tgt.energy + ' kcal　',
        h('span', { class: 'sub' }, 'たんぱく質 ' + tgt.target.prot[0] + '〜' + tgt.target.prot[1] + 'g　脂質 ' + tgt.target.fat[0] + '〜' + tgt.target.fat[1] + 'g　食塩 ' + (tgt.target.nacl[1] || '—') + 'g 未満　（' + N.DRI_VERSION + '）'),
        ' ', h('button', { class: 'btn small no-print', onclick: () => Menu.targetDialog(sId) }, '出し直す'))
        : h('div', null, 'この食種の給与栄養目標量がまだありません。', ' ',
          h('button', { class: 'btn no-print', onclick: () => Menu.targetDialog(sId) }, '今いる人から出す'))));

    // 表（日付展開: 行=食事、列=日）
    const table = h('table', { class: 'grid menu' },
      h('thead', null, h('tr', null, h('th'), days.map((d) => h('th', { class: (d === today ? 'today ' : '') + ([0, 6].indexOf(M.weekday(d)) >= 0 ? 'weekend' : '') }, U.fmtDate(d))))),
      h('tbody', null,
        meals.map((ml) => h('tr', null, h('th', null, ml.label),
          days.map((d) => {
            const l = Menu.cellDishes(recs[d], ml.id, sId);
            const s = Menu.sumCell(l, dishMap);
            const alg = Menu.allergensOf(l, dishMap);
            return h('td', { class: 'menucell' + (warnDays[d + '/' + ml.id] ? ' hit' : ''), onclick: () => editCell(d, ml.id, sId, dishMap, residents) },
              l.length ? h('div', null, l.map((c) => h('div', { class: 'mdish' }, (dishMap[c.dishId] || { name: c.name }).name + ((c.x != null && c.x !== 1) ? ' ×' + c.x : ''))),
                h('div', { class: 'msum' }, N.fmt('kcal', s.values.kcal) + 'kcal　食塩' + N.fmt('nacl', s.values.nacl) + 'g'),
                alg.length ? h('div', { class: 'tag bad' }, alg.join('・')) : null,
                warnDays[d + '/' + ml.id] ? h('div', { class: 'tag bad' }, '当たる人 ' + warnDays[d + '/' + ml.id] + '人') : null)
              : h('span', { class: 'sub no-print' }, '＋'));
          }))),
        // 1 日の合計
        h('tr', { class: 'total' }, h('th', null, '1日'), days.map((d) => {
          const s = Menu.sumDay(recs[d], meals, sId, dishMap);
          const keys = Foods.shownKeys();
          return h('td', null, keys.map((k) => {
            const j = tgt ? N.judge(tgt.target, k, s.values[k]) : null;
            return h('div', { class: j ? 'j-' + j : '' }, Foods.nutrient(k).name + ' ' + N.fmt(k, s.values[k]));
          }));
        }))));
    root.appendChild(h('div', { class: 'scroll-x' }, table));
    if (!Object.keys(dishMap).length && window.Seed && window.Seed.available()) root.appendChild(h('div', { class: 'card info no-print' },
      '料理がまだありません。初期データを入れると、料理 ' + window.Seed.count() + ' 件と ' + window.Seed.cycleDays() + ' 日分のサイクル献立がすぐ使えます。 ',
      h('button', { class: 'btn primary', onclick: () => window.Seed.dialog() }, '初期データを入れる')));
    root.appendChild(h('div', { class: 'sub' }, '青＝目標の下限より少ない　赤＝上限より多い。マスを押すと料理を足せます。'));

    // 期間の平均（栄養出納の代わり）
    let total = N.empty(), filled = 0;
    days.forEach((d) => {
      const has = meals.some((ml) => Menu.cellDishes(recs[d], ml.id, sId).length);
      if (!has) return; // 献立を入れていない日は平均に入れない
      filled++;
      total = N.add(total, Menu.sumDay(recs[d], meals, sId, dishMap));
    });
    const avg = N.scale(total, 1 / Math.max(1, filled));
    root.appendChild(h('section', { class: 'card' }, h('h2', null, '献立が入っている ' + filled + ' 日の 1 日平均'),
      tgt ? Foods.targetTable(avg, tgt.target, Foods.shownKeys()) : Foods.sumRow(avg, Foods.shownKeys())));
    // 同じ料理の繰り返し
    const count = {};
    days.forEach((d) => meals.forEach((ml) => Menu.cellDishes(recs[d], ml.id, sId).forEach((c) => { count[c.dishId] = (count[c.dishId] || 0) + 1; })));
    const dup = Object.keys(count).filter((k) => count[k] > 1).sort((a, b) => count[b] - count[a]);
    if (dup.length) root.appendChild(h('div', { class: 'card' }, h('b', null, 'この期間に 2 回以上出る料理: '),
      dup.map((k) => h('span', { class: 'tag' }, (dishMap[k] || { name: '？' }).name + ' ' + count[k] + '回'))));
  });

  App.registerNav({ order: 70, feature: 'menu', label: '献立', icon: '📅', hash: '#/menu', match: ['menu'] });
  window.Menu = Menu;
})();
