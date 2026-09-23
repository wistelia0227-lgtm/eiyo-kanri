// 掲示用の献立表と、給食会議の議事録（削除可能）。
// 掲示は決まりごと: 「献立表の掲示、熱量・たんぱく質・脂質・食塩等の主要栄養成分の表示」
//   （特定給食施設における栄養管理に関する指導・支援等について 令和2年3月31日 健健発0331第2号 別添2 第2 の 7。調査 02 の 5.2）。
//   厨房に渡す 予定献立表（modules/kondate.js）とは別物で、こちらは利用者と家族が読む紙。
// 議事録の項目は「給食関係会議議事録」（横浜市の手引きの帳票一覧・調査 02 の 5.2）:
//   実施年月日、時間、場所、参加者、議題、討議内容、決定事項、施設長決裁。
(function () {
  'use strict';
  const U = window.U, h = U.h, DB = window.DB, M = window.Model, N = window.Nutri, V = window.View;
  const Foods = window.Foods, Dishes = window.Dishes, Menu = window.Menu, App = window.App;
  const ms = () => window.Master.current;
  const P = {};
  let span = 7, shokushu = '';

  // 掲示に出す栄養素。通知が名指ししている 4 つを既定にする
  P.POSTER_KEYS = ['kcal', 'prot', 'fat', 'nacl'];
  P.keys = function () {
    const m = ms();
    const k = (m.posterKeys && m.posterKeys.length) ? m.posterKeys : P.POSTER_KEYS;
    return k.filter((x) => N.key[x] != null);
  };

  // ---- 掲示用の献立表 ----
  App.registerScreen('poster', async function (params, root) {
    const m = ms(), meals = M.activeMeals(m), today = U.today();
    const start = params[0] || today;
    const sId = shokushu || (m.shokushu[0] && m.shokushu[0].id);
    const dishMap = {};
    (await Dishes.all()).forEach((d) => { dishMap[d.id] = d; });
    const days = []; for (let i = 0; i < span; i++) days.push(M.addDays(start, i));
    const recs = {};
    for (const d of days) recs[d] = await Menu.get(d);
    const keys = P.keys();

    root.appendChild(h('header', { class: 'topbar no-print' }, h('h1', null, '掲示用の献立表'),
      h('div', null, h('button', { class: 'btn primary', onclick: () => window.print() }, '印刷'), ' ',
        h('a', { class: 'btn', href: '#/menu/' + start }, '献立を直す'))));
    root.appendChild(h('div', { class: 'toolrow no-print' },
      h('button', { class: 'btn', onclick: () => App.go('#/poster/' + M.addDays(start, -span)) }, '◀ 前'),
      h('button', { class: 'btn', onclick: () => App.go('#/poster/' + today) }, '今日から'),
      h('button', { class: 'btn', onclick: () => App.go('#/poster/' + M.addDays(start, span)) }, '次 ▶'),
      [7, 14, 31].map((k) => h('button', { class: 'btn seg' + (span === k ? ' on' : ''), onclick: () => { span = k; App.refresh(); } }, k + '日')),
      h('span', { class: 'gap' }), h('span', { class: 'sub' }, '食種'),
      U.select(m.shokushu, sId, { noEmpty: true, onchange: (e) => { shokushu = e.target.value; App.refresh(); } }),
      h('a', { class: 'btn', href: '#/settings' }, '出す栄養素を変える')));
    root.appendChild(h('div', { class: 'card info no-print' },
      '利用者と家族が読む紙です。決まりで「献立表の掲示」と「熱量・たんぱく質・脂質・食塩等の主要栄養成分の表示」が求められています。' +
      '厨房に渡す紙は「献立表」（調理指示書）のほうです。'));

    // 見出し
    const fac = (m.facility && m.facility.name) || '';
    root.appendChild(h('div', { class: 'poster-head' },
      h('h1', null, '献　立　表'),
      h('div', { class: 'sub' }, U.fmtDate(days[0], true) + ' 〜 ' + U.fmtDate(days[days.length - 1], true) +
        '　' + M.label(m.shokushu, sId) + (fac ? '　' + fac : ''))));

    let any = false;
    const body = days.map((d) => {
      const has = meals.some((ml) => Menu.cellDishes(recs[d], ml.id, sId).length);
      if (!has) return null;
      any = true;
      const sum = Menu.sumDay(recs[d], meals, sId, dishMap);
      return h('tr', { class: [0, 6].indexOf(M.weekday(d)) >= 0 ? 'weekend' : '' },
        h('th', null, U.fmtDate(d, true)),
        meals.map((ml) => h('td', null, Menu.cellDishes(recs[d], ml.id, sId).map((c) =>
          h('div', null, (dishMap[c.dishId] || { name: c.name }).name)))),
        keys.map((k) => h('td', { class: 'num' }, N.fmt(k, sum.values[k]))));
    }).filter(Boolean);

    if (!any) {
      root.appendChild(h('div', { class: 'empty' }, 'この期間の献立がまだ入っていません。'));
      return;
    }
    root.appendChild(h('div', { class: 'scroll-x' }, h('table', { class: 'list bordered poster' },
      h('thead', null, h('tr', null,
        [h('th', null, '日')].concat(meals.map((ml) => h('th', null, ml.label)))
          .concat(keys.map((k) => h('th', null, Foods.nutrient(k).name, h('div', { class: 'sub' }, Foods.nutrient(k).unit)))))),
      h('tbody', null, body))));
    root.appendChild(h('div', { class: 'sub' }, '栄養価は ' + M.label(m.shokushu, sId) + ' の 1 日分です。' +
      '主食の量や食事の形態によって、実際に召し上がる量は人ごとに変わります。'));
    root.appendChild(h('div', { class: 'sub' }, '成分値の出どころ: ' + (N.meta ? N.meta.citation : '日本食品標準成分表')));
  });

  // 設定: 掲示に出す栄養素
  App.registerSettings({ order: 36, title: '掲示用の献立表に出す栄養素', render: function () {
    const m = ms();
    const now = P.keys();
    const box = h('div', { class: 'chips' });
    N.nutrients.forEach((nu) => {
      const on = now.indexOf(nu.key) >= 0;
      box.appendChild(h('button', { class: 'btn seg small' + (on ? ' on' : ''), onclick: async () => {
        const list = P.keys().slice();
        const i = list.indexOf(nu.key);
        if (i >= 0) list.splice(i, 1); else list.push(nu.key);
        m.posterKeys = list;
        await window.Master.save(); App.refresh();
      } }, nu.name));
    });
    return h('div', null,
      h('div', { class: 'sub' }, '決まりで名指しされているのは 熱量・たんぱく質・脂質・食塩 の 4 つです（既定）。足し引きできます。'),
      box,
      h('button', { class: 'btn danger-outline', onclick: async () => {
        m.posterKeys = null; await window.Master.save(); App.refresh();
      } }, '既定の 4 つに戻す'));
  } });

  // ---- 給食会議の議事録 ----
  P.MINUTES_FIELDS = [
    { id: 'date', label: '実施年月日', kind: 'date' },
    { id: 'time', label: '時間', kind: 'text', hint: '例: 14:00〜15:00' },
    { id: 'place', label: '場所', kind: 'text' },
    { id: 'members', label: '参加者', kind: 'chips', hint: '施設長・管理栄養士・看護職員・介護職員・調理責任者・委託先 など' },
    { id: 'agenda', label: '議題', kind: 'textarea' },
    { id: 'talk', label: '討議内容', kind: 'big' },
    { id: 'decided', label: '決定事項', kind: 'big' },
    { id: 'next', label: '次回', kind: 'text' }
  ];
  P.minutesKey = (id) => 'minutes_' + id;

  App.registerScreen('minutes', async function (params, root) {
    const id = params[0];
    const all = (await DB.getMeta('minutes', [])) || [];
    if (!id) return drawMinutesList(root, all);
    const rec = all.find((x) => x.id === id);
    if (!rec) { root.appendChild(h('div', { class: 'empty' }, '見つかりません。')); return; }
    return drawMinutes(root, all, rec);
  });

  function drawMinutesList(root, all) {
    root.appendChild(h('header', { class: 'topbar' }, h('h1', null, '給食会議の議事録'),
      h('div', { class: 'no-print' }, h('button', { class: 'btn primary', onclick: async () => {
        const rec = { id: U.uid('g'), date: U.today(), time: '', place: '', members: [], agenda: '', talk: '', decided: '', next: '', at: Date.now() };
        const list = [rec].concat(all);
        await DB.setMeta('minutes', list);
        App.go('#/minutes/' + rec.id);
      } }, '＋ 新しく書く'))));
    if (!all.length) { root.appendChild(h('div', { class: 'empty' }, 'まだありません。給食会議は「管理者と関係部門が参加する会議の記録」として残す帳票です。')); return; }
    root.appendChild(h('table', { class: 'list bordered' },
      h('thead', null, h('tr', null, ['日', '議題', '参加者', ''].map((t) => h('th', null, t)))),
      h('tbody', null, all.slice().sort((a, b) => b.date.localeCompare(a.date)).map((r) => h('tr', null,
        h('td', null, U.fmtDate(r.date, true)),
        h('td', null, (r.agenda || '').split('\n')[0] || h('span', { class: 'sub' }, '（未記入）')),
        h('td', { class: 'sub' }, (r.members || []).join('・')),
        h('td', { class: 'no-print' }, h('a', { class: 'btn small', href: '#/minutes/' + r.id }, '開く')))))));
  }

  async function drawMinutes(root, all, rec) {
    const m = ms();
    const save = async () => { await DB.setMeta('minutes', all); };
    root.appendChild(h('header', { class: 'topbar' }, h('h1', null, '給食会議の議事録　' + U.fmtDate(rec.date, true)),
      h('div', { class: 'no-print' }, h('button', { class: 'btn', onclick: () => window.print() }, '印刷'), ' ',
        h('a', { class: 'btn', href: '#/minutes' }, '一覧に戻る'))));
    const grid = h('div', { class: 'grid2' });
    P.MINUTES_FIELDS.forEach((f) => {
      let el;
      if (f.kind === 'chips') {
        el = U.chipList(rec[f.id] || [], ['施設長', '管理栄養士', '栄養士', '看護職員', '介護職員', '調理責任者', '委託先', '事務'],
          '入力して Enter', async (list) => { rec[f.id] = list; await save(); });
      } else if (f.kind === 'textarea' || f.kind === 'big') {
        el = h('textarea', { class: 'input', rows: f.kind === 'big' ? '6' : '2' }, rec[f.id] || '');
        el.addEventListener('change', async () => { rec[f.id] = el.value; await save(); });
      } else {
        el = h('input', { class: 'input', type: f.kind === 'date' ? 'date' : 'text', value: rec[f.id] || '' });
        el.addEventListener('change', async () => { rec[f.id] = el.value; await save(); });
      }
      const field = U.field(f.label, el, f.hint);
      if (f.kind === 'big') field.classList.add('span2');
      grid.appendChild(field);
    });
    root.appendChild(h('section', { class: 'card' }, grid));
    root.appendChild(h('table', { class: 'stamps print-only' }, h('tbody', null,
      h('tr', null, ['記録者', '管理栄養士', '施設長'].map((s) => h('th', null, s))),
      h('tr', null, [0, 1, 2].map(() => h('td', null, ' '))))));
    root.appendChild(h('div', { class: 'toolrow no-print' },
      h('button', { class: 'btn danger-outline', onclick: async () => {
        if (!await U.confirm('この議事録を消します。', { okLabel: '消す', danger: true })) return;
        const i = all.indexOf(rec);
        all.splice(i, 1); await save(); App.go('#/minutes');
      } }, '消す')));
  }

  App.registerNav({ order: 46, group: '献立と食材', label: '掲示', icon: '📰', hash: '#/poster', match: ['poster'], feature: 'menu' });
  App.registerNav({ order: 52, group: 'まとめ', label: '会議', icon: '🗒', hash: '#/minutes', match: ['minutes'], feature: 'reports' });
  window.Poster = P;
})();
