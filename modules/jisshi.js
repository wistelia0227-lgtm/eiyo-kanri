// 実施献立表と残食（喫食）調査（削除可能）。
// 予定献立表は計画書、実施献立表は「実際に何を出したか」。食材が変わったら訂正して保存する決まり
// （横浜市の手引きの帳票一覧・調査 02 の 5.2。実施献立表の項目は 実施年月日・食種別・朝昼夕の献立名・食品名・数量）。
// 残食（喫食）調査は「毎食ごと、料理ごと」に取るのが望ましいとされる。ここは料理ごとの残食率（%）で持つ。
// 残食率から「推定摂取栄養量」が出る。栄養管理報告書が聞いてくるのは提供量だけでなく推定摂取量でもある。
(function () {
  'use strict';
  const U = window.U, h = U.h, DB = window.DB, M = window.Model, N = window.Nutri, V = window.View;
  const Foods = window.Foods, Dishes = window.Dishes, Menu = window.Menu, App = window.App;
  const ms = () => window.Master.current;
  const J = {};

  // 残食率の押しやすい目盛り。給食日誌の「多・普通・少」より細かく、%で持つ
  J.STEPS = [0, 10, 30, 50, 70, 100];
  J.stepLabel = (p) => p === 0 ? '完食' : (p === 100 ? '全残' : p + '%');

  J.save = (rec) => DB.put('menus', rec);

  App.registerScreen('jisshi', async function (params, root) {
    const date = params[0] || U.today();
    const m = ms(), meals = M.activeMeals(m);
    const rec = await Menu.get(date);
    const dishMap = {};
    (await Dishes.all()).forEach((d) => { dishMap[d.id] = d; });
    const residents = await DB.residents();

    root.appendChild(h('header', { class: 'topbar' }, h('h1', null, '実施献立表・残食調査　' + U.fmtDate(date, true)),
      h('div', { class: 'no-print' }, h('button', { class: 'btn', onclick: () => window.print() }, '印刷'), ' ',
        h('a', { class: 'btn', href: '#/kondate/' + date }, '予定献立表'), ' ',
        h('a', { class: 'btn', href: '#/menu/' + date }, '献立を直す'))));
    root.appendChild(V.dateBar(date, (d) => App.go('#/jisshi/' + d)));

    const used = [];
    m.shokushu.forEach((sh) => {
      const cells = meals.filter((ml) => Menu.cellDishes(rec, ml.id, sh.id).length || Menu.hasActual(rec, ml.id, sh.id));
      if (cells.length) used.push({ sh: sh, cells: cells });
    });
    if (!used.length) {
      root.appendChild(h('div', { class: 'empty' }, 'この日の献立がまだ入っていません。', ' ',
        h('a', { class: 'btn no-print', href: '#/menu/' + date }, '献立を開く')));
      return;
    }
    root.appendChild(h('div', { class: 'card info no-print' },
      '予定どおりに出した所は何もしなくて構いません。食材や料理を変えた所だけ「実施を直す」を押してください。' +
      '残食率を入れると、下に推定摂取栄養量が出ます。'));

    used.forEach((row) => {
      const sec = h('section', { class: 'card' }, h('h2', null, row.sh.label));
      row.cells.forEach((ml) => {
        const key = Menu.cellKey(ml.id, row.sh.id);
        const n = M.census(residents, { d: date, m: ml.id }, m).byShokushu[row.sh.id] || 0;
        const box = h('div', { class: 'card sub-card' });
        const draw = () => {
          const plan = Menu.cellDishes(rec, ml.id, row.sh.id);
          const act = Menu.actualDishes(rec, ml.id, row.sh.id);
          const diff = Menu.hasActual(rec, ml.id, row.sh.id);
          box.innerHTML = '';
          box.appendChild(h('h3', null, ml.label + '　' + n + ' 食',
            diff ? h('span', { class: 'tag bad' }, '予定と違う') : h('span', { class: 'tag' }, '予定どおり')));
          box.appendChild(h('table', { class: 'list bordered' },
            h('thead', null, h('tr', null, ['出した料理', '人数分', '残食率', '食べられた分'].map((t) => h('th', null, t)))),
            h('tbody', null, act.map((c) => {
              const d = dishMap[c.dishId];
              const p = Menu.leftOf(rec, ml.id, row.sh.id, c.dishId);
              const eaten = d ? N.scale(Dishes.sumOf(d), (c.x == null ? 1 : Number(c.x)) * (p == null ? 1 : Math.max(0, 1 - p / 100))) : null;
              const inPlan = plan.some((x) => x.dishId === c.dishId);
              return h('tr', null,
                h('td', null, d ? d.name : (c.name || '消された料理'),
                  inPlan ? null : h('span', { class: 'tag bad' }, '差し替え')),
                h('td', { class: 'num' }, c.x == null ? 1 : c.x),
                h('td', { class: 'no-print-border' }, h('div', { class: 'segrow' }, J.STEPS.map((s) => h('button', {
                  type: 'button', class: 'btn seg small' + (p === s ? ' on' : ''),
                  onclick: async () => {
                    rec.left = rec.left || {}; rec.left[key] = rec.left[key] || {};
                    if (rec.left[key][c.dishId] === s) delete rec.left[key][c.dishId];
                    else rec.left[key][c.dishId] = s;
                    await J.save(rec); draw();
                  } }, J.stepLabel(s))))),
                h('td', null, eaten ? N.fmt('kcal', eaten.values.kcal) + ' kcal' : '—'));
            }),
            // 予定にあって実施に無い料理（出さなかったもの）
            plan.filter((x) => !act.some((y) => y.dishId === x.dishId)).map((x) => h('tr', { class: 'sub' },
              h('td', null, (dishMap[x.dishId] || { name: x.name }).name, h('span', { class: 'tag bad' }, '出さなかった')),
              h('td', { class: 'num' }, '—'), h('td', null, ''), h('td', null, '—'))))));
          const note = h('input', { class: 'input', type: 'text', value: (rec.actualNote && rec.actualNote[key]) || '',
            placeholder: '変えた理由（例: 鮭が入らずカレイに差し替え）' });
          note.addEventListener('change', async () => {
            rec.actualNote = rec.actualNote || {};
            rec.actualNote[key] = note.value.trim();
            await J.save(rec);
          });
          box.appendChild(U.field('実施の記録', note));
          box.appendChild(h('div', { class: 'toolrow no-print' },
            h('button', { class: 'btn', onclick: () => J.editActual(rec, ml.id, row.sh.id, dishMap, draw) }, '実施を直す'),
            diff ? h('button', { class: 'btn', onclick: async () => {
              if (!await U.confirm('実施を消して、予定のとおりに戻します。', { okLabel: '戻す' })) return;
              delete rec.actual[key]; await J.save(rec); draw();
            } }, '予定のとおりに戻す') : null,
            h('button', { class: 'btn', onclick: async () => {
              rec.left = rec.left || {}; rec.left[key] = {};
              act.forEach((c) => { rec.left[key][c.dishId] = 0; });
              await J.save(rec); draw();
            } }, '全部 完食にする')));
        };
        draw();
        sec.appendChild(box);
      });
      // その食種の 1 日分（予定・実施・推定摂取）
      const tgt = window.Menu.targetOf(row.sh.id);
      const keys = Foods.shownKeys();
      const sums = Menu.MODES.map((md) => ({ md: md, s: Menu.sumDay(rec, meals, row.sh.id, dishMap, md.id) }));
      sec.appendChild(h('div', { class: 'scroll-x' }, h('table', { class: 'list bordered' },
        h('thead', null, h('tr', null, [h('th', null, '1 日分')].concat(keys.map((k) => h('th', null, Foods.nutrient(k).name))))),
        h('tbody', null, sums.map((x) => h('tr', null, h('th', null, x.md.label),
          keys.map((k) => {
            const j = (tgt && x.md.id !== 'eaten') ? N.judge(tgt.target, k, x.s.values[k]) : null;
            return h('td', { class: j ? 'j-' + j : '' }, N.fmt(k, x.s.values[k]));
          })))))));
      const pk = sums[0].s.values.kcal, ek = sums[2].s.values.kcal;
      if (pk) sec.appendChild(h('div', { class: 'sub' }, '推定摂取は「実施 × (1 − 残食率)」です。残食率を入れていない料理は完食として数えません（残食率なし＝そのまま）。' +
        '　摂取／提供 = ' + Math.round(ek / pk * 100) + ' %'));
      root.appendChild(sec);
    });
  });

  // 実施の料理を直す（予定を写して、そこから足し引きする）
  J.editActual = function (rec, mealId, sId, dishMap, done) {
    const key = Menu.cellKey(mealId, sId);
    const m = ms();
    rec.actual = rec.actual || {};
    if (!rec.actual[key]) rec.actual[key] = JSON.parse(JSON.stringify(Menu.cellDishes(rec, mealId, sId)));
    const list = rec.actual[key];
    const box = h('div');
    let close, redraw;
    redraw = function () {
      box.innerHTML = '';
      box.appendChild(list.length ? h('table', { class: 'list edit' },
        h('thead', null, h('tr', null, ['料理', '人数分', ''].map((t) => h('th', null, t)))),
        h('tbody', null, list.map((c, i) => h('tr', null,
          h('td', null, (dishMap[c.dishId] || { name: c.name }).name),
          h('td', null, h('input', { class: 'input num', type: 'number', step: '0.1', min: '0', value: c.x == null ? 1 : c.x,
            onchange: async (e) => { c.x = parseFloat(e.target.value); await J.save(rec); } })),
          h('td', null, h('button', { class: 'btn small', onclick: async () => { list.splice(i, 1); await J.save(rec); redraw(); } }, '外す'))))))
        : h('div', { class: 'empty' }, 'この食事は出さなかったことになります。'));
    };
    redraw();
    close = U.modal(h('div', null,
      h('h2', null, U.fmtDate(rec.date, true) + ' ' + M.label(m.meals, mealId) + '　' + M.label(m.shokushu, sId) + '　実施'),
      h('div', { class: 'sub' }, '予定を写してあります。実際に出した形に直してください。予定はそのまま残ります。'),
      box,
      h('div', { class: 'toolrow' }, h('button', { class: 'btn primary', onclick: async () => {
        const picked = await Dishes.pick({ multi: true });
        if (!picked || !picked.length) { redraw(); return; }
        picked.forEach((d) => list.push({ dishId: d.id, name: d.name, x: 1 }));
        await J.save(rec); redraw();
      } }, '＋ 料理を足す')),
      h('div', { class: 'modal-btns' }, h('button', { class: 'btn primary', onclick: async () => { await J.save(rec); close(); done(); } }, '閉じる'))), { wide: true });
  };

  // 今日やること: 昨日までで残食を入れていない日
  App.registerTodo(async function (ctx) {
    const m = ms(), meals = M.activeMeals(m);
    const y = M.addDays(ctx.today, -1);
    const rec = await Menu.get(y);
    const cells = [];
    m.shokushu.forEach((sh) => meals.forEach((ml) => {
      if (!Menu.cellDishes(rec, ml.id, sh.id).length) return;
      const l = rec.left && rec.left[Menu.cellKey(ml.id, sh.id)];
      if (!l || !Object.keys(l).length) cells.push(sh.label + ' ' + ml.label);
    }));
    if (!cells.length) return [];
    return [{ level: 'info', text: '昨日の残食がまだ: ' + cells.slice(0, 4).join('・') + (cells.length > 4 ? ' ほか' : ''),
      href: '#/jisshi/' + y }];
  });

  App.registerNav({ order: 42, group: '献立と食材', feature: 'menu', label: '実施', icon: '✅', hash: '#/jisshi', match: ['jisshi'] });
  window.Jisshi = J;
})();
