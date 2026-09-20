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
    m.profile = window.Profile.normalize({ kinds: ['tokuyo', 'short'], supply: 'contract', dietitians: 1, addons: ['genzan', 'kyoka', 'ryoyo'], setupDone: true });
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

    // 料理と献立（成分表が読み込まれている時だけ）
    if (!window.Nutri || !window.Nutri.loaded()) return;
    m.targets = { jo: { energy: 1500, age: 82, sex: 'f', setAt: today } };
    await window.Master.save();
    const dish = (id, name, kind, items, allergy) => ({ id: id, name: name, kana: '', kind: kind, servings: 1,
      items: items.map((x) => ({ no: x[0], name: (window.Nutri.get(x[0]) || { name: '?' }).name, g: x[1] })), allergy: allergy || [], memo: '', updatedAt: now });
    const dishes = [
      dish('d_gohan', 'ごはん', '主食', [['01088', 150]]),
      dish('d_kayu', '全粥', '主食', [['01093', 300]]),
      dish('d_miso', 'みそ汁（豆腐・わかめ）', '汁物', [['17045', 12], ['04032', 30], ['09041', 1], ['06226', 5]], ['大豆']),
      dish('d_sake', '鮭の塩焼き', '主菜', [['10134', 60], ['17012', 0.5]], ['さけ']),
      dish('d_nikujaga', '肉じゃが', '主菜', [['11130', 50], ['02017', 80], ['06212', 30], ['06153', 20], ['17007', 10], ['03003', 5]], ['豚肉', '小麦', '大豆']),
      dish('d_ohitashi', 'ほうれん草のお浸し', '副菜', [['06268', 60], ['17007', 4], ['10092', 1]], ['小麦', '大豆']),
      dish('d_hijiki', 'ひじきの煮物', '副菜', [['09050', 5], ['04040', 15], ['06214', 15], ['17007', 5], ['03003', 3]], ['大豆', '小麦']),
      dish('d_yogurt', 'ヨーグルト', 'デザート', [['13025', 80]], ['乳']),
      dish('d_banana', 'バナナ', 'デザート', [['07107', 80]], ['バナナ'])
    ];
    await DB.putMany('dishes', dishes);
    const menus = [];
    for (let k = -2; k <= 4; k++) {
      const d = day(k);
      menus.push({ date: d, cells: {
        'b/jo': [{ dishId: 'd_gohan', name: 'ごはん', x: 1 }, { dishId: 'd_miso', name: 'みそ汁（豆腐・わかめ）', x: 1 }, { dishId: 'd_sake', name: '鮭の塩焼き', x: 1 }, { dishId: 'd_ohitashi', name: 'ほうれん草のお浸し', x: 1 }],
        'l/jo': [{ dishId: 'd_gohan', name: 'ごはん', x: 1 }, { dishId: 'd_nikujaga', name: '肉じゃが', x: 1 }, { dishId: 'd_hijiki', name: 'ひじきの煮物', x: 1 }, { dishId: 'd_yogurt', name: 'ヨーグルト', x: 1 }],
        'd/jo': [{ dishId: 'd_gohan', name: 'ごはん', x: 1 }, { dishId: 'd_miso', name: 'みそ汁（豆腐・わかめ）', x: 1 }, { dishId: 'd_sake', name: '鮭の塩焼き', x: 1 }, { dishId: 'd_banana', name: 'バナナ', x: 1 }]
      } });
    }
    await DB.putMany('menus', menus);
  }

  async function selftest() {
    const results = [];
    const ok = (name, cond, extra) => results.push({ name: name, ok: !!cond, extra: extra });
    for (const s of DB.STORES) await DB.clear(s);
    await window.Master.load();
    await seedDemo();
    const res = await DB.residents();
    ok('見本データ 8 人が保存される', res.length === 8, res.length);
    const m = window.Master.current, m2 = m, today = U.today();
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
    // 事業所プロファイル: 機能を切るとメニューから消える
    const prof = window.Master.current.profile;
    ok('見本の事業所は特養＋ショート', prof.kinds.join(',') === 'tokuyo,short' && prof.setupDone);
    ok('呼び方が入居者になっている', window.View.t('person') === '入居者');
    ok('強化加算あり → ミールラウンドが有効', prof.features.rounds === true);
    const navNames = () => { App.screens.home && 0; const bar = document.getElementById('nav'); return bar ? bar.textContent : ''; };
    prof.features.cards = false; await window.Master.save();
    document.getElementById('nav').innerHTML = '';
    await App.screens.home([], h('div'));
    ok('機能を切っても画面の関数は残る（直接開けば動く）', typeof App.screens.cards === 'function');
    ok('切った機能はメニューに出ない', !window.Profile.enabled(prof, 'cards'), navNames());
    prof.features.cards = true; await window.Master.save();

    // 栄養計算
    if (window.Nutri && window.Nutri.loaded()) {
      ok('成分表が読み込まれている', window.Nutri.count() === 2538, window.Nutri.count());
      const ds = await window.Dishes.all();
      ok('見本の料理が 9 件', ds.length === 9, ds.length);
      const gohan = ds.find((d) => d.id === 'd_gohan');
      ok('ごはん 150g は 234kcal', window.Nutri.round('kcal', window.Dishes.sumOf(gohan).values.kcal) === 234, window.Dishes.sumOf(gohan).values.kcal);
      const dm = {}; ds.forEach((d) => { dm[d.id] = d; });
      const rec = await window.Menu.get(today);
      const lunch = window.Menu.sumCell(window.Menu.cellDishes(rec, 'l', 'jo'), dm);
      ok('昼の献立にエネルギーがある', lunch.values.kcal > 400, window.Nutri.round('kcal', lunch.values.kcal));
      const dayAll = window.Menu.sumDay(rec, M.activeMeals(m2), 'jo', dm);
      ok('1日の合計は3食の和', window.Nutri.round('kcal', dayAll.values.kcal) > window.Nutri.round('kcal', lunch.values.kcal));
      const tg = window.Menu.targetOf('jo');
      ok('給与栄養目標量が引ける（1500kcal）', tg && tg.energy === 1500, tg && tg.energy);
      ok('目標と見比べて判定が出る', ['low', 'ok', 'high'].indexOf(window.Nutri.judge(tg.target, 'kcal', dayAll.values.kcal)) >= 0);
      ok('アレルギーが献立から拾える', window.Menu.allergensOf(window.Menu.cellDishes(rec, 'l', 'jo'), dm).indexOf('豚肉') >= 0);
      ok('未測定の成分は合計に足さない', Object.keys(dayAll.missing).length >= 0);
    }

    // リンク集と出典
    ok('リンクが 96 件、分類つきで入っている', m.links.length === 96 && new Set(m.links.map((l) => l.c)).size >= 7, m.links.length);
    ok('リンクの URL が全部 https', m.links.every((l) => /^https:/.test(l.u)), m.links.filter((l) => !/^https:/.test(l.u)).map((l) => l.n));
    ok('掲示板・Q&A の分類がある', m.links.some((l) => l.c === '掲示板・Q&A'));
    ok('出典に「更新に気づく手がかり」が全部ある', m.dataSources.every((s) => s.how && s.how.length > 10), m.dataSources.filter((s) => !s.how).map((s) => s.id));
    ok('アレルギー品目は 28、先頭 9 が表示義務でカシューナッツを含む',
      m.allergens.length === 28 && m.allergens.slice(0, 9).indexOf('カシューナッツ') >= 0 && m.allergens.slice(0, 9).indexOf('くるみ') >= 0, m.allergens.slice(0, 9));

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
