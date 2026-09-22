// 初期データの取り込み（削除可能）: 料理 75 件と 2 週間のサイクル献立。
// 市販ソフトが「導入初日から使える」ように料理サンプルを積んでいるのに合わせた（調査 05 Z-15）。
// データは js/dishes_seed.js（tools/make_dishes.py で作る）。材料は成分表の食品番号なので、そのまま栄養価が出る。
(function () {
  'use strict';
  const U = window.U, h = U.h, DB = window.DB, M = window.Model, App = window.App;
  const ms = () => window.Master.current;
  const S = {};
  const seed = () => window.DISHES_SEED || null;

  S.available = () => !!seed();
  S.count = () => (seed() ? seed().dishes.length : 0);
  S.cycleDays = () => (seed() && seed().cycle ? seed().cycle.length : 0);

  // 料理を入れる。同じ名前があれば飛ばす（上書きしない）
  S.importDishes = async function () {
    const sd = seed();
    if (!sd) throw new Error('初期データが読み込まれていません（js/dishes_seed.js）');
    const have = {};
    (await window.Dishes.all()).forEach((d) => { have[d.name] = d; });
    const add = [], skip = [];
    sd.dishes.forEach((d) => {
      if (have[d.name]) { skip.push(d.name); return; }
      add.push({ id: U.uid('d'), name: d.name, kana: '', kind: d.kind, main: d.main || '', method: d.method || '', servings: 1,
        items: d.items.map((i) => ({ no: i.no, name: i.name, g: i.g })),
        allergy: d.allergy.slice(), memo: d.memo || '', seeded: true, updatedAt: Date.now() });
    });
    if (add.length) await DB.putMany('dishes', add);
    // 料理の区分をマスタに足す
    const m = ms();
    const kinds = m.dishKinds || [];
    sd.dishes.forEach((d) => { if (d.kind && kinds.indexOf(d.kind) < 0) kinds.push(d.kind); });
    m.dishKinds = kinds;
    await window.Master.save();
    return { added: add.length, skipped: skip.length };
  };

  // サイクル献立を入れる。start から 14 日分、指定した食種に。既に料理が入っているマスは触らない
  S.importCycle = async function (start, sId, overwrite) {
    const sd = seed();
    if (!sd || !sd.cycle) throw new Error('サイクル献立の初期データがありません');
    const m = ms(), meals = M.activeMeals(m);
    const byName = {};
    (await window.Dishes.all()).forEach((d) => { if (!byName[d.name]) byName[d.name] = d; });
    const missing = [];
    let filled = 0, kept = 0;
    for (let i = 0; i < sd.cycle.length; i++) {
      const date = M.addDays(start, i);
      const rec = await window.Menu.get(date);
      sd.cycle[i].forEach((names, mi) => {
        const ml = meals[mi];
        if (!ml) return; // 使っている食事の数が少ない施設（朝・昼だけ等）
        const key = window.Menu.cellKey(ml.id, sId);
        if ((rec.cells[key] || []).length && !overwrite) { kept++; return; }
        const list = [];
        names.forEach((n) => {
          const d = byName[n];
          if (!d) { if (missing.indexOf(n) < 0) missing.push(n); return; }
          list.push({ dishId: d.id, name: d.name, x: 1 });
        });
        rec.cells[key] = list;
        filled++;
      });
      await DB.put('menus', rec);
    }
    return { filled: filled, kept: kept, missing: missing, days: sd.cycle.length };
  };

  // 取り込みの画面
  S.dialog = async function () {
    const m = ms(), sd = seed();
    let close;
    if (!sd) { U.toast('初期データが読み込まれていません（js/dishes_seed.js）', true); return; }
    const have = (await window.Dishes.all()).length;
    const start = h('input', { class: 'input', type: 'date', value: U.today() });
    const sSel = U.select(m.shokushu, (m.shokushu[0] || {}).id, { noEmpty: true });
    const overwrite = h('input', { type: 'checkbox' });
    const out = h('div');
    close = U.modal(h('div', null,
      h('h2', null, '初期データを入れる'),
      h('div', { class: 'sub' }, '高齢者施設でよく出る料理 ' + sd.dishes.length + ' 件と、2 週間のサイクル献立です。' +
        '材料は成分表の食品番号なので、入れた時点で栄養価が出ます。分量は一般的な目安なので、施設に合わせて直してください。'),
      h('div', { class: 'card' },
        h('h3', null, '1. 料理'),
        h('div', null, '今ある料理 ' + have + ' 件。同じ名前の料理は飛ばします（上書きしません）。'),
        h('button', { class: 'btn primary', onclick: async () => {
          const r = await S.importDishes();
          out.innerHTML = '';
          out.appendChild(h('div', { class: 'card ok' }, '料理を ' + r.added + ' 件入れました' + (r.skipped ? '（同じ名前の ' + r.skipped + ' 件は飛ばしました）' : '') + '。'));
        } }, '料理 ' + sd.dishes.length + ' 件を入れる')),
      h('div', { class: 'card' },
        h('h3', null, '2. サイクル献立（' + sd.cycle.length + ' 日分）'),
        h('div', { class: 'sub' }, '先に料理を入れてから実行してください。1 日あたりおよそ 1400kcal・食塩 6.4g の常食の雛形です。'),
        h('div', { class: 'grid3' }, U.field('いつから', start), U.field('どの食種に', sSel),
          U.field('すでに献立があるマス', h('label', { class: 'check' }, overwrite, ' 上書きする'))),
        h('button', { class: 'btn primary', onclick: async () => {
          const r = await S.importCycle(start.value || U.today(), sSel.value, overwrite.checked);
          out.innerHTML = '';
          out.appendChild(h('div', { class: r.missing.length ? 'card warn' : 'card ok' },
            r.days + ' 日分のうち ' + r.filled + ' マスに入れました' + (r.kept ? '（すでに献立がある ' + r.kept + ' マスは残しました）' : '') + '。',
            r.missing.length ? h('div', null, '料理マスタに無くて入れられなかったもの: ' + r.missing.join('、') + '（先に「料理を入れる」を実行してください）') : null));
        } }, 'サイクル献立を入れる')),
      out,
      h('div', { class: 'modal-btns' }, h('button', { class: 'btn primary', onclick: () => { close(); App.refresh(); } }, '閉じる'))), { wide: true });
  };

  App.registerSettings({ order: 55, title: '初期データ', render: function () {
    if (!S.available()) return h('div', { class: 'card warn' }, '初期データ（js/dishes_seed.js）が読み込まれていません。');
    return h('div', { class: 'card' },
      h('div', { class: 'sub' }, '高齢者施設でよく出る料理 ' + S.count() + ' 件と、2 週間のサイクル献立を入れられます。何度押しても、同じ名前の料理は増えません。'),
      h('button', { class: 'btn primary', onclick: () => S.dialog() }, '初期データを入れる'));
  } });

  window.Seed = S;
})();
