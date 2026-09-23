// 食数: 期間の予定食数表（締切つき）と、1 日の内訳・変更連絡票。全部、利用者台帳から計算する。
(function () {
  'use strict';
  const U = window.U, h = U.h, DB = window.DB, M = window.Model, V = window.View, App = window.App;
  const ms = () => window.Master.current;
  const C = {};
  let span = 7;

  // 利用者ではない食事（職員・検食など）。その日の手入力が無ければ既定の数
  C.extraOf = function (daily, row, mealId) {
    const v = daily && daily.extra && daily.extra[row.id] && daily.extra[row.id][mealId];
    return v != null ? v : ((row.def && row.def[mealId]) || 0);
  };
  C.extraTotal = (daily, mealId) => ms().extraRows.reduce((s, row) => s + C.extraOf(daily, row, mealId), 0);

  // ---------- 期間の表 ----------
  App.registerScreen('census', async function (params, root) {
    const m = ms(), meals = M.activeMeals(m), today = U.today();
    const start = params[0] || today;
    const residents = await DB.residents();
    const dailies = {}; (await DB.getAll('daily')).forEach((x) => { dailies[x.date] = x; });
    const days = []; for (let i = 0; i < span; i++) days.push(M.addDays(start, i));
    const cols = []; days.forEach((d) => meals.forEach((ml) => cols.push({ d: d, m: ml.id, c: M.census(residents, { d: d, m: ml.id }, m) })));
    const now = Date.now();

    root.appendChild(h('header', { class: 'topbar' }, h('h1', null, '食数　' + U.fmtDate(start, true) + ' 〜 ' + U.fmtDate(days[days.length - 1])),
      h('div', { class: 'no-print' }, h('button', { class: 'btn', onclick: () => window.print() }, '印刷'), ' ',
        h('button', { class: 'btn', onclick: () => U.download('食数_' + start + '.csv', U.csv(toRows()), 'text/csv') }, 'Excel 用に保存'))));
    root.appendChild(h('div', { class: 'toolrow no-print' },
      h('button', { class: 'btn', onclick: () => App.go('#/census/' + M.addDays(start, -7)) }, '◀ 前の週'),
      h('button', { class: 'btn', onclick: () => App.go('#/census/' + today) }, '今日から'),
      h('button', { class: 'btn', onclick: () => App.go('#/census/' + M.addDays(start, 7)) }, '次の週 ▶'),
      [7, 14].map((n) => h('button', { class: 'btn seg' + (span === n ? ' on' : ''), onclick: () => { span = n; App.refresh(); } }, n + '日分'))));

    const lines = []; // [見出し, 行の種類, 値を返す関数]
    const sect = (title) => lines.push({ title: title });
    const row = (label, fn, cls) => lines.push({ label: label, fn: fn, cls: cls });
    const keysOf = (pick, master) => {
      const seen = {}; cols.forEach((x) => Object.keys(pick(x.c)).forEach((k) => { seen[k] = true; }));
      const order = master.map((x) => x.id).filter((id) => seen[id]);
      Object.keys(seen).forEach((k) => { if (order.indexOf(k) < 0) order.push(k); });
      return order;
    };
    row('利用者の合計', (x) => x.c.total, 'total');
    sect('区分'); keysOf((c) => c.byCategory, m.categories).forEach((k) => row(M.label(m.categories, k), (x) => x.c.byCategory[k] || 0));
    sect('主食'); keysOf((c) => c.byStaple, m.staple).forEach((k) => row(M.label(m.staple, k), (x) => x.c.byStaple[k] || 0));
    sect('副食'); keysOf((c) => c.bySide, m.side).forEach((k) => row(M.label(m.side, k), (x) => x.c.bySide[k] || 0));
    sect('食種'); keysOf((c) => c.byShokushu, m.shokushu).forEach((k) => row(M.label(m.shokushu, k), (x) => x.c.byShokushu[k] || 0));
    sect('利用者以外'); m.extraRows.forEach((er) => row(er.label, (x) => C.extraOf(dailies[x.d], er, x.m)));
    row('総合計', (x) => x.c.total + C.extraTotal(dailies[x.d], x.m), 'total');
    row('欠食（外出など）', (x) => x.c.absent.length, 'mute');

    const closed = (d) => now > M.deadlineMs(d, m.deadline);
    const table = h('table', { class: 'grid census' },
      h('thead', null,
        h('tr', null, h('th', { rowspan: '2' }), days.map((d) => h('th', { colspan: String(meals.length), class: 'day' + (d === today ? ' today' : '') + ([0, 6].indexOf(M.weekday(d)) >= 0 ? ' weekend' : '') },
          h('a', { href: '#/day/' + d }, U.fmtDate(d)), closed(d) ? h('div', { class: 'lock', title: '変更の締切を過ぎています' }, '締切済み') : null))),
        h('tr', null, days.map(() => meals.map((ml) => h('th', { class: 'meal' }, ml.label))))),
      h('tbody', null, lines.map((ln) => ln.title
        ? h('tr', { class: 'sect' }, h('th', { colspan: String(cols.length + 1) }, ln.title))
        : h('tr', { class: ln.cls || '' }, h('th', null, ln.label), cols.map((x) => { const v = ln.fn(x); return h('td', { class: v ? '' : 'zero' }, v || '・'); })))));
    root.appendChild(h('div', { class: 'scroll-x' }, table));
    function toRows() {
      const out = [[''].concat(cols.map((x) => U.fmtDate(x.d) + ' ' + M.label(m.meals, x.m)))];
      lines.forEach((ln) => out.push(ln.title ? ['【' + ln.title + '】'] : [ln.label].concat(cols.map((x) => ln.fn(x)))));
      return out;
    }

    const noDiet = {}; cols.forEach((x) => x.c.noDiet.forEach((r) => { noDiet[r.id] = r; }));
    if (Object.keys(noDiet).length) root.appendChild(h('div', { class: 'card warn no-print' }, '食事情報が未設定の人が数に入っています: ',
      Object.values(noDiet).map((r) => [h('a', { href: '#/resident/' + r.id }, r.name), '　'])));

    // 締切のあとに入った変更
    const late = M.lateChanges(residents, m.deadline, M.addDays(today, -1)).filter((x) => x.d <= days[days.length - 1]);
    root.appendChild(h('section', { class: 'card' }, h('h2', null, '締切のあとに入った変更'),
      h('div', { class: 'sub' }, '締切: 食事の ' + (m.deadline.daysBefore || 0) + ' 日前 ' + m.deadline.time + '（設定で変えられます）。厨房・委託先へ個別に連絡が要るものです。'),
      late.length ? h('table', { class: 'list' }, h('tbody', null, late.map((x) => h('tr', null, h('td', null, U.fmtDate(x.d)), h('td', null, h('a', { href: '#/resident/' + x.r.id }, x.r.name)),
        h('td', null, x.what), h('td', { class: 'sub' }, '入力 ' + U.fmtDateTime(x.at)))))) : h('div', { class: 'empty' }, 'ありません。')));
  });

  // ---------- 1 日の内訳（変更連絡票を兼ねる） ----------
  C.dayBlock = async function (date, opts) {
    opts = opts || {};
    const m = ms(), meals = M.activeMeals(m);
    const residents = await DB.residents();
    const daily = (await DB.get('daily', date)) || { date: date, extra: {} };
    const box = h('div');
    const cs = meals.map((ml) => ({ ml: ml, c: M.census(residents, { d: date, m: ml.id }, m) }));

    // 食数の要約
    const cell = (x, pick, master) => Object.keys(pick(x.c)).sort((a, b) => master.findIndex((y) => y.id === a) - master.findIndex((y) => y.id === b))
      .map((k) => h('div', null, M.label(master, k) + ' ', h('b', null, pick(x.c)[k])));
    box.appendChild(h('table', { class: 'grid daysum' },
      h('thead', null, h('tr', null, h('th'), cs.map((x) => h('th', null, x.ml.label)))),
      h('tbody', null,
        h('tr', { class: 'total' }, h('th', null, '利用者'), cs.map((x) => h('td', null, x.c.total))),
        h('tr', null, h('th', null, '主食'), cs.map((x) => h('td', null, cell(x, (c) => c.byStaple, m.staple)))),
        h('tr', null, h('th', null, '副食'), cs.map((x) => h('td', null, cell(x, (c) => c.bySide, m.side)))),
        h('tr', null, h('th', null, '食種'), cs.map((x) => h('td', null, cell(x, (c) => c.byShokushu, m.shokushu)))),
        m.extraRows.map((er) => h('tr', null, h('th', null, er.label), cs.map((x) => h('td', null,
          opts.readonly ? C.extraOf(daily, er, x.ml.id) : h('input', { class: 'input num no-print-border', type: 'number', min: '0', value: C.extraOf(daily, er, x.ml.id), onchange: async (e) => {
            daily.extra[er.id] = daily.extra[er.id] || {}; daily.extra[er.id][x.ml.id] = Math.max(0, parseInt(e.target.value, 10) || 0);
            await DB.put('daily', daily); App.refresh();
          } }))))),
        h('tr', { class: 'total' }, h('th', null, '総合計'), cs.map((x) => h('td', null, x.c.total + C.extraTotal(daily, x.ml.id)))))));

    // 変更
    const ev = M.eventsOn(residents, date, m);
    box.appendChild(h('h2', { class: 'sec' }, 'この日の変更（' + ev.length + '件）'));
    box.appendChild(ev.length ? h('table', { class: 'list' }, h('thead', null, h('tr', null, ['食事', '場所', '氏名', '内容', '指示'].map((t) => h('th', null, t)))),
      h('tbody', null, ev.map((e) => h('tr', null, h('td', null, M.label(m.meals, e.m)), h('td', null, V.where(e.r)),
        h('td', null, h('a', { href: '#/resident/' + e.r.id }, e.r.name)), h('td', null, h('b', null, e.text), (e.lines || []).map((l) => h('div', null, l))),
        h('td', { class: 'sub' }, e.type === 'diet' ? [e.rec.source, e.rec.doctor === 'wait' ? '医師確認待ち' : ''].filter(Boolean).join('・') : ''))))) : h('div', { class: 'empty' }, '変更はありません。'));

    // 食事変更の「前／後」2 行（献ダテマンの食札情報変更一覧表の形。変わった値に ★）
    const dietEv = ev.filter((e) => e.type === 'diet');
    if (dietEv.length) {
      box.appendChild(h('h2', { class: 'sec' }, '食事変更の前と後'));
      const head = ['区分', '場所', '氏名'].concat(M.ROW_FIELDS.map((f) => f.label));
      box.appendChild(h('div', { class: 'scroll-x' }, h('table', { class: 'grid beforeafter' },
        h('thead', null, h('tr', null, head.map((t) => h('th', null, t)))),
        h('tbody', null, dietEv.map((e) => {
          const prev = M.prevVersion(e.r, e.rec, m.meals);
          const before = M.rowOf(prev ? prev.data : null, m), after = M.rowOf(e.rec.data, m);
          const mk = (label, vals, other, star) => h('tr', { class: star ? 'after' : 'before' },
            h('td', null, label), h('td', null, V.where(e.r)), h('td', null, e.r.name),
            vals.map((v, i) => h('td', { class: (star && v !== other[i]) ? 'changed' : '' },
              (star && v !== other[i]) ? '★' + (v || 'なし') : (v || ''))));
          return [mk('前', before, after, false), mk('後 ' + M.label(m.meals, e.m) + 'から', after, before, true)];
        })))));
    }

    // 欠食の人
    const absent = {}; cs.forEach((x) => x.c.absent.forEach((a) => { (absent[a.r.id] = absent[a.r.id] || { r: a.r, reason: a.absence.reason, meals: [] }).meals.push(x.ml.label); }));
    if (Object.keys(absent).length) box.appendChild(h('div', null, h('h2', { class: 'sec' }, '欠食'),
      h('div', { class: 'card' }, Object.values(absent).map((a) => h('div', null, V.where(a.r) + '　' + a.r.name + '　' + (a.reason || '') + '（' + a.meals.join('・') + '）')))));
    return box;
  };

  App.registerScreen('day', async function (params, root) {
    const date = params[0] || U.today();
    root.appendChild(h('header', { class: 'topbar' }, h('h1', null, U.fmtDate(date, true) + ' の食数と変更'),
      h('div', { class: 'no-print' }, h('button', { class: 'btn', onclick: () => window.print() }, '変更連絡票として印刷'), ' ',
        h('a', { class: 'btn', href: '#/cards/' + date }, 'この日の食札へ'))));
    root.appendChild(V.dateBar(date, (d) => App.go('#/day/' + d)));
    root.appendChild(await C.dayBlock(date));
    root.appendChild(h('div', { class: 'print-only signline' }, '連絡した人 ＿＿＿＿＿＿　受けた人 ＿＿＿＿＿＿　時刻 ＿＿：＿＿'));
  });

  App.registerNav({ order: 30, group: '毎日', feature: 'census', label: '食数', icon: '🔢', hash: '#/census', match: ['census', 'day'] });
  window.Census = C;
})();
