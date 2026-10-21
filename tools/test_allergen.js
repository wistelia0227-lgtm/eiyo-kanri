// アレルギー・禁食と「出る物」の突き合わせの試験（2026-10-22 の修正）。C:/AI/_setup/node/node.exe tools/test_allergen.js
// 成分表の名前（こむぎ・だいず・うし …）や加工品（パン・うどん・麩 …）、カタカナ・半角でも拾えること、
// 初期料理 75 件で今まで拾えていたものが減らないことを確かめる。
'use strict';
global.window = global;
const M = require('../js/model.js');
const Master = require('../js/master.js');
require('../js/dishes_seed.js');
const SEED = global.DISHES_SEED;
let n = 0, bad = 0;
function ok(name, cond, extra) { n++; if (!cond) { bad++; console.log('NG  ' + name + (extra !== undefined ? '  → ' + JSON.stringify(extra) : '')); } else console.log('ok  ' + name); }
const diet = (allergy, kinshi) => Object.assign(M.emptyDiet(), { allergy: allergy || [], kinshi: (kinshi || []).map((f) => ({ food: f, sub: '' })) });
const hits = (allergy, words, kinshi) => M.matchRestrictions(diet(allergy, kinshi), words).map((x) => x.word);
const hitA = (a, words) => hits([a], words).indexOf(a) >= 0;

// ---- 成分表のひらがな名 ----
ok('小麦 ← こむぎ（成分表の食パン）', hitA('小麦', ['こむぎ　［パン類］　角形食パン　食パン']));
ok('大豆 ← だいず（成分表の木綿豆腐）', hitA('大豆', ['だいず　［豆腐・油揚げ類］　木綿豆腐']));
ok('落花生 ← らっかせい', hitA('落花生', ['らっかせい　大粒種　いり']));
ok('牛肉 ← うし', hitA('牛肉', ['＜畜肉類＞　うし　［和牛肉］　かた　脂身つき　生']));
ok('豚肉 ← ぶた', hitA('豚肉', ['＜畜肉類＞　ぶた　［大型種肉］　ばら　脂身つき　生']));
ok('鶏肉 ← にわとり', hitA('鶏肉', ['＜鳥肉類＞　にわとり　［若どり・主品目］　もも　皮つき　生']));
ok('卵 ← 鶏卵', hitA('卵', ['鶏卵　全卵　生']));
ok('乳 ← 普通牛乳', hitA('乳', ['＜牛乳及び乳製品＞　（液状乳類）　生乳　ジャージー種']));
ok('やまいも ← ながいも', hitA('やまいも', ['＜いも類＞　（やまのいも類）　ながいも　ながいも　塊根　生']));
// ---- 加工品 ----
ok('小麦 ← パン', hitA('小麦', ['パン']));
ok('小麦 ← うどん', hitA('小麦', ['うどん']));
ok('小麦 ← 麩', hitA('小麦', ['麩のすまし汁']));
ok('小麦 ← ちくわ', hitA('小麦', ['ちくわの磯辺揚げ']));
ok('卵 ← マヨネーズ', hitA('卵', ['マヨネーズ']));
ok('卵 ← 茶碗蒸し', hitA('卵', ['茶碗蒸し']));
ok('乳 ← ヨーグルト・チーズ・バター', hitA('乳', ['ヨーグルト']) && hitA('乳', ['チーズ']) && hitA('乳', ['バター']));
ok('大豆 ← 納豆・油揚げ・みそ', hitA('大豆', ['納豆']) && hitA('大豆', ['油揚げ']) && hitA('大豆', ['みそ汁']));
ok('豚肉 ← ハム・ベーコン・ソーセージ', hitA('豚肉', ['ハム']) && hitA('豚肉', ['ベーコン']) && hitA('豚肉', ['ソーセージ']));
ok('落花生 ← ピーナッツ', hitA('落花生', ['ピーナッツバター']));
ok('ゼラチン ← ゼリー', hitA('ゼラチン', ['オレンジゼリー']));
// ---- ひらがな／カタカナ・全角／半角 ----
ok('えび ← エビフライ（カタカナ）', hitA('えび', ['エビフライ']));
ok('えび ← ｴﾋﾞﾌﾗｲ（半角カナ）', hitA('えび', ['ｴﾋﾞﾌﾗｲ']));
ok('アレルギーをカタカナで登録しても当たる（エビ ← えびフライ）', hits(['エビ'], ['えびフライ']).length === 1);
ok('かに ← ずわいがに（濁る）', hitA('かに', ['ずわいがに　ゆで']));
ok('そば ← 蕎麦', hitA('そば', ['ざる蕎麦']));
ok('くるみ ← クルミ', hitA('くるみ', ['クルミパン']));
// ---- 禁食にも同じ表が効く ----
ok('禁食の鶏肉 ← チキン', hits([], ['チキンカレー'], ['鶏肉']).indexOf('鶏肉') >= 0);
// ---- 当たってはいけない物 ----
ok('鶏肉は鶏卵に当たらない', !hitA('鶏肉', ['鶏卵　全卵　生', 'だし巻き卵']));
ok('牛肉は牛乳に当たらない', !hitA('牛肉', ['牛乳']));
ok('禁食の納豆はみそ汁に当たらない（加工品の表は品目名の時だけ）', hits([], ['ごはん', 'みそ汁'], ['納豆']).length === 0);
ok('当たらない物では出ない', hits(['えび', 'かに'], ['ごはん', 'みそ汁']).length === 0);

// ---- 特定原材料 8 品目（えび・かに・くるみ・小麦・そば・卵・乳・落花生）は必ず表にある ----
['えび', 'かに', 'くるみ', '小麦', 'そば', '卵', '乳', '落花生'].forEach((a) => {
  const t = M.allergenTerms ? M.allergenTerms(a) : [];
  ok('8 品目: ' + a + ' に言いかえ・加工品がある', t.length >= 3, t.length);
});
ok('表示義務 9・推奨 19 の全部に表がある', Master.DEFAULTS.allergens.every((a) => M.ALLERGEN_WORDS && M.ALLERGEN_WORDS[a]),
  Master.DEFAULTS.allergens.filter((a) => !(M.ALLERGEN_WORDS && M.ALLERGEN_WORDS[a])));

// ---- 初期料理 75 件で、今まで拾えていたものが減らない ----
(function () {
  const old = (a, words) => words.some((w) => w.indexOf(a) >= 0);  // 直す前の照合（部分一致だけ）
  let lost = [], before = 0, after = 0;
  ok('初期料理は 75 件', SEED.dishes.length === 75, SEED.dishes.length);
  SEED.dishes.forEach((d) => {
    const words = [d.name].concat(d.items.map((it) => it.name)).concat(d.allergy || []);
    Master.DEFAULTS.allergens.forEach((a) => {
      const o = old(a, words), nw = hitA(a, words);
      if (o) before++;
      if (nw) after++;
      if (o && !nw) lost.push(d.name + '×' + a);
    });
  });
  ok('今まで拾えていた組み合わせが 1 つも減らない', lost.length === 0, lost);
  ok('拾える組み合わせが増えた（' + before + ' → ' + after + '）', after > before, [before, after]);
  const pick = (name) => SEED.dishes.find((d) => d.name === name);
  const of = (name) => { const d = pick(name); const w = [d.name].concat(d.items.map((it) => it.name)).concat(d.allergy || []);
    return Master.DEFAULTS.allergens.filter((a) => hitA(a, w)); };
  ok('食パンに小麦', of('食パン').indexOf('小麦') >= 0, of('食パン'));
  ok('うどんに小麦', of('うどん').indexOf('小麦') >= 0, of('うどん'));
  ok('豚汁に豚肉と大豆', of('豚汁').indexOf('豚肉') >= 0 && of('豚汁').indexOf('大豆') >= 0, of('豚汁'));
  ok('鶏の照り焼きに鶏肉', of('鶏の照り焼き').indexOf('鶏肉') >= 0, of('鶏の照り焼き'));
  ok('だし巻き卵に卵', of('だし巻き卵').indexOf('卵') >= 0, of('だし巻き卵'));
})();

console.log('\n' + (n - bad) + '/' + n + ' 通過' + (bad ? '  ★ 失敗 ' + bad + ' 件' : ''));
process.exit(bad ? 1 : 0);
