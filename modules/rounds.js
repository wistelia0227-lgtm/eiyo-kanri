// ミールラウンド（食事の観察）の記録。月の表に ○（見た）／◎（気づきあり）を付ける。
// rounds ストア: { id: 利用者ID_日付, residentId, date, mark:'o'|'oo', meal, staple, side, note }
(function () {
  'use strict';
  const U = window.U, h = U.h, DB = window.DB, M = window.Model, V = window.View, App = window.App;
  const ms = () => window.Master.current;
  const MARK = { o: '○', oo: '◎' };
  const weekStart = (d) => M.addDays(d, -((M.weekday(d) + 6) % 7)); // 月曜はじまり

  function editRound(r, date, rec) {
    const m = ms(), meals = M.activeMeals(m);
    const meal = U.select(meals, (rec && rec.meal) || V.nextSlot().m, { noEmpty: true });
    const tens = [{ id: '', label: '—' }].concat([10, 9, 8, 7, 6, 5, 4, 3, 2, 1, 0].map((n) => ({ id: String(n), label: n + '割' })));
    const staple = U.select(tens.slice(1), rec && rec.staple != null ? String(rec.staple) : '', { emptyLabel: '—' });
    const side = U.select(tens.slice(1), rec && rec.side != null ? String(rec.side) : '', { emptyLabel: '—' });
    const note = h('textarea', { class: 'input', rows: '3', placeholder: '気づいたこと（むせ、食べ残し、姿勢、食具、本人の声 など）' }, rec ? rec.note || '' : '');
    let close;
    const save = async (mark) => {
      const id = r.id + '_' + date;
      if (!mark) await DB.del('rounds', id);
      else await DB.put('rounds', { id: id, residentId: r.id, date: date, mark: note.value.trim() ? 'oo' : mark, meal: meal.value,
        staple: staple.value === '' ? null : Number(staple.value), side: side.value === '' ? null : Number(side.value), note: note.value.trim(), by: V.recorder(), recordedAt: Date.now() });
      close(); App.refresh();
    };
    close = U.modal(h('div', null, h('h2', null, V.sama(r.name) + '　' + U.fmtDate(date) + ' のミールラウンド'),
      h('div', { class: 'grid3' }, U.field('食事', meal), U.field('主食の摂取', staple), U.field('副食の摂取', side)),
      U.field('メモ（書くと ◎ になります）', note),
      h('div', { class: 'modal-btns' }, rec ? h('button', { class: 'btn danger-outline', onclick: () => save(null) }, '記録を消す') : null,
        h('button', { class: 'btn', onclick: () => close() }, 'やめる'), h('button', { class: 'btn primary', onclick: () => save('o') }, '記録する'))));
  }

  App.registerScreen('rounds', async function (params, root) {
    const m = ms(), today = U.today(), month = params[0] || today.slice(0, 7);
    const first = month + '-01', last = M.addDays(M.addMonths(first, 1), -1);
    const days = []; for (let d = first; d <= last; d = M.addDays(d, 1)) days.push(d);
    const stayIn = V.stayInCats();
    const residents = (await DB.residents()).filter((r) => !r.archived && stayIn.indexOf(r.category) >= 0 &&
      days.some((d) => M.activeMeals(m).some((ml) => M.presence(r, { d: d, m: ml.id }, m.meals).state !== 'out')))
      .sort((a, b) => (a.unit + a.room).localeCompare(b.unit + b.room, 'ja') || (a.kana || a.name).localeCompare(b.kana || b.name, 'ja'));
    const recs = {}; (await DB.getAll('rounds')).forEach((x) => { recs[x.id] = x; });
    const ws = weekStart(today);
    const weekCount = (r) => { let n = 0; for (let i = 0; i < 7; i++) if (recs[r.id + '_' + M.addDays(ws, i)]) n++; return n; };

    root.appendChild(h('header', { class: 'topbar' }, h('h1', null, 'ミールラウンド　' + month.replace('-', '年') + '月'),
      h('button', { class: 'btn no-print', onclick: () => window.print() }, '印刷')));
    root.appendChild(h('div', { class: 'toolrow no-print' },
      h('button', { class: 'btn', onclick: () => App.go('#/rounds/' + M.addMonths(first, -1).slice(0, 7)) }, '◀ 前の月'),
      h('button', { class: 'btn', onclick: () => App.go('#/rounds/' + today.slice(0, 7)) }, '今月'),
      h('button', { class: 'btn', onclick: () => App.go('#/rounds/' + M.addMonths(first, 1).slice(0, 7)) }, '次の月 ▶'),
      h('span', { class: 'sub' }, 'マスを押して記録します。○=見た　◎=気づきあり（メモつき）')));
    if (!residents.length) { root.appendChild(h('div', { class: 'empty' }, 'この月に在籍している人がいません。')); return; }
    root.appendChild(h('div', { class: 'scroll-x' }, h('table', { class: 'grid rounds' },
      h('thead', null, h('tr', null, h('th', null, '氏名'), h('th', { title: '月曜からの 1 週間' }, '今週'),
        days.map((d) => h('th', { class: (d === today ? 'today ' : '') + ([0, 6].indexOf(M.weekday(d)) >= 0 ? 'weekend' : '') }, Number(d.slice(8)), h('div', { class: 'wd' }, U.WD[M.weekday(d)]))))),
      h('tbody', null, residents.map((r) => {
        const n = weekCount(r);
        return h('tr', null, h('th', null, h('a', { href: '#/resident/' + r.id }, r.name)), h('td', { class: n >= 3 ? 'ok-text' : 'warn-text' }, n + '回'),
          days.map((d) => {
            const rec = recs[r.id + '_' + d];
            const here = M.activeMeals(m).some((ml) => M.presence(r, { d: d, m: ml.id }, m.meals).state === 'in');
            return h('td', { class: 'cell' + (here ? ' click' : ' out') + (rec && rec.mark === 'oo' ? ' oo' : ''), title: rec && rec.note || '',
              onclick: (here || rec) ? () => editRound(r, d, rec) : null }, rec ? MARK[rec.mark] : '');
          }));
      })))));
    // ◎ のメモ
    const notes = Object.values(recs).filter((x) => x.date >= first && x.date <= last && x.note).sort((a, b) => b.date.localeCompare(a.date));
    const names = {}; residents.forEach((r) => { names[r.id] = r.name; });
    root.appendChild(h('section', { class: 'card' }, h('h2', null, '気づきのメモ（◎）'),
      notes.length ? h('table', { class: 'list' }, h('tbody', null, notes.map((x) => h('tr', null, h('td', null, U.fmtDate(x.date) + ' ' + M.label(m.meals, x.meal)), h('td', null, names[x.residentId] || ''),
        h('td', { class: 'sub' }, [x.staple != null ? '主食' + x.staple + '割' : '', x.side != null ? '副食' + x.side + '割' : ''].filter(Boolean).join(' ')), h('td', null, x.note))))) : h('div', { class: 'empty' }, 'まだありません。')));
  });

  window.Residents.registerSection({ order: 20, render: async function (r) {
    const list = (await DB.byIndex('rounds', 'residentId', r.id)).sort((a, b) => b.date.localeCompare(a.date)).slice(0, 10);
    return h('section', { class: 'card' },
      h('div', { class: 'sec-head' }, h('h2', null, 'ミールラウンド'), h('button', { class: 'btn no-print', onclick: async () => editRound(r, U.today(), await DB.get('rounds', r.id + '_' + U.today())) }, '今日の記録を付ける')),
      list.length ? h('table', { class: 'list' }, h('tbody', null, list.map((x) => h('tr', null, h('td', null, U.fmtDate(x.date, true) + ' ' + M.label(ms().meals, x.meal)), h('td', null, MARK[x.mark]),
        h('td', { class: 'sub' }, [x.staple != null ? '主食' + x.staple + '割' : '', x.side != null ? '副食' + x.side + '割' : ''].filter(Boolean).join(' ')), h('td', null, x.note || ''))))) : h('div', { class: 'empty' }, 'まだ記録がありません。'));
  } });

  App.registerTodo(async function (ctx) {
    const ws = weekStart(ctx.today), recs = {};
    (await DB.getAll('rounds')).forEach((x) => { if (x.date >= ws) recs[x.residentId] = (recs[x.residentId] || 0) + 1; });
    const stayIn = V.stayInCats();
    const target = ctx.residents.filter((r) => r._st === 'in' && stayIn.indexOf(r.category) >= 0);
    const few = target.filter((r) => (recs[r.id] || 0) < 3);
    return (target.length && few.length) ? [{ level: 'info', text: '今週のミールラウンドが 3 回未満の人: ' + few.length + '人（対象 ' + target.length + '人中）', href: '#/rounds' }] : [];
  });

  App.registerNav({ order: 60, feature: 'rounds', label: 'ラウンド', icon: '👀', hash: '#/rounds', match: ['rounds'] });
})();
