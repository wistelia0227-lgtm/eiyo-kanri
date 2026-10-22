// 献立のアレルギー表（厨房向けの A4 1 枚）の画面（削除可能）。中身は js/allergy_sheet.js。
// 献立の画面の「🖨 アレルギー表」から開く。読むだけで、何も保存しない。
(function () {
  'use strict';
  const U = window.U, h = U.h, DB = window.DB, M = window.Model, V = window.View, App = window.App, AS = window.AllergySheet;
  const ms = () => window.Master.current;

  App.registerScreen('allergysheet', async function (params, root) {
    const m = ms(), meals = M.activeMeals(m), next = V.nextSlot();
    const date = params[0] || next.d;
    const mealId = params[1] || (date === next.d ? next.m : meals[0].id);
    const slot = { d: date, m: mealId };
    const dishMap = {};
    (await DB.getAll('dishes')).forEach((d) => { d.items = d.items || []; d.allergy = d.allergy || []; dishMap[d.id] = d; });
    const rec = (await DB.get('menus', date)) || { date: date, cells: {} };
    const sheet = AS.build(await DB.residents(), dishMap, rec, slot, m);
    const where = (r) => V.where(r);

    const dIn = h('input', { class: 'input', type: 'date', value: date, onchange: () => dIn.value && App.go('#/allergysheet/' + dIn.value + '/' + mealId) });
    root.appendChild(h('div', { class: 'toolrow no-print' },
      h('a', { class: 'btn', href: '#/menu' }, '‹ 献立'), dIn,
      meals.map((ml) => h('a', { class: 'btn seg' + (ml.id === mealId ? ' on' : ''), href: '#/allergysheet/' + date + '/' + ml.id }, ml.label)),
      h('span', { class: 'gap' }),
      h('button', { class: 'btn primary', onclick: () => window.print() }, '🖨 印刷する')));

    const page = h('div', { class: 'as-sheet' });
    page.appendChild(h('div', { class: 'as-head' },
      h('h1', null, 'アレルギー・禁食 確認表'),
      h('div', null, h('b', null, U.fmtDate(date, true) + '　' + M.label(m.meals, mealId)), '　食べる人 ' + sheet.eaters + ' 人')));

    const hitCount = sheet.rows.reduce((a, x) => a + x.hits.length, 0);
    if (!Object.keys(rec.cells || {}).some((k) => k.indexOf(mealId + '/') === 0 && rec.cells[k].length)) {
      page.appendChild(h('div', { class: 'as-warn' }, 'この食事の献立がまだありません。献立を入れてから開いてください。'));
    }
    page.appendChild(h('table', { class: 'as-table' },
      h('thead', null, h('tr', null, ['料理', '食種', '当たる人', '当たったもの（← 食材・料理の名前）', '代替'].map((t) => h('th', null, t)))),
      h('tbody', null, sheet.rows.map((row) => {
        if (!row.hits.length) return h('tr', { class: 'as-none' }, h('td', null, row.name), h('td', null, row.shokushu.join('・')), h('td', { colspan: '3' }, '当たる人なし'));
        return row.hits.map((x, i) => h('tr', null,
          i === 0 ? h('td', { rowspan: String(row.hits.length), class: 'as-dish' }, row.name) : null,
          i === 0 ? h('td', { rowspan: String(row.hits.length) }, row.shokushu.join('・')) : null,
          h('td', null, (where(x.r) ? where(x.r) + '　' : '') + V.sama(x.r.name)),
          h('td', { class: x.kind === 'allergy' ? 'as-alg' : 'as-kin' }, (x.kind === 'allergy' ? 'アレルギー ' : '禁食 ') + x.word,
            h('div', { class: 'as-foods' }, '← ' + x.foods.join('、'))),
          h('td', null, x.sub ? x.sub : '代替: 　　　　　　')));
      }))));
    if (!hitCount && sheet.rows.length) page.appendChild(h('div', { class: 'as-ok' }, '材料・アレルギーの印から確かめられる料理では、当たる人はいません。'));

    if (sheet.unknown.length) {
      page.appendChild(h('div', { class: 'as-unknown' },
        h('b', null, '⚠ 確認できない料理 ' + sheet.unknown.length + ' 件'),
        h('div', null, '料理にアレルギーの印も材料も無いため、当たる人を判定できません。原材料を確かめてください。'),
        sheet.unknown.map((u) => h('div', null, '・' + u.name + '（' + u.shokushu.join('・') + '）　確認: 　　　　'))));
    }
    if (sheet.noDiet.length) {
      page.appendChild(h('div', { class: 'as-unknown' }, h('b', null, '⚠ 食事情報が未設定で確かめられない人'),
        sheet.noDiet.map((r) => h('div', null, '・' + (where(r) ? where(r) + '　' : '') + V.sama(r.name)))));
    }
    if (sheet.fallback.length) {
      page.appendChild(h('div', { class: 'as-note' }, '自分の食種の献立が無いため、別の食種の献立で判定した人: ',
        sheet.fallback.map((f) => V.sama(f.r.name) + '（' + (M.label(m.shokushu, f.own) || '食種なし') + ' → ' + M.label(m.shokushu, f.used) + '）').join('、')));
    }
    page.appendChild(h('div', { class: 'as-note' }, '名前の一致で拾っています（ひらがな・カタカナ・成分表の名前と、よくある加工品の言いかえを含む）。言いかえ表に無い加工品は漏れます。'));
    page.appendChild(h('table', { class: 'as-sign' }, h('tbody', null, h('tr', null,
      ['作成', '厨房 確認', '配膳 確認'].map((t) => [h('th', null, t), h('td', null, '')])))));
    root.appendChild(page);
  });

  window.AllergySheetScreen = true;
})();
