// 開発用（削除可能）: このファイルと index.html の script タグを消せば本番構成。
//  index.html?demo     … 別のデータベースに見本データを入れて開く（本番のデータには触れない）
//  index.html?selftest … 別のデータベースで自己テストを回し、結果を画面に出す
(function () {
  'use strict';
  const U = window.U, h = U.h, DB = window.DB, M = window.Model, App = window.App;
  const q = location.search;

  async function seedDemo() {
    const today = U.today(), now = Date.now(), day = (k) => M.addDays(today, k);
    const m = window.Master.current;
    m.facility = { name: '見本の里', recorder: '栄養 花子' }; m.units = ['さくら', 'もみじ', 'ショート'];
    m.extraRows.forEach((er) => { er.def = er.id === 'staff' ? { l: 8 } : er.id === 'kenshoku' ? { b: 1, l: 1, d: 1 } : {}; });
    await window.Master.save();
    const D = (o) => Object.assign(M.emptyDiet(), o);
    const mk = (name, kana, o) => M.normalizeResident(Object.assign(M.newResident(name, U.uid), { kana: kana, recordedAt: now }, o));
    const long = (d) => [{ id: U.uid('s'), from: { d: d, m: 'l' }, to: null, recordedAt: now - 90 * 86400000 }];
    const v = (d, mm, data, extra) => Object.assign({ id: U.uid('v'), from: { d: d, m: mm }, data: data, recordedAt: now - 86400000, by: '栄養 花子', doctor: 'na' }, extra || {});
    const base = D({ shokushu: 'jo', staple: 'rice', stapleG: 150, side: 'jo', tools: ['箸'], assist: 'self' });
    const list = [
      mk('山田 ハナ', 'やまだ はな', { unit: 'さくら', room: '101', gender: 'f', birth: '1938-04-02', heightCm: 148, stays: long(day(-400)),
        diet: [v(day(-400), 'l', base), v(today, 'l', D(Object.assign({}, base, { staple: 'kayu', stapleG: 300, side: 'kizami', soupThick: 'thin', notes: '冷まして提供' })), { source: '看護師', reason: 'むせ込みが増えたため', doctor: 'wait', recordedAt: now - 3600000 })] }),
      mk('佐藤 正一', 'さとう しょういち', { unit: 'さくら', room: '102', gender: 'm', birth: '1935-11-20', heightCm: 162, stays: long(day(-200)),
        diet: [v(day(-200), 'l', D({ shokushu: 'dm', staple: 'rice', stapleG: 130, side: 'hito', allergy: ['えび', 'かに'], kinshi: [{ food: '納豆', sub: '豆腐' }], tools: ['箸', 'すべり止めマット'], assist: 'watch' }))] }),
      mk('鈴木 トメ', 'すずき とめ', { unit: 'さくら', room: '103', gender: 'f', birth: '1930-01-15', heightCm: 145, stays: long(day(-700)),
        diet: [v(day(-700), 'l', D({ shokushu: 'salt', staple: 'kayu_m', stapleG: 250, side: 'mixer', soupThick: 'mid', drinkThick: 'mid', supplements: [{ name: '高カロリーゼリー', when: '15時' }], tools: ['大スプーン', 'エプロン'], assist: 'full', notes: '交互嚥下' }))] }),
      mk('高橋 キヨ', 'たかはし きよ', { unit: 'もみじ', room: '201', gender: 'f', birth: '1941-07-08', heightCm: 150, stays: long(day(-300)),
        absences: [{ id: U.uid('a'), from: { d: today, m: 'l' }, to: { d: today, m: 'l' }, reason: '受診', recordedAt: now - 7200000 }],
        diet: [v(day(-300), 'l', D(Object.assign({}, base, { stapleG: 120, side: 'hito', kinshi: [{ food: '鶏肉', sub: '魚' }], cond: [{ when: 'noodle', text: '10cm にカット' }], byMeal: { b: { staple: 'bread', stapleG: 60 } } })))] }),
      mk('田中 勇', 'たなか いさむ', { unit: 'もみじ', room: '202', gender: 'm', birth: '1933-09-30', heightCm: 165, stays: long(day(-150)),
        diet: [v(day(-150), 'l', D({ shokushu: 'ckd', staple: 'soft', stapleG: 180, side: 'soft', portion: 'half', assist: 'part', tools: ['柄の太いスプーン'] }))] }),
      mk('伊藤 フミ', 'いとう ふみ', { category: 'short', unit: 'ショート', room: 'S1', gender: 'f', birth: '1939-02-11', heightCm: 152,
        stays: [{ id: U.uid('s'), from: { d: day(-40), m: 'l' }, to: { d: day(-36), m: 'b' }, recordedAt: now - 45 * 86400000 }, { id: U.uid('s'), from: { d: day(1), m: 'l' }, to: { d: day(4), m: 'b' }, recordedAt: now - 1800000 }],
        diet: [v(day(-40), 'l', D({ shokushu: 'jo', staple: 'kayu', stapleG: 250, side: 'kizami', allergy: ['卵'], tools: ['スプーン'], assist: 'watch' }))] }),
      mk('渡辺 茂', 'わたなべ しげる', { category: 'short', unit: 'ショート', room: 'S2', gender: 'm', birth: '1937-12-01', heightCm: 160,
        stays: [{ id: U.uid('s'), from: { d: day(-2), m: 'l' }, to: { d: today, m: 'b' }, recordedAt: now - 9 * 86400000 }],
        diet: [v(day(-2), 'l', D(Object.assign({}, base, { side: 'hito' })))] }),
      mk('中村 ヨシ', 'なかむら よし', { category: 'day', unit: '', room: 'デイ', gender: 'f', birth: '1942-05-05', weekdays: [1, 2, 3, 4, 5], mealsTaken: ['l'],
        stays: [{ id: U.uid('s'), from: { d: day(-100) }, to: null, recordedAt: now - 100 * 86400000 }], diet: [v(day(-100), 'l', D(Object.assign({}, base, { stapleG: 100 })))] })
    ];
    await DB.putMany('residents', list);
    // 体重: 毎月 1 回。山田さんは減り続けている
    const ws = [];
    const curve = { 0: [46, 45.2, 44.5, 43.6, 42.4, 41.2, 39.8], 1: [58, 58.3, 58, 57.8, 58.1, 58, 57.6], 2: [38, 38.2, 38, 37.9, 38.1, 38, 0], 3: [47, 47, 46.8, 47.2, 47, 46.9, 47.1], 4: [55, 54.5, 54, 53.8, 53, 52.6, 52] };
    Object.keys(curve).forEach((i) => curve[i].forEach((kg, k) => { if (!kg) return; const d = M.addMonths(today, k - 6); ws.push({ id: list[i].id + '_w_' + d, residentId: list[i].id, kind: 'weight', date: d, value: kg, recordedAt: now }); }));
    await DB.putMany('measures', ws);
    const rs = [];
    [0, 1, 2].forEach((i) => [0, -2].forEach((k) => rs.push({ id: list[i].id + '_' + day(k), residentId: list[i].id, date: day(k), mark: i === 0 && k === 0 ? 'oo' : 'o', meal: 'l', staple: i === 0 ? 5 : 10, side: i === 0 ? 4 : 9, note: i === 0 && k === 0 ? '汁物でむせ込み 2 回。きざみへの変更を看護師と相談。' : '', recordedAt: now })));
    await DB.putMany('rounds', rs);
  }

  async function selftest() {
    const results = [];
    const ok = (name, cond, extra) => results.push({ name: name, ok: !!cond, extra: extra });
    for (const s of DB.STORES) await DB.clear(s);
    await window.Master.load();
    await seedDemo();
    const res = await DB.residents();
    ok('見本データ 8 人が保存される', res.length === 8, res.length);
    const m = window.Master.current, today = U.today();
    const c = M.census(res, { d: today, m: 'l' }, m);
    ok('今日の昼: 高橋さんは受診で欠食', c.absent.some((a) => a.r.name === '高橋 キヨ'));
    ok('今日の昼: 渡辺さんは朝で退所済み', !c.rows.some((x) => x.r.name === '渡辺 茂'));
    ok('今日の昼: 山田さんは全粥に変わっている', (c.rows.find((x) => x.r.name === '山田 ハナ') || { diet: {} }).diet.staple === 'kayu');
    const b = M.census(res, { d: today, m: 'b' }, m);
    ok('今日の朝: 山田さんはまだ米飯、渡辺さんはいる', b.rows.find((x) => x.r.name === '山田 ハナ').diet.staple === 'rice' && b.rows.some((x) => x.r.name === '渡辺 茂'));
    ok('明日の昼: ショートの伊藤さんが入り、前回の食事情報が使われる', (M.census(res, { d: M.addDays(today, 1), m: 'l' }, m).rows.find((x) => x.r.name === '伊藤 フミ') || { diet: {} }).diet.side === 'kizami');
    ok('食札の刷り直し対象に山田さん', !!M.cardChangedIds(res, today, m)[res.find((r) => r.name === '山田 ハナ').id]);
    const all = await window.Weights.byResident();
    const y = res.find((r) => r.name === '山田 ハナ');
    const ev = window.Weights.evaluate(y, all[y.id], today);
    ok('山田さんの体重リスクは高', ev.risk.level === 'high', ev.risk);
    // マスタの補完
    const merged = window.Master.merge({ meals: [{ id: 'l', label: 'ひる' }] });
    ok('保存済みマスタは尊重し、無い項目だけ補う', merged.meals.length === 1 && merged.staple.length > 0 && merged.risk.bmiMid === 18.5);
    // バックアップの往復
    const dump = await DB.exportAll();
    for (const s of DB.STORES) await DB.clear(s);
    await DB.importAll(JSON.parse(JSON.stringify(dump)));
    ok('バックアップから戻すと同じ人数・同じ測定数', (await DB.getAll('residents')).length === 8 && (await DB.getAll('measures')).length === dump.stores.measures.length);
    let refused = false; try { await DB.importAll({ app: 'other' }); } catch (e) { refused = true; }
    ok('別アプリのファイルは断る', refused);
    // 全画面が例外なく描ける
    for (const name of Object.keys(App.screens)) {
      const box = h('div'); let err = null;
      try { await App.screens[name](name === 'resident' ? [y.id] : [], box); } catch (e) { err = e.message; }
      ok('画面「' + name + '」が描ける', !err && box.childNodes.length > 0, err);
    }
    const bad = results.filter((r) => !r.ok).length;
    const root = document.getElementById('root');
    root.innerHTML = '';
    root.appendChild(h('div', { id: 'selftest-result', 'data-bad': String(bad), class: 'card ' + (bad ? 'bad' : 'ok') }, h('h1', null, '自己テスト ' + (results.length - bad) + '/' + results.length + (bad ? '　失敗 ' + bad + ' 件' : '　全部通過')),
      results.map((r) => h('div', { class: r.ok ? '' : 'bad-text' }, (r.ok ? 'ok　' : 'NG　') + r.name + (r.ok || r.extra === undefined ? '' : '　→ ' + JSON.stringify(r.extra))))));
  }

  App.beforeStart = async function () {
    if (/[?&]demo/.test(q) && !(await DB.getAll('residents')).length) await seedDemo();
  };
  if (/[?&]selftest/.test(q)) { App.start = function () { window.addEventListener('load', () => selftest().catch((e) => U.showError(e.message))); }; }
  window.DevTools = { seedDemo: seedDemo, selftest: selftest };
})();
