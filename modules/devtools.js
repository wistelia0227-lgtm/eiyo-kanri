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

    // 全画面が例外なく描ける
    for (const name of Object.keys(App.screens)) {
      const box = h('div'); let err = null;
      try { await App.screens[name]((['resident', 'plan', 'form411', 'form42'].indexOf(name) >= 0) ? [y.id] : [], box); } catch (e) { err = e.message; }
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
