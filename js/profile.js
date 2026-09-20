// 事業所プロファイル: 事業所の種類・給食の方式・算定している加算を登録し、それに合わせて機能と呼び方を決める。
// 方針: プロファイルは「推奨」を出すだけ。機能は 1 つずつ手で入切できる（種類で機能を封じない）。
// window.Profile で公開。DOM にも DB にも触れない（Node で試験できる）。
(function (root) {
  'use strict';
  const P = {};

  // 事業所の種類。terms = 呼び方の初期値、feat = この種類でふつう使う機能
  P.KINDS = [
    { id: 'tokuyo', label: '特別養護老人ホーム', group: '介護保険施設', terms: { person: '入居者', suffix: '様', place: 'ユニット・フロア', admit: '入所', leave: '退所' },
      feat: ['census', 'cards', 'weights', 'rounds', 'menu'], ncm: 'facility' },
    { id: 'chiiki', label: '地域密着型特養', group: '介護保険施設', terms: { person: '入居者', suffix: '様', place: 'ユニット', admit: '入所', leave: '退所' },
      feat: ['census', 'cards', 'weights', 'rounds'], ncm: 'facility' },
    { id: 'roken', label: '介護老人保健施設', group: '介護保険施設', terms: { person: '入所者', suffix: '様', place: 'フロア・棟', admit: '入所', leave: '退所' },
      feat: ['census', 'cards', 'weights', 'rounds'], ncm: 'facility' },
    { id: 'iryoin', label: '介護医療院', group: '介護保険施設', terms: { person: '入所者', suffix: '様', place: '病棟', admit: '入所', leave: '退所' },
      feat: ['census', 'cards', 'weights', 'rounds'], ncm: 'facility' },
    { id: 'short', label: 'ショートステイ（短期入所）', group: '介護保険施設', terms: { person: '利用者', suffix: '様', place: 'フロア', admit: '入所', leave: '退所' },
      feat: ['census', 'cards', 'weights'], ncm: null },
    { id: 'day', label: 'デイサービス・デイケア', group: '通所・居住系', terms: { person: '利用者', suffix: '様', place: 'フロア', admit: '利用開始', leave: '利用終了' },
      feat: ['census', 'weights'], ncm: 'day' },
    { id: 'shoki', label: '小規模多機能・看護小規模多機能', group: '通所・居住系', terms: { person: '利用者', suffix: '様', place: 'フロア', admit: '登録', leave: '終了' },
      feat: ['census', 'weights'], ncm: 'day' },
    { id: 'gh', label: 'グループホーム', group: '通所・居住系', terms: { person: '入居者', suffix: '様', place: 'ユニット', admit: '入居', leave: '退居' },
      feat: ['census', 'weights'], ncm: null },
    { id: 'yuryo', label: '有料老人ホーム・サ高住', group: '通所・居住系', terms: { person: '入居者', suffix: '様', place: 'フロア', admit: '入居', leave: '退居' },
      feat: ['census', 'cards', 'weights'], ncm: null },
    { id: 'shogai', label: '障害者支援施設', group: 'その他', terms: { person: '利用者', suffix: '様', place: 'ユニット・棟', admit: '入所', leave: '退所' },
      feat: ['census', 'cards', 'weights', 'rounds'], ncm: 'shogai' },
    { id: 'hospital', label: '病院・診療所', group: 'その他', terms: { person: '患者', suffix: '様', place: '病棟', admit: '入院', leave: '退院' },
      feat: ['census', 'cards', 'weights', 'rounds'], ncm: 'hospital' },
    { id: 'hoiku', label: '保育園・認定こども園', group: 'その他', terms: { person: '園児', suffix: 'ちゃん', place: 'クラス', admit: '入園', leave: '卒園' },
      feat: ['census', 'cards', 'weights'], ncm: null },
    { id: 'school', label: '学校', group: 'その他', terms: { person: '児童・生徒', suffix: 'さん', place: 'クラス', admit: '入学', leave: '卒業' },
      feat: ['census', 'cards'], ncm: null },
    { id: 'jigyosho', label: '事業所給食・社員食堂', group: 'その他', terms: { person: '利用者', suffix: 'さん', place: '部署', admit: '開始', leave: '終了' },
      feat: ['census'], ncm: null }
  ];

  // 給食の提供方式
  P.SUPPLY = [
    { id: 'direct', label: '直営（自分の施設で作る）' },
    { id: 'contract', label: '委託（委託会社が作る）' },
    { id: 'cookchill', label: '完調品・クックチル（外から届く）' },
    { id: 'delivery', label: '配食（弁当で届く）' }
  ];

  // 加算・減算。kinds = 対象の事業所の種類、feat = 算定するなら要る機能、note = 画面に出す一言
  // 出典: 厚生労働省 令和6年度介護報酬改定（研究レポート 02_制度と様式.md 2.1）。単位数は改定で変わるのでここには持たない
  P.ADDONS = [
    { id: 'genzan', label: '栄養ケア・マネジメント（未実施は減算）', kinds: ['tokuyo', 'chiiki', 'roken', 'iryoin'], feat: ['weights'],
      note: '入所者全員が対象。体重は全員1月毎、再スクリーニングは全員3月毎。' },
    { id: 'kyoka', label: '栄養マネジメント強化加算', kinds: ['tokuyo', 'chiiki', 'roken', 'iryoin'], feat: ['weights', 'rounds'],
      note: '食事の観察が週3回以上（異なる日）。観察した日付と、調整した時の対応を記録する。' },
    { id: 'ikou', label: '経口移行加算', kinds: ['tokuyo', 'chiiki', 'roken', 'iryoin'], feat: [],
      note: '医師の指示が要る。同意日から180日以内。超える時は医師の指示をおおむね2週間毎。' },
    { id: 'iji', label: '経口維持加算', kinds: ['tokuyo', 'chiiki', 'roken', 'iryoin'], feat: ['rounds'],
      note: '月1回以上、多職種で食事の観察と会議。' },
    { id: 'ryoyo', label: '療養食加算', kinds: ['tokuyo', 'chiiki', 'roken', 'iryoin', 'short', 'hospital'], feat: ['cards'],
      note: '主治医の食事箋に基づく提供と、療養食の献立表が要る。食種マスタの「療養食」に印を付ける。' },
    { id: 'sainyusho', label: '再入所時栄養連携加算', kinds: ['tokuyo', 'chiiki', 'roken', 'iryoin'], feat: [],
      note: '入院先を訪問し、医療機関の管理栄養士と連携して再入所後の計画を作る。' },
    { id: 'taisho', label: '退所時栄養情報連携加算', kinds: ['tokuyo', 'chiiki', 'roken', 'iryoin'], feat: [],
      note: '退所時に栄養情報提供書（様式4-2）を渡す。退所月に1回まで。' },
    { id: 'assess', label: '栄養アセスメント加算', kinds: ['day', 'shoki'], feat: ['weights'],
      note: '3月に1回以上のアセスメントと LIFE への提出。' },
    { id: 'kaizen', label: '栄養改善加算', kinds: ['day', 'shoki'], feat: ['weights'],
      note: '月2回まで、原則3月以内。3月毎にケアマネジャーへ情報提供。' },
    { id: 'screening', label: '口腔・栄養スクリーニング加算', kinds: ['day', 'shoki', 'gh', 'yuryo', 'short'], feat: [],
      note: '利用開始時と、利用中は6月ごと。' },
    { id: 'taisei', label: '栄養管理体制加算', kinds: ['gh'], feat: [],
      note: '管理栄養士が介護職員へ月1回以上の助言・指導。' }
  ];

  // 機能。core = 消せない
  P.FEATURES = [
    { id: 'census', label: '食数', desc: '予定食数の表、締切、変更連絡票' },
    { id: 'cards', label: '食札・禁食一覧', desc: '食札の印刷と、禁食・アレルギーの一覧' },
    { id: 'weights', label: '体重', desc: 'まとめて入力、減少率とリスクの目安' },
    { id: 'rounds', label: 'ミールラウンド', desc: '食事の観察の記録（○◎）と週3回の確認' },
    { id: 'menu', label: '献立・栄養計算', desc: '料理マスタ、献立、栄養価と給与栄養目標量' },
    { id: 'links', label: '情報リンク', desc: '制度・食品・掲示板などのリンク集' }
  ];

  P.kind = (id) => P.KINDS.find((k) => k.id === id) || null;
  P.addonsFor = function (kinds) { return P.ADDONS.filter((a) => a.kinds.some((k) => kinds.indexOf(k) >= 0)); };

  // 登録内容から「推奨の機能」を出す
  P.recommend = function (profile) {
    const on = {};
    (profile.kinds || []).forEach((id) => { const k = P.kind(id); if (k) k.feat.forEach((f) => { on[f] = true; }); });
    (profile.addons || []).forEach((id) => { const a = P.ADDONS.find((x) => x.id === id); if (a) a.feat.forEach((f) => { on[f] = true; }); });
    on.links = true;
    // 直営なら献立を自分で作る。委託・完調品・配食でも、栄養価の確認に使えるので推奨から外さない
    if (!profile.supply || profile.supply === 'direct') on.menu = true;
    // 献立が外から来る施設でも、食数と食札は施設側に残る（調査 03）。ここでは機能を減らさない
    return on;
  };
  const FALLBACK_TERMS = { person: '利用者', suffix: '様', place: 'ユニット・フロア', admit: '入所', leave: '退所' };
  P.defaultTerms = function (kinds) {
    const k = P.kind((kinds || [])[0]);
    return Object.assign({}, FALLBACK_TERMS, k ? k.terms : null);
  };
  // 登録内容から出る注意書き
  P.notes = function (profile) {
    const out = [];
    (profile.addons || []).forEach((id) => { const a = P.ADDONS.find((x) => x.id === id); if (a && a.note) out.push({ label: a.label, text: a.note }); });
    const k = profile.kinds || [];
    if (k.indexOf('short') >= 0 && (profile.supply === 'cookchill' || profile.supply === 'delivery'))
      out.push({ label: '締切', text: '完調品・配食は数日前に締め切ることがあります。設定の締切を実際に合わせると、締切後に入った変更が一覧に出ます。' });
    if (profile.supply === 'contract' || profile.supply === 'cookchill' || profile.supply === 'delivery')
      out.push({ label: '委託・外部調理', text: '献立は委託先が作るため、この道具は個人の食事情報・食数・食札・記録だけを扱います。' });
    if (profile.dietitians === 1) out.push({ label: '1人職場', text: '直す場所は利用者の1か所だけです。食札・食数・禁食一覧は自動で追随するので、二重に直す必要はありません。' });
    return out;
  };
  P.empty = function () {
    return { kinds: [], supply: '', dietitians: 1, addons: [], terms: P.defaultTerms([]), features: {}, setupDone: false };
  };
  // 保存済みプロファイルに、後から増えた項目を補う
  P.normalize = function (src) {
    src = src || {};
    const p = Object.assign(P.empty(), src);
    // 呼び方は、手で直した分だけを種類の初期値に重ねる（空の入力で初期値を潰さない）
    p.terms = Object.assign(P.defaultTerms(p.kinds), src.terms || {});
    const rec = P.recommend(p);
    // まだ事業所を登録していない間は全部見せる（登録前に機能を隠さない）
    P.FEATURES.forEach((f) => { if (p.features[f.id] == null) p.features[f.id] = p.setupDone ? !!rec[f.id] : true; });
    return p;
  };
  P.enabled = function (p, feature) { return !feature || !p || !p.setupDone || !p.features || p.features[feature] !== false; };

  if (typeof module !== 'undefined' && module.exports) module.exports = P;
  root.Profile = P;
})(typeof window !== 'undefined' ? window : globalThis);
