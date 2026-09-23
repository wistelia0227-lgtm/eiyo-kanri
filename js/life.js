// LIFE（科学的介護情報システム）へ渡す CSV を作る。DOM にも DB にも触れない。window.Life で公開。
// 仕様: CSV連携仕様書（LIFE）3.10版 ／ 外部インターフェース項目一覧 3.10版（厚生労働省）。項目定義は js/life_spec.js。
//   1 行目が物理名、2 行目以降がデータ。値はダブルクォーテーションで囲む。空値は null 扱い。
//   文字コードは UTF-8 か Shift-JIS、改行は CR-LF。1 回の実施 = 1 レコード。
// 注意: 出せない項目は空欄にする（○ は「記録できない場合は空値で連携」）。人が LIFE 側で確かめる前提。
(function (root) {
  'use strict';
  const M = (typeof Model !== 'undefined') ? Model : require('./model.js');
  const L = {};
  let SPEC = null;

  L.load = function (spec) { SPEC = spec; L.spec = spec; return L; };
  L.loaded = () => !!SPEC;
  L.fields = (key) => (SPEC && SPEC.interfaces[key] ? SPEC.interfaces[key].fields : []);
  L.iface = (key) => (SPEC ? SPEC.interfaces[key] : null);
  L.VERSION = () => (SPEC ? SPEC.version : '');

  // ---- 値の形 ----
  L.date8 = function (iso) { return iso ? String(iso).replace(/-/g, '') : ''; };
  L.num = function (v, dec) {
    if (v == null || v === '') return '';
    const n = Number(v);
    if (!isFinite(n)) return '';
    return dec ? n.toFixed(Number(dec)) : String(Math.round(n));
  };
  L.yesNo = function (v) { return v ? '1' : '0'; };
  // 全角半角文字の項目は、桁数で切る（LIFE 側で弾かれないように）
  L.cut = function (s, len) {
    s = String(s == null ? '' : s).replace(/[\r\n]+/g, ' ').trim();
    const n = Number(len);
    return (n && s.length > n) ? s.slice(0, n) : s;
  };

  // ひらがな・全角カナ → 半角カナ（LIFE の姓名カナ欄は半角カナ）
  const KANA_FULL = 'ガギグゲゴザジズゼゾダヂヅデドバビブベボパピプペポヴアイウエオカキクケコサシスセソタチツテトナニヌネノハヒフヘホマミムメモヤユヨラリルレロワヲンァィゥェォッャュョー、。・「」゛゜';
  const KANA_HALF = ['ｶﾞ', 'ｷﾞ', 'ｸﾞ', 'ｹﾞ', 'ｺﾞ', 'ｻﾞ', 'ｼﾞ', 'ｽﾞ', 'ｾﾞ', 'ｿﾞ', 'ﾀﾞ', 'ﾁﾞ', 'ﾂﾞ', 'ﾃﾞ', 'ﾄﾞ', 'ﾊﾞ', 'ﾋﾞ', 'ﾌﾞ', 'ﾍﾞ', 'ﾎﾞ', 'ﾊﾟ', 'ﾋﾟ', 'ﾌﾟ', 'ﾍﾟ', 'ﾎﾟ', 'ｳﾞ', 'ｱ', 'ｲ', 'ｳ', 'ｴ', 'ｵ', 'ｶ', 'ｷ', 'ｸ', 'ｹ', 'ｺ', 'ｻ', 'ｼ', 'ｽ', 'ｾ', 'ｿ', 'ﾀ', 'ﾁ', 'ﾂ', 'ﾃ', 'ﾄ', 'ﾅ', 'ﾆ', 'ﾇ', 'ﾈ', 'ﾉ', 'ﾊ', 'ﾋ', 'ﾌ', 'ﾍ', 'ﾎ', 'ﾏ', 'ﾐ', 'ﾑ', 'ﾒ', 'ﾓ', 'ﾔ', 'ﾕ', 'ﾖ', 'ﾗ', 'ﾘ', 'ﾙ', 'ﾚ', 'ﾛ', 'ﾜ', 'ｦ', 'ﾝ', 'ｧ', 'ｨ', 'ｩ', 'ｪ', 'ｫ', 'ｯ', 'ｬ', 'ｭ', 'ｮ', 'ｰ', '､', '｡', '･', '｢', '｣', 'ﾞ', 'ﾟ'];
  L.han = function (src) {
    let out = '';
    String(src || '').replace(/[\u3041-\u3096]/g, (c) => String.fromCharCode(c.charCodeAt(0) + 0x60))
      .split('').forEach((ch) => {
        if (ch === ' ' || ch === '\u3000') return;
        const i = KANA_FULL.indexOf(ch);
        out += (i >= 0) ? KANA_HALF[i] : ch;
      });
    return out;
  };

  // 要介護度のコード（LIFE の code 値。利用者に持たせる）
  L.CARE_LEVELS = [
    { id: '01', label: '非該当' }, { id: '06', label: '事業対象者' },
    { id: '11', label: '要支援1' }, { id: '12', label: '要支援2' },
    { id: '21', label: '要介護1' }, { id: '22', label: '要介護2' }, { id: '23', label: '要介護3' },
    { id: '24', label: '要介護4' }, { id: '25', label: '要介護5' }
  ];
  L.SEX = { f: '2', m: '1' };
  L.PROCESS = { screening: '1', assessment: '2', monitoring: '3' };
  L.LEVEL = { low: '1', mid: '2', high: '3' };
  L.EVAL = { improved: '1', improving: '2', maintained: '3', not: '4' };
  L.THICK = { '': '0', thin: '1', mid: '2', thickk: '3' };
  // 食事の形態（学会分類コード → LIFE のコード）
  L.MEAL_FORM = { '常食': '50', '4': '40', '3': '30', '2-2': '22', '2-1': '21', '1j': '10', '0t': '02', '0j': '01' };
  // 栄養補給法 経口摂取: 0 無し / 1 一部経口 / 2 経口のみ
  L.ORAL = { oral: '2', partial: '1', enteral: '0', parenteral: '0', '': '' };
  L.GLIM = { no: '1', mid: '2', severe: '2' };
  L.GLIM_SUB = { mid: '1', severe: '2' };

  // 課題のチェック（様式の文言 → LIFE の項目 ID）
  L.ISSUE_FIELDS = {
    '安定した正しい姿勢が自分で取れない': 'eating_status_unable_stable_right_posture',
    '食事に集中することができない': 'eating_status_unable_meal_concentrate',
    '食事中に傾眠や意識混濁がある': 'eating_status_somnolence_confusion_during_meal',
    '歯（義歯）のない状態で食事をしている': 'eating_status_eating_without_denture',
    '食べ物を口腔内に溜め込む': 'eating_status_accumulate_food_in_mouth',
    '固形の食べ物を咀しゃく中にむせる': 'eating_status_choke_while_chewing_solid_food',
    '食後、頬の内側や口腔内に残渣がある': 'eating_status_food_remain_in_cheeks_or_mouth_after_meal',
    '水分でむせる': 'eating_status_choke_by_water',
    '食事中、食後に咳をすることがある': 'eating_status_cough_during_or_after_meal',
    '褥瘡': 'nutrition_care_issues_bedsore',
    '生活機能低下': 'nutrition_care_issues_living_function_deterioration',
    '嘔気・嘔吐': 'nutrition_care_issues_nausea_vomit',
    '下痢': 'nutrition_care_issues_diarrhoea',
    '便秘': 'nutrition_care_issues_constipation',
    '浮腫': 'nutrition_care_issues_edema',
    '脱水': 'nutrition_care_issues_dehydration',
    '感染': 'nutrition_care_issues_infection',
    '発熱': 'nutrition_care_issues_fever',
    '閉じこもり': 'nutrition_care_issues_homebodies',
    'うつ': 'nutrition_care_issues_depression',
    '認知症': 'nutrition_care_issues_cognitive_function',
    '薬の影響': 'nutrition_care_issues_medicine'
  };
  // 経口維持の検査 → 項目 ID
  L.TEST_FIELDS = {
    '水飲みテスト': 'inspection_drinking_test',
    '頚部聴診法': 'inspection_cervical_auscultation',
    '嚥下内視鏡検査': 'inspection_swallow_endoscopic',
    '嚥下造影検査': 'inspection_swallow_fluoroscopic',
    '咀嚼能力・機能の検査': 'inspection_chewing_ability_function_inspection',
    '認知機能に課題あり（検査不可のため食事の観察にて確認）': 'inspection_problem_in_cognitive_function',
    'その他': 'inspection_other'
  };
  // 職種 → 項目名の語尾。食事の観察（meals_observation_participants_）と多職種会議（meeting_participants_）で
  // 言語聴覚士の綴りが違う（仕様書どおり）
  L.JOB_OBSERVE = {
    '医師': 'doctor', '歯科医師': 'dentist', '管理栄養士': 'managerial_dietician', '栄養士': 'dietician',
    '歯科衛生士': 'dental_hygienist', '言語聴覚士': 'hearing_therapist', '作業療法士': 'occupational_therapist',
    '理学療法士': 'physical_therapist', '看護職員': 'nursing_staff', '介護職員': 'nursing_care_staff',
    '介護支援専門員': 'care_support_specialist'
  };
  L.JOB_MEETING = Object.assign({}, L.JOB_OBSERVE, { '言語聴覚士': 'speech_language_hearing_therapist' });

  // ---- 事業所の情報 ----
  L.facilityOf = function (masters) {
    const f = (masters && masters.life) || {};
    return { careFacilityId: f.careFacilityId || '', serviceCode: f.serviceCode || '',
      insurerNo: f.insurerNo || '', category: f.category || '1', trinity: f.trinity ? '1' : '0' };
  };

  // ---- 利用者情報 IF ----
  L.userRow = function (r, masters) {
    const fac = L.facilityOf(masters);
    const v = {};
    v.care_facility_id = fac.careFacilityId;
    v.service_code = fac.serviceCode;
    v.insurer_no = r.insurerNo || fac.insurerNo;
    v.insured_no = r.insuredNo || '';
    v.external_system_management_number = r.id;
    const parts = String(r.name || '').split(/[\s　]+/).filter(Boolean);
    v.last_name = L.cut(parts[0] || '', 20);
    v.first_name = L.cut(parts.slice(1).join(' '), 20);
    const kana = String(r.kana || '').split(/[\s　]+/).filter(Boolean);
    v.last_name_kana = L.han(kana[0] || '');
    v.first_name_kana = L.han(kana.slice(1).join(''));
    v.gender = L.SEX[r.gender] || '';
    v.birthday = L.date8(r.birth);
    v.care_level = r.careLevel || '';
    v.remarks = L.cut(r.memo, 100);
    const live = (r.stays || []).filter((x) => !x.cancelledAt).sort((a, b) => a.from.d.localeCompare(b.from.d));
    if (live.length) {
      v.start_date = L.date8(live[live.length - 1].from.d);
      const to = live[live.length - 1].to;
      if (to && to.d) v.end_date = L.date8(to.d);
    }
    v.version = L.VERSION();
    return v;
  };

  // ---- 栄養・摂食嚥下スクリーニング／アセスメント／モニタリング IF ----
  L.nutritionRow = function (rec, resident, masters, opts) {
    opts = opts || {};
    const fac = L.facilityOf(masters);
    const v = {};
    v.care_facility_id = fac.careFacilityId;
    v.service_code = fac.serviceCode;
    v.insurer_no = resident.insurerNo || fac.insurerNo;
    v.insured_no = resident.insuredNo || '';
    v.external_system_management_number = rec.id;
    v.facility_outpatient_category = fac.category;
    v.trinity_attempt = fac.trinity;
    v.care_level = resident.careLevel || '';
    v.disease_name = L.cut(resident.memo, 100);
    v.create_date = L.date8(rec.date);
    v.implementation_date = L.date8(rec.date);
    v.process = L.PROCESS[rec.process] || '';
    v.low_operating_risk_level = L.LEVEL[rec.level] || '';

    const b = rec.body || {};
    v.height = L.num(b.heightCm, 1);
    v.weight = L.num(b.weightKg, 1);
    [['1', 'one', b.loss1], ['3', 'three', b.loss3], ['6', 'six', b.loss6]].forEach((x) => {
      const has = x[2] != null && x[2] >= 3;
      v['is_' + x[1] + '_month_weight_loss'] = x[2] == null ? '' : L.yesNo(has);
      v[x[1] + '_month_weight_loss'] = has ? L.num(x[2], 1) : '';
    });
    v.bedsore = L.yesNo(b.ulcer);
    v.food_form_ingestion = L.ORAL[b.feeding] == null ? '' : L.ORAL[b.feeding];
    v.is_nutrition_supply_method_enteral_nutrition = b.feeding === 'enteral' ? '1' : (b.feeding ? '0' : '');
    v.is_nutrition_supply_method_parenteral_nutrition = b.feeding === 'parenteral' ? '1' : (b.feeding ? '0' : '');

    const i = rec.intake || {};
    v.dietary_intake = L.num(i.pct, 0);
    v.staple_food_intake = L.num(i.staple, 0);
    v.main_dish_intake = L.num(i.side, 0);
    v.side_dish_intake = L.num(i.side, 0);
    v.provided_nutrients_other = L.cut(i.other, 100);

    const n = rec.nut || {};
    v.nutrition_intake_energy = L.num(n.inKcal, 0);
    v.nutrition_intake_protein = L.num(n.inProt, 1);
    v.nutrition_provided_energy = L.num(n.outKcal, 0);
    v.nutrition_provided_protein = L.num(n.outProt, 1);
    v.required_nutrients_energy = L.num(n.needKcal, 0);
    v.required_nutrients_protein = L.num(n.needProt, 1);

    const sw = rec.swallow || {};
    v.is_need_swallowing_adjusted_food = L.yesNo(sw.need);
    v.meal_form = L.MEAL_FORM[sw.code] || '';
    v.thickening = L.THICK[sw.thick || ''] || '';
    const c = rec.caution || {};
    v.is_meal_notes = L.yesNo(c.text);
    v.instructions_and_allergies_etc_notes = L.cut(c.text, 200);

    const w = rec.will || {};
    v.motivation = w.motivation ? String(w.motivation) : '';
    v.appetite_meal_satisfaction = w.satisfaction ? String(w.satisfaction) : '';
    v.eating_aweareness = w.attitude ? String(w.attitude) : '';

    // 課題のチェック（付けていない項目は 0）
    const issues = rec.issues || [];
    Object.keys(L.ISSUE_FIELDS).forEach((k) => { v[L.ISSUE_FIELDS[k]] = L.yesNo(issues.indexOf(k) >= 0); });
    // 口腔関係・摂食嚥下のまとめ（どれか付いていれば 1）
    const oralKeys = Object.keys(L.ISSUE_FIELDS).slice(0, 9);
    v.eating_status_oral = L.yesNo(oralKeys.some((k) => issues.indexOf(k) >= 0));
    v.eating_status_eating_swallow = v.eating_status_oral;
    v.nutrition_care_issues_bedsore = L.yesNo(b.ulcer || issues.indexOf('褥瘡') >= 0);

    v.overall_notice = L.cut(rec.special, 200);
    v.overall_evaluation = L.EVAL[rec.evaluation] || '';
    v.is_overall_evaluation_planning = rec.planChange ? '1' : '0';
    if (rec.glim) {
      v.glim_evaluation = L.GLIM[rec.glim] || '';
      if (L.GLIM_SUB[rec.glim]) v.glim_evaluation_low_nutrition = L.GLIM_SUB[rec.glim];
    }

    // 経口維持加算を算定している場合
    if (rec.iji && opts.iji) {
      const j = rec.iji;
      Object.keys(L.TEST_FIELDS).forEach((k) => { v[L.TEST_FIELDS[k]] = L.yesNo((j.tests || []).indexOf(k) >= 0); });
      v.inspection_date = L.date8(j.testDate);
      v.issues_location_cognitive_function = L.yesNo((j.targets || []).indexOf('認知機能') >= 0);
      v.issues_location_chewing_oral_function = L.yesNo((j.targets || []).indexOf('咀嚼・口腔機能') >= 0);
      v.issues_location_swallowing_function = L.yesNo((j.targets || []).indexOf('嚥下機能') >= 0);
      const obs = (j.observe || {}), mtg = (j.meeting || {});
      Object.keys(L.JOB_OBSERVE).forEach((job) => {
        v['meals_observation_participants_' + L.JOB_OBSERVE[job]] = L.yesNo((obs.members || []).indexOf(job) >= 0);
        v['meeting_participants_' + L.JOB_MEETING[job]] = L.yesNo((mtg.members || []).indexOf(job) >= 0);
      });
      v.meals_observation_date = L.date8(obs.date);
      v.meeting_date = L.date8(mtg.date);
      const VIEW = ['support_viewpoint_meal_forms_supplementary_meals', 'support_viewpoint_meal_ambience',
        'support_viewpoint_meal_support_method', 'support_viewpoint_oral_care_method',
        'support_viewpoint_medical_or_dental_treatment_necessity'];
      VIEW.forEach((id, i) => {
        const x = (mtg.items || {})[i];
        v[id] = x === 'keep' ? '1' : (x === 'change' ? '2' : '');
      });
      v.support_viewpoint_notice = L.cut(j.note, 200);
    }
    v.version = L.VERSION();
    return v;
  };

  // ---- 栄養ケア等計画書 IF ----
  L.PLAN_CAT = { '栄養補給・食事': '1', '栄養食事相談': '2', '経口移行の支援': '3', '経口維持の支援': '4', '多職種による課題の解決': '5' };
  L.PLAN_ADDON_FIELD = { kyoka: 'is_nutrition_management_addition', ikou: 'oral_shift_addition',
    iji1: 'oral_maintenance_addition_01', iji2: 'oral_maintenance_addition_02', ryoyo: 'dietetic_food_addition' };
  L.planRow = function (plan, resident, masters) {
    const fac = L.facilityOf(masters);
    const v = {};
    v.care_facility_id = fac.careFacilityId;
    v.service_code = fac.serviceCode;
    v.insurer_no = resident.insurerNo || fac.insurerNo;
    v.insured_no = resident.insuredNo || '';
    v.external_system_management_number = plan.id;
    v.facility_outpatient_category = fac.category;
    const live = (resident.stays || []).filter((x) => !x.cancelledAt).sort((a2, b2) => a2.from.d.localeCompare(b2.from.d));
    if (live.length) v.admission_date = L.date8(live[live.length - 1].from.d);
    v.first_create_date = L.date8(plan.firstAt);
    v.create_date = L.date8(plan.updatedAt);
    v.user_family_intention = L.cut(plan.wish, 200);
    v.user_family_intention_date = L.date8(plan.explainedAt);
    v.low_operating_risk_level = L.LEVEL[plan.level] || '';
    v.assignment_contents = L.cut(plan.needs, 200);
    v.long_goal_and_period_contents = L.cut(plan.longGoal + (plan.longTerm ? '（' + plan.longTerm + '）' : ''), 200);
    (plan.rows || []).slice(0, 5).forEach((r, i) => {
      const k = ('0' + (i + 1)).slice(-2);
      v['plan_classification_' + k] = L.PLAN_CAT[r.cat] || '';
      v['plan_short_goal_and_period_' + k] = L.cut(r.goal + (r.term ? '（' + r.term + '）' : ''), 200);
      v['plan_content_of_nutritional_care_' + k] = L.cut(r.care + (r.freq ? '（' + r.freq + '）' : ''), 200);
    });
    v.support_viewpoint_notice = L.cut(plan.special, 200);
    Object.keys(L.PLAN_ADDON_FIELD).forEach((id) => { v[L.PLAN_ADDON_FIELD[id]] = L.yesNo((plan.addons || []).indexOf(id) >= 0); });
    (plan.progress || []).slice(0, 20).forEach((x, i) => {
      const k = ('0' + (i + 1)).slice(-2);
      v['implementation_date_' + k] = L.date8(x.date);
      v['service_provision_items_' + k] = L.cut(x.text, 200);
    });
    v.version = L.VERSION();
    return v;
  };

  // ---- CSV ----
  L.csv = function (key, rows) {
    const fields = L.fields(key);
    if (!fields.length) return '';
    const esc = (s) => '"' + String(s == null ? '' : s).replace(/"/g, '""') + '"';
    const out = [fields.map((f) => f.id).join(',')];
    rows.forEach((v) => out.push(fields.map((f) => esc(v[f.id] == null ? '' : v[f.id])).join(',')));
    return out.join('\r\n') + '\r\n';
  };
  // 出せていない必須項目を調べる（◎ は常に必須、○ は原則必須）
  L.check = function (key, rows) {
    const fields = L.fields(key);
    const miss = {};
    rows.forEach((v) => fields.forEach((f) => {
      if (f.req !== '◎') return;
      if (v[f.id] == null || v[f.id] === '') miss[f.id] = (miss[f.id] || 0) + 1;
    }));
    return Object.keys(miss).map((id) => {
      const f = fields.find((x) => x.id === id);
      return { id: id, name: f ? f.name : id, count: miss[id] };
    });
  };
  // ファイル名（仕様書の推奨: インターフェース名_管理連番+独自記号.csv）
  L.filename = function (key, today) {
    const label = { user: '利用者情報', nutrition: '栄養・摂食嚥下スクリーニング・アセスメント・モニタリング', plan: '栄養ケア等計画書' }[key] || key;
    return label + '_1_' + L.date8(today) + '.csv';
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = L;
  root.Life = L;
  if (root.LIFE_SPEC) L.load(root.LIFE_SPEC);
  void M;
})(typeof window !== 'undefined' ? window : globalThis);
