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

  // 食札に載せられるもの。どれを・どの欄に・どんな見出しで出すかは 設定 → 食札の中身 で変えられる。
  // 帯（3 つまで）／本文（見出し＋値）／指示欄（並べるだけ）の 3 か所に割り振る形にした。
  // 禁止（読み落とすと事故）は外せない。献ダテマンの「禁止」「指示」の 2 列に合わせてある。
  const ITEMS = [
    { id: 'where', label: '場所（ユニット・部屋）', get: (c) => V.where(c.r) },
    { id: 'unit', label: 'ユニット', get: (c) => c.r.unit },
    { id: 'room', label: '部屋', get: (c) => c.r.room },
    { id: 'meal', label: '食事（朝昼夕）', get: (c) => M.label(c.m.meals, c.slot.m) },
    { id: 'shokushu', label: '食種', get: (c) => M.label(c.m.shokushu, c.d.shokushu) },
    { id: 'category', label: '区分（入所・ショート等）', get: (c) => M.label(c.m.categories, c.r.category) },
    { id: 'staple', label: '主食', get: (c) => M.label(c.m.staple, c.d.staple) + (c.d.stapleG ? ' ' + c.d.stapleG + 'g' : '') },
    { id: 'side', label: '副食', get: (c) => M.label(c.m.side, c.d.side) },
    { id: 'thick', label: 'とろみ', get: (c) => [c.d.soupThick ? '汁 ' + M.label(c.m.thick, c.d.soupThick) : '',
      c.d.drinkThick ? '飲み物 ' + M.label(c.m.thick, c.d.drinkThick) : ''].filter(Boolean).join('／') },
    { id: 'portion', label: '量の指示', get: (c) => M.label(c.m.portion, c.d.portion) },
    { id: 'tools', label: '食器・自助具', get: (c) => c.d.tools.join('・') },
    { id: 'supp', label: '補食', get: (c) => M.suppText(c.d) },
    { id: 'cond', label: '条件つきの指示', get: (c) => M.condText(c.d, c.m) },
    { id: 'assist', label: '介助', get: (c) => M.label(c.m.assist, c.d.assist) },
    { id: 'place', label: '食べる場所・席', get: (c) => c.d.place },
    { id: 'notes', label: '注意', get: (c) => c.d.notes },
    { id: 'age', label: '年齢', get: (c) => { const a = M.age(c.r.birth, c.slot.d); return a == null ? '' : a + '歳'; } },
    { id: 'careLevel', label: '要介護度', get: (c) => c.r.careLevel }
  ];
  const DEFAULT_TEMPLATE = {
    band: ['where', 'shokushu', 'meal'],
    main: ['staple', 'side'],
    do: ['thick', 'portion', 'tools', 'supp', 'cond', 'assist', 'place', 'notes'],
    labels: {}, notLabel: '禁止', doLabel: '指示', kana: true, suffix: true
  };
  const Cards = { ITEMS: ITEMS, DEFAULT_TEMPLATE: DEFAULT_TEMPLATE };
  Cards.item = (id) => ITEMS.find((x) => x.id === id) || null;
  Cards.template = function () {
    const t = ms().cardTemplate;
    if (!t) return DEFAULT_TEMPLATE;
    return Object.assign({}, DEFAULT_TEMPLATE, t, { labels: Object.assign({}, t.labels || {}) });
  };
  Cards.labelOf = (t, id) => (t.labels && t.labels[id]) || (Cards.item(id) || { label: id }).label;

  // 1 枚の食札。禁止（読み落とすと事故）と 指示（読み落とすと作業のやり直し）を分けて出す。
  function card(r, d, slot, lay, changed) {
    const m = ms(), t = Cards.template();
    const ctx = { r: r, d: d, slot: slot, m: m };
    const colorOf = m.cardColorBy === 'shokushu' ? M.item(m.shokushu, d.shokushu) : M.item(m.side, d.side);
    const val = (id) => { const it = Cards.item(id); return it ? String(it.get(ctx) || '') : ''; };
    // 禁止: 食べさせてはいけないもの（外せない）
    const nots = [];
    d.allergy.forEach((a) => nots.push({ t: a, alg: true }));
    d.kinshi.forEach((k) => nots.push({ t: k.food + (k.sub ? ' → ' + k.sub : ''), alg: false }));
    // 指示: どう出すか
    const dos = [];
    (t.do || []).forEach((id) => {
      const v = val(id);
      if (!v) return;
      const lb = (t.labels && t.labels[id]);
      dos.push(lb ? lb + ' ' + v : (id === 'thick' ? 'とろみ ' + v : (id === 'supp' ? '補食 ' + v : v)));
    });
    const band = (t.band || []).slice(0, 3);
    return h('div', { class: 'fcard', style: 'width:' + lay.w + 'mm;height:' + lay.h + 'mm;--u:' + (lay.h / 55).toFixed(3) },
      h('div', { class: 'fc-band', style: 'background:' + ((colorOf && colorOf.color) || '#e5e7eb') },
        band.map((id, i) => h('span', null, val(id) + (changed && i === band.length - 1 ? ' ★変更' : '')))),
      h('div', { class: 'fc-name' }, r.name, t.suffix ? h('span', { class: 'fc-sama' }, ' ' + V.t('suffix')) : null,
        (t.kana && r.kana) ? h('span', { class: 'fc-kana' }, r.kana) : null),
      h('div', { class: 'fc-main' }, (t.main || []).map((id) => {
        const v = val(id);
        return v ? h('div', null, h('span', { class: 'fc-k' }, Cards.labelOf(t, id)), v) : null;
      })),
      h('div', { class: 'fc-two' },
        h('div', { class: 'fc-not' + (nots.length ? '' : ' empty') },
          h('span', { class: 'fc-h' }, t.notLabel || '禁止'),
          nots.length ? nots.map((x) => h('span', { class: 'fc-item' + (x.alg ? ' alg' : '') }, x.t)) : h('span', { class: 'fc-none' }, 'なし')),
        h('div', { class: 'fc-do' },
          h('span', { class: 'fc-h' }, t.doLabel || '指示'),
          dos.length ? dos.map((x) => h('span', { class: 'fc-item' }, x)) : h('span', { class: 'fc-none' }, 'なし'))));
  }
  Cards.card = card;
  window.Cards = Cards;

  // ---- 設定: 食札の中身 ----
  // 面付け（用紙のどこに何枚）は別の設定。ここは 1 枚の中に何を書くか。
  App.registerSettings({ order: 33, title: '食札の中身', render: function () {
    const m = ms();
    if (!m.cardTemplate) m.cardTemplate = JSON.parse(JSON.stringify(DEFAULT_TEMPLATE));
    const t = m.cardTemplate;
    ['band', 'main', 'do'].forEach((k) => { if (!Array.isArray(t[k])) t[k] = DEFAULT_TEMPLATE[k].slice(); });
    t.labels = t.labels || {};
    const box = h('div'), prev = h('div', { class: 'card' });
    const AREAS = [
      { k: 'band', label: '帯（上の色つきの行）', note: '3 つまで。4 つ目から先は刷られません' },
      { k: 'main', label: '本文（見出し＋大きな字）', note: '主食・副食のような、配膳のときに一番見る所' },
      { k: 'do', label: '指示の欄（右下）', note: 'とろみ・自助具・注意など。空のものは出ません' }
    ];
    const save = async () => { await window.Master.save(); draw(); };
    function where(id) { return AREAS.map((a) => a.k).find((k) => t[k].indexOf(id) >= 0) || ''; }
    function drawPreview() {
      // 見本の 1 人でそのまま描く
      const r = { id: 'x', name: '山田 ハナ', kana: 'ヤマダ ハナ', unit: '1F', room: '101', category: 'long',
        birth: '1938-04-02', careLevel: '23' };
      const d = Object.assign(M.emptyDiet(), { shokushu: (m.shokushu[0] || {}).id || '', staple: (m.staple[2] || m.staple[0] || {}).id || '',
        stapleG: 120, side: (m.side[2] || m.side[0] || {}).id || '', drinkThick: (m.thick[1] || {}).id || '',
        allergy: ['えび'], kinshi: [{ food: '牛乳', sub: '豆乳' }], tools: ['大スプーン'],
        supplements: [{ name: '高カロリーゼリー', when: '15時' }], assist: (m.assist[2] || {}).id || '', notes: '一口量を少なめに' });
      const lay = m.cardLayouts[0];
      prev.innerHTML = '';
      prev.appendChild(h('div', { class: 'sub' }, '見本（' + lay.label + '）'));
      prev.appendChild(card(r, d, { d: U.today(), m: M.activeMeals(m)[0].id }, lay, true));
    }
    function draw() {
      box.innerHTML = '';
      AREAS.forEach((area) => {
        const wrap = h('div', { class: 'card sub-card' }, h('h3', null, area.label), h('div', { class: 'sub' }, area.note));
        const tb = h('tbody');
        t[area.k].forEach((id, i) => {
          const it = Cards.item(id);
          const lab = h('input', { class: 'input', type: 'text', value: t.labels[id] || '',
            placeholder: it ? it.label : id });
          lab.addEventListener('change', async () => {
            const v = lab.value.trim();
            if (v) t.labels[id] = v; else delete t.labels[id];
            await save();
          });
          tb.appendChild(h('tr', null,
            h('th', null, it ? it.label : id + '（無い項目）'),
            h('td', null, area.k === 'band' ? h('span', { class: 'sub' }, '見出しは出ません') : lab),
            h('td', null,
              h('button', { class: 'btn small', disabled: i === 0, onclick: async () => { const x = t[area.k].splice(i, 1)[0]; t[area.k].splice(i - 1, 0, x); await save(); } }, '▲'),
              h('button', { class: 'btn small', disabled: i === t[area.k].length - 1, onclick: async () => { const x = t[area.k].splice(i, 1)[0]; t[area.k].splice(i + 1, 0, x); await save(); } }, '▼'),
              h('button', { class: 'btn small', onclick: async () => { t[area.k].splice(i, 1); await save(); } }, '外す'))));
        });
        if (!t[area.k].length) tb.appendChild(h('tr', null, h('td', { colspan: '3', class: 'sub' }, '（何も出ません）')));
        wrap.appendChild(h('table', { class: 'list edit' },
          h('thead', null, h('tr', null, ['項目', '見出しの言葉', ''].map((x) => h('th', null, x)))), tb));
        // まだどこにも置いていない項目
        const rest = ITEMS.filter((x) => !where(x.id));
        if (rest.length) {
          const sel = U.select(rest, '', { emptyLabel: '（足す項目をえらぶ）' });
          sel.addEventListener('change', async () => {
            if (!sel.value) return;
            if (area.k === 'band' && t.band.length >= 3) { U.toast('帯は 3 つまでです', true); sel.value = ''; return; }
            t[area.k].push(sel.value); await save();
          });
          wrap.appendChild(h('div', { class: 'toolrow' }, sel));
        }
        box.appendChild(wrap);
      });
      // 禁止・指示の見出しと、氏名まわり
      const notL = h('input', { class: 'input', type: 'text', value: t.notLabel || '' });
      const doL = h('input', { class: 'input', type: 'text', value: t.doLabel || '' });
      notL.addEventListener('change', async () => { t.notLabel = notL.value.trim() || '禁止'; await save(); });
      doL.addEventListener('change', async () => { t.doLabel = doL.value.trim() || '指示'; await save(); });
      const kana = h('input', { type: 'checkbox', checked: t.kana !== false });
      const suf = h('input', { type: 'checkbox', checked: t.suffix !== false });
      kana.addEventListener('change', async () => { t.kana = kana.checked; await save(); });
      suf.addEventListener('change', async () => { t.suffix = suf.checked; await save(); });
      box.appendChild(h('div', { class: 'card sub-card' }, h('h3', null, 'その他'),
        h('div', { class: 'grid2' }, U.field('左下の欄の見出し', notL, 'アレルギーと禁食が入ります。この欄は外せません'),
          U.field('右下の欄の見出し', doL)),
        h('label', { class: 'check' }, kana, ' ふりがなを出す'),
        h('label', { class: 'check' }, suf, ' 氏名のうしろに「' + V.t('suffix') + '」を付ける')));
      drawPreview();
    }
    draw();
    return h('div', null,
      h('div', { class: 'sub' }, '食札 1 枚の中に何を書くかを決めます。用紙のどこに何枚並べるかは「食札の面付け」で別に決めます。'),
      prev, box,
      h('button', { class: 'btn danger-outline', onclick: async () => {
        if (!await U.confirm('食札の中身を最初の状態に戻します。', { okLabel: '戻す', danger: true })) return;
        m.cardTemplate = JSON.parse(JSON.stringify(DEFAULT_TEMPLATE)); await window.Master.save(); App.refresh();
      } }, '最初の状態に戻す'));
  } });


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
