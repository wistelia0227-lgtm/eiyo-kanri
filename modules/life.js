// LIFE の CSV 出力（削除可能）: 期間を選んで、利用者情報・栄養・計画書の 3 つの CSV を作る。
// 仕様は厚生労働省の CSV連携仕様書 3.10版。出せない項目は空欄のまま出す（LIFE 側で人が確かめる前提）。
(function () {
  'use strict';
  const U = window.U, h = U.h, DB = window.DB, M = window.Model, L = window.Life, V = window.View, App = window.App;
  const ms = () => window.Master.current;
  const X = {};
  const KEYS = [
    { key: 'user', label: '利用者情報', note: '先に取り込むもの' },
    { key: 'nutrition', label: '栄養・摂食嚥下スクリーニング・アセスメント・モニタリング', note: '1 回の実施 = 1 行' },
    { key: 'plan', label: '栄養ケア等計画書', note: '1 版 = 1 行' }
  ];

  // 期間の記録を集める
  X.collect = async function (from, to) {
    const m = ms();
    const residents = (await DB.residents()).filter((r) => !r.archived);
    const byId = {}; residents.forEach((r) => { byId[r.id] = r; });
    const recs = (await window.Ncm.all()).filter((x) => x.date >= from && x.date <= to);
    const plans = (await window.CarePlan.all()).filter((x) => (x.updatedAt || '') >= from && (x.updatedAt || '') <= to);
    // 出す利用者 = 期間に記録か計画がある人
    const ids = {};
    recs.forEach((x) => { ids[x.residentId] = true; });
    plans.forEach((x) => { ids[x.residentId] = true; });
    const users = Object.keys(ids).map((id) => byId[id]).filter(Boolean);
    const iji = (m.profile.addons || []).indexOf('iji') >= 0;
    const rows = {
      user: users.map((r) => L.userRow(r, m)),
      nutrition: recs.filter((x) => byId[x.residentId]).map((x) => L.nutritionRow(x, byId[x.residentId], m, { iji: iji })),
      plan: plans.filter((x) => byId[x.residentId]).map((x) => L.planRow(x, byId[x.residentId], m))
    };
    return { rows: rows, users: users, recs: recs, plans: plans, byId: byId };
  };

  App.registerScreen('life', async function (params, root) {
    const m = ms(), today = U.today();
    const to = params[1] || today;
    const from = params[0] || M.addDays(M.addMonths(to, -1), 1);
    root.appendChild(h('header', { class: 'topbar' }, h('h1', null, 'LIFE へ出す'),
      h('span', { class: 'sub' }, '仕様 ' + (L.loaded() ? L.VERSION() + '版' : '未読み込み'))));
    if (!L.loaded()) { root.appendChild(h('div', { class: 'card bad' }, '項目定義（js/life_spec.js）が読み込まれていません。')); return; }

    const fac = L.facilityOf(m);
    const lack = [];
    if (!fac.careFacilityId) lack.push('事業所番号');
    if (!fac.serviceCode) lack.push('サービス種類コード');
    if (!fac.insurerNo) lack.push('保険者番号');
    if (lack.length) root.appendChild(h('div', { class: 'card bad' },
      '事業所の情報が足りません: ' + lack.join('、') + '　',
      h('a', { class: 'btn', href: '#/settings' }, '設定で入れる')));

    const f1 = h('input', { class: 'input', type: 'date', value: from });
    const f2 = h('input', { class: 'input', type: 'date', value: to });
    const go = () => App.go('#/life/' + (f1.value || from) + '/' + (f2.value || to));
    root.appendChild(h('div', { class: 'toolrow no-print' }, U.field('いつから', f1), U.field('いつまで', f2),
      h('button', { class: 'btn', onclick: go }, 'この期間で見る'),
      h('button', { class: 'btn', onclick: () => { const t = M.addDays(M.addMonths(today, 0), 0); const first = t.slice(0, 8) + '01'; App.go('#/life/' + M.addMonths(first, -1) + '/' + M.addDays(first, -1)); } }, '先月にする')));
    root.appendChild(h('div', { class: 'sub' }, 'LIFE への提出は翌月 10 日までです。月ごとにまとめて出すのが普通です。'));

    const data = await X.collect(from, to);
    const box = h('div');
    root.appendChild(box);

    KEYS.forEach((k) => {
      const rows = data.rows[k.key];
      const miss = L.check(k.key, rows);
      const fields = L.fields(k.key);
      box.appendChild(h('section', { class: 'card' },
        h('div', { class: 'sec-head' },
          h('h2', null, k.label + '　' + rows.length + ' 行'),
          h('div', { class: 'no-print' },
            h('button', { class: 'btn', disabled: !rows.length, onclick: () => X.preview(k, rows) }, '中身を見る'), ' ',
            h('button', { class: 'btn primary', disabled: !rows.length, onclick: () => {
              U.download(L.filename(k.key, today), L.csv(k.key, rows), 'text/csv;charset=utf-8');
            } }, 'CSV を保存'))),
        h('div', { class: 'sub' }, k.note + '　項目 ' + fields.length + '（必ず要るもの ' + fields.filter((f) => f.req === '◎').length + '）'),
        miss.length ? h('div', { class: 'card warn' }, h('b', null, '必ず要る項目が空です（このままでは取り込めません）'),
          miss.map((x) => h('div', null, '・' + x.name + '（' + x.id + '） … ' + x.count + ' 行')),
          h('div', { class: 'sub' }, '被保険者番号・要介護度は 利用者 の画面、事業所番号などは 設定 → LIFE で入れます。'))
          : (rows.length ? h('div', { class: 'card ok' }, '必ず要る項目はすべて埋まっています。') : h('div', { class: 'empty' }, 'この期間に出すものがありません。'))));
    });

    root.appendChild(h('div', { class: 'card info no-print' },
      h('b', null, '使い方'),
      h('div', null, '3 つの CSV を保存して、LIFE の画面から取り込みます（利用者情報から処理されるので、まとめて選んで構いません）。'),
      h('div', { class: 'sub' }, '文字コードは UTF-8、改行は CR-LF で出します。空欄の項目は「記録なし」として渡ります。' +
        '取り込んだあと、LIFE の画面で中身を必ず確かめてください。このアプリが持っていない項目（血清アルブミンなど）は空欄のままです。')));
  });

  X.preview = function (k, rows) {
    const fields = L.fields(k.key);
    const shown = fields.filter((f) => rows.some((v) => v[f.id] != null && v[f.id] !== ''));
    let close;
    close = U.modal(h('div', null, h('h2', null, k.label + '　' + rows.length + ' 行'),
      h('div', { class: 'sub' }, '値が入っている ' + shown.length + ' 項目だけ出しています（CSV には ' + fields.length + ' 項目すべて出ます）。'),
      h('div', { class: 'scroll-x' }, h('table', { class: 'grid' },
        h('thead', null, h('tr', null, shown.map((f) => h('th', { title: f.name }, f.id)))),
        h('tbody', null, rows.map((v) => h('tr', null, shown.map((f) => h('td', null, v[f.id] || ''))))))),
      h('div', { class: 'modal-btns' }, h('button', { class: 'btn primary', onclick: () => close() }, '閉じる'))), { wide: true });
  };

  // 設定
  App.registerSettings({ order: 47, title: 'LIFE', render: function () {
    const m = ms();
    m.life = Object.assign({ careFacilityId: '', serviceCode: '', insurerNo: '', category: '1', trinity: false }, m.life || {});
    const t = (key, ph) => h('input', { class: 'input', type: 'text', value: m.life[key], placeholder: ph,
      onchange: async (e) => { m.life[key] = e.target.value.trim(); await window.Master.save(); } });
    const cat = U.select([{ id: '1', label: '施設' }, { id: '2', label: '通所・居宅' }], m.life.category, { noEmpty: true,
      onchange: async (e) => { m.life.category = e.target.value; await window.Master.save(); } });
    const tri = h('label', { class: 'check' }, h('input', { type: 'checkbox', checked: !!m.life.trinity,
      onchange: async (e) => { m.life.trinity = e.target.checked; await window.Master.save(); } }), ' リハ・個別機能、栄養、口腔の一体的取り組みを行っている');
    return h('div', { class: 'card' },
      h('div', { class: 'sub' }, 'LIFE へ出す CSV に必ず入る項目です。介護保険の請求で使っている番号を入れてください。'),
      h('div', { class: 'grid3' },
        U.field('事業所番号（10桁）', t('careFacilityId', '9900000001')),
        U.field('サービス種類コード（2桁）', t('serviceCode', '51')),
        U.field('保険者番号（6桁）', t('insurerNo', '990001')),
        U.field('施設／通所・居宅の区分', cat), h('span'), h('span')),
      tri,
      h('div', { class: 'sub' }, '利用者ごとの被保険者番号と要介護度は、利用者の画面で入れます。'));
  } });

  App.registerNav({ order: 24, group: 'ひと', feature: 'ncm', label: 'LIFE', icon: '📤', hash: '#/life', match: ['life'] });
  window.LifeUi = X;
})();
