// 検収の記録簿と、在庫・受払い簿（削除可能）。発注書（modules/kondate.js）の続き。
// 検収の項目は 大量調理施設衛生管理マニュアル 別紙 様式4「検収の記録簿」のとおり
//   （納品の時刻・納入業者名・品目名・生産地・期限表示・数量・鮮度・包装・品温・異物・進言事項。調査 02 の 5.1）。
// 受払い簿は「即日消費されない食材の出納」（横浜市の手引きの帳票一覧・調査 02 の 5.2。各日・各月の入庫・出庫・残）。
// stock ストア: { id, date, no, name, kind:'in'|'out'|'adjust', qty(g), yen, vendor, memo, check:{様式4の欄} }
(function () {
  'use strict';
  const U = window.U, h = U.h, DB = window.DB, M = window.Model, N = window.Nutri, V = window.View;
  const Foods = window.Foods, Kondate = window.Kondate, App = window.App;
  const ms = () => window.Master.current;
  const S = {};
  let tab = 'kenshu';

  // 様式4 の「鮮度・包装・異物」は ○ / △ / × で付ける
  S.MARKS = ['良', '否'];
  S.CHECK_FIELDS = [
    { id: 'time', label: '納品の時刻', kind: 'time' },
    { id: 'origin', label: '生産地', kind: 'text' },
    { id: 'expiry', label: '期限表示', kind: 'text', hint: '消費期限・賞味期限' },
    { id: 'fresh', label: '鮮度', kind: 'mark' },
    { id: 'pack', label: '包装', kind: 'mark' },
    { id: 'temp', label: '品温 (℃)', kind: 'number' },
    { id: 'foreign', label: '異物', kind: 'mark' },
    { id: 'advice', label: '進言事項', kind: 'text' }
  ];

  S.all = () => DB.getAll('stock');
  S.onDate = (date) => DB.byIndex('stock', 'date', date);
  S.put = (rec) => DB.put('stock', rec);
  S.sign = (kind) => kind === 'out' ? -1 : 1;

  // 食品ごとの残（date まで）。adjust は「その日の実数」として、それ以前を上書きする
  S.balance = function (rows, upto) {
    const by = {};
    rows.slice().sort((a, b) => a.date.localeCompare(b.date) || (a.at || 0) - (b.at || 0)).forEach((r) => {
      if (upto && r.date > upto) return;
      const e = by[r.no] = by[r.no] || { no: r.no, name: r.name, qty: 0, last: '' };
      if (r.kind === 'adjust') e.qty = Number(r.qty) || 0;
      else e.qty += S.sign(r.kind) * (Number(r.qty) || 0);
      e.name = r.name || e.name;
      e.last = r.date;
    });
    return by;
  };

  // ---- 画面 ----
  App.registerScreen('stock', async function (params, root) {
    if (params[0] === 'kenshu' || params[0] === 'ledger' || params[0] === 'count') tab = params[0];
    const date = params[1] || U.today();
    const rows = await S.all();
    root.appendChild(h('header', { class: 'topbar' }, h('h1', null, '検収・在庫'),
      h('div', { class: 'no-print' }, h('button', { class: 'btn', onclick: () => window.print() }, '印刷'), ' ',
        h('a', { class: 'btn', href: '#/order/' + date }, '発注書'))));
    root.appendChild(h('div', { class: 'toolrow no-print' },
      [['kenshu', '検収の記録簿'], ['ledger', '受払い簿・在庫'], ['count', '棚卸し']].map((t) =>
        h('a', { class: 'btn seg' + (tab === t[0] ? ' on' : ''), href: '#/stock/' + t[0] + '/' + date }, t[1]))));
    if (tab === 'kenshu') return drawKenshu(root, date, rows);
    if (tab === 'count') return drawCount(root, date, rows);
    return drawLedger(root, date, rows);
  });

  // ---- 検収の記録簿（様式4）----
  async function drawKenshu(root, date, rows) {
    const today = rows.filter((r) => r.date === date && r.kind === 'in');
    root.appendChild(V.dateBar(date, (d) => App.go('#/stock/kenshu/' + d)));
    root.appendChild(h('div', { class: 'card info no-print' },
      '納品に立ち会って、その場で付ける表です（大量調理施設衛生管理マニュアル 様式4）。' +
      '「発注から写す」を押すと、その日に頼んだ物が並びます。'));
    if (!today.length) root.appendChild(h('div', { class: 'empty' }, 'この日の検収はまだありません。'));
    else root.appendChild(h('div', { class: 'scroll-x' }, h('table', { class: 'list bordered small' },
      h('thead', null, h('tr', null, ['時刻', '納入業者', '品目', '生産地', '期限表示', '数量', '鮮度', '包装', '品温', '異物', '進言事項', ''].map((t) => h('th', null, t)))),
      h('tbody', null, today.sort((a, b) => ((a.check && a.check.time) || '').localeCompare((b.check && b.check.time) || '')).map((r) => {
        r.check = r.check || {};
        const inp = (f) => {
          if (f.kind === 'mark') {
            const box = h('div', { class: 'segrow' });
            S.MARKS.forEach((mk) => box.appendChild(h('button', { type: 'button', class: 'btn seg small' + (r.check[f.id] === mk ? ' on' : ''),
              onclick: async () => { r.check[f.id] = (r.check[f.id] === mk ? '' : mk); await S.put(r); App.refresh(); } }, mk)));
            return box;
          }
          const el = h('input', { class: 'input' + (f.kind === 'number' ? ' num' : ''), type: f.kind === 'time' ? 'time' : (f.kind === 'number' ? 'number' : 'text'),
            step: 'any', value: r.check[f.id] == null ? '' : r.check[f.id] });
          el.addEventListener('change', async () => { r.check[f.id] = el.value; await S.put(r); });
          return el;
        };
        const byId = {}; S.CHECK_FIELDS.forEach((f) => { byId[f.id] = f; });
        const qty = h('input', { class: 'input num', type: 'number', step: 'any', value: r.qty == null ? '' : r.qty });
        qty.addEventListener('change', async () => { r.qty = parseFloat(qty.value) || 0; await S.put(r); });
        const vendor = h('input', { class: 'input', type: 'text', value: r.vendor || '', list: 'dl-vendor2' });
        vendor.addEventListener('change', async () => { r.vendor = vendor.value.trim(); await S.put(r); });
        return h('tr', null,
          h('td', null, inp(byId.time)), h('td', null, vendor),
          h('td', null, Foods.shortName(r.name || ''), h('div', { class: 'sub' }, r.no)),
          h('td', null, inp(byId.origin)), h('td', null, inp(byId.expiry)),
          h('td', null, qty, h('span', { class: 'sub' }, ' g')),
          h('td', null, inp(byId.fresh)), h('td', null, inp(byId.pack)), h('td', null, inp(byId.temp)), h('td', null, inp(byId.foreign)),
          h('td', null, inp(byId.advice)),
          h('td', { class: 'no-print' }, h('button', { class: 'btn small', onclick: async () => {
            if (!await U.confirm('この行を消します。', { okLabel: '消す', danger: true })) return;
            await DB.del('stock', r.id); App.refresh();
          } }, '消す')));
      })))));
    const vendors = [];
    rows.forEach((r) => { if (r.vendor && vendors.indexOf(r.vendor) < 0) vendors.push(r.vendor); });
    (ms().prices || []).forEach((p) => { if (p.vendor && vendors.indexOf(p.vendor) < 0) vendors.push(p.vendor); });
    root.appendChild(h('datalist', { id: 'dl-vendor2' }, vendors.map((v) => h('option', { value: v }))));
    root.appendChild(h('div', { class: 'toolrow no-print' },
      h('button', { class: 'btn primary', onclick: () => S.fromOrder(date) }, '発注から写す'),
      h('button', { class: 'btn', onclick: async () => {
        const f = await Foods.pick();
        if (!f) return;
        const pr = (ms().prices || []).find((p) => p.no === f.no);
        await S.put({ id: U.uid('s'), date: date, no: f.no, name: f.name, kind: 'in', qty: 0, yen: null,
          vendor: (pr && pr.vendor) || '', memo: '', at: Date.now(), check: {} });
        App.refresh();
      } }, '＋ 1 品足す')));
    root.appendChild(h('table', { class: 'stamps print-only' }, h('tbody', null,
      h('tr', null, ['検収者', '責任者'].map((s) => h('th', null, s))), h('tr', null, [0, 1].map(() => h('td', null, ' '))))));
  }

  // その日の発注から検収の行を作る
  S.fromOrder = async function (date) {
    if (!window.Kondate) { U.toast('発注書の機能が入っていません', true); return; }
    const data = await window.Kondate.unfold(date);
    const need = {};
    data.rows.forEach((row) => row.cells.forEach((c) => c.dishes.forEach((dd) => dd.items.forEach((it) => {
      const g = it.g1 * c.n;
      if (!g) return;
      const e = need[it.no] = need[it.no] || { no: it.no, name: it.name || (N.get(it.no) || {}).name || it.no, g: 0 };
      e.g += g;
    }))));
    const keys = Object.keys(need);
    if (!keys.length) { U.toast('この日の献立がありません', true); return; }
    const have = (await S.onDate(date)).filter((r) => r.kind === 'in');
    const add = keys.filter((no) => !have.some((r) => r.no === no));
    if (!add.length) { U.toast('もう全部あります'); return; }
    if (!await U.confirm(add.length + ' 品を検収の表に足します。数量は購入量（廃棄率を戻したもの）で入ります。', { okLabel: '足す' })) return;
    for (const no of add) {
      const o = window.Kondate.orderOf(no, need[no].g);
      await S.put({ id: U.uid('s'), date: date, no: no, name: need[no].name, kind: 'in',
        qty: Math.round(o.buyG), yen: o.yen, vendor: (o.price && o.price.vendor) || '', memo: '', at: Date.now(), check: {} });
    }
    U.toast(add.length + ' 品を足しました');
    App.refresh();
  };

  // ---- 受払い簿・在庫 ----
  function drawLedger(root, date, rows) {
    const ym = date.slice(0, 7);
    const days = window.Report ? window.Report.daysOf(ym) : [];
    const inMonth = rows.filter((r) => r.date.slice(0, 7) === ym);
    const opening = S.balance(rows.filter((r) => r.date < ym + '-01'));
    const closing = S.balance(rows, ym + '-31');
    const nos = Array.from(new Set(Object.keys(opening).concat(Object.keys(closing)))).sort();
    root.appendChild(h('div', { class: 'toolrow no-print' },
      h('a', { class: 'btn', href: '#/stock/ledger/' + (window.Report ? window.Report.addMonth(ym, -1) : ym) + '-01' }, '◀ 前月'),
      h('a', { class: 'btn', href: '#/stock/ledger/' + U.today() }, '今月'),
      h('a', { class: 'btn', href: '#/stock/ledger/' + (window.Report ? window.Report.addMonth(ym, 1) : ym) + '-01' }, '次月 ▶'),
      h('span', { class: 'gap' }), h('span', null, ym.replace('-', '年') + '月')));
    if (!nos.length) {
      root.appendChild(h('div', { class: 'empty' }, 'この月の出入りはまだありません。検収の記録簿から入れると、ここに残が出ます。'));
      return;
    }
    const g = (v) => window.Kondate ? window.Kondate.g(v) : Math.round(v) + ' g';
    root.appendChild(h('div', { class: 'scroll-x' }, h('table', { class: 'list bordered' },
      h('thead', null, h('tr', null, ['食品', '前月からの繰越', '入庫', '出庫', '棚卸し', '残'].map((t) => h('th', null, t)))),
      h('tbody', null, nos.map((no) => {
        const mine = inMonth.filter((r) => r.no === no);
        const ins = mine.filter((r) => r.kind === 'in').reduce((s, r) => s + (Number(r.qty) || 0), 0);
        const outs = mine.filter((r) => r.kind === 'out').reduce((s, r) => s + (Number(r.qty) || 0), 0);
        const adj = mine.filter((r) => r.kind === 'adjust');
        const bal = (closing[no] || {}).qty || 0;
        const name = (closing[no] || opening[no] || {}).name || no;
        return h('tr', { class: bal < 0 ? 'j-high' : '' },
          h('th', null, h('a', { href: '#/stockone/' + no + '/' + ym }, Foods.shortName(name)), h('div', { class: 'sub' }, no)),
          h('td', { class: 'num' }, g((opening[no] || {}).qty || 0)),
          h('td', { class: 'num' }, ins ? g(ins) : '—'),
          h('td', { class: 'num' }, outs ? g(outs) : '—'),
          h('td', { class: 'num sub' }, adj.length ? adj.length + ' 回' : '—'),
          h('td', { class: 'num' }, g(bal)));
      })))));
    if (nos.some((no) => ((closing[no] || {}).qty || 0) < 0)) root.appendChild(h('div', { class: 'card warn' },
      '残がマイナスの食品があります。検収を入れ忘れているか、出庫を二重に入れています。'));
    root.appendChild(h('div', { class: 'toolrow no-print' },
      h('button', { class: 'btn primary', onclick: () => S.outFromMenu(date) }, 'この日の使用量を出庫にする'),
      h('button', { class: 'btn', onclick: () => {
        const list = [[ym.replace('-', '年') + '月　受払い簿'], [], ['食品番号', '食品名', '前月繰越(g)', '入庫(g)', '出庫(g)', '残(g)']];
        nos.forEach((no) => {
          const mine = inMonth.filter((r) => r.no === no);
          list.push([no, (closing[no] || opening[no] || {}).name || '',
            Math.round((opening[no] || {}).qty || 0),
            Math.round(mine.filter((r) => r.kind === 'in').reduce((s, r) => s + (Number(r.qty) || 0), 0)),
            Math.round(mine.filter((r) => r.kind === 'out').reduce((s, r) => s + (Number(r.qty) || 0), 0)),
            Math.round((closing[no] || {}).qty || 0)]);
        });
        const detail = [['日', '食品番号', '食品名', '区分', '業者', '数量(g)', '備考']];
        inMonth.slice().sort((a, b) => a.date.localeCompare(b.date)).forEach((r) => detail.push([r.date, r.no, r.name,
          r.kind === 'in' ? '入庫' : (r.kind === 'out' ? '出庫' : '棚卸し'), r.vendor || '', Math.round(Number(r.qty) || 0), r.memo || '']));
        U.xlsx('受払い簿_' + ym + '.xlsx', [{ name: '受払い簿', rows: list }, { name: '明細', rows: detail }]);
      } }, 'Excel で保存')));
    root.appendChild(h('div', { class: 'sub' }, '出庫は「実施献立の 1 人分 × その食種の食数」を純使用量で引きます（皮や骨は引きません）。' +
      '食品名を押すと、その食品の日ごとの出入りが見られます。'));
  }

  // その日に使った分を出庫として書く
  S.outFromMenu = async function (date) {
    if (!window.Kondate) return;
    const m = ms(), meals = M.activeMeals(m);
    const dishMap = {};
    (await window.Dishes.all()).forEach((d) => { dishMap[d.id] = d; });
    const residents = await DB.residents();
    const rec = await window.Menu.get(date);
    const need = {};
    m.shokushu.forEach((sh) => meals.forEach((ml) => {
      const list = window.Menu.actualDishes(rec, ml.id, sh.id);
      if (!list.length) return;
      const n = M.census(residents, { d: date, m: ml.id }, m).byShokushu[sh.id] || 0;
      list.forEach((c) => {
        const d = dishMap[c.dishId]; if (!d) return;
        const per = Math.max(1, Number(d.servings) || 1), x = (c.x == null ? 1 : Number(c.x)) || 0;
        (d.items || []).forEach((it) => {
          const g = it.g / per * x * n;
          if (!g) return;
          const e = need[it.no] = need[it.no] || { no: it.no, name: it.name || (N.get(it.no) || {}).name || it.no, g: 0 };
          e.g += g;
        });
      });
    }));
    const keys = Object.keys(need);
    if (!keys.length) { U.toast('この日の献立がありません', true); return; }
    const had = (await S.onDate(date)).filter((r) => r.kind === 'out');
    if (had.length && !await U.confirm('この日の出庫はもう入っています（' + had.length + ' 件）。もう一度足すと二重になります。', { okLabel: 'それでも足す', danger: true })) return;
    for (const no of keys) {
      await S.put({ id: U.uid('s'), date: date, no: no, name: need[no].name, kind: 'out',
        qty: Math.round(need[no].g), yen: null, vendor: '', memo: '献立から', at: Date.now(), check: {} });
    }
    U.toast(keys.length + ' 品を出庫にしました');
    App.refresh();
  };

  // ---- 棚卸し ----
  function drawCount(root, date, rows) {
    const bal = S.balance(rows, date);
    const nos = Object.keys(bal).sort();
    root.appendChild(V.dateBar(date, (d) => App.go('#/stock/count/' + d)));
    root.appendChild(h('div', { class: 'card info no-print' },
      '数えた実数を入れると、帳簿の残との差が出ます。入れた数がその日からの残になります（月 1 回が目安）。'));
    if (!nos.length) { root.appendChild(h('div', { class: 'empty' }, 'まだ在庫がありません。')); return; }
    root.appendChild(h('div', { class: 'scroll-x' }, h('table', { class: 'list bordered' },
      h('thead', null, h('tr', null, ['食品', '帳簿の残', '数えた実数', '差'].map((t) => h('th', null, t)))),
      h('tbody', null, nos.map((no) => {
        const cur = bal[no].qty;
        const done = rows.find((r) => r.no === no && r.date === date && r.kind === 'adjust');
        const inp = h('input', { class: 'input num', type: 'number', step: 'any', value: done ? done.qty : '' });
        inp.addEventListener('change', async () => {
          const v = inp.value === '' ? null : parseFloat(inp.value);
          if (v == null) { if (done) await DB.del('stock', done.id); App.refresh(); return; }
          const rec = done || { id: U.uid('s'), date: date, no: no, name: bal[no].name, kind: 'adjust', vendor: '', memo: '棚卸し', check: {} };
          rec.qty = v; rec.at = Date.now();
          await S.put(rec); App.refresh();
        });
        const diff = done ? done.qty - cur : null;
        return h('tr', null,
          h('th', null, Foods.shortName(bal[no].name || no), h('div', { class: 'sub' }, no)),
          h('td', { class: 'num' }, Math.round(cur) + ' g'),
          h('td', { class: 'no-print-border' }, inp),
          h('td', { class: 'num ' + (diff == null ? '' : (Math.abs(diff) > Math.max(50, Math.abs(cur) * 0.1) ? 'j-high' : '')) },
            diff == null ? '—' : (diff > 0 ? '+' : '') + Math.round(diff) + ' g'));
      })))));
  }

  // ---- 1 食品の出入り ----
  App.registerScreen('stockone', async function (params, root) {
    const no = params[0], ym = params[1] || U.today().slice(0, 7);
    const rows = (await S.all()).filter((r) => r.no === no).sort((a, b) => a.date.localeCompare(b.date) || (a.at || 0) - (b.at || 0));
    const f = N.get(no);
    root.appendChild(h('header', { class: 'topbar' }, h('h1', null, (f ? Foods.shortName(f.name) : no) + '　受払い'),
      h('div', { class: 'no-print' }, h('a', { class: 'btn', href: '#/stock/ledger/' + ym + '-01' }, '一覧に戻る'))));
    if (!rows.length) { root.appendChild(h('div', { class: 'empty' }, '出入りがありません。')); return; }
    let run = 0;
    root.appendChild(h('table', { class: 'list bordered' },
      h('thead', null, h('tr', null, ['日', '区分', '業者', '入', '出', '残', '備考'].map((t) => h('th', null, t)))),
      h('tbody', null, rows.map((r) => {
        if (r.kind === 'adjust') run = Number(r.qty) || 0; else run += S.sign(r.kind) * (Number(r.qty) || 0);
        const kind = r.kind === 'in' ? '入庫' : (r.kind === 'out' ? '出庫' : '棚卸し');
        return h('tr', null, h('td', null, U.fmtDate(r.date, true)), h('td', null, kind), h('td', null, r.vendor || ''),
          h('td', { class: 'num' }, r.kind === 'in' ? Math.round(r.qty) : ''),
          h('td', { class: 'num' }, r.kind === 'out' ? Math.round(r.qty) : ''),
          h('td', { class: 'num' }, Math.round(run)),
          h('td', { class: 'sub' }, r.memo || ''));
      }))));
  });

  App.registerNav({ order: 45, group: '献立と食材', feature: 'menu', label: '検収', icon: '📦', hash: '#/stock', match: ['stock', 'stockone'] });
  window.Stock = S;
})();
