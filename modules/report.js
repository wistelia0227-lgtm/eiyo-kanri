// 給食の帳票（削除可能）: 食品構成表 / 栄養出納表（栄養月報）/ 栄養管理報告書 の 3 つ。
// 献立に入れた料理の材料から、食品群ごとの重量と栄養量を出す。手で数え直さなくて済むようにするのが目的。
// 根拠: 横浜市「健康増進法に基づく給食施設のための栄養管理の手引き（2025年改訂版）」の帳票一覧と栄養管理報告書の様式（調査 02 の 5.2）。
//   様式は自治体ごとに違うので、集計するところまでをこの画面が持ち、紙の様式への転記は印刷とCSVに任せる。
(function () {
  'use strict';
  const U = window.U, h = U.h, DB = window.DB, M = window.Model, N = window.Nutri, V = window.View;
  const FG = window.FoodGroup, Foods = window.Foods, Dishes = window.Dishes, Menu = window.Menu, App = window.App;
  const ms = () => window.Master.current;
  const R = {};
  let tab = 'comp', shokushu = '', month = '', mode = 'plan';

  R.TABS = [{ id: 'comp', label: '食品構成表' }, { id: 'out', label: '栄養出納表（月報）' }, { id: 'kanri', label: '栄養管理報告書' }];

  // ---- 期間の集計 ----
  R.monthNow = () => U.today().slice(0, 7);
  R.daysOf = function (ym) {
    const y = parseInt(ym.slice(0, 4), 10), mo = parseInt(ym.slice(5, 7), 10);
    const last = new Date(y, mo, 0).getDate();
    const out = [];
    for (let i = 1; i <= last; i++) out.push(ym + '-' + String(i).padStart(2, '0'));
    return out;
  };
  R.addMonth = function (ym, k) {
    const y = parseInt(ym.slice(0, 4), 10), mo = parseInt(ym.slice(5, 7), 10) + k;
    const d = new Date(y, mo - 1, 1);
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
  };

  // その日・その食種の材料（1 人分に直したもの）を集める
  R.itemsOfDay = function (rec, meals, sId, dishMap, md) {
    const out = [];
    meals.forEach((ml) => {
      Menu.dishesBy(rec, ml.id, sId, md).forEach((c) => {
        const d = dishMap[c.dishId];
        if (!d) return;
        const per = Math.max(1, Number(d.servings) || 1), x = (c.x == null ? 1 : Number(c.x)) || 0;
        (d.items || []).forEach((it) => { if (it.g) out.push({ no: it.no, g: it.g / per * x }); });
      });
    });
    return out;
  };

  // 期間ぶんを 1 回で集める。献立が空の日は数に入れない（平均が薄まるため）
  R.gather = async function (days, sId, md) {
    const m = ms(), meals = M.activeMeals(m);
    const dishMap = {};
    (await Dishes.all()).forEach((d) => { dishMap[d.id] = d; });
    const classify = FG.classifier(N);
    const perDay = [], itemsAll = [];
    let group = FG.emptyTally(), nut = N.empty(), filled = 0;
    for (const d of days) {
      const rec = await Menu.get(d);
      const items = R.itemsOfDay(rec, meals, sId, dishMap, md);
      if (!items.length) { perDay.push({ date: d, empty: true }); continue; }
      filled++;
      items.forEach((it) => itemsAll.push(it));
      const g = FG.tally(items, classify), s = N.sum(items);
      group = FG.addTally(group, g); nut = N.add(nut, s);
      perDay.push({ date: d, empty: false, group: g, nut: s });
    }
    const k = 1 / Math.max(1, filled);
    return { perDay: perDay, filled: filled, days: days, itemsAll: itemsAll, mode: md || 'plan',
      group: group, nut: nut, avgGroup: FG.scaleTally(group, k), avgNut: N.scale(nut, k), dishMap: dishMap, classify: classify };
  };

  // ---- 画面 ----
  function head(root, sId, ym, extra) {
    const m = ms();
    root.appendChild(h('header', { class: 'topbar' }, h('h1', null, '帳票　' + ym.replace('-', '年') + '月'),
      h('div', { class: 'no-print' }, h('button', { class: 'btn', onclick: () => window.print() }, '印刷'), extra || null)));
    root.appendChild(h('div', { class: 'toolrow no-print' },
      R.TABS.map((t) => h('button', { class: 'btn seg' + (tab === t.id ? ' on' : ''), onclick: () => { tab = t.id; App.refresh(); } }, t.label)),
      h('span', { class: 'gap' }),
      h('button', { class: 'btn', onclick: () => { month = R.addMonth(ym, -1); App.refresh(); } }, '◀ 前月'),
      h('button', { class: 'btn', onclick: () => { month = R.monthNow(); App.refresh(); } }, '今月'),
      h('button', { class: 'btn', onclick: () => { month = R.addMonth(ym, 1); App.refresh(); } }, '次月 ▶'),
      h('span', { class: 'gap' }), h('span', { class: 'sub' }, '食種'),
      U.select(m.shokushu, sId, { noEmpty: true, onchange: (e) => { shokushu = e.target.value; App.refresh(); } }),
      h('span', { class: 'gap' }), h('span', { class: 'sub' }, '何の量か'),
      window.Menu.MODES.map((x) => h('button', { class: 'btn seg' + (mode === x.id ? ' on' : ''),
        onclick: () => { mode = x.id; App.refresh(); } }, x.label))));
  }

  // 群の表（目標と実績）
  function groupTable(avg, comp, sId, onEdit) {
    const rows = FG.GROUPS.filter((g) => (avg.g[g.id] || comp[g.id]));
    const inReport = {}; FG.REPORT_ROWS.forEach((r) => { inReport[r.id] = true; });
    const num = (v) => v == null ? '—' : Math.round(v) + ' g';
    return h('table', { class: 'list bordered' },
      h('thead', null, h('tr', null, ['食品群', '目標（1人1日）', '実績（1人1日平均）', '差', ''].map((t) => h('th', null, t)))),
      h('tbody', null, rows.map((g) => {
        const t = comp[g.id] == null ? null : Number(comp[g.id]);
        const a = avg.g[g.id] || 0;
        const diff = t == null ? null : a - t;
        const cls = t == null ? '' : (Math.abs(diff) <= Math.max(5, t * 0.1) ? '' : (diff < 0 ? 'j-low' : 'j-high'));
        return h('tr', null,
          h('th', null, g.label, inReport[g.id] ? null : h('span', { class: 'sub' }, '（報告書の欄に無い）')),
          h('td', { class: 'no-print-border' }, onEdit ? h('input', { class: 'input num', type: 'number', min: '0', step: '1', value: t == null ? '' : t,
            onchange: (e) => onEdit(g.id, e.target.value) }) : num(t)),
          h('td', { class: cls }, num(a)),
          h('td', { class: cls }, diff == null ? '—' : (diff > 0 ? '+' : '') + Math.round(diff) + ' g'),
          h('td', { class: 'sub' }, diff == null ? '' : (cls === 'j-low' ? '少ない' : cls === 'j-high' ? '多い' : 'おおむね合う')));
      }),
      avg.unknown ? h('tr', null, h('th', null, '群が分からなかった分'), h('td', null, '—'), h('td', { class: 'warn-text' }, num(avg.unknown)), h('td'), h('td', { class: 'sub' }, '成分表に無い食品番号')) : null));
  }

  App.registerScreen('report', async function (params, root) {
    const m = ms();
    if (params[0] && R.TABS.some((t) => t.id === params[0])) tab = params[0];
    const ym = month || (params[1] || R.monthNow());
    month = ym;
    const sId = shokushu || (m.shokushu[0] && m.shokushu[0].id);
    if (!sId) { root.appendChild(h('div', { class: 'empty' }, '食種がありません。設定 → 呼び方（マスタ）で足してください。')); return; }
    const days = R.daysOf(ym);
    const data = await R.gather(days, sId, mode);
    head(root, sId, ym);

    if (!data.filled) {
      root.appendChild(h('div', { class: 'card warn' }, 'この月の ' + M.label(m.shokushu, sId) + ' の献立がまだ入っていません。',
        ' ', h('a', { class: 'btn no-print', href: '#/menu/' + days[0] }, '献立を開く')));
      return;
    }
    const modeLabel = (window.Menu.MODES.find((x) => x.id === mode) || {}).label || '予定';
    root.appendChild(h('div', { class: 'sub' }, '献立が入っている ' + data.filled + ' 日ぶんの「' + modeLabel + '」で計算しました（' + days.length + ' 日中）。' +
      (mode === 'eaten' ? '　残食率を入れていない料理は、そのままの量で数えています。' : '')));

    if (tab === 'comp') return drawComp(root, data, sId, ym);
    if (tab === 'out') return drawOut(root, data, sId, ym);
    return drawKanri(root, data, sId, ym);
  });

  // ---- 食品構成表 ----
  function drawComp(root, data, sId, ym) {
    const m = ms();
    m.foodComp = m.foodComp || {};
    const comp = m.foodComp[sId] = m.foodComp[sId] || {};
    const save = async () => { await window.Master.save(); };

    root.appendChild(h('section', { class: 'card' }, h('h2', null, '食品構成表　' + M.label(m.shokushu, sId)),
      h('div', { class: 'sub' }, '給与栄養目標量に見合うように、食品群ごとの 1 人 1 日当たりの目標量を決めた表です。' +
        '目標の欄に数字を入れると、実績（この月の献立の平均）と見比べられます。'),
      groupTable(data.avgGroup, comp, sId, async (id, v) => {
        const n = parseFloat(v);
        if (!(n > 0)) delete comp[id]; else comp[id] = Math.round(n);
        await save(); App.refresh();
      }),
      h('div', { class: 'toolrow no-print' },
        h('button', { class: 'btn primary', onclick: async () => {
          if (!await U.confirm('この月の実績（1 人 1 日平均）を、そのまま目標に入れます。今の目標は上書きされます。', { okLabel: '入れる' })) return;
          FG.GROUPS.forEach((g) => { const v = data.avgGroup.g[g.id]; if (v) comp[g.id] = Math.round(v); });
          await save(); U.toast('実績から目標を作りました'); App.refresh();
        } }, '実績から目標を作る'),
        h('button', { class: 'btn', onclick: () => {
          const rows = [['食品群', '目標(g)', '実績(g)', '差(g)']];
          FG.GROUPS.forEach((g) => {
            if (!comp[g.id] && !data.avgGroup.g[g.id]) return;
            const t = comp[g.id] == null ? null : Number(comp[g.id]), a = Math.round(data.avgGroup.g[g.id] || 0);
            rows.push([g.label, t == null ? '' : t, a, t == null ? '' : a - t]);
          });
          U.xlsx('食品構成表_' + ym + '.xlsx', [{ name: '食品構成表', rows: [[M.label(m.shokushu, sId) + '　' + ym], []].concat(rows) }]);
        } }, 'Excel で保存'),
        h('button', { class: 'btn danger-outline', onclick: async () => {
          if (!await U.confirm('この食種の目標を全部消します。', { okLabel: '消す', danger: true })) return;
          m.foodComp[sId] = {}; await save(); App.refresh();
        } }, '目標を消す'))));

    // 荷重平均成分値（群 100g 当たり）。食品構成から栄養量を見積もるときに使う
    root.appendChild(h('section', { class: 'card' }, h('h2', null, '目標の食品構成で取れる栄養量（目安）'),
      h('div', { class: 'sub' }, 'この月の献立から群ごとの荷重平均成分値（その群 100g 当たり）を出し、上の目標量を掛けたものです。' +
        '群の中の食品の使い方が変わると値も変わるので、目安として見てください。'),
      compEstimate(data, comp, sId)));
  }

  // 群ごとの荷重平均成分値 × 目標量
  function compEstimate(data, comp, sId) {
    const keys = Foods.shownKeys();
    // この月に使った材料を群ごとにまとめ、群 100g 当たりの平均成分（荷重平均成分値）を作る
    const acc = {}; // 群 → { sum, g }
    const classify = data.classify;
    data.itemsAll.forEach((it) => {
      const k = classify(it.no);
      if (!k) return;
      const a = acc[k] = acc[k] || { sum: N.empty(), g: 0 };
      a.sum = N.add(a.sum, N.sum([it])); a.g += it.g;
    });
    let est = N.empty();
    const rows = [];
    FG.GROUPS.forEach((g) => {
      const t = comp[g.id]; if (!t) return;
      const a = acc[g.id];
      if (!a || !a.g) { rows.push({ g: g, t: t, none: true }); return; }
      const one = N.scale(a.sum, t / a.g); // 群の平均成分 × 目標量
      est = N.add(est, one);
      rows.push({ g: g, t: t, one: one });
    });
    if (!rows.length) return h('div', { class: 'sub' }, '目標量を入れると、ここに栄養量が出ます。');
    const tgt = Menu.targetOf(sId);
    const body = h('tbody', null,
      rows.map((r) => h('tr', null, h('th', null, r.g.label), h('td', null, r.t + ' g'),
        keys.map((k) => h('td', null, r.none ? h('span', { class: 'sub' }, '—') : N.fmt(k, r.one.values[k]))))),
      h('tr', { class: 'total' }, h('th', null, '合計'), h('td', null, rows.reduce((s, r) => s + r.t, 0) + ' g'),
        keys.map((k) => {
          const j = tgt ? N.judge(tgt.target, k, est.values[k]) : null;
          return h('td', { class: j ? 'j-' + j : '' }, N.fmt(k, est.values[k]));
        })));
    const note = [tgt ? '青＝目標の下限より少ない　赤＝上限より多い（給与栄養目標量 ' + tgt.energy + ' kcal と比べています）。' : '',
      rows.some((r) => r.none) ? '「—」の群はこの月の献立に出てこなかったので、平均成分値が出せません。' : ''].filter(Boolean).join('');
    return h('div', null,
      h('div', { class: 'scroll-x' }, h('table', { class: 'list bordered' },
        h('thead', null, h('tr', null, ['食品群', '目標量'].concat(keys.map((k) => Foods.nutrient(k).name)).map((t) => h('th', null, t)))),
        body)),
      note ? h('div', { class: 'sub' }, note) : null);
  }

  // ---- 栄養出納表（栄養月報）----
  function drawOut(root, data, sId, ym) {
    const m = ms();
    const keys = Foods.shownKeys();
    const tgt = Menu.targetOf(sId);
    root.appendChild(h('section', { class: 'card' }, h('h2', null, '栄養出納表　' + M.label(m.shokushu, sId) + '　' + ym.replace('-', '年') + '月'),
      h('div', { class: 'sub' }, '毎日の提供栄養量と、その月の 1 人 1 日平均です。目標量の達成状況を見るための表（推定栄養摂取量表・栄養月報）にあたります。'),
      h('div', { class: 'scroll-x' }, h('table', { class: 'list bordered small' },
        h('thead', null, h('tr', null, ['日'].concat(keys.map((k) => Foods.nutrient(k).name + '(' + Foods.nutrient(k).unit + ')')).map((t) => h('th', null, t)))),
        h('tbody', null,
          data.perDay.map((d) => d.empty ? null : h('tr', null, h('th', null, U.fmtDate(d.date).replace(/^.*\//, '') + '日'),
            keys.map((k) => {
              const j = tgt ? N.judge(tgt.target, k, d.nut.values[k]) : null;
              return h('td', { class: j ? 'j-' + j : '' }, N.fmt(k, d.nut.values[k]));
            }))).filter(Boolean),
          h('tr', { class: 'total' }, h('th', null, '平均'), keys.map((k) => {
            const j = tgt ? N.judge(tgt.target, k, data.avgNut.values[k]) : null;
            return h('td', { class: j ? 'j-' + j : '' }, N.fmt(k, data.avgNut.values[k]));
          })))))));

    if (tgt) root.appendChild(h('section', { class: 'card' }, h('h2', null, '目標量との対比（1 人 1 日平均）'),
      Foods.targetTable(data.avgNut, tgt.target, keys)));
    root.appendChild(h('section', { class: 'card' }, h('h2', null, '食品群別の平均使用量（1 人 1 日）'),
      groupTable(data.avgGroup, (m.foodComp || {})[sId] || {}, sId, null)));
    root.appendChild(h('div', { class: 'toolrow no-print' }, h('button', { class: 'btn', onclick: () => {
      const head1 = ['日'].concat(keys.map((k) => Foods.nutrient(k).name + '(' + Foods.nutrient(k).unit + ')'));
      const day = [[M.label(m.shokushu, sId) + '　' + ym + '　' + modeLabel], [], head1];
      data.perDay.forEach((d) => { if (!d.empty) day.push([d.date].concat(keys.map((k) => N.round(k, d.nut.values[k])))); });
      day.push(['平均'].concat(keys.map((k) => N.round(k, data.avgNut.values[k]))));
      const tg = [['栄養素', '提供量', '目標の下限', '目標の上限']];
      keys.forEach((k) => {
        const r = tgt && tgt.target[k];
        tg.push([Foods.nutrient(k).name + '(' + Foods.nutrient(k).unit + ')', N.round(k, data.avgNut.values[k]),
          r && r[0] != null ? r[0] : '', r && r[1] != null ? r[1] : '']);
      });
      const gr = [['食品群', '1人1日平均(g)']];
      FG.GROUPS.forEach((g) => { if (data.avgGroup.g[g.id]) gr.push([g.label, Math.round(data.avgGroup.g[g.id])]); });
      U.xlsx('栄養出納表_' + ym + '.xlsx', [{ name: '栄養出納表', rows: day }, { name: '目標との対比', rows: tg }, { name: '食品群別', rows: gr }]);
    } }, 'Excel で保存')));
  }

  // ---- 栄養管理報告書 ----
  // 表面（施設のことがら）は手で入れて保存し、裏面（集計）は今のデータから出す。
  R.INFO_FIELDS = [
    { k: 'kind', label: '施設種別', hint: '社会福祉施設／介護老人保健施設／老人福祉施設／介護医療院 など' },
    { k: 'manager', label: '管理者' },
    { k: 'policy', label: '栄養管理部門の理念・方針・目標', big: true },
    { k: 'meeting', label: '栄養管理等の検討会議（有無・回数・構成員・目的）', big: true },
    { k: 'style', label: '運営方式', hint: '直営／一部委託／委託。委託先と委託内容' },
    { k: 'staff', label: '従業者数', hint: '施設側・受託側の 管理栄養士／栄養士／調理師／調理員／事務' },
    { k: 'training', label: '研修会' },
    { k: 'addon', label: '加算の算定', hint: '栄養マネジメント強化／経口移行／経口維持／再入所時栄養連携／療養食' },
    { k: 'survey', label: '摂取量調査（残菜量調査・摂取量調査と回数）' },
    { k: 'voice', label: '利用者による給食の評価' },
    { k: 'edu', label: '栄養教育（個別・集団）' },
    { k: 'memo', label: 'その他', big: true }
  ];

  async function drawKanri(root, data, sId, ym) {
    const m = ms(), today = U.today();
    m.reportInfo = m.reportInfo || {};
    const info = m.reportInfo;
    const residents = (await DB.residents()).filter((r) => !r.archived && M.status(r, today, m.meals) === 'in');
    const weights = {};
    (await DB.getAll('measures')).forEach((x) => { if (x.kind === 'weight') { const p = weights[x.residentId]; if (!p || p.date < x.date) weights[x.residentId] = x; } });

    // 年齢階級別・性別の人数（報告書の裏面）
    const BANDS = [[0, 64, '64歳以下'], [65, 74, '65〜74歳'], [75, 84, '75〜84歳'], [85, 999, '85歳以上']];
    const byBand = {}; BANDS.forEach((b) => { byBand[b[2]] = { m: 0, f: 0 }; });
    let bmiN = 0, bmiHigh = 0, bmiLow = 0, hN = 0, wN = 0;
    residents.forEach((r) => {
      const age = M.age(r.birth, today);
      const b = BANDS.find((x) => age != null && age >= x[0] && age <= x[1]);
      if (b) byBand[b[2]][r.gender === 'm' ? 'm' : 'f']++;
      if (r.heightCm) hN++;
      const w = weights[r.id] ? weights[r.id].value : null;
      if (w) wN++;
      if (w && r.heightCm) {
        const bmi = w / Math.pow(r.heightCm / 100, 2);
        bmiN++;
        if (bmi >= 25) bmiHigh++; else if (bmi < 18.5) bmiLow++;
      }
    });
    const pct = (a, b) => b ? (a / b * 100).toFixed(1) + ' %' : '—';

    root.appendChild(h('section', { class: 'card' }, h('h2', null, '栄養管理報告書（' + ym.replace('-', '年') + '月）'),
      h('div', { class: 'sub' }, '健康増進法にもとづいて保健所に出す報告書の下ごしらえです。様式は自治体ごとに違うので、' +
        'ここで出した数字を紙の様式に書き写すか、CSV に保存して使ってください。提出の月・回数も自治体ごとに違います（年 1〜2 回）。')));

    // 表面
    const box = h('div', { class: 'grid2' });
    R.INFO_FIELDS.forEach((f) => {
      const el = f.big ? h('textarea', { class: 'input', rows: '2' }, info[f.k] || '')
        : h('input', { class: 'input', type: 'text', value: info[f.k] || '' });
      el.addEventListener('change', async () => { info[f.k] = el.value; await window.Master.save(); });
      box.appendChild(U.field(f.label, el, f.hint));
    });
    root.appendChild(h('section', { class: 'card' }, h('h2', null, '表面（施設のことがら）'),
      h('div', { class: 'sub no-print' }, '入れた内容は保存されます。次の年も残ります。'), box));

    // 裏面: 人員構成
    root.appendChild(h('section', { class: 'card' }, h('h2', null, '裏面①　喫食者の構成（今いる ' + residents.length + ' 人）'),
      h('table', { class: 'list bordered' },
        h('thead', null, h('tr', null, ['年齢階級', '男', '女', '計'].map((t) => h('th', null, t)))),
        h('tbody', null, BANDS.map((b) => h('tr', null, h('th', null, b[2]), h('td', null, byBand[b[2]].m),
          h('td', null, byBand[b[2]].f), h('td', null, byBand[b[2]].m + byBand[b[2]].f))),
          h('tr', { class: 'total' }, h('th', null, '計'),
            h('td', null, residents.filter((r) => r.gender === 'm').length),
            h('td', null, residents.filter((r) => r.gender !== 'm').length), h('td', null, residents.length)))),
      h('table', { class: 'list' }, h('tbody', null,
        h('tr', null, h('th', null, '身長を把握している人'), h('td', null, hN + ' 人（' + pct(hN, residents.length) + '）')),
        h('tr', null, h('th', null, '体重を把握している人'), h('td', null, wN + ' 人（' + pct(wN, residents.length) + '）')),
        h('tr', null, h('th', null, 'BMI 25 以上'), h('td', null, bmiHigh + ' 人（' + pct(bmiHigh, bmiN) + '）')),
        h('tr', null, h('th', null, 'BMI 18.5 未満'), h('td', null, bmiLow + ' 人（' + pct(bmiLow, bmiN) + '）')))),
      bmiN < residents.length ? h('div', { class: 'sub warn-text' }, '身長か体重が入っていない人が ' + (residents.length - bmiN) + ' 人います。BMI の割合はその人たちを除いた ' + bmiN + ' 人で出しました。') : null));

    // 裏面: 1人1日当たり平均提供食品量
    root.appendChild(h('section', { class: 'card' }, h('h2', null, '裏面②　1 人 1 日当たり平均提供食品量'),
      h('div', { class: 'sub' }, M.label(m.shokushu, sId) + 'の献立 ' + data.filled + ' 日ぶんの平均です。'),
      h('table', { class: 'list bordered' },
        h('thead', null, h('tr', null, ['食品群', '平均提供量'].map((t) => h('th', null, t)))),
        h('tbody', null, FG.REPORT_ROWS.map((r) => h('tr', null, h('th', null, r.label),
          h('td', null, Math.round(data.avgGroup.g[r.id] || 0) + ' g')))))));

    // 裏面: 栄養目標量と提供栄養量
    const tgt = Menu.targetOf(sId);
    const keys = ['kcal', 'prot', 'fat', 'ca', 'fe', 'vita', 'b1', 'b2', 'vitc', 'fib', 'na', 'nacl'].filter((k) => N.key[k] != null);
    const e = data.avgNut.values.kcal;
    const ratio = (g, kcalPerG) => (e && data.avgNut.values[g] != null) ? (data.avgNut.values[g] * kcalPerG / e * 100).toFixed(1) + ' %' : '—';
    root.appendChild(h('section', { class: 'card' }, h('h2', null, '裏面③　栄養目標量と提供栄養量（1 人 1 日平均）'),
      h('table', { class: 'list bordered' },
        h('thead', null, h('tr', null, ['栄養素', '目標量', '提供量'].map((t) => h('th', null, t)))),
        h('tbody', null, keys.map((k) => {
          const nu = Foods.nutrient(k), r = tgt && tgt.target[k];
          return h('tr', null, h('th', null, nu.name + '（' + nu.unit + '）'),
            h('td', { class: 'sub' }, r ? ((r[0] != null ? r[0] : '') + ' 〜 ' + (r[1] != null ? r[1] : '')) : '—'),
            h('td', { class: tgt ? ('j-' + (N.judge(tgt.target, k, data.avgNut.values[k]) || '')) : '' }, N.fmt(k, data.avgNut.values[k])));
        }))),
      h('table', { class: 'list' }, h('tbody', null,
        h('tr', null, h('th', null, 'たんぱく質エネルギー比'), h('td', null, ratio('prot', 4))),
        h('tr', null, h('th', null, '脂質エネルギー比'), h('td', null, ratio('fat', 9))),
        h('tr', null, h('th', null, '炭水化物エネルギー比'), h('td', null, ratio('cho', 4)))))));

    root.appendChild(h('div', { class: 'toolrow no-print' }, h('button', { class: 'btn', onclick: () => {
      const front = [['栄養管理報告書', ym], []];
      R.INFO_FIELDS.forEach((f) => front.push([f.label, info[f.k] || '']));
      const back1 = [['年齢階級', '男', '女', '計']];
      BANDS.forEach((b) => back1.push([b[2], byBand[b[2]].m, byBand[b[2]].f, byBand[b[2]].m + byBand[b[2]].f]));
      back1.push([], ['身長を把握', hN], ['体重を把握', wN], ['BMI 25以上', bmiHigh], ['BMI 18.5未満', bmiLow], ['BMI を出せた人数', bmiN]);
      const back2 = [['食品群', '1人1日平均提供量(g)']];
      FG.REPORT_ROWS.forEach((r) => back2.push([r.label, Math.round(data.avgGroup.g[r.id] || 0)]));
      const back3 = [['栄養素', '目標量の下限', '目標量の上限', '提供量']];
      keys.forEach((k) => {
        const r = tgt && tgt.target[k];
        back3.push([Foods.nutrient(k).name + '(' + Foods.nutrient(k).unit + ')',
          r && r[0] != null ? r[0] : '', r && r[1] != null ? r[1] : '', N.round(k, data.avgNut.values[k])]);
      });
      back3.push([], ['たんぱく質エネルギー比', ratio('prot', 4)], ['脂質エネルギー比', ratio('fat', 9)], ['炭水化物エネルギー比', ratio('cho', 4)]);
      U.xlsx('栄養管理報告書_' + ym + '.xlsx', [{ name: '表面', rows: front }, { name: '裏面1 喫食者の構成', rows: back1 },
        { name: '裏面2 提供食品量', rows: back2 }, { name: '裏面3 栄養量', rows: back3 }]);
    } }, 'Excel で保存')));
  }

  App.registerNav({ order: 50, group: 'まとめ', feature: 'reports', label: '帳票', icon: '📊', hash: '#/report', match: ['report'] });
  window.Report = R;
})();
