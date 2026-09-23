// LIFE の CSV の試験。C:/AI/_setup/node/node.exe tools/test_life.js
'use strict';
const fs = require('fs');
const path = require('path');
global.window = global;
const M = require('../js/model.js');
global.Model = M;
const N = require('../js/ncm.js');
// 仕様は window.LIFE_SPEC に入る形なので、読み込んで評価する
const specSrc = fs.readFileSync(path.join(__dirname, '..', 'js', 'life_spec.js'), 'utf8');
eval(specSrc);
const L = require('../js/life.js');
L.load(global.LIFE_SPEC);
const masters = require('../js/master.js').DEFAULTS;
let n = 0, bad = 0;
function ok(name, cond, extra) { n++; if (!cond) { bad++; console.log('NG  ' + name + (extra !== undefined ? '  → ' + JSON.stringify(extra) : '')); } else console.log('ok  ' + name); }
let seq = 0; const uid = (p) => p + (++seq);

const m = JSON.parse(JSON.stringify(masters));
m.life = { careFacilityId: '9900000001', serviceCode: '51', insurerNo: '990001', category: '1', trinity: true };

const r = M.normalizeResident(Object.assign(M.newResident('山田 ハナ', uid), {
  kana: 'やまだ はな', gender: 'f', birth: '1938-04-02', heightCm: 148,
  insuredNo: 'H900000001', careLevel: '23', memo: '脳梗塞後遺症',
  stays: [{ id: 's1', from: { d: '2025-08-15', m: 'l' }, to: null, recordedAt: 1 }]
}));

// ---- 項目名が仕様に全部あるか ----
const idsOf = (k) => new Set(L.fields(k).map((f) => f.id));
function checkIds(key, row) {
  const known = idsOf(key);
  return Object.keys(row).filter((k) => !known.has(k));
}

ok('仕様が読める（利用者 22 / 栄養 122 / 計画 79）',
  L.fields('user').length === 22 && L.fields('nutrition').length === 122 && L.fields('plan').length === 79,
  [L.fields('user').length, L.fields('nutrition').length, L.fields('plan').length]);
ok('バージョンは 0310', L.VERSION() === '0310', L.VERSION());

// ---- 利用者情報 ----
const u = L.userRow(r, m);
ok('利用者: 仕様に無い項目を作っていない', checkIds('user', u).length === 0, checkIds('user', u));
ok('利用者: 事業所番号・被保険者番号', u.care_facility_id === '9900000001' && u.insured_no === 'H900000001');
ok('利用者: 姓と名が分かれる', u.last_name === '山田' && u.first_name === 'ハナ', [u.last_name, u.first_name]);
ok('利用者: カナは半角（ﾔﾏﾀﾞ / ﾊﾅ）', u.last_name_kana === 'ﾔﾏﾀﾞ' && u.first_name_kana === 'ﾊﾅ', [u.last_name_kana, u.first_name_kana]);
ok('利用者: 性別は女=2', u.gender === '2');
ok('利用者: 生年月日は YYYYMMDD', u.birthday === '19380402', u.birthday);
ok('利用者: 要介護度コード', u.care_level === '23');
ok('利用者: 入所日', u.start_date === '20250815' && !u.end_date, [u.start_date, u.end_date]);
ok('利用者: バージョン', u.version === '0310');
ok('利用者: 必須◎がすべて埋まる', L.check('user', [u]).length === 0, L.check('user', [u]));

// ---- 栄養 IF ----
const rec = N.normalize(Object.assign(N.empty(r.id, '2026-09-21'), {
  id: uid('n'), process: 'monitoring', level: 'high',
  body: { heightCm: 148, weightKg: 41.2, loss1: 2.8, loss3: 7.4, loss6: 13.5, ulcer: false, feeding: 'oral', other: '' },
  intake: { pct: 60, staple: 50, side: 60, other: '高カロリーゼリー' },
  nut: { inKcal: 900, inProt: 35.5, outKcal: 1500, outProt: 60, needKcal: 1400, needProt: 55 },
  swallow: { need: true, code: '4', thick: 'thin' },
  caution: { has: true, text: '汁物にとろみ' },
  will: { motivation: 4, satisfaction: 4, attitude: 3 },
  issues: ['水分でむせる', '食事中、食後に咳をすることがある', '認知症'],
  special: 'むせ込みが増えている', evaluation: 'not', planChange: true, glim: 'severe',
  iji: { tests: ['水飲みテスト'], testDate: '2026-09-10', targets: ['嚥下機能'],
    observe: { members: ['管理栄養士', '看護職員'], date: '2026-09-18' },
    meeting: { members: ['医師', '言語聴覚士'], date: '2026-09-19', items: { 0: 'change', 3: 'keep' } }, note: '検討した' }
}));
const nv = L.nutritionRow(rec, r, m, { iji: true });
ok('栄養: 仕様に無い項目を作っていない', checkIds('nutrition', nv).length === 0, checkIds('nutrition', nv));
ok('栄養: 必須◎がすべて埋まる', L.check('nutrition', [nv]).length === 0, L.check('nutrition', [nv]));
ok('栄養: プロセス モニタリング=3', nv.process === '3');
ok('栄養: リスク 高=3', nv.low_operating_risk_level === '3');
ok('栄養: 身長・体重は小数第1位', nv.height === '148.0' && nv.weight === '41.2', [nv.height, nv.weight]);
ok('栄養: 3%以上の減少は有=1、値も出す', nv.is_three_month_weight_loss === '1' && nv.three_month_weight_loss === '7.4', [nv.is_three_month_weight_loss, nv.three_month_weight_loss]);
ok('栄養: 3%未満は無=0、値は空', nv.is_one_month_weight_loss === '0' && nv.one_month_weight_loss === '', [nv.is_one_month_weight_loss, nv.one_month_weight_loss]);
ok('栄養: 経口のみ=2、経腸・静脈は0', nv.food_form_ingestion === '2' && nv.is_nutrition_supply_method_enteral_nutrition === '0');
ok('栄養: 食事の形態 学会分類4 → 40', nv.meal_form === '40', nv.meal_form);
ok('栄養: とろみ 薄い=1', nv.thickening === '1');
ok('栄養: 課題のチェックが対応する項目に入る',
  nv.eating_status_choke_by_water === '1' && nv.nutrition_care_issues_cognitive_function === '1' && nv.nutrition_care_issues_diarrhoea === '0');
ok('栄養: 口腔関係のまとめが 1', nv.eating_status_oral === '1');
ok('栄養: 総合評価 改善が認められない=4', nv.overall_evaluation === '4');
ok('栄養: 計画変更 有=1', nv.is_overall_evaluation_planning === '1');
ok('栄養: GLIM 重度 → 2 / 2', nv.glim_evaluation === '2' && nv.glim_evaluation_low_nutrition === '2');
ok('栄養: 経口維持 検査と参加者', nv.inspection_drinking_test === '1' && nv.meals_observation_participants_managerial_dietician === '1'
  && nv.meeting_participants_speech_language_hearing_therapist === '1' && nv.meals_observation_participants_doctor === '0');
ok('栄養: 多職種会議の5視点 変更=2 / 現状維持=1', nv.support_viewpoint_meal_forms_supplementary_meals === '2' && nv.support_viewpoint_oral_care_method === '1');
ok('栄養: 実施日', nv.implementation_date === '20260921');
// 経口維持を算定していない施設では、その欄を出さない
const nv2 = L.nutritionRow(rec, r, m, {});
ok('栄養: 経口維持を算定しない時はその欄を空にする', nv2.inspection_drinking_test === undefined && nv2.meeting_date === undefined);

// ---- 計画書 IF ----
const plan = N.normalizePlan({
  id: uid('p'), residentId: r.id, firstAt: '2026-08-24', updatedAt: '2026-09-01', explainedAt: '2026-09-02',
  wish: '好きな物を安全に食べたい', needs: '体重減少が続いている', level: 'high',
  longGoal: '体重を維持する', longTerm: '6か月',
  rows: [{ cat: '栄養補給・食事', goal: '体重の減少を止める', term: '3か月', care: '栄養補助食品を提供', freq: '毎日15時', who: '管理栄養士' },
    { cat: '経口維持の支援', goal: 'むせ込みをなくす', term: '3か月', care: '食形態を見直す', freq: '随時', who: '看護職員' }],
  special: '面会時に嗜好を聞く', addons: ['kyoka', 'ryoyo'],
  progress: [{ date: '2026-09-03', text: 'ゼリー開始', by: '栄養 花子' }]
});
const pv = L.planRow(plan, r, m);
ok('計画: 仕様に無い項目を作っていない', checkIds('plan', pv).length === 0, checkIds('plan', pv));
ok('計画: 必須◎がすべて埋まる', L.check('plan', [pv]).length === 0, L.check('plan', [pv]));
ok('計画: 分類 栄養補給・食事=1、経口維持の支援=4', pv.plan_classification_01 === '1' && pv.plan_classification_02 === '4');
ok('計画: 短期目標に期間が付く', pv.plan_short_goal_and_period_01 === '体重の減少を止める（3か月）', pv.plan_short_goal_and_period_01);
ok('計画: 具体的内容に頻度が付く', pv.plan_content_of_nutritional_care_01 === '栄養補助食品を提供（毎日15時）');
ok('計画: 算定加算 強化=1 経口移行=0 療養食=1',
  pv.is_nutrition_management_addition === '1' && pv.oral_shift_addition === '0' && pv.dietetic_food_addition === '1');
ok('計画: 経過記録', pv.implementation_date_01 === '20260903' && pv.service_provision_items_01 === 'ゼリー開始');
ok('計画: 3 行目以降は空', pv.plan_classification_03 === undefined);

// ---- CSV ----
const csv = L.csv('nutrition', [nv, nv2]);
const lines = csv.split('\r\n').filter((x) => x !== '');
ok('CSV: 1 行目が物理名、以降がデータ', lines.length === 3 && lines[0].split(',').length === 122, lines.length);
ok('CSV: 値はダブルクォーテーションで囲む', /^"/.test(lines[1]) && lines[1].indexOf('","') > 0);
ok('CSV: 改行は CR-LF', csv.indexOf('\r\n') > 0 && csv.split('\n').every((x) => x === '' || x.endsWith('\r')));
ok('CSV: 1 行目に事業所番号が先頭で出る', lines[0].split(',')[0] === 'care_facility_id');
ok('CSV: 空の項目も列として出す', lines[2].split('","').length === 122, lines[2].split('","').length);
const quoted = L.csv('user', [Object.assign({}, u, { remarks: 'あ"い,う' })]);
ok('CSV: ダブルクォーテーションは 2 つにする', quoted.indexOf('あ""い,う') > 0);
ok('ファイル名の形', L.filename('nutrition', '2026-09-23') === '栄養・摂食嚥下スクリーニング・アセスメント・モニタリング_1_20260923.csv', L.filename('nutrition', '2026-09-23'));

// ---- 足りない時 ----
const r2 = M.normalizeResident(Object.assign(M.newResident('番号なし 次郎', uid), { stays: [{ id: 's2', from: { d: '2026-01-01', m: 'l' }, to: null, recordedAt: 1 }] }));
const u2 = L.userRow(r2, m);
const miss = L.check('user', [u2]);
ok('被保険者番号や要介護度が無いと、足りない項目として出る',
  miss.some((x) => x.id === 'insured_no') && miss.some((x) => x.id === 'care_level'), miss.map((x) => x.id));

console.log('\n' + (n - bad) + '/' + n + ' 通過' + (bad ? '  ★ 失敗 ' + bad + ' 件' : ''));
process.exit(bad ? 1 : 0);
