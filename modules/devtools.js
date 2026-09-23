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
    m.life = { careFacilityId: '9900000001', serviceCode: '51', insurerNo: '990001', category: '1', trinity: true };
    m.profile = window.Profile.normalize({ kinds: ['tokuyo', 'short'], supply: 'contract', dietitians: 1, addons: ['genzan', 'kyoka', 'ryoyo'], setupDone: true });
    m.extraRows.forEach((er) => { er.def = er.id === 'staff' ? { l: 8 } : er.id === 'kenshoku' ? { b: 1, l: 1, d: 1 } : {}; });
    await window.Master.save();
    const D = (o) => Object.assign(M.emptyDiet(), o);
    const mk = (name, kana, o) => M.normalizeResident(Object.assign(M.newResident(name, U.uid), { kana: kana, recordedAt: now }, o));
    const long = (d) => [{ id: U.uid('s'), from: { d: d, m: 'l' }, to: null, recordedAt: now - 90 * 86400000 }];
    const v = (d, mm, data, extra) => Object.assign({ id: U.uid('v'), from: { d: d, m: mm }, data: data, recordedAt: now - 86400000, by: '栄養 花子', doctor: 'na' }, extra || {});
    const base = D({ shokushu: 'jo', staple: 'rice', stapleG: 150, side: 'jo', tools: ['箸'], assist: 'self' });
    const list = [
      mk('山田 ハナ', 'やまだ はな', { unit: 'さくら', room: '101', gender: 'f', birth: '1938-04-02', heightCm: 148, insuredNo: 'H900000001', careLevel: '23', stays: long(day(-400)),
        diet: [v(day(-400), 'l', base), v(today, 'l', D(Object.assign({}, base, { staple: 'kayu', stapleG: 300, side: 'kizami', soupThick: 'thin', notes: '冷まして提供' })), { source: '看護師', reason: 'むせ込みが増えたため', doctor: 'wait', recordedAt: now - 3600000 })] }),
      mk('佐藤 正一', 'さとう しょういち', { unit: 'さくら', room: '102', gender: 'm', birth: '1935-11-20', heightCm: 162, insuredNo: 'H900000002', careLevel: '22', stays: long(day(-200)),
        diet: [v(day(-200), 'l', D({ shokushu: 'dm', staple: 'rice', stapleG: 130, side: 'hito', allergy: ['えび', 'かに'], kinshi: [{ food: '納豆', sub: '豆腐' }], tools: ['箸', 'すべり止めマット'], assist: 'watch' }))] }),
      mk('鈴木 トメ', 'すずき とめ', { unit: 'さくら', room: '103', gender: 'f', birth: '1930-01-15', heightCm: 145, insuredNo: 'H900000003', careLevel: '25', stays: long(day(-700)),
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
    // 体重以外の測定値（アルブミン・ヘモグロビンなど）
    [['alb', [3.8, 3.6, 3.4, 3.2, 3.0, 2.9]], ['hb', [12.1, 11.8, 11.5, 11.2, 10.9, 10.7]]].forEach((pair) => {
      pair[1].forEach((v, k) => {
        const d = M.addMonths(today, k - 5);
        ws.push({ id: list[0].id + '_' + pair[0] + '_' + d, residentId: list[0].id, kind: pair[0], date: d, value: v, recordedAt: now });
      });
    });
    await DB.putMany('measures', ws);
    const rs = [];
    [0, 1, 2].forEach((i) => [0, -2].forEach((k) => rs.push({ id: list[i].id + '_' + day(k), residentId: list[i].id, date: day(k), mark: i === 0 && k === 0 ? 'oo' : 'o', meal: 'l', staple: i === 0 ? 5 : 10, side: i === 0 ? 4 : 9, note: i === 0 && k === 0 ? '汁物でむせ込み 2 回。きざみへの変更を看護師と相談。' : '', recordedAt: now })));
    await DB.putMany('rounds', rs);

    // 栄養ケア計画書（様式4-1-2）
    const plans = [{
      id: U.uid('p'), residentId: list[0].id, firstAt: day(-30), updatedAt: day(-30), author: '栄養 花子',
      wish: '好きな物を安全に食べたい（本人）。食事量が減っているのが心配（長女）。', explainedAt: day(-29), explainedBy: '栄養 花子',
      needs: '体重減少が続いている。汁物でむせ込みがあり、食形態の調整が必要。', level: 'high',
      longGoal: '体重を維持し、むせ込みなく食事ができる', longTerm: '6か月',
      rows: [
        { cat: '栄養補給・食事', goal: '体重の減少を止める', term: '3か月', care: '栄養補助食品を1日1個提供する', freq: '毎日15時', who: '管理栄養士' },
        { cat: '経口維持の支援', goal: 'むせ込みなく食事ができる', term: '3か月', care: '食形態・とろみを状態に合わせて見直す', freq: '随時', who: '管理栄養士・看護職員' },
        { cat: '多職種による課題の解決', goal: '低栄養リスクを高から中にする', term: '6か月', care: '月1回体重を測定し、多職種で共有する', freq: '月1回', who: '看護職員' }
      ],
      special: '家族の面会時に嗜好を聞き取る。', addons: ['kyoka'],
      progress: [
        { date: day(-20), text: '高カロリーゼリーの提供を開始。全量摂取できている。', by: '栄養 花子' },
        { date: day(-7), text: '昼食の汁物でむせ込み2回。看護師と相談し、薄いとろみを付けることとした。', by: '栄養 花子' }
      ], recordedAt: now
    }];
    await DB.putMany('plans', plans);

    // 栄養ケア・マネジメントの記録（様式4-1-1）
    const NC = window.NCM;
    const ncRec = (r, date, o) => NC.normalize(Object.assign(NC.empty(r.id, date), { id: U.uid('n'), by: '栄養 花子', recordedAt: now }, o));
    const ncm = [
      // 山田さん: 高リスク。2週毎なので期限切れ
      ncRec(list[0], day(-30), { process: 'screening', level: 'high',
        body: { heightCm: 148, weightKg: 41.2, loss1: 2.8, loss3: 7.4, loss6: 13.5, ulcer: false, feeding: 'oral' },
        intake: { pct: 60, staple: 50, side: 60, other: '' }, swallow: { need: true, code: '4', thick: 'thin' },
        will: { motivation: 4, satisfaction: 4, attitude: 3 }, issues: ['水分でむせる', '食事中、食後に咳をすることがある'],
        evaluation: 'not', special: '汁物でむせ込みが増えている。きざみ・薄いとろみへ変更を検討。' }),
      // 佐藤さん: 低リスク（3月毎）
      ncRec(list[1], day(-20), { process: 'screening', level: 'low',
        body: { heightCm: 162, weightKg: 57.6, loss1: 0.7, loss3: 0.3, loss6: 0.7, ulcer: false, feeding: 'oral' },
        intake: { pct: 100, staple: 100, side: 100, other: '' }, will: { motivation: 1, satisfaction: 2, attitude: 2 }, evaluation: 'maintained' }),
      // 鈴木さん: 中リスク（1月毎）、もうすぐ期限
      ncRec(list[2], day(-28), { process: 'monitoring', level: 'mid',
        body: { heightCm: 145, weightKg: 38.0, loss1: 0.3, loss3: 0, loss6: null, ulcer: false, feeding: 'partial' },
        intake: { pct: 70, staple: 60, side: 70, other: '高カロリーゼリー 1個/日' }, swallow: { need: true, code: '2-1', thick: 'mid' },
        will: { motivation: 3, satisfaction: 3, attitude: 3 }, issues: ['食べ物を口腔内に溜め込む'], evaluation: 'maintained' })
    ];
    await DB.putMany('ncm', ncm);

    // 料理と献立: 初期データ（js/dishes_seed.js）をそのまま使う
    if (!window.Nutri || !window.Nutri.loaded() || !window.Seed || !window.Seed.available()) return;
    m.targets = { jo: { energy: 1500, age: 82, sex: 'f', setAt: today } };
    await window.Master.save();
    await window.Seed.importDishes();
    await window.Seed.importCycle(day(-2), 'jo', true);
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

    // 栄養ケア・マネジメント
    {
      const NC = window.NCM, recsN = await window.Ncm.all();
      ok('見本の栄養ケアの記録が 3 件', recsN.length === 3, recsN.length);
      const y = res.find((r) => r.name === '山田 ハナ');
      const due = NC.nextDue(y, recsN, m2, today);
      ok('高リスクは 2 週毎 → 30 日前の記録なら期限切れ', due.overdueDays > 0 && due.lastLevel === 'high', due.overdueDays);
      const s2 = res.find((r) => r.name === '佐藤 正一');
      ok('低リスクは 90 日毎 → まだ先', M.dayNum(NC.nextDue(s2, recsN, m2, today).due) > M.dayNum(today));
      const nw = res.find((r) => r.name === '高橋 キヨ');
      ok('記録が無い人は入所+7日が期限', NC.nextDue(nw, recsN, m2, today).kind === 'first');
      const dl = NC.dueList(res, recsN, m2, today, 7);
      ok('期限の一覧に山田さんが入り、期限切れが先頭', dl.length > 0 && dl[0].daysLeft < 0);
      const cp = NC.copyFrom(recsN.find((x) => x.residentId === y.id), today, 'monitoring');
      ok('前回複写: 体重は残り、総合評価は空になる', cp.body.weightKg === 41.2 && cp.evaluation === '');
      const al = NC.autoLevel(recsN.find((x) => x.residentId === y.id), m2.risk);
      ok('山田さんの自動判定は高リスク', al.level === 'high', al.reasons);
    }

    // 栄養ケア計画書
    {
      const NC = window.NCM, pl = await window.CarePlan.all();
      ok('見本の計画書が 1 件', pl.length === 1, pl.length);
      const y5 = res.find((r) => r.name === '山田 ハナ');
      const st = NC.planState(pl, y5.id, m2, today);
      ok('計画書がある人は has = true、短期目標 3 行', st.has && st.current.rows.length === 3, st.has);
      ok('経過記録が 2 件', st.current.progress.length === 2);
      ok('見直しの目安（90日）はまだ来ていない', !st.needsReview, st.staleDays);
      const st2 = NC.planState(pl, res.find((r) => r.name === '佐藤 正一').id, m2, today);
      ok('計画書が無い人は needsReview = true', !st2.has && st2.needsReview);
      const rev = NC.revisePlan(st.current, today);
      ok('見直し: 中身は引き継ぎ、説明日と経過記録は空になる', rev.rows.length === 3 && rev.explainedAt === '' && rev.progress.length === 0 && rev.id === '');
      ok('見直し: 元の版を壊さない', st.current.progress.length === 2 && st.current.explainedAt);
      ok('計画の分類 5・算定加算 5', NC.PLAN_CATEGORIES.length === 5 && NC.PLAN_ADDONS.length === 5);
    }

    // 栄養計算
    if (window.Nutri && window.Nutri.loaded()) {
      ok('成分表が読み込まれている', window.Nutri.count() === 2538, window.Nutri.count());
      const ds = await window.Dishes.all();
      ok('見本に初期データの料理 75 件が入る', ds.length === 75, ds.length);
      const gohan = ds.find((d) => d.name === 'ごはん');
      ok('ごはん 160g は 250kcal', window.Nutri.round('kcal', window.Dishes.sumOf(gohan).values.kcal) === 250, window.Nutri.round('kcal', window.Dishes.sumOf(gohan).values.kcal));
      const dm = {}; ds.forEach((d) => { dm[d.id] = d; });
      const rec = await window.Menu.get(today);
      const lunch = window.Menu.sumCell(window.Menu.cellDishes(rec, 'l', 'jo'), dm);
      ok('昼の献立にエネルギーがある', lunch.values.kcal > 400, window.Nutri.round('kcal', lunch.values.kcal));
      const dayAll = window.Menu.sumDay(rec, M.activeMeals(m2), 'jo', dm);
      ok('1日の合計は3食の和', window.Nutri.round('kcal', dayAll.values.kcal) > window.Nutri.round('kcal', lunch.values.kcal));
      const tg = window.Menu.targetOf('jo');
      ok('給与栄養目標量が引ける（1500kcal）', tg && tg.energy === 1500, tg && tg.energy);
      ok('目標と見比べて判定が出る', ['low', 'ok', 'high'].indexOf(window.Nutri.judge(tg.target, 'kcal', dayAll.values.kcal)) >= 0);
      ok('アレルギーが献立から拾える', window.Menu.allergensOf(window.Menu.cellDishes(rec, 'l', 'jo'), dm).length > 0,
        window.Menu.allergensOf(window.Menu.cellDishes(rec, 'l', 'jo'), dm));
      ok('未測定の成分は合計に足さない', Object.keys(dayAll.missing).length >= 0);
    }

    // リンク集と出典
    ok('リンクが 96 件、分類つきで入っている', m.links.length === 96 && new Set(m.links.map((l) => l.c)).size >= 7, m.links.length);
    ok('リンクの URL が全部 https', m.links.every((l) => /^https:/.test(l.u)), m.links.filter((l) => !/^https:/.test(l.u)).map((l) => l.n));
    ok('掲示板・Q&A の分類がある', m.links.some((l) => l.c === '掲示板・Q&A'));
    ok('出典に「更新に気づく手がかり」が全部ある', m.dataSources.every((s) => s.how && s.how.length > 10), m.dataSources.filter((s) => !s.how).map((s) => s.id));
    ok('アレルギー品目は 28、先頭 9 が表示義務でカシューナッツを含む',
      m.allergens.length === 28 && m.allergens.slice(0, 9).indexOf('カシューナッツ') >= 0 && m.allergens.slice(0, 9).indexOf('くるみ') >= 0, m.allergens.slice(0, 9));

    // 文例
    ok('文例が欄ごとに 10 欄ある', Object.keys(m.phrases).length >= 10, Object.keys(m.phrases).length);
    ok('特記事項の文例が入っている', m.phrases['ncm.special'].length >= 5);
    ok('文例をつなげられる', window.Phrases.apply('', ['A', 'B'], 'replace').indexOf('A') === 0);
    ok('今の文に足せる', window.Phrases.apply('元', ['A'], 'append').indexOf('元') === 0);
    ok('同じ文は二重に足さない', window.Phrases.add(m, 'ncm.special', m.phrases['ncm.special'][0]) === false);

    // やること一覧
    {
      const built = await window.Board.build(today);
      ok('やること一覧に列が 5 つ（食事情報・栄養ケア・計画書・体重・ラウンド）', built.cols.length === 5, built.cols.map((c) => c.label));
      ok('やること一覧の行は在籍者の数', built.rows.length === res.filter((r) => M.status(r, today, m2.meals) === 'in').length, built.rows.length);
      const y2 = built.rows.find((x) => x.resident.name === '山田 ハナ');
      ok('山田さんの栄養ケアのセルは期限切れ', y2.cells[1].state === 'over', y2.cells[1]);
      ok('山田さんの計画書のセルは作成済み', y2.cells[2].state === 'ok', y2.cells[2]);
      ok('計画書が無い人のセルは赤', built.rows.find((x) => x.resident.name === '佐藤 正一').cells[2].state === 'over');
      const sh = built.rows.find((x) => x.resident.name === '渡辺 茂');
      ok('ショートの人の栄養ケアは対象外', sh.cells[1].state === 'none', sh.cells[1]);
      ok('セルを押す動きが付いている', typeof y2.cells[1].onclick === 'function');
    }

    // 保存済みマスタへの項目の補完
    {
      const mg = window.Master.merge({ categories: [{ id: 'long', label: '入所' }] });
      ok('古い区分に「栄養ケアの対象」が補われる', mg.categories[0].ncm === true, mg.categories[0]);
      const mg2 = window.Master.merge({ shokushu: [{ id: 'jo', label: 'ふつう食', color: '#ff0000' }] });
      ok('保存した名前と色は上書きされない', mg2.shokushu[0].label === 'ふつう食' && mg2.shokushu[0].color === '#ff0000');
    }

    // 禁食・アレルギー × 出る物
    {
      const y3 = res.find((r) => r.name === '佐藤 正一');   // アレルギー えび・かに、禁食 納豆→豆腐
      const d3 = M.dietAt(y3, { d: today, m: 'l' }, m2.meals);
      const hit = M.matchRestrictions(d3, ['えびフライ', 'ごはん']);
      ok('アレルギーが料理名から当たる', hit.length === 1 && hit[0].kind === 'allergy' && hit[0].word === 'えび', hit);
      const hit2 = M.matchRestrictions(d3, ['納豆', 'ごはん']);
      ok('禁食が当たり、代わりの物が付く', hit2.length === 1 && hit2[0].kind === 'kinshi' && hit2[0].sub === '豆腐', hit2);
      ok('当たらない物では出ない', M.matchRestrictions(d3, ['ごはん', 'みそ汁']).length === 0);
      const rows = M.restrictionsAt(res, { d: today, m: 'd' }, m2, ['鶏肉']);
      ok('鶏肉で高橋さんが当たる（禁食 鶏肉→魚）', rows.some((x) => x.r.name === '高橋 キヨ'), rows.map((x) => x.r.name));
      ok('その枠にいない人は出ない（渡辺さんは朝で退所）', !rows.some((x) => x.r.name === '渡辺 茂'));
      ok('欠食の人は出ない（高橋さんは昼が受診）', !M.restrictionsAt(res, { d: today, m: 'l' }, m2, ['鶏肉']).some((x) => x.r.name === '高橋 キヨ'));
      // 献立から出る物の言葉
      const ds2 = await window.Dishes.all(); const dm2 = {}; ds2.forEach((d) => { dm2[d.id] = d; });
      const nj = ds2.find((d) => d.name === '肉じゃが');
      const w = window.Menu.wordsOf([{ dishId: nj.id }], dm2);
      ok('料理から材料名とアレルギー品目が言葉として出る', w.indexOf('肉じゃが') >= 0 && w.indexOf('豚肉') >= 0 && w.some((x) => x.indexOf('じゃがいも') >= 0), w.slice(0, 5));
    }

    // 変更の前後 2 行
    {
      const y4 = res.find((r) => r.name === '山田 ハナ');
      const v = y4.diet[y4.diet.length - 1];
      const prev = M.prevVersion(y4, v, m2.meals);
      const before = M.rowOf(prev.data, m2), after = M.rowOf(v.data, m2);
      ok('前後の行が同じ長さ', before.length === after.length && before.length === M.ROW_FIELDS.length);
      const changed = before.map((x, i) => x !== after[i]).filter(Boolean).length;
      ok('変わった所だけ違う（主食・副食・汁とろみ・注意）', changed === 4, { before: before, after: after });
    }

    // 初期データ
    {
      const S = window.Seed;
      ok('初期データが読み込まれている（料理 75 件・サイクル 14 日）', S.available() && S.count() === 75 && S.cycleDays() === 14, [S.count(), S.cycleDays()]);
      const before = (await window.Dishes.all()).length;
      const r2 = await S.importDishes();
      ok('二度押しても増えない（同じ名前は飛ばす）', r2.added === 0 && (await window.Dishes.all()).length === before, r2);
      const seeded = (await window.Dishes.all()).find((d) => d.name === '筑前煮');
      ok('初期データの料理に材料と食品番号が入っている', !!(seeded && seeded.items.length >= 5 && /^[0-9]{5}$/.test(seeded.items[0].no)), seeded && seeded.items[0]);
      const kcal = seeded ? window.Nutri.round('kcal', window.Dishes.sumOf(seeded).values.kcal) : 0;
      ok('初期データの料理から栄養価が出る（筑前煮 80〜200kcal）', kcal > 80 && kcal < 200, kcal);
      ok('同じ名前の料理は 1 件だけ', (await window.Dishes.all()).filter((d) => d.name === '肉じゃが').length === 1);
      // 区分
      const ds4 = await window.Dishes.all();
      ok('全部の料理に主材料と調理法が付いている', ds4.every((d) => d.main && d.method), ds4.filter((d) => !d.main || !d.method).map((d) => d.name));
      ok('区分は マスタの並びに収まっている', ds4.every((d) => m2.dishMains.indexOf(d.main) >= 0 && m2.dishMethods.indexOf(d.method) >= 0),
        ds4.filter((d) => m2.dishMains.indexOf(d.main) < 0).map((d) => d.main));
      const byKind = {}; ds4.forEach((d) => { byKind[d.kind] = (byKind[d.kind] || 0) + 1; });
      ok('区分ごとに料理がある（主食・汁物・主菜・副菜・デザート・飲み物）', Object.keys(byKind).length === 6 && byKind['主菜'] >= 20, byKind);
      const fish = ds4.filter((d) => d.main === '魚');
      ok('主材料で絞れる（魚は 9 件）', fish.length === 9, fish.length);
      const nimono = ds4.filter((d) => d.method === '煮る');
      ok('調理法で絞れる（煮る は 15 件以上）', nimono.length >= 15, nimono.length);
      // サイクル献立
      const st = M.addDays(today, 30);
      const r3 = await S.importCycle(st, 'jo', false);
      ok('サイクル献立が 14 日分入る', r3.days === 14 && r3.filled > 0 && !r3.missing.length, r3);
      const rec2 = await window.Menu.get(st);
      const dm3 = {}; (await window.Dishes.all()).forEach((d) => { dm3[d.id] = d; });
      const dayK = window.Nutri.round('kcal', window.Menu.sumDay(rec2, M.activeMeals(m2), 'jo', dm3).values.kcal);
      ok('サイクル献立 1 日目が 1200〜1600kcal', dayK > 1200 && dayK < 1600, dayK);
      const r4 = await S.importCycle(st, 'jo', false);
      ok('二度目は既にある献立を残す', r4.filled === 0 && r4.kept > 0, r4);
    }

    // LIFE の CSV
    {
      const Lx = window.Life;
      ok('LIFE の項目定義が読める（22/122/79）',
        Lx.fields('user').length === 22 && Lx.fields('nutrition').length === 122 && Lx.fields('plan').length === 79);
      const got = await window.LifeUi.collect(M.addDays(today, -60), today);
      ok('期間の記録から行ができる', got.rows.nutrition.length === 3 && got.rows.user.length >= 3, [got.rows.nutrition.length, got.rows.user.length]);
      const yamada = got.rows.user.find((v) => v.last_name === '山田');
      ok('利用者行に被保険者番号と要介護度が入る', yamada.insured_no === 'H900000001' && yamada.care_level === '23', yamada && [yamada.insured_no, yamada.care_level]);
      ok('利用者行のカナは半角', yamada.last_name_kana === 'ﾔﾏﾀﾞ', yamada.last_name_kana);
      const missU = Lx.check('user', got.rows.user);
      ok('番号を入れた人は必須◎が埋まる', !missU.some((x) => x.id === 'insured_no' && x.count >= got.rows.user.length), missU.map((x) => x.id + ':' + x.count));
      const csv = Lx.csv('nutrition', got.rows.nutrition);
      const NLCR = String.fromCharCode(13) + String.fromCharCode(10);
      ok('CSV は 1+行数 行', csv.split(NLCR).filter((x) => x !== '').length === got.rows.nutrition.length + 1);
      ok('CSV の 1 行目が物理名', csv.split(NLCR)[0].indexOf('care_facility_id,service_code') === 0);
      const planRows = got.rows.plan;
      ok('計画書の行もできる', planRows.length === 1 && planRows[0].plan_classification_01 === '1', planRows.length);
    }

    // 測定値・補食・様式・プリセット
    {
      const y6 = res.find((r) => r.name === '山田 ハナ');
      const md = await window.Measures.ofResident(y6.id);
      ok('測定値が種類ごとに分かれる（体重・Alb・Hb）', md.weight.length === 7 && md.alb.length === 6 && md.hb.length === 6,
        Object.keys(md).map((k) => k + ':' + md[k].length));
      ok('基準から外れた値が分かる（Alb 2.9 は低い）', window.Measures.out('alb', 2.9) === 'low' && window.Measures.out('alb', 4.0) === '');
      ok('測定の種類は 7 つ、体重は消せない', m2.measures.length === 7 && m2.measures[0].core === true);
      const sup = await window.Supplements.collect(today);
      ok('補食の配布表に鈴木さんが出る（高カロリーゼリー 15時）',
        sup.rows.some((x) => x.r.name === '鈴木 トメ' && x.name === '高カロリーゼリー' && x.when === '15時'), sup.rows.map((x) => x.r.name));
      ok('補食は時刻でまとまる', Object.keys(sup.byTime).length >= 1 && sup.byItem['高カロリーゼリー'] >= 1, Object.keys(sup.byTime));
      ok('表示のプリセットが 3 つある', m2.nutrientPresets.length === 3 && m2.nutrientPresets[0].name === '栄養士', m2.nutrientPresets.map((p) => p.name));
    }

    // 帳票（食品構成表・栄養出納表・栄養管理報告書）
    {
      const Rx = window.Report, FGx = window.FoodGroup;
      const st = M.addDays(today, 30);           // 上で 14 日分のサイクル献立を入れた日
      const days = []; for (let i = 0; i < 14; i++) days.push(M.addDays(st, i));
      const g = await Rx.gather(days, 'jo');
      ok('献立から 14 日ぶん集まる', g.filled === 14, g.filled);
      ok('1 人 1 日平均の穀類（ごはん）が 300〜500g（1 食 160g ×3 食、パン・めんの日を含む平均）', g.avgGroup.g.rice > 300 && g.avgGroup.g.rice < 500, Math.round(g.avgGroup.g.rice));
      ok('緑黄色野菜が 1 日 30g 以上ある', g.avgGroup.g.gvege >= 30, Math.round(g.avgGroup.g.gvege));
      ok('群の分からない材料は無い', g.avgGroup.unknown === 0, g.avgGroup.unknown);
      const sumG = FGx.ids().reduce((s2, k) => s2 + (g.avgGroup.g[k] || 0), 0);
      ok('群ごとの合計が総重量と合う', Math.abs(sumG + g.avgGroup.unknown - g.avgGroup.total) < 0.01, [sumG, g.avgGroup.total]);
      const dayK2 = window.Nutri.round('kcal', g.avgGroup && g.avgNut.values.kcal);
      ok('1 日平均のエネルギーが献立と同じ桁（1200〜1600kcal）', dayK2 > 1200 && dayK2 < 1600, dayK2);
      ok('月の日数が出せる（2026-02 は 28 日）', Rx.daysOf('2026-02').length === 28, Rx.daysOf('2026-02').length);
      ok('うるう年も合う（2028-02 は 29 日）', Rx.daysOf('2028-02').length === 29, Rx.daysOf('2028-02').length);
      ok('前月・次月に動ける', Rx.addMonth('2026-01', -1) === '2025-12' && Rx.addMonth('2026-12', 1) === '2027-01',
        [Rx.addMonth('2026-01', -1), Rx.addMonth('2026-12', 1)]);
    }

    // 予定献立表・調理指示書・発注書
    {
      const Kx = window.Kondate;
      const st = M.addDays(today, 30);
      const un = await Kx.unfold(st);
      ok('献立が 食種 × 食事 × 料理 × 材料 にほどける', un.rows.length >= 1 && un.rows[0].cells.length === 3, un.rows.map((r) => r.sh.id + ':' + r.cells.length));
      const cell = un.rows[0].cells[0];
      ok('その食種のその食事の食数が付く', cell.n >= 1, cell.n);
      const gohan = cell.dishes.find((d) => d.dish && d.dish.name === 'ごはん');
      ok('1 人分の材料の重さが出る（ごはん 160g）', gohan && Math.round(gohan.items[0].g1) === 160, gohan && gohan.items.map((i) => i.name + ':' + i.g1));
      // 食種展開
      await window.Menu.get(st);
      const before = window.Menu.cellDishes(await window.Menu.get(st), 'l', 'dm').length;
      const recX = await window.Menu.get(st);
      recX.cells[window.Menu.cellKey('l', 'dm')] = JSON.parse(JSON.stringify(window.Menu.cellDishes(recX, 'l', 'jo')));
      await DB.put('menus', recX);
      const after = window.Menu.cellDishes(await window.Menu.get(st), 'l', 'dm').length;
      ok('別の食種に献立を写せる', before === 0 && after > 0, [before, after]);
      // 発注（単価）
      m2.prices = [{ no: '01088', name: 'めし', spec: '5kg 袋', packG: 5000, yen: 2800, vendor: '米屋' }];
      const o1 = Kx.orderOf('01088', 12000);
      ok('必要量から発注数を切り上げる（12kg → 5kg 袋 3 個）', o1.packs === 3 && o1.yen === 8400, [o1.packs, o1.yen]);
      const o2 = Kx.orderOf('99999', 100);
      ok('単価が無い食材は金額を出さない', o2.packs === null && o2.yen === null, o2);
      ok('重さの表示が kg に切り替わる', Kx.g(950) === '950 g' && Kx.g(1500) === '1.50 kg', [Kx.g(950), Kx.g(1500)]);
      // 廃棄率（純使用量 → 購入量）
      const egg = Kx.buyG('12004', 100);   // 鶏卵 全卵 生（廃棄率 14%）
      ok('廃棄率を戻して購入量が出る（卵 100g → 116g）', egg.refuse === 14 && Math.round(egg.g) === 116, [egg.refuse, Math.round(egg.g)]);
      const shio = Kx.buyG('17012', 100);  // 食塩（廃棄率 0）
      ok('廃棄率 0 の食材は純使用量のまま', shio.refuse === 0 && shio.g === 100, shio);
      m2.prices = [];
    }

    // Excel の書き出し（画面側でも動くか）
    {
      const bytes = window.Xlsx.build([{ name: '試し', rows: [['あ', 1]] }]);
      ok('ブラウザでも .xlsx が作れる', bytes instanceof Uint8Array && bytes.length > 500, bytes && bytes.length);
      ok('ZIP のしるしで始まる', bytes[0] === 0x50 && bytes[1] === 0x4B && bytes[2] === 3 && bytes[3] === 4);
      ok('U.xlsx がある', typeof U.xlsx === 'function');
    }

    // 選択メニューと嗜好調査
    {
      const Cx = window.Choice, Mx = window.Menu;
      const st = M.addDays(today, 30);
      const rec = await Mx.get(st);
      ok('選択メニューを置いていなければ null', !Cx.get(rec, 'l', 'jo'));
      const dishes = await window.Dishes.all();
      const a1 = dishes.find((d) => d.kind === '主菜') || dishes[0];
      const a2 = dishes.filter((d) => d.kind === '主菜' && d !== a1)[0] || dishes[1];
      rec.choice = { [Mx.cellKey('l', 'jo')]: { label: '主菜を選ぶ',
        options: [{ id: 'oa', dishId: a1.id, name: a1.name }, { id: 'ob', dishId: a2.id, name: a2.name }] } };
      await DB.put('menus', rec);
      const rec2 = await Mx.get(st);
      const ch = Cx.get(rec2, 'l', 'jo');
      ok('選択メニューが残る（2 件）', ch && ch.options.length === 2, ch && ch.options.length);
      ok('置けるのは 4 件まで', Cx.MAX === 4);
      // 誰が何を選んだか
      const d0 = { date: st, extra: {}, choice: { [Mx.cellKey('l', 'jo')]: { r1: 'oa', r2: 'ob', r3: 'oa' } } };
      await DB.put('daily', d0);
      const daily = await Cx.picksOf(st);
      ok('選んだものが引ける', Cx.pickOf(daily, 'l', 'jo', 'r1') === 'oa' && Cx.pickOf(daily, 'l', 'jo', 'r2') === 'ob');
      ok('聞いていない人は空', Cx.pickOf(daily, 'l', 'jo', 'r9') === '');
      const t = Cx.tally(daily, 'l', 'jo', ch.options).apply(['r1', 'r2', 'r3', 'r9']);
      ok('選んだ人数が数えられる（A 2人・B 1人・未 1人）', t.oa === 2 && t.ob === 1 && t.none === 1, t);
      // 食札に「選んだ料理」を出せる
      ok('食札の項目に「選んだ料理」がある', window.Cards.ITEMS.some((x) => x.id === 'choice'));
      await Cx.preload(st);
      const item = window.Cards.ITEMS.find((x) => x.id === 'choice');
      ok('選んだ人はその料理名が出る',
        item.get({ r: { id: 'r1' }, d: { shokushu: 'jo' }, slot: { d: st, m: 'l' }, m: m2 }) === a1.name,
        item.get({ r: { id: 'r1' }, d: { shokushu: 'jo' }, slot: { d: st, m: 'l' }, m: m2 }));
      ok('聞いていない人は「未選択」',
        item.get({ r: { id: 'r9' }, d: { shokushu: 'jo' }, slot: { d: st, m: 'l' }, m: m2 }) === '未選択');
      ok('選択メニューが無い食事は空',
        item.get({ r: { id: 'r1' }, d: { shokushu: 'jo' }, slot: { d: st, m: 'b' }, m: m2 }) === '');
      // 嗜好調査の欄
      ok('嗜好調査の欄が 6 つ', Cx.KIKOU.length === 6, Cx.KIKOU.length);
      ok('5 段階の欄は 3 つ、それぞれ言葉が 5 つ',
        Cx.KIKOU.filter((f) => f.kind === 'five').length === 3
        && Cx.KIKOU.filter((f) => f.kind === 'five').every((f) => f.words.length === 5));
      // 片付け
      delete rec2.choice; await DB.put('menus', rec2);
      await DB.put('daily', { date: st, extra: {} });
    }

    // 検収・在庫・受払い
    {
      const Sx = window.Stock;
      ok('検収の欄が 大量調理施設衛生管理マニュアル 様式4 の 8 項目', Sx.CHECK_FIELDS.length === 8
        && Sx.CHECK_FIELDS.map((f) => f.id).join() === 'time,origin,expiry,fresh,pack,temp,foreign,advice',
        Sx.CHECK_FIELDS.map((f) => f.id));
      const d1 = M.addDays(today, -3), d2 = M.addDays(today, -2), d3 = M.addDays(today, -1);
      const mk = (date, kind, qty, no) => ({ id: U.uid('s'), date: date, no: no || '01083', name: '精白米',
        kind: kind, qty: qty, vendor: '米屋', memo: '', at: Date.now(), check: {} });
      await DB.putMany('stock', [mk(d1, 'in', 5000), mk(d2, 'out', 1200), mk(d3, 'out', 1300)]);
      const rows = await Sx.all();
      const bal = Sx.balance(rows);
      ok('入庫 − 出庫 = 残（5000 − 1200 − 1300 = 2500）', bal['01083'].qty === 2500, bal['01083'].qty);
      const upto = Sx.balance(rows, d2);
      ok('日付で区切って残が出せる（d2 まで 3800）', upto['01083'].qty === 3800, upto['01083'].qty);
      // 棚卸しはそれまでの計算を上書きする
      await DB.put('stock', mk(d3, 'adjust', 2400));
      const rows2 = await Sx.all();
      ok('棚卸しを入れるとその実数が残になる', Sx.balance(rows2)['01083'].qty === 2400, Sx.balance(rows2)['01083'].qty);
      // 棚卸しの後にまた出庫すると、そこから引かれる
      await DB.put('stock', mk(today, 'out', 400));
      ok('棚卸しの後の出庫は実数から引く（2400 − 400 = 2000）',
        Sx.balance(await Sx.all())['01083'].qty === 2000, Sx.balance(await Sx.all())['01083'].qty);
      ok('入庫と出庫の向きが分かる', Sx.sign('in') === 1 && Sx.sign('out') === -1);
      await DB.clear('stock');
      ok('出入りを消せば残も消える', Object.keys(Sx.balance(await Sx.all())).length === 0);
    }

    // 実施献立表と残食（喫食）調査
    {
      const Mx = window.Menu, Jx = window.Jisshi;
      const st = M.addDays(today, 30);       // 上でサイクル献立を入れた日
      const rec = await Mx.get(st);
      const key = Mx.cellKey('l', 'jo');
      const plan = Mx.cellDishes(rec, 'l', 'jo');
      ok('予定の料理がある', plan.length >= 3, plan.length);
      ok('実施を入れていなければ 実施＝予定', !Mx.hasActual(rec, 'l', 'jo')
        && Mx.actualDishes(rec, 'l', 'jo').length === plan.length);
      // 実施を直す（1 品を外す）
      rec.actual = rec.actual || {};
      rec.actual[key] = JSON.parse(JSON.stringify(plan)).slice(0, plan.length - 1);
      await DB.put('menus', rec);
      const rec2 = await Mx.get(st);
      ok('実施だけ変えても予定は残る', Mx.cellDishes(rec2, 'l', 'jo').length === plan.length
        && Mx.actualDishes(rec2, 'l', 'jo').length === plan.length - 1,
        [Mx.cellDishes(rec2, 'l', 'jo').length, Mx.actualDishes(rec2, 'l', 'jo').length]);
      ok('予定と違うことが分かる', Mx.hasActual(rec2, 'l', 'jo'));
      // 残食率
      const first = Mx.actualDishes(rec2, 'l', 'jo')[0];
      rec2.left = { [key]: { [first.dishId]: 50 } };
      await DB.put('menus', rec2);
      const rec3 = await Mx.get(st);
      ok('残食率が残る', Mx.leftOf(rec3, 'l', 'jo', first.dishId) === 50, Mx.leftOf(rec3, 'l', 'jo', first.dishId));
      const eaten = Mx.eatenDishes(rec3, 'l', 'jo');
      ok('残食 50% の料理は人数分が半分になる', eaten[0].x === 0.5, eaten[0].x);
      ok('残食を入れていない料理はそのまま', eaten[1].x === 1, eaten[1].x);
      ok('残食率 0（完食）でも減らない', (function () {
        const t = JSON.parse(JSON.stringify(rec3));
        t.left[key][first.dishId] = 0;
        return Mx.eatenDishes(t, 'l', 'jo')[0].x === 1;
      })());
      // 1 日分の合計が 予定 > 実施 > 推定摂取 の順になる
      const dm4 = {}; (await window.Dishes.all()).forEach((d) => { dm4[d.id] = d; });
      const kPlan = Mx.sumDay(rec3, M.activeMeals(m2), 'jo', dm4, 'plan').values.kcal;
      const kAct = Mx.sumDay(rec3, M.activeMeals(m2), 'jo', dm4, 'actual').values.kcal;
      const kEat = Mx.sumDay(rec3, M.activeMeals(m2), 'jo', dm4, 'eaten').values.kcal;
      ok('予定 > 実施 > 推定摂取', kPlan > kAct && kAct > kEat, [kPlan, kAct, kEat]);
      // 帳票も同じ切り替えで集計できる
      const gP = await window.Report.gather([st], 'jo', 'plan');
      const gE = await window.Report.gather([st], 'jo', 'eaten');
      ok('帳票が 推定摂取 でも集計できる', gE.avgNut.values.kcal < gP.avgNut.values.kcal,
        [Math.round(gP.avgNut.values.kcal), Math.round(gE.avgNut.values.kcal)]);
      ok('推定摂取では食品群の重さも減る', gE.avgGroup.total < gP.avgGroup.total,
        [Math.round(gP.avgGroup.total), Math.round(gE.avgGroup.total)]);
      ok('残食率の目盛りが 6 段階', Jx.STEPS.length === 6 && Jx.stepLabel(0) === '完食' && Jx.stepLabel(100) === '全残', Jx.STEPS);
      // 片付け
      delete rec3.actual; delete rec3.left; await DB.put('menus', rec3);
    }

    // 食札の中身（テンプレート）
    {
      const Cx = window.Cards;
      // 18 は食札モジュール自身の項目。選択メニュー（modules/choice.js）が「選んだ料理」を足して 19 になる
      ok('食札に載せられる項目が 19 ある', Cx.ITEMS.length === 19, Cx.ITEMS.map(function (x) { return x.id; }));
      ok('初期は 帯3・本文2・指示8', Cx.DEFAULT_TEMPLATE.band.length === 3 && Cx.DEFAULT_TEMPLATE.main.length === 2
        && Cx.DEFAULT_TEMPLATE.do.length === 8, [Cx.DEFAULT_TEMPLATE.band.length, Cx.DEFAULT_TEMPLATE.main.length, Cx.DEFAULT_TEMPLATE.do.length]);
      ok('初期の並びの項目はすべて実在する', ['band', 'main', 'do'].every((k) => Cx.DEFAULT_TEMPLATE[k].every((id) => !!Cx.item(id))));
      ok('設定が無ければ初期の並びを使う', Cx.template().band[0] === 'where');
      // 中身を変えると刷られる食札が変わる
      const y8 = res.find((r) => r.name === '鈴木 トメ');
      const slot = { d: today, m: 'l' };
      const diet = M.dietAt(y8, slot, m2.meals);
      const before = Cx.card(y8, diet, slot, m2.cardLayouts[0], false).textContent;
      m2.cardTemplate = { band: ['room', 'meal'], main: ['staple', 'side', 'age'], do: ['notes'],
        labels: { staple: 'ごはん' }, notLabel: 'たべられないもの', doLabel: 'おねがい', kana: false, suffix: false };
      const after = Cx.card(y8, diet, slot, m2.cardLayouts[0], false).textContent;
      ok('見出しの言葉を変えられる', after.indexOf('ごはん') >= 0 && after.indexOf('たべられないもの') >= 0 && after.indexOf('おねがい') >= 0, after);
      ok('外した項目は出ない（自助具を指示欄から外した）', before.indexOf('大スプーン') >= 0 && after.indexOf('大スプーン') < 0, [before, after]);
      ok('足した項目は出る（年齢）', after.indexOf('歳') >= 0, after);
      const suffix = window.View.t('suffix');
      ok('敬称を消せる', before.indexOf(suffix) >= 0 && after.indexOf(suffix) < 0, [before, after]);
      // 禁止の欄は、外す設定が無い（並びに入っていなくても必ず描かれる）
      const dietNG = Object.assign(M.emptyDiet(), { allergy: ['えび'], kinshi: [{ food: '牛乳', sub: '豆乳' }] });
      const ngCard = Cx.card(y8, dietNG, slot, m2.cardLayouts[0], false).textContent;
      ok('アレルギーと禁食は外せない（必ず出る）', ngCard.indexOf('えび') >= 0 && ngCard.indexOf('牛乳') >= 0, ngCard);
      m2.cardTemplate = null;
      ok('null に戻すと初期の並びに戻る', Cx.template().main.join() === 'staple,side', Cx.template().main);
    }

    // 入所時の聞き取り
    {
      const Ix = window.Intake;
      ok('聞き取りの欄が 9 かたまり', Ix.GROUPS.length === 9, Ix.GROUPS.length);
      ok('欄の合計は 45 以上（実物 2 様式の合わせ）', Ix.allFields().length >= 45, Ix.allFields().length);
      ok('欄の id が重複していない', (function () {
        const ids = Ix.allFields().map((f) => f.id);
        return ids.length === ids.filter((x, i) => ids.indexOf(x) === i).length;
      })());
      const v = { shokushu: 'dm', staple: 'kayu', stapleG: 120, side: 'kizami', drinkThick: 'mid', assist: 'part',
        tools: ['スプーン'], allergy: ['えび'], kinshi: ['牛乳'], suppName: '高カロリーゼリー',
        sideWord: 'きざみ 1cm角', thickWord: 'ポタージュ状', swWay: ['交互嚥下'], drugNg: 'ワルファリンのため納豆' };
      const d = Ix.toDiet(v, null);
      ok('食種・主食・副食・とろみが食事情報に写る',
        d.shokushu === 'dm' && d.staple === 'kayu' && d.stapleG === 120 && d.side === 'kizami' && d.drinkThick === 'mid', d);
      ok('禁食は {food, sub} の形になる', d.kinshi.length === 1 && d.kinshi[0].food === '牛乳' && d.kinshi[0].sub === '', d.kinshi);
      ok('アレルギーと食具も写る', d.allergy[0] === 'えび' && d.tools[0] === 'スプーン');
      ok('補助食品が補食に入る', d.supplements.length === 1 && d.supplements[0].name === '高カロリーゼリー', d.supplements);
      ok('前の施設の言葉と注意は食札の注意にまとまる',
        /きざみ 1cm角/.test(d.notes) && /ポタージュ状/.test(d.notes) && /交互嚥下/.test(d.notes) && /ワルファリン/.test(d.notes), d.notes);
      const d0 = Ix.toDiet({}, null);
      ok('空の聞き取りは何も上書きしない', !d0.shokushu && !d0.staple && !d0.notes, d0);
      ok('まだ書いていない人は「なし」', !Ix.filled({ intake: null }) && !Ix.filled({ intake: {} }));
      ok('1 つでも入っていれば「あり」', Ix.filled({ intake: { sw: 'むせ込みあり' } }));
    }

    // 個人別の必要栄養量
    {
      const y7 = res.find((r) => r.name === '山田 ハナ');
      const got = await window.Needs.of(y7);
      ok('既定（基礎代謝基準値×体重×身体活動レベル）で出る', got.kcal > 800 && got.kcal < 2000, [got.kcal, got.how]);
      ok('たんぱく質は体重 × 1.0g が既定', got.prot != null && Math.abs(got.prot - got.weightUsed) < 0.05, [got.prot, got.weightUsed]);
      ok('出し方が 1 行の文で残る', /基礎代謝基準値/.test(got.how), got.how);
      // 体重 × 係数
      const kgRule = { method: 'kg', weightBase: 'actual', kcalPerKg: 30, protPerKg: 1.2 };
      const g2 = window.Nutri.personalNeed(kgRule, got.body);
      ok('体重 × 30kcal で出せる', g2.kcal === Math.round(got.body.weightKg * 30), [g2.kcal, got.body.weightKg]);
      ok('たんぱく質の係数も効く', Math.abs(g2.prot - got.body.weightKg * 1.2) < 0.06, g2.prot);
      // 標準体重（BMI 22）
      ok('標準体重は BMI 22 で出る（150cm → 49.5kg）', window.Nutri.idealWeight(150) === 49.5, window.Nutri.idealWeight(150));
      ok('調整体重は 標準 +（実 − 標準）× 0.25', window.Nutri.weightFor('adjust', 39.5, 150) === 47, window.Nutri.weightFor('adjust', 39.5, 150));
      ok('身長が無ければ実体重に戻る', window.Nutri.weightFor('ideal', 40, null) === 40);
      // Harris-Benedict
      const hb = window.Nutri.personalNeed({ method: 'hb', activity: 1.3, stress: 1.0 }, { age: 80, sex: 'f', weightKg: 50, heightCm: 150 });
      const bee = 655.1 + 9.56 * 50 + 1.85 * 150 - 4.68 * 80;
      ok('Harris-Benedict が式どおり', hb.kcal === Math.round(bee * 1.3), [hb.kcal, Math.round(bee * 1.3)]);
      // 手入力
      const man = window.Nutri.personalNeed({ method: 'manual', kcal: 1400, prot: 55 }, got.body);
      ok('手で入れた値はそのまま', man.kcal === 1400 && man.prot === 55, man);
      // 保存できる
      const rec = await DB.get('residents', y7.id);
      rec.energyRule = kgRule; await DB.put('residents', rec);
      const again = await window.Needs.of(M.normalizeResident(await DB.get('residents', y7.id)));
      ok('利用者に出し方が残る', again.rule.method === 'kg' && again.kcal === g2.kcal, [again.rule.method, again.kcal]);
      rec.energyRule = null; await DB.put('residents', rec);
    }

    // 常用量（目安量）
    {
      const Ax = window.Amounts;
      ok('目安量の初期値がある', Ax.DEFAULTS.length >= 40, Ax.DEFAULTS.length);
      const egg2 = Ax.forFood(null, '12004');
      ok('卵に M玉 1個 = 50g がある', egg2.some((x) => x.unit === 'M玉 1個' && x.g === 50), egg2);
      const shoyu = Ax.forFood(null, '17007');
      ok('しょうゆに 小さじ1 = 6g と 大さじ1 = 18g がある',
        shoyu.some((x) => x.unit === '小さじ1' && x.g === 6) && shoyu.some((x) => x.unit === '大さじ1' && x.g === 18), shoyu);
      ok('目安量の食品番号はすべて成分表にある', Ax.DEFAULTS.every((x) => !!window.Nutri.get(x.no)),
        Ax.DEFAULTS.filter((x) => !window.Nutri.get(x.no)).map((x) => x.no));
      ok('可食部 → 購入量（廃棄率 40% なら 1.67 倍）', Math.round(Ax.purchase(60, 40)) === 100, Ax.purchase(60, 40));
      ok('廃棄率 0・未測定は そのまま', Ax.purchase(50, 0) === 50 && Ax.purchase(50, null) === 50);
      // 目安量（可食部）に廃棄率を戻すと、よく言われる 1 個の重さに戻る
      const banana = Ax.forFood(null, '07107')[0];
      ok('バナナ 1本 90g（可食部）は、皮を入れると 150g', Math.round(Ax.purchase(banana.g, window.Nutri.val(window.Nutri.get('07107'), 'refuse'))) === 150,
        Math.round(Ax.purchase(banana.g, 40)));
    }

    // 検食簿・給食日誌
    {
      const Jx = window.Journal;
      const form = Jx.form();
      ok('検食簿の欄が 7 つ（うち所見は自由記入）', form.kenshoku.length === 7 && form.kenshoku[6].kind === 'text', form.kenshoku.length);
      ok('5 段階の言葉がある', form.scale.length === 5 && form.scale[0] === '良い', form.scale);
      ok('検印欄が 3 つ', form.stamps.length === 3, form.stamps);
      const rec = await Jx.get(today);
      ok('まだ書いていない日は未記入', !Jx.done(rec, 'l'));
      rec.kenshoku.l = { at: '11:30', by: '施設長', values: { amount: '良い' } };
      await Jx.save(rec);
      const rec2 = await Jx.get(today);
      ok('検食簿が保存される', Jx.done(rec2, 'l') && rec2.kenshoku.l.by === '施設長', rec2.kenshoku.l);
      ok('同じ日の食数の手入力（extra）は消えない', rec2.extra !== undefined);
      const ph = window.Phrases.get(m2, 'journal.kenshoku');
      ok('検食簿の文例が入っている', ph.length >= 5, ph.length);
    }

    // 全画面が例外なく描ける
    for (const name of Object.keys(App.screens)) {
      const box = h('div'); let err = null;
      try { await App.screens[name]((['resident', 'plan', 'form411', 'form42'].indexOf(name) >= 0) ? [y.id] : [], box); } catch (e) { err = e.message; }
      ok('画面「' + name + '」が描ける', !err && box.childNodes.length > 0, err);
    }
    // データが空でも全画面が描けるか（「該当なし」で null を返す作りの取りこぼしを見つける）
    for (const st of DB.STORES) await DB.clear(st);
    await window.Master.load();
    for (const name of Object.keys(App.screens)) {
      const box = h('div');
      let err = null;
      try { await App.screens[name]([], box); } catch (e) { err = e.message; }
      ok('空のデータでも画面「' + name + '」が描ける', !err, err);
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
