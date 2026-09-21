// 食札（A4 に面付けして印刷）と、禁食・アレルギー一覧。どちらも利用者台帳から作る。
(function () {
  'use strict';
  const U = window.U, h = U.h, DB = window.DB, M = window.Model, V = window.View, App = window.App;
  const ms = () => window.Master.current;
  const st = { unit: '', onlyChanged: false, layout: null, off: {} };

  function subTabs(current, date) {
    return h('div', { class: 'toolrow no-print' },
      h('a', { class: 'btn seg' + (current === 'cards' ? ' on' : ''), href: '#/cards/' + date }, '食札'),
      h('a', { class: 'btn seg' + (current === 'kinshi' ? ' on' : ''), href: '#/kinshi/' + date }, '禁食・アレルギー一覧'),
      h('a', { class: 'btn seg' + (current === 'check' ? ' on' : ''), href: '#/check/' + date }, '出る物から当たる人'));
  }

  // 1 枚の食札。警告（アレルギー・禁食）は必ず氏名のすぐ上の同じ位置
  // 食札。禁止（読み落とすと事故）と 指示（読み落とすと作業のやり直し）を分けて出す。
  // 献ダテマンの食札レイアウト「禁止」「指示」の 2 列と、Dietech が自助具をアレルギーと別項目にしているのに合わせた。
  function card(r, d, slot, lay, changed) {
    const m = ms();
    const colorOf = m.cardColorBy === 'shokushu' ? M.item(m.shokushu, d.shokushu) : M.item(m.side, d.side);
    const thick = [d.soupThick ? '汁 ' + M.label(m.thick, d.soupThick) : '', d.drinkThick ? '飲み物 ' + M.label(m.thick, d.drinkThick) : ''].filter(Boolean).join('／');
    // 禁止: 食べさせてはいけないもの
    const nots = [];
    d.allergy.forEach((a) => nots.push({ t: a, alg: true }));
    d.kinshi.forEach((k) => nots.push({ t: k.food + (k.sub ? ' → ' + k.sub : ''), alg: false }));
    // 指示: どう出すか
    const dos = [];
    if (thick) dos.push('とろみ ' + thick);
    if (d.portion) dos.push(M.label(m.portion, d.portion));
    if (d.tools.length) dos.push(d.tools.join('・'));
    if (M.suppText(d)) dos.push('補食 ' + M.suppText(d));
    if (M.condText(d, m)) dos.push(M.condText(d, m));
    if (d.assist) dos.push(M.label(m.assist, d.assist));
    if (d.place) dos.push(d.place);
    if (d.notes) dos.push(d.notes);
    return h('div', { class: 'fcard', style: 'width:' + lay.w + 'mm;height:' + lay.h + 'mm;--u:' + (lay.h / 55).toFixed(3) },
      h('div', { class: 'fc-band', style: 'background:' + ((colorOf && colorOf.color) || '#e5e7eb') },
        h('span', null, V.where(r)), h('span', null, M.label(m.shokushu, d.shokushu)),
        h('span', null, M.label(m.meals, slot.m) + (changed ? ' ★変更' : ''))),
      h('div', { class: 'fc-name' }, r.name, h('span', { class: 'fc-sama' }, ' ' + V.t('suffix')), r.kana ? h('span', { class: 'fc-kana' }, r.kana) : null),
      h('div', { class: 'fc-main' },
        h('div', null, h('span', { class: 'fc-k' }, '主食'), M.label(m.staple, d.staple) + (d.stapleG ? ' ' + d.stapleG + 'g' : '')),
        h('div', null, h('span', { class: 'fc-k' }, '副食'), M.label(m.side, d.side))),
      h('div', { class: 'fc-two' },
        h('div', { class: 'fc-not' + (nots.length ? '' : ' empty') },
          h('span', { class: 'fc-h' }, '禁止'),
          nots.length ? nots.map((x) => h('span', { class: 'fc-item' + (x.alg ? ' alg' : '') }, x.t)) : h('span', { class: 'fc-none' }, 'なし')),
        h('div', { class: 'fc-do' },
          h('span', { class: 'fc-h' }, '指示'),
          dos.length ? dos.map((x) => h('span', { class: 'fc-item' }, x)) : h('span', { class: 'fc-none' }, 'なし'))));
  }

  App.registerScreen('cards', async function (params, root) {
    const m = ms(), meals = M.activeMeals(m), next = V.nextSlot();
    const date = params[0] || next.d;
    const mealId = params[1] || (date === next.d ? next.m : meals[0].id);
    const slot = { d: date, m: mealId };
    const lay = M.item(m.cardLayouts, st.layout) || m.cardLayouts[0];
    const residents = await DB.residents();
    const cen = M.census(residents, slot, m);
    const changed = M.cardChangedIds(residents, date, m);
    const units = Array.from(new Set(cen.rows.map((x) => x.r.unit).filter(Boolean))).sort();

    let rows = cen.rows.filter((x) => x.diet && (!st.unit || x.r.unit === st.unit) && (!st.onlyChanged || changed[x.r.id]))
      .sort((a, b) => (a.r.unit + a.r.room).localeCompare(b.r.unit + b.r.room, 'ja') || (a.r.kana || a.r.name).localeCompare(b.r.kana || b.r.name, 'ja'));
    const picked = rows.filter((x) => !st.off[x.r.id]);

    root.appendChild(h('header', { class: 'topbar no-print' }, h('h1', null, '食札　' + U.fmtDate(date, true) + ' ' + M.label(m.meals, mealId)),
      h('button', { class: 'btn primary big', onclick: () => window.print(), disabled: !picked.length }, picked.length + ' 枚を印刷')));
    root.appendChild(subTabs('cards', date));
    root.appendChild(V.dateBar(date, (d) => App.go('#/cards/' + d + '/' + mealId)));
    root.appendChild(h('div', { class: 'toolrow no-print' },
      meals.map((ml) => h('a', { class: 'btn seg' + (ml.id === mealId ? ' on' : ''), href: '#/cards/' + date + '/' + ml.id }, ml.label)),
      h('span', { class: 'gap' }),
      h('button', { class: 'btn seg' + (st.onlyChanged ? ' on' : ''), onclick: () => { st.onlyChanged = !st.onlyChanged; st.off = {}; App.refresh(); } },
        '変更があった人だけ（' + cen.rows.filter((x) => changed[x.r.id]).length + '）'),
      units.length > 1 ? U.select(units.map((u) => ({ id: u, label: u })), st.unit, { emptyLabel: '全ユニット', onchange: (e) => { st.unit = e.target.value; App.refresh(); } }) : null,
      U.select(m.cardLayouts, lay.id, { noEmpty: true, onchange: (e) => { st.layout = e.target.value; App.refresh(); } })));
    if (cen.noDiet.length) root.appendChild(h('div', { class: 'card warn no-print' }, '食事情報が未設定のため食札を作れない人: ', cen.noDiet.map((r) => [h('a', { href: '#/resident/' + r.id }, r.name), '　'])));
    root.appendChild(h('div', { class: 'card info no-print' }, '印刷するときは、ブラウザの印刷画面で「余白: なし」「倍率: 100%」にしてください。用紙に合わない時は、設定の「食札の面付け」で数字を直せます。'));

    // 刷る人を選ぶ
    root.appendChild(h('details', { class: 'no-print' }, h('summary', null, '刷る人を選ぶ（' + picked.length + ' / ' + rows.length + '）'),
      h('div', { class: 'pickgrid' }, rows.map((x) => h('label', { class: 'check' }, h('input', { type: 'checkbox', checked: !st.off[x.r.id],
        onchange: (e) => { st.off[x.r.id] = !e.target.checked; App.refresh(); } }), ' ' + V.where(x.r) + ' ' + x.r.name + (changed[x.r.id] ? ' ★' : ''))))));

    if (!picked.length) { root.appendChild(h('div', { class: 'empty' }, 'この条件で刷る食札はありません。')); return; }
    root.appendChild(h('style', null, '@media print { @page { size: A4 portrait; margin: 0; } body { background: #fff; } }'));
    const per = lay.cols * lay.rows;
    for (let i = 0; i < picked.length; i += per) {
      root.appendChild(h('div', { class: 'sheet', style: 'padding:' + lay.mt + 'mm 0 0 ' + lay.ml + 'mm;' },
        h('div', { class: 'sheet-grid', style: 'grid-template-columns:repeat(' + lay.cols + ',' + lay.w + 'mm);gap:' + lay.gy + 'mm ' + lay.gx + 'mm;' },
          picked.slice(i, i + per).map((x) => card(x.r, x.diet, slot, lay, changed[x.r.id])))));
    }
  });

  App.registerScreen('kinshi', async function (params, root) {
    const m = ms(), meals = M.activeMeals(m);
    const date = params[0] || U.today();
    const residents = await DB.residents();
    const rows = [];
    residents.forEach((r) => {
      if (r.archived) return;
      const ml = meals.find((x) => M.presence(r, { d: date, m: x.id }, m.meals).state !== 'out');
      if (!ml) return;
      const d = M.dietAt(r, { d: date, m: meals[meals.length - 1].id }, m.meals) || M.dietAt(r, { d: date, m: ml.id }, m.meals);
      if (d && (d.allergy.length || d.kinshi.length)) rows.push({ r: r, d: d });
    });
    rows.sort((a, b) => (a.r.unit + a.r.room).localeCompare(b.r.unit + b.r.room, 'ja'));
    root.appendChild(h('header', { class: 'topbar' }, h('h1', null, '禁食・アレルギー一覧　' + U.fmtDate(date, true)),
      h('button', { class: 'btn no-print', onclick: () => window.print() }, '印刷')));
    root.appendChild(subTabs('kinshi', date));
    root.appendChild(V.dateBar(date, (d) => App.go('#/kinshi/' + d)));
    root.appendChild(rows.length ? h('table', { class: 'list bordered' },
      h('thead', null, h('tr', null, ['場所', '氏名', '区分', 'アレルギー', '禁食 → 代わりの物', '食種・形態'].map((t) => h('th', null, t)))),
      h('tbody', null, rows.map((x) => h('tr', null, h('td', null, V.where(x.r)), h('td', null, h('a', { href: '#/resident/' + x.r.id }, x.r.name)), h('td', null, V.catLabel(x.r)),
        h('td', { class: 'bad-text' }, x.d.allergy.join('、')), h('td', null, x.d.kinshi.map((k) => h('div', null, k.food + (k.sub ? ' → ' + k.sub : '')))),
        h('td', { class: 'sub' }, V.dietShort(x.d)))))) : h('div', { class: 'empty' }, 'この日に在籍する人で、禁食・アレルギーの登録がある人はいません。'));
    // 食品ごとの逆引き（献立を見ながら「今日の鶏肉は誰がだめか」を引く）
    const byFood = {};
    rows.forEach((x) => { x.d.allergy.forEach((f) => { (byFood[f] = byFood[f] || []).push(x.r.name + '（ア）'); }); x.d.kinshi.forEach((k) => { (byFood[k.food] = byFood[k.food] || []).push(x.r.name + (k.sub ? '→' + k.sub : '')); }); });
    if (rows.length) root.appendChild(h('section', { class: 'card' }, h('h2', null, '食品から引く'),
      h('table', { class: 'list' }, h('tbody', null, Object.keys(byFood).sort((a, b) => a.localeCompare(b, 'ja')).map((f) => h('tr', null, h('th', null, f), h('td', null, byFood[f].length + '人'), h('td', null, byFood[f].join('、'))))))));
  });

  // 献立を持たない施設でも使える「今日出る物」の突き合わせ
  App.registerScreen('check', async function (params, root) {
    const m = ms(), meals = M.activeMeals(m);
    const date = params[0] || U.today();
    const mealId = params[1] || meals[0].id;
    const residents = await DB.residents();
    let words = [];
    try { words = JSON.parse(localStorage.getItem('eiyo.checkWords') || '[]'); } catch (e) { words = []; }
    root.appendChild(h('header', { class: 'topbar' }, h('h1', null, '出る物から当たる人をさがす'),
      h('button', { class: 'btn no-print', onclick: () => window.print() }, '印刷')));
    root.appendChild(h('div', { class: 'sub' }, '献立表を見ながら、その食事に出る物を入れてください（例: パン、鶏肉、えび、そば）。禁食・アレルギーに当たる人を出します。'));
    root.appendChild(subTabs('check', date));
    root.appendChild(V.dateBar(date, (d) => App.go('#/check/' + d + '/' + mealId)));
    root.appendChild(h('div', { class: 'toolrow no-print' },
      meals.map((ml) => h('a', { class: 'btn seg' + (ml.id === mealId ? ' on' : ''), href: '#/check/' + date + '/' + ml.id }, ml.label))));
    const chips = U.chipList(words, m.allergens.concat(['パン', '麺', 'ごはん', '魚', '肉']), '出る物を入れて Enter');
    const out = h('div');
    const draw = () => {
      const w = chips.peek();
      try { localStorage.setItem('eiyo.checkWords', JSON.stringify(w)); } catch (e) { /* 覚えられなくても続ける */ }
      const rows = M.restrictionsAt(residents, { d: date, m: mealId }, m, w);
      out.innerHTML = '';
      if (!w.length) { out.appendChild(h('div', { class: 'empty' }, '出る物を入れると、当たる人が出ます。')); return; }
      out.appendChild(h('div', { class: 'sub' }, U.fmtDate(date, true) + ' ' + M.label(m.meals, mealId) + ' に食べる人のうち ' + rows.length + ' 人'));
      out.appendChild(rows.length ? h('table', { class: 'list bordered' },
        h('thead', null, h('tr', null, ['場所', '氏名', '当たるもの', '代わりの物', '今の食事'].map((t) => h('th', null, t)))),
        h('tbody', null, rows.map((x) => h('tr', null,
          h('td', null, V.where(x.r)), h('td', null, h('a', { href: '#/resident/' + x.r.id }, x.r.name)),
          h('td', null, x.hits.map((hh) => h('div', { class: hh.kind === 'allergy' ? 'bad-text' : 'warn-text' },
            (hh.kind === 'allergy' ? 'アレルギー ' : '禁食 ') + hh.word))),
          h('td', null, x.hits.map((hh) => h('div', null, hh.sub || '—'))),
          h('td', { class: 'sub' }, V.dietShort(x.diet))))))
        : h('div', { class: 'card ok' }, '当たる人はいません。'));
      out.appendChild(h('div', { class: 'sub' }, '名前の一致で拾っています。加工品（マヨネーズに卵、ちくわに小麦 など）は名前に出ないので漏れます。原材料を確かめてください。'));
    };
    const btn = h('button', { class: 'btn primary no-print', onclick: draw }, 'さがす');
    root.appendChild(h('div', { class: 'toolrow no-print' }, chips, btn));
    root.appendChild(out);
    draw();
  });

  App.registerNav({ order: 40, feature: 'cards', label: '食札', icon: '🏷️', hash: '#/cards', match: ['cards', 'kinshi', 'check'] });
})();
