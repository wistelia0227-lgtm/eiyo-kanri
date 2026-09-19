// 今日の画面: やること（各モジュールが App.registerTodo で出す）と、今日の食数・変更。
(function () {
  'use strict';
  const U = window.U, h = U.h, DB = window.DB, M = window.Model, V = window.View, App = window.App;
  const ms = () => window.Master.current;

  // 台帳から出る「やること」
  App.registerTodo(async function (ctx) {
    const m = ms(), out = [];
    const names = (list) => list.map((r) => r.name).join('、');
    const waits = ctx.residents.filter((r) => r.diet.some((v) => !v.cancelledAt && v.doctor === 'wait'));
    if (waits.length) out.push({ level: 'warn', text: '医師の確認待ちの食事変更: ' + names(waits), href: '#/resident/' + waits[0].id });
    const noDiet = ctx.residents.filter((r) => r._st !== 'rest' && !r.diet.some((v) => !v.cancelledAt));
    if (noDiet.length) out.push({ level: 'bad', text: '食事情報が未設定: ' + names(noDiet), href: '#/resident/' + noDiet[0].id });
    const late = M.lateChanges(ctx.residents, m.deadline, ctx.today);
    if (late.length) out.push({ level: 'warn', text: '締切のあとに入った変更が ' + late.length + ' 件（厨房・委託先へ連絡）', href: '#/census' });
    const tomorrow = M.addDays(ctx.today, 1);
    [[ctx.today, '今日'], [tomorrow, '明日']].forEach((d) => {
      const ev = M.eventsOn(ctx.residents, d[0], m);
      const ins = ev.filter((e) => e.type === 'in'), outs = ev.filter((e) => e.type === 'out');
      if (ins.length) out.push({ level: 'info', text: d[1] + 'の入所: ' + ins.map((e) => e.r.name + '（' + M.label(m.meals, e.m) + 'から）').join('、'), href: '#/day/' + d[0] });
      if (outs.length) out.push({ level: 'info', text: d[1] + 'の退所: ' + outs.map((e) => e.r.name + '（' + M.label(m.meals, e.m) + 'まで）').join('、'), href: '#/day/' + d[0] });
    });
    return out;
  });

  App.registerScreen('home', async function (params, root) {
    const today = U.today(), m = ms();
    const residents = (await DB.residents()).filter((r) => !r.archived);
    residents.forEach((r) => { r._st = M.status(r, today, m.meals); });
    root.appendChild(h('header', { class: 'topbar' }, h('h1', null, U.fmtDate(today, true) + (m.facility.name ? '　' + m.facility.name : '')),
      h('div', { class: 'no-print' }, h('a', { class: 'btn', href: '#/day/' + today }, '変更連絡票'), ' ', h('a', { class: 'btn primary', href: '#/cards/' + today }, '食札を刷る'))));
    if (!residents.length) {
      root.appendChild(h('div', { class: 'card info' }, h('h2', null, 'はじめに'),
        h('p', null, '利用者を登録すると、食札・食数・変更連絡票・禁食一覧がここから全部作られます。'),
        h('a', { class: 'btn primary big', href: '#/residents' }, '利用者を登録する')));
      return;
    }
    const todos = [];
    for (const fn of App.todos) { try { (await fn({ today: today, residents: residents })).forEach((t) => todos.push(t)); } catch (e) { todos.push({ level: 'bad', text: 'やることの集計でエラー: ' + e.message }); } }
    const order = { bad: 0, warn: 1, info: 2 };
    todos.sort((a, b) => order[a.level] - order[b.level]);
    root.appendChild(h('section', { class: 'no-print' }, h('h2', { class: 'sec' }, 'やること・気にすること'),
      todos.length ? todos.map((t) => h(t.href ? 'a' : 'div', { class: 'card todo ' + t.level, href: t.href }, t.text)) : h('div', { class: 'empty' }, '今のところありません。')));
    root.appendChild(h('h2', { class: 'sec' }, '今日の食数'));
    root.appendChild(await window.Census.dayBlock(today));
  });

  App.registerNav({ order: 10, label: '今日', icon: '📋', hash: '#/home', match: ['home'] });
})();
