// 予定献立表・調理指示書・発注書（削除可能）。
// 献立（modules/menu.js）は「料理を並べて栄養価を見る」ための画面で、厨房に渡す紙はここで作る。
// 予定献立表は計画書であり作業指示書でもある（横浜市の手引きの帳票一覧・調査 02 の 5.2）。
//   要る項目: 実施年月日、食種別、朝昼夕の献立名、食品名、数量（1 人分と食数分）、作業指示のポイント。
// 発注は「食料品消費日計表（発注書・納品書で代用可）」にあたる。食材の単価は 設定 → 食材の単価 で持つ。
(function () {
  'use strict';
  const U = window.U, h = U.h, DB = window.DB, M = window.Model, N = window.Nutri, V = window.View;
  const Foods = window.Foods, Dishes = window.Dishes, Menu = window.Menu, App = window.App;
  const ms = () => window.Master.current;
  const K = {};

  // ---- 食材の単価 ----
  // prices: [{ no, name, packG, yen, vendor, spec }] … packG = 1 回に買う単位の重さ(g)、yen = その値段
  K.prices = () => (ms().prices || []);
  K.priceOf = (no) => K.prices().find((p) => p.no === no) || null;
  // 純使用量（可食部）→ 購入量。成分表の廃棄率（皮・骨・殻）を戻す
  K.buyG = function (no, netG) {
    const f = N.get(no);
    const r = f ? N.val(f, 'refuse') : null;
    return { g: window.Amounts.purchase(netG, r), refuse: r || 0 };
  };
  // 購入量 → 発注する数と金額
  K.orderOf = function (no, needG) {
    const p = K.priceOf(no);
    const buy = K.buyG(no, needG);
    if (!p || !(p.packG > 0)) return { price: p, buyG: buy.g, refuse: buy.refuse, packs: null, yen: null };
    const packs = Math.ceil(buy.g / p.packG);
    return { price: p, buyG: buy.g, refuse: buy.refuse, packs: packs, yen: p.yen != null ? packs * p.yen : null };
  };

  // ---- その日の献立を「食種 × 食事 × 料理 × 材料」の形にほどく ----
  K.unfold = async function (date) {
    const m = ms(), meals = M.activeMeals(m);
    const dishMap = {};
    (await Dishes.all()).forEach((d) => { dishMap[d.id] = d; });
    const residents = await DB.residents();
    const rec = await Menu.get(date);
    const out = [];
    m.shokushu.forEach((sh) => {
      const cells = [];
      meals.forEach((ml) => {
        const list = Menu.cellDishes(rec, ml.id, sh.id);
        if (!list.length) return;
        const n = M.census(residents, { d: date, m: ml.id }, m).byShokushu[sh.id] || 0;
        cells.push({ meal: ml, n: n, dishes: list.map((c) => {
          const d = dishMap[c.dishId];
          const per = d ? Math.max(1, Number(d.servings) || 1) : 1, x = (c.x == null ? 1 : Number(c.x)) || 0;
          return { cell: c, dish: d, x: x,
            items: d ? (d.items || []).map((it) => ({ no: it.no, name: it.name, g1: it.g / per * x })) : [] };
        }) });
      });
      if (cells.length) out.push({ sh: sh, cells: cells });
    });
    return { date: date, rows: out, dishMap: dishMap };
  };

  // ---- 予定献立表・調理指示書 ----
  App.registerScreen('kondate', async function (params, root) {
    const date = params[0] || U.today();
    const m = ms();
    const data = await K.unfold(date);
    root.appendChild(h('header', { class: 'topbar' }, h('h1', null, '予定献立表・調理指示書　' + U.fmtDate(date, true)),
      h('div', { class: 'no-print' }, h('button', { class: 'btn', onclick: () => window.print() }, '印刷'), ' ',
        h('a', { class: 'btn', href: '#/order/' + date }, '発注書'), ' ',
        h('a', { class: 'btn', href: '#/menu/' + date }, '献立を直す'))));
    root.appendChild(V.dateBar(date, (d) => App.go('#/kondate/' + d)));
    if (!data.rows.length) {
      root.appendChild(h('div', { class: 'empty' }, 'この日の献立がまだ入っていません。', ' ',
        h('a', { class: 'btn no-print', href: '#/menu/' + date }, '献立を開く')));
      return;
    }
    data.rows.forEach((row) => {
      const sec = h('section', { class: 'card' }, h('h2', null, row.sh.label));
      row.cells.forEach((c) => {
        const body = [];
        c.dishes.forEach((dd) => {
          const name = dd.dish ? dd.dish.name : (dd.cell.name || '消された料理');
          const span = Math.max(1, dd.items.length);
          dd.items.forEach((it, i) => {
            body.push(h('tr', null,
              i === 0 ? h('th', { rowspan: String(span), class: 'dishname' }, name,
                dd.x !== 1 ? h('div', { class: 'sub' }, '×' + dd.x) : null) : null,
              h('td', null, Foods.shortName(it.name || (N.get(it.no) || {}).name || it.no)),
              h('td', { class: 'num' }, K.g(it.g1)),
              h('td', { class: 'num' }, c.n ? K.g(it.g1 * c.n) : '—'),
              i === 0 ? h('td', { rowspan: String(span), class: 'shiji' }, dd.dish ? dd.dish.memo : '') : null));
          });
          if (!dd.items.length) body.push(h('tr', null, h('th', { class: 'dishname' }, name),
            h('td', { class: 'sub', colspan: '3' }, '材料が入っていません'), h('td', null, dd.dish ? dd.dish.memo : '')));
        });
        sec.appendChild(h('div', { class: 'scroll-x' }, h('table', { class: 'list bordered kondate' },
          h('thead', null, h('tr', null,
            h('th', { colspan: '5' }, c.meal.label + '　' + c.n + ' 食')),
            h('tr', null, ['料理', '食品名', '1人分', c.n + '食分', '作業指示'].map((t) => h('th', null, t)))),
          h('tbody', null, body))));
      });
      sec.appendChild(h('div', { class: 'sub no-print' }, '作業指示の欄は 料理マスタ の「メモ」に書いた内容です。'));
      root.appendChild(sec);
    });
    root.appendChild(h('table', { class: 'stamps print-only' }, h('tbody', null,
      h('tr', null, ['作成者', '栄養士', '施設長'].map((s) => h('th', null, s))),
      h('tr', null, ['', '', ''].map(() => h('td', null, ' '))))));
  });

  K.g = function (v) {
    if (v == null) return '—';
    if (v >= 1000) return (v / 1000).toFixed(2) + ' kg';
    return (v >= 100 ? Math.round(v) : Math.round(v * 10) / 10) + ' g';
  };

  // ---- 発注書・食料品消費日計表 ----
  App.registerScreen('order', async function (params, root) {
    const from = params[0] || U.today();
    const days = parseInt(params[1], 10) || 7;
    const m = ms();
    const list = []; for (let i = 0; i < days; i++) list.push(M.addDays(from, i));
    // 食品番号ごとに必要量を足す（食数を掛けたもの）
    const need = {};   // no → { name, g, byDay: {date: g} }
    for (const d of list) {
      const data = await K.unfold(d);
      data.rows.forEach((row) => row.cells.forEach((c) => c.dishes.forEach((dd) => dd.items.forEach((it) => {
        const g = it.g1 * c.n;
        if (!g) return;
        const e = need[it.no] = need[it.no] || { no: it.no, name: it.name || (N.get(it.no) || {}).name || it.no, g: 0, byDay: {} };
        e.g += g; e.byDay[d] = (e.byDay[d] || 0) + g;
      }))));
    }
    const keys = Object.keys(need).sort((a, b) => need[b].g - need[a].g);
    // 業者ごとにまとめる
    const byVendor = {};
    let total = 0, unknown = 0;
    keys.forEach((no) => {
      const o = K.orderOf(no, need[no].g);
      const v = (o.price && o.price.vendor) || '（業者未設定）';
      (byVendor[v] = byVendor[v] || []).push({ need: need[no], order: o });
      if (o.yen != null) total += o.yen; else unknown++;
    });

    root.appendChild(h('header', { class: 'topbar' }, h('h1', null, '発注書　' + U.fmtDate(from, true) + ' から ' + days + ' 日分'),
      h('div', { class: 'no-print' }, h('button', { class: 'btn', onclick: () => window.print() }, '印刷'), ' ',
        h('button', { class: 'btn', onclick: () => {
          const rows = [['業者', '食品番号', '食品名', '純使用量(g)', '廃棄率(%)', '購入量(g)', '規格', '発注数', '単価(円)', '金額(円)']];
          Object.keys(byVendor).sort().forEach((v) => byVendor[v].forEach((x) => rows.push([v, x.need.no, x.need.name,
            Math.round(x.need.g), x.order.refuse || 0, Math.round(x.order.buyG),
            (x.order.price && x.order.price.spec) || '', x.order.packs == null ? '' : x.order.packs,
            (x.order.price && x.order.price.yen) == null ? '' : x.order.price.yen, x.order.yen == null ? '' : x.order.yen])));
          U.download('発注_' + from + '.csv', U.csv(rows), 'text/csv');
        } }, 'CSV で保存'))));
    root.appendChild(h('div', { class: 'toolrow no-print' },
      h('button', { class: 'btn', onclick: () => App.go('#/order/' + M.addDays(from, -days) + '/' + days) }, '◀ 前'),
      h('button', { class: 'btn', onclick: () => App.go('#/order/' + U.today() + '/' + days) }, '今日から'),
      h('button', { class: 'btn', onclick: () => App.go('#/order/' + M.addDays(from, days) + '/' + days) }, '次 ▶'),
      [1, 3, 7, 14].map((k) => h('button', { class: 'btn seg' + (days === k ? ' on' : ''), onclick: () => App.go('#/order/' + from + '/' + k) }, k + '日')),
      h('span', { class: 'gap' }), h('a', { class: 'btn', href: '#/settings' }, '食材の単価を入れる')));

    if (!keys.length) { root.appendChild(h('div', { class: 'empty' }, 'この期間の献立がまだ入っていません。')); return; }
    root.appendChild(h('div', { class: 'card' }, h('b', null, '食材 ' + keys.length + ' 品目'),
      total ? h('span', null, '　概算 ' + total.toLocaleString() + ' 円') : null,
      unknown ? h('div', { class: 'sub warn-text' }, '単価が入っていない食材が ' + unknown + ' 品目あります（金額に入っていません）。設定 → 食材の単価 で入れられます。') : null));

    Object.keys(byVendor).sort().forEach((v) => {
      const rows = byVendor[v];
      const sum = rows.reduce((s, x) => s + (x.order.yen || 0), 0);
      root.appendChild(h('section', { class: 'card' }, h('h2', null, v + '　' + rows.length + ' 品目' + (sum ? '　' + sum.toLocaleString() + ' 円' : '')),
        h('div', { class: 'scroll-x' }, h('table', { class: 'list bordered' },
          h('thead', null, h('tr', null, ['食品名', '純使用量', '廃棄率', '購入量', '規格', '発注数', '単価', '金額', '納品'].map((t) => h('th', null, t)))),
          h('tbody', null, rows.map((x) => h('tr', null,
            h('td', null, Foods.shortName(x.need.name), h('div', { class: 'sub' }, x.need.no)),
            h('td', { class: 'num' }, K.g(x.need.g)),
            h('td', { class: 'num sub' }, x.order.refuse ? x.order.refuse + ' %' : '—'),
            h('td', { class: 'num' }, K.g(x.order.buyG)),
            h('td', null, (x.order.price && x.order.price.spec) || h('span', { class: 'sub' }, '—')),
            h('td', { class: 'num' }, x.order.packs == null ? h('span', { class: 'sub' }, '単価未設定') : x.order.packs + ' 個'),
            h('td', { class: 'num' }, (x.order.price && x.order.price.yen) == null ? '—' : x.order.price.yen + ' 円'),
            h('td', { class: 'num' }, x.order.yen == null ? '—' : x.order.yen.toLocaleString() + ' 円'),
            h('td', { class: 'checkbox-cell' }, '□'))))))));
    });
    root.appendChild(h('div', { class: 'sub' }, '純使用量は「献立の 1 人分 × その日のその食種の食数」を期間ぶん足したもの（可食部）です。' +
      '購入量は、成分表の廃棄率（皮・骨・殻）を戻した重さ（純使用量 ÷（1 − 廃棄率））。発注数はこの購入量を規格で割って切り上げます。'));
  });

  // ---- 設定: 食材の単価 ----
  App.registerSettings({ order: 48, title: '食材の単価', render: function () {
    const m = ms();
    m.prices = m.prices || [];
    const box = h('div');
    function draw() {
      box.innerHTML = '';
      if (!m.prices.length) box.appendChild(h('div', { class: 'empty' }, 'まだ入っていません。下の「食品を足す」から入れると、発注書に金額が出ます。'));
      else box.appendChild(h('div', { class: 'scroll-x' }, h('table', { class: 'list edit' },
        h('thead', null, h('tr', null, ['食品', '規格（1 回に買う単位）', '1 単位の重さ(g)', '1 単位の値段(円)', '業者', ''].map((t) => h('th', null, t)))),
        h('tbody', null, m.prices.map((p, i) => {
          const inp = (key, type) => {
            const el = h('input', { class: 'input' + (type === 'number' ? ' num' : ''), type: type || 'text',
              step: 'any', value: p[key] == null ? '' : p[key], list: key === 'vendor' ? 'dl-vendor' : null });
            el.addEventListener('change', async () => {
              const v = el.value.trim();
              p[key] = (type === 'number') ? (v === '' ? null : parseFloat(v)) : v;
              await window.Master.save();
            });
            return el;
          };
          return h('tr', null,
            h('td', null, Foods.shortName(p.name || ''), h('div', { class: 'sub' }, p.no)),
            h('td', null, inp('spec')), h('td', null, inp('packG', 'number')), h('td', null, inp('yen', 'number')),
            h('td', null, inp('vendor')),
            h('td', null, h('button', { class: 'btn small', onclick: async () => {
              if (!await U.confirm('「' + p.name + '」の単価を消します。', { okLabel: '消す', danger: true })) return;
              m.prices.splice(i, 1); await window.Master.save(); draw();
            } }, '消す')));
        })))));
      const vendors = []; m.prices.forEach((p) => { if (p.vendor && vendors.indexOf(p.vendor) < 0) vendors.push(p.vendor); });
      box.appendChild(h('datalist', { id: 'dl-vendor' }, vendors.map((v) => h('option', { value: v }))));
      box.appendChild(h('div', { class: 'toolrow' },
        h('button', { class: 'btn primary', onclick: async () => {
          const f = await Foods.pick();
          if (!f) return;
          if (m.prices.some((p) => p.no === f.no)) { U.toast('もう入っています', true); return; }
          m.prices.push({ no: f.no, name: f.name, spec: '', packG: null, yen: null, vendor: '' });
          await window.Master.save(); draw();
        } }, '＋ 食品を足す'),
        h('button', { class: 'btn', onclick: async () => {
          // 献立で使っている食材のうち、単価が入っていないものをまとめて足す
          const seen = {};
          (await Dishes.all()).forEach((d) => (d.items || []).forEach((it) => { if (it.g) seen[it.no] = it.name; }));
          const add = Object.keys(seen).filter((no) => !m.prices.some((p) => p.no === no));
          if (!add.length) { U.toast('足すものはありません'); return; }
          if (!await U.confirm('料理マスタで使っている食材 ' + add.length + ' 品目を、値段が空のまま足します。', { okLabel: '足す' })) return;
          add.forEach((no) => m.prices.push({ no: no, name: seen[no] || (N.get(no) || {}).name || no, spec: '', packG: null, yen: null, vendor: '' }));
          await window.Master.save(); draw();
        } }, '料理で使っている食材をまとめて足す')));
    }
    draw();
    return h('div', null, h('div', { class: 'sub' },
      '1 回に買う単位（例: 米 5kg 袋 = 5000g で 2,800 円）を入れると、発注書に「何個・いくら」が出ます。' +
      '重さと値段が空のままでも、業者だけ入れれば発注書を業者ごとに分けられます。'), box);
  } });

  App.registerNav({ order: 41, group: '献立と食材', feature: 'menu', label: '献立表', icon: '📋', hash: '#/kondate', match: ['kondate', 'order'] });
  window.Kondate = K;
})();
