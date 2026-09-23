// やることマトリクス（削除可能）: 行＝利用者、列＝業務。セルを押すとその人のその業務の入力が開く。
// 福祉の森の「利用者選択【プロセス管理】画面」（一覧から対象の業務へ直接遷移）を真似た。
// 期限で回る仕事なので、探す作業をなくすのが狙い。列は使っている機能だけ出す。
(function () {
  'use strict';
  const U = window.U, h = U.h, DB = window.DB, M = window.Model, V = window.View, App = window.App;
  const ms = () => window.Master.current;
  const B = { columns: [] };
  // 列を足す: { order, id, feature, label, cell(resident, ctx) → {text, state, onclick} }
  //   state: 'over'（期限切れ）/'soon'（近い）/'ok'/'none'（対象外）
  B.registerColumn = (col) => { B.columns.push(col); B.columns.sort((a, b) => a.order - b.order); };

  B.visibleColumns = function () {
    const p = ms().profile;
    return B.columns.filter((c) => window.Profile.enabled(p, c.feature));
  };

  B.build = async function (today) {
    const m = ms();
    const residents = (await DB.residents()).filter((r) => !r.archived && M.status(r, today, m.meals) === 'in')
      .sort((a, b) => (a.unit + a.room).localeCompare(b.unit + b.room, 'ja') || (a.kana || a.name).localeCompare(b.kana || b.name, 'ja'));
    const cols = B.visibleColumns();
    const ctx = { today: today, m: m, residents: residents };
    for (const c of cols) { if (c.prepare) await c.prepare(ctx); }
    const rows = residents.map((r) => ({ resident: r, cells: cols.map((c) => c.cell(r, ctx)) }));
    return { cols: cols, rows: rows, ctx: ctx };
  };

  App.registerScreen('board', async function (params, root) {
    const today = U.today();
    const { cols, rows } = await B.build(today);
    root.appendChild(h('header', { class: 'topbar' }, h('h1', null, 'やること一覧　' + U.fmtDate(today, true)),
      h('button', { class: 'btn no-print', onclick: () => window.print() }, '印刷')));
    if (!rows.length) { root.appendChild(h('div', { class: 'empty' }, '在籍している方がいません。')); return; }
    const count = { over: 0, soon: 0 };
    rows.forEach((r) => r.cells.forEach((c) => { if (c.state === 'over') count.over++; else if (c.state === 'soon') count.soon++; }));
    root.appendChild(h('div', { class: 'sub' }, '赤 = 期限切れ ' + count.over + ' 件　黄 = 近い ' + count.soon + ' 件　マスを押すとその場で入力できます'));
    root.appendChild(h('div', { class: 'scroll-x' }, h('table', { class: 'grid board' },
      h('thead', null, h('tr', null, h('th', null, '場所'), h('th', null, '氏名'),
        cols.map((c) => h('th', null, c.label)))),
      h('tbody', null, rows.map((row) => h('tr', null,
        h('td', { class: 'sub' }, V.where(row.resident)),
        h('th', null, h('a', { href: '#/resident/' + row.resident.id }, row.resident.name)),
        row.cells.map((cell) => h('td', { class: 'bcell ' + cell.state, onclick: cell.onclick || null },
          h('div', { class: 'bmain' }, cell.text), cell.sub ? h('div', { class: 'sub' }, cell.sub) : null))))))));
    root.appendChild(h('div', { class: 'sub no-print' }, '列は使っている機能だけ出ます（設定 → 事業所）。'));
  });

  App.registerNav({ order: 15, group: '', label: 'やること', icon: '🗂️', hash: '#/board', match: ['board'] });
  window.Board = B;
})();
