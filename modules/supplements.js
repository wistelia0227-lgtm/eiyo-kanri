// 補食・栄養補助食品の配布表（削除可能）: 誰に・何を・何時に。時刻別にまとめて、ラベルとして刷れる。
// 日本の食札では備考に埋もれがちな所で、海外のソフト（Dietech）は補食のラベルと集計を別に持っている（調査 03・05）。
(function () {
  'use strict';
  const U = window.U, h = U.h, DB = window.DB, M = window.Model, V = window.View, App = window.App;
  const ms = () => window.Master.current;
  const S = {};

  // その日に補食がある人を、時刻でまとめる
  S.collect = async function (date) {
    const m = ms(), meals = M.activeMeals(m);
    const residents = await DB.residents();
    const rows = [];
    residents.forEach((r) => {
      if (r.archived) return;
      // その日に食べる枠があるか（1 つでもあれば対象）
      const here = meals.some((ml) => M.presence(r, { d: date, m: ml.id }, m.meals).state === 'in');
      if (!here) return;
      const d = M.dietAt(r, { d: date, m: meals[meals.length - 1].id }, m.meals);
      if (!d || !d.supplements.length) return;
      d.supplements.forEach((s) => { if (s.name) rows.push({ r: r, name: s.name, when: s.when || '', diet: d }); });
    });
    const byTime = {};
    rows.forEach((x) => { (byTime[x.when || '（時刻なし）'] = byTime[x.when || '（時刻なし）'] || []).push(x); });
    const byItem = {};
    rows.forEach((x) => { byItem[x.name] = (byItem[x.name] || 0) + 1; });
    return { rows: rows, byTime: byTime, byItem: byItem };
  };

  App.registerScreen('supp', async function (params, root) {
    const date = params[0] || U.today();
    const data = await S.collect(date);
    root.appendChild(h('header', { class: 'topbar' }, h('h1', null, '補食・栄養補助食品　' + U.fmtDate(date, true)),
      h('div', { class: 'no-print' }, h('button', { class: 'btn', onclick: () => window.print() }, '印刷'), ' ',
        h('a', { class: 'btn', href: '#/supplabel/' + date }, 'ラベルを刷る'))));
    root.appendChild(V.dateBar(date, (d) => App.go('#/supp/' + d)));
    if (!data.rows.length) { root.appendChild(h('div', { class: 'empty' }, 'この日に補食の登録がある方はいません。利用者の食事情報の「補食・栄養補助食品」に入れると出ます。')); return; }

    root.appendChild(h('div', { class: 'sub' }, '合計 ' + data.rows.length + ' 件'));
    // 時刻ごとの配布リスト
    Object.keys(data.byTime).sort().forEach((t) => {
      const list = data.byTime[t].sort((a, b) => (a.r.unit + a.r.room).localeCompare(b.r.unit + b.r.room, 'ja'));
      root.appendChild(h('section', { class: 'card' }, h('h2', null, t + '　' + list.length + ' 件'),
        h('table', { class: 'list bordered' },
          h('thead', null, h('tr', null, ['場所', '氏名', '品名', '渡した', '注意'].map((x) => h('th', null, x)))),
          h('tbody', null, list.map((x) => h('tr', null,
            h('td', null, V.where(x.r)), h('td', null, h('a', { href: '#/resident/' + x.r.id }, x.r.name)),
            h('td', null, x.name), h('td', { class: 'checkbox-cell' }, '□'),
            h('td', { class: 'sub' }, [x.diet.allergy.length ? 'ア) ' + x.diet.allergy.join('・') : '',
              x.diet.drinkThick ? '飲み物 ' + M.label(ms().thick, x.diet.drinkThick) : ''].filter(Boolean).join('　'))))))));
    });
    // 品名ごとの数（発注・準備用）
    root.appendChild(h('section', { class: 'card' }, h('h2', null, '品名ごとの数'),
      h('table', { class: 'list' }, h('tbody', null, Object.keys(data.byItem).sort()
        .map((n) => h('tr', null, h('th', null, n), h('td', null, data.byItem[n] + ' 件')))))));
  });

  // ラベル（名刺サイズの面付けを使い回す）
  App.registerScreen('supplabel', async function (params, root) {
    const date = params[0] || U.today();
    const m = ms();
    const data = await S.collect(date);
    const lay = M.item(m.cardLayouts, 'meishi10') || m.cardLayouts[0];
    root.appendChild(h('header', { class: 'topbar no-print' }, h('h1', null, '補食のラベル　' + U.fmtDate(date, true)),
      h('div', null, h('a', { class: 'btn', href: '#/supp/' + date }, '一覧に戻る'), ' ',
        h('button', { class: 'btn primary', onclick: () => window.print(), disabled: !data.rows.length }, data.rows.length + ' 枚を印刷'))));
    if (!data.rows.length) { root.appendChild(h('div', { class: 'empty' }, 'この日の補食はありません。')); return; }
    root.appendChild(h('div', { class: 'card info no-print' }, '印刷の余白は「なし」、倍率は 100% にしてください。'));
    root.appendChild(h('style', null, '@media print { @page { size: A4 portrait; margin: 0; } }'));
    const list = data.rows.slice().sort((a, b) => (a.when || '').localeCompare(b.when || '') || (a.r.unit + a.r.room).localeCompare(b.r.unit + b.r.room, 'ja'));
    const per = lay.cols * lay.rows;
    for (let i = 0; i < list.length; i += per) {
      root.appendChild(h('div', { class: 'sheet', style: 'padding:' + lay.mt + 'mm 0 0 ' + lay.ml + 'mm;' },
        h('div', { class: 'sheet-grid', style: 'grid-template-columns:repeat(' + lay.cols + ',' + lay.w + 'mm);gap:' + lay.gy + 'mm ' + lay.gx + 'mm;' },
          list.slice(i, i + per).map((x) => h('div', { class: 'fcard', style: 'width:' + lay.w + 'mm;height:' + lay.h + 'mm;--u:' + (lay.h / 55).toFixed(3) },
            h('div', { class: 'fc-band', style: 'background:#dbeafe' }, h('span', null, V.where(x.r)), h('span', null, '補食'), h('span', null, x.when || '')),
            h('div', { class: 'fc-name' }, x.r.name, h('span', { class: 'fc-sama' }, ' ' + V.t('suffix'))),
            h('div', { class: 'fc-main' }, h('div', null, x.name)),
            x.diet.allergy.length ? h('div', { class: 'fc-two' }, h('div', { class: 'fc-not' }, h('span', { class: 'fc-h' }, '禁止'),
              x.diet.allergy.map((a) => h('span', { class: 'fc-item alg' }, a)))) : null)))));
    }
  });

  // 今日やること
  App.registerTodo(async function (ctx) {
    const data = await S.collect(ctx.today);
    return data.rows.length ? [{ level: 'info', text: '今日の補食 ' + data.rows.length + ' 件（' + Object.keys(data.byTime).sort().join('・') + '）', href: '#/supp/' + ctx.today }] : [];
  });

  App.registerNav({ order: 45, feature: 'cards', label: '補食', icon: '🥤', hash: '#/supp', match: ['supp', 'supplabel'] });
  window.Supplements = S;
})();
