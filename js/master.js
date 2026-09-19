// マスタの初期値。設定画面で全部書き換えられる（コードに名前を埋め込まない）。window.Master で公開。
// code = 日本摂食嚥下リハビリテーション学会 嚥下調整食分類2021 のコード。施設ごとの呼び方とコードの対応表を兼ねる。
(function () {
  'use strict';
  const DEFAULTS = {
    facility: { name: '', recorder: '' },
    meals: [
      { id: 'b', label: '朝', on: true }, { id: 'l', label: '昼', on: true },
      { id: 's', label: 'おやつ', on: false }, { id: 'd', label: '夕', on: true }],
    categories: [
      { id: 'long', label: '入所' }, { id: 'short', label: 'ショート' }, { id: 'day', label: 'デイ' }],
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
    // 食札の面付け（mm）。A4 縦。設定画面で数字を直せる
    cardLayouts: [
      { id: 'meishi10', label: '名刺サイズ 10面（91×55mm）', cols: 2, rows: 5, w: 91, h: 55, mt: 11, ml: 14, gx: 0, gy: 0 },
      { id: 'big8', label: '大きめ 8面（99×68mm）', cols: 2, rows: 4, w: 99, h: 68, mt: 12, ml: 6, gx: 0, gy: 0 },
      { id: 'wide4', label: '横長 4面（190×65mm・トレー用）', cols: 1, rows: 4, w: 190, h: 65, mt: 12, ml: 10, gx: 0, gy: 3 }]
  };

  const Master = { DEFAULTS: DEFAULTS, current: null };
  // 保存済みのマスタに、後から増えた項目だけを初期値で補う（既存の値は触らない）
  Master.merge = function (saved) {
    const out = JSON.parse(JSON.stringify(DEFAULTS));
    Object.keys(saved || {}).forEach((k) => { out[k] = saved[k]; });
    return out;
  };
  Master.load = async function () { Master.current = Master.merge(await window.DB.getMeta('masters', null)); return Master.current; };
  Master.save = async function () { await window.DB.setMeta('masters', Master.current); };
  if (typeof module !== 'undefined' && module.exports) module.exports = Master;
  (typeof window !== 'undefined' ? window : globalThis).Master = Master;
})();
