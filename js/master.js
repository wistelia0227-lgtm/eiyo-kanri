// マスタの初期値。設定画面で全部書き換えられる（コードに名前を埋め込まない）。window.Master で公開。
// code = 日本摂食嚥下リハビリテーション学会 嚥下調整食分類2021 のコード。施設ごとの呼び方とコードの対応表を兼ねる。
(function () {
  'use strict';
  const DEFAULTS = {
    facility: { name: '', recorder: '' },
    profile: null, // 事業所プロファイル（js/profile.js）。null なら初回の登録案内を出す
    meals: [
      { id: 'b', label: '朝', on: true }, { id: 'l', label: '昼', on: true },
      { id: 's', label: 'おやつ', on: false }, { id: 'd', label: '夕', on: true }],
    categories: [ // stayIn = 泊まる人（ミールラウンドの週3回の対象など）
      { id: 'long', label: '入所', stayIn: true }, { id: 'short', label: 'ショート', stayIn: true }, { id: 'day', label: 'デイ', stayIn: false }],
    units: [],
    shokushu: [
      { id: 'jo', label: '常食', color: '#e5e7eb' },
      { id: 'dm', label: '糖尿病食', color: '#fde68a', ryoyo: true },
      { id: 'salt', label: '減塩食', color: '#bfdbfe', ryoyo: true },
      { id: 'ckd', label: '腎臓病食', color: '#ddd6fe', ryoyo: true },
      { id: 'liver', label: '肝臓病食', color: '#fbcfe8', ryoyo: true },
      { id: 'lipid', label: '脂質異常症食', color: '#fed7aa', ryoyo: true },
      { id: 'tube', label: '経管栄養', color: '#d1d5db' }],
    staple: [
      { id: 'rice', label: '米飯', code: '' }, { id: 'soft', label: '軟飯', code: '4' },
      { id: 'kayu', label: '全粥', code: '4' }, { id: 'kayu_m', label: 'ミキサー粥', code: '2-1' },
      { id: 'kayu_j', label: 'ゼリー粥', code: '1j' }, { id: 'bread', label: 'パン', code: '' },
      { id: 'none', label: '主食なし', code: '' }],
    side: [
      { id: 'jo', label: '常菜', code: '', color: '#e5e7eb' }, { id: 'hito', label: '一口大', code: '', color: '#bbf7d0' },
      { id: 'kizami', label: 'きざみ', code: '', color: '#fde68a' }, { id: 'soft', label: 'ソフト食', code: '3', color: '#fed7aa' },
      { id: 'mixer', label: 'ミキサー', code: '2-1', color: '#fbcfe8' }, { id: 'jelly', label: 'ゼリー', code: '1j', color: '#ddd6fe' }],
    thick: [
      { id: 'thin', label: '薄いとろみ' }, { id: 'mid', label: '中間のとろみ' }, { id: 'thickk', label: '濃いとろみ' }],
    portion: [{ id: 'half', label: '1/2量' }, { id: 'q3', label: '3/4量' }, { id: 'large', label: '大盛' }],
    assist: [{ id: 'self', label: '自立' }, { id: 'watch', label: '見守り' }, { id: 'part', label: '一部介助' }, { id: 'full', label: '全介助' }],
    cond: [{ id: 'bread', label: 'パンの日' }, { id: 'noodle', label: '麺の日' }, { id: 'fish', label: '魚の日' }, { id: 'event', label: '行事食' }],
    tools: ['箸', 'スプーン', '大スプーン', '柄の太いスプーン', 'フォーク', 'ストロー付きコップ', '吸い飲み', 'すべり止めマット', '仕切り皿', 'エプロン'],
    allergens: ['えび', 'かに', 'くるみ', '小麦', 'そば', '卵', '乳', '落花生',
      'アーモンド', 'あわび', 'いか', 'いくら', 'オレンジ', 'カシューナッツ', 'キウイフルーツ', '牛肉', 'ごま', 'さけ', 'さば',
      '大豆', '鶏肉', 'バナナ', '豚肉', 'マカダミアナッツ', 'もも', 'やまいも', 'りんご', 'ゼラチン'],
    sources: ['医師', '看護師', '管理栄養士', 'ケアマネジャー', '介護職', '家族', '本人'],
    absenceReasons: ['外出', '外泊', '入院', '受診', '絶食', '体調不良'],
    // 食数表に手で足す行（利用者ではない食事）
    extraRows: [{ id: 'staff', label: '職員' }, { id: 'kenshoku', label: '検食' }, { id: 'hozon', label: '保存食' }, { id: 'yobi', label: '予備' }],
    deadline: { daysBefore: 1, time: '15:00' },
    cardColorBy: 'side',
    // 低栄養リスクの判定値（厚生労働省 様式例の基準。変わったらここを直す）
    risk: { bmiMid: 18.5, loss: { m1: { mid: 3, high: 5 }, m3: { mid: 3, high: 7.5 }, m6: { mid: 3, high: 10 } }, albMid: 3.5, albHigh: 3.0, intakeMid: 75 },
    weightAlertKg: 2,
    nutrientKeys: null,      // 画面に出す栄養素（null = 基本の6つ）
    dishKinds: ['主食', '主菜', '副菜', '汁物', 'デザート', '飲み物'],
    targets: {},             // 食種ID → { energy, age, sex, setAt } 給与栄養目標量
    // 情報リンク。設定で足す・消す・並べ替えができる
    links: null, // null = 既定のリンク集（LINKS）を使う
    // 使っているデータの版と、最新かどうかを人が確かめた日
    dataSources: null, // null = 既定（SOURCES）
    // 食札の面付け（mm）。A4 縦。設定画面で数字を直せる
    cardLayouts: [
      { id: 'meishi10', label: '名刺サイズ 10面（91×55mm）', cols: 2, rows: 5, w: 91, h: 55, mt: 11, ml: 14, gx: 0, gy: 0 },
      { id: 'big8', label: '大きめ 8面（99×68mm）', cols: 2, rows: 4, w: 99, h: 68, mt: 12, ml: 6, gx: 0, gy: 0 },
      { id: 'wide4', label: '横長 4面（190×65mm・トレー用）', cols: 1, rows: 4, w: 190, h: 65, mt: 12, ml: 10, gx: 0, gy: 3 }]
  };

  // 既定の情報リンク。外部サイトは新しいタブで開く
  const LINKS = [
    { c: '制度・様式', n: '介護報酬改定（厚生労働省）', u: 'https://www.mhlw.go.jp/stf/seisakunitsuite/bunya/hukushi_kaigo/kaigo_koureisha/housyu/index.html', d: '改定の通知・Q&A・様式。栄養関係の様式もここから' },
    { c: '制度・様式', n: 'LIFE（科学的介護情報システム）', u: 'https://www.mhlw.go.jp/stf/shingi2/0000198094_00037.html', d: '仕様書、様式、CSV連携。2026年5月に国保中央会へ移管' },
    { c: '制度・様式', n: '社会保障審議会 介護給付費分科会', u: 'https://www.mhlw.go.jp/stf/shingi/shingi-hosho_126698.html', d: '次の改定に向けた資料。低栄養リスクの判定基準の見直しもここで議論' },
    { c: '食品・栄養のデータ', n: '日本食品標準成分表（文部科学省）', u: 'https://www.mext.go.jp/a_menu/syokuhinseibun/mext_00001.html', d: '現行は八訂増補2023年。Excel と正誤表' },
    { c: '食品・栄養のデータ', n: '食品成分データベース', u: 'https://fooddb.mext.go.jp/', d: '成分表をその場で検索' },
    { c: '食品・栄養のデータ', n: '日本人の食事摂取基準（厚生労働省）', u: 'https://www.mhlw.go.jp/stf/seisakunitsuite/bunya/kenkou_iryou/kenkou/eiyou/syokuji_kijyun.html', d: '現行は2025年版' },
    { c: '食品・栄養のデータ', n: 'アレルギー表示（消費者庁）', u: 'https://www.caa.go.jp/policies/policy/food_labeling/food_sanitation/allergy/', d: '特定原材料等の品目。追加されたらここで分かる' },
    { c: '衛生', n: '大量調理施設衛生管理マニュアル', u: 'https://www.mhlw.go.jp/stf/seisakunitsuite/bunya/kenkou_iryou/shokuhin/syokuchu/02.html', d: '点検表の様式、加熱温度、保存食' },
    { c: '嚥下・介護食', n: '日本摂食嚥下リハビリテーション学会', u: 'https://www.jsdr.or.jp/', d: '嚥下調整食分類2021（コードととろみ3段階）' },
    { c: '嚥下・介護食', n: 'ユニバーサルデザインフード（日本介護食品協議会）', u: 'https://www.udf.jp/', d: '市販介護食の区分' },
    { c: '嚥下・介護食', n: 'スマイルケア食（農林水産省）', u: 'https://www.maff.go.jp/j/shokusan/seizo/kaigo.html', d: '青・黄・赤のマーク' },
    { c: '職能団体', n: '日本栄養士会', u: 'https://www.dietitian.or.jp/', d: '改定情報、研修、生涯教育' },
    { c: '職能団体', n: '日本健康・栄養システム学会', u: 'https://www.j-ncm.com/', d: '栄養ケア・マネジメントの手引き、業務時間の調査' },
    { c: '同業に聞く', n: 'エイチエ（栄養士・管理栄養士の質問板）', u: 'https://eichie.jp/questions', d: '現場の相談と回答。回答を読むには会員登録' },
    { c: '同業に聞く', n: 'Eatreat', u: 'https://eat-treat.jp/', d: '栄養士のコミュニティ。無料の栄養価計算も' },
    { c: '献立・レシピ', n: '栄養士のお仕事Magazine', u: 'https://eiyoushi-shigoto.com/', d: '実務のコラム、行事食のアイデア' }
  ];
  const SOURCES = [
    { id: 'foods', label: '日本食品標準成分表', version: '八訂 増補2023年', url: 'https://www.mext.go.jp/a_menu/syokuhinseibun/mext_00001.html', note: '公式Excel 2026-03-27 差し替え版から変換', checkedAt: '' },
    { id: 'dri', label: '日本人の食事摂取基準', version: '2025年版', url: 'https://www.mhlw.go.jp/stf/seisakunitsuite/bunya/kenkou_iryou/kenkou/eiyou/syokuji_kijyun.html', note: '', checkedAt: '' },
    { id: 'risk', label: '低栄養リスクの判定基準', version: '令和6年度（様式例）', url: 'https://www.mhlw.go.jp/stf/seisakunitsuite/bunya/hukushi_kaigo/kaigo_koureisha/housyu/index.html', note: '平成17年以来見直し無し。次の改定で変わる可能性あり', checkedAt: '' },
    { id: 'engeshoku', label: '嚥下調整食分類', version: '学会分類2021', url: 'https://www.jsdr.or.jp/', note: '主食・副食マスタのコード欄', checkedAt: '' },
    { id: 'allergen', label: 'アレルギー表示の品目', version: '特定原材料等 28品目', url: 'https://www.caa.go.jp/policies/policy/food_labeling/food_sanitation/allergy/', note: '', checkedAt: '' },
    { id: 'life', label: 'LIFE CSV連携仕様', version: '3.10版', url: 'https://www.mhlw.go.jp/stf/shingi2/0000198094_00037.html', note: 'CSV出力は未実装', checkedAt: '' }
  ];

  const Master = { DEFAULTS: DEFAULTS, LINKS: LINKS, SOURCES: SOURCES, current: null };
  // 保存済みのマスタに、後から増えた項目だけを初期値で補う（既存の値は触らない）
  Master.merge = function (saved) {
    const out = JSON.parse(JSON.stringify(DEFAULTS));
    Object.keys(saved || {}).forEach((k) => { out[k] = saved[k]; });
    out.profile = (typeof Profile !== 'undefined' ? Profile : require('./profile.js')).normalize(out.profile);
    if (!out.links) out.links = JSON.parse(JSON.stringify(LINKS));
    if (!out.dataSources) out.dataSources = JSON.parse(JSON.stringify(SOURCES));
    else { // 後から足した出典を補う
      SOURCES.forEach((s2) => { if (!out.dataSources.some((x) => x.id === s2.id)) out.dataSources.push(JSON.parse(JSON.stringify(s2))); });
    }
    return out;
  };
  Master.load = async function () { Master.current = Master.merge(await window.DB.getMeta('masters', null)); return Master.current; };
  Master.save = async function () { await window.DB.setMeta('masters', Master.current); };
  if (typeof module !== 'undefined' && module.exports) module.exports = Master;
  (typeof window !== 'undefined' ? window : globalThis).Master = Master;
})();
