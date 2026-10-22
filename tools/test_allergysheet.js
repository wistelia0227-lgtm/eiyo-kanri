// 献立のアレルギー表（厨房向けの 1 枚）の中身の試験（2026-10-22 追加）。C:/AI/_setup/node/node.exe tools/test_allergysheet.js
'use strict';
global.window = global;
const M = require('../js/model.js');
const Master = require('../js/master.js');
const AS = require('../js/allergy_sheet.js');
const masters = Master.DEFAULTS;
let n = 0, bad = 0;
function ok(name, cond, extra) { n++; if (!cond) { bad++; console.log('NG  ' + name + (extra !== undefined ? '  → ' + JSON.stringify(extra) : '')); } else console.log('ok  ' + name); }
let seq = 0; const uid = (p) => p + (++seq);
const res = (name, o) => M.normalizeResident(Object.assign(M.newResident(name, uid), o));
const ver = (d, m, data, at) => ({ id: uid('v'), from: { d: d, m: m }, data: Object.assign(M.emptyDiet(), { shokushu: 'jo' }, data), recordedAt: at || 1 });
const stay = { id: 's', from: { d: '2026-10-01', m: 'b' }, to: null, recordedAt: 1 };

const dishes = {
  pan: { id: 'pan', name: '食パン', items: [{ no: '01026', name: 'こむぎ　［パン類］　角形食パン　食パン', g: 60 }], allergy: [] },
  tama: { id: 'tama', name: 'だし巻き卵', items: [{ no: '12004', name: '鶏卵　全卵　生', g: 50 }], allergy: [] },
  tori: { id: 'tori', name: '照り焼き', items: [{ no: '11221', name: '＜鳥肉類＞　にわとり　［若どり・主品目］　もも　皮つき　生', g: 70 }], allergy: [] },
  nazo: { id: 'nazo', name: '季節の煮物', items: [], allergy: [] }
};
const menu = { date: '2026-10-22', cells: {
  'b/jo': [{ dishId: 'pan' }, { dishId: 'tama' }, { dishId: 'nazo' }, { name: '手書きの小鉢' }],
  'l/jo': [{ dishId: 'pan' }, { dishId: 'tama' }, { dishId: 'tori' }] } };

// 山田: 小麦のアレルギー。10/22 の昼から卵も足した版（版の切り替わる日）
const yamada = res('山田 ハナ', { stays: [stay], diet: [ver('2026-10-01', 'b', { allergy: ['小麦'] }), ver('2026-10-22', 'l', { allergy: ['小麦', '卵'] }, 2)] });
// 佐藤: 禁食 鶏肉 → 白身魚。10/22 の昼は受診で欠食
const sato = res('佐藤 正一', { stays: [stay], diet: [ver('2026-10-01', 'b', { kinshi: [{ food: '鶏肉', sub: '白身魚' }], allergy: ['卵'] })],
  absences: [{ id: 'a1', from: { d: '2026-10-22', m: 'l' }, to: { d: '2026-10-22', m: 'l' }, reason: '受診', recordedAt: 1 }] });
// 鈴木: 卵のアレルギーだが 10/21 で退所（不在）
const suzuki = res('鈴木 トメ', { stays: [{ id: 's2', from: { d: '2026-10-01', m: 'b' }, to: { d: '2026-10-21', m: 'd' }, recordedAt: 1 }], diet: [ver('2026-10-01', 'b', { allergy: ['卵'] })] });
const people = [yamada, sato, suzuki];

const hitsOf = (sheet, dishName) => ((sheet.rows.find((x) => x.name === dishName) || { hits: [] }).hits);
const names = (hs) => hs.map((x) => x.r.name + ':' + x.word).sort().join(',');

const b = AS.build(people, dishes, menu, { d: '2026-10-22', m: 'b' }, masters);
ok('朝: 食パンに山田さん（小麦 ← こむぎ の言いかえで当たる）', names(hitsOf(b, '食パン')) === '山田 ハナ:小麦', names(hitsOf(b, '食パン')));
ok('朝: 当たった食材の名前が付く', hitsOf(b, '食パン')[0].foods.some((f) => /こむぎ/.test(f)), hitsOf(b, '食パン')[0].foods);
ok('朝: 山田さんの卵は昼からなので、朝のだし巻き卵には当たらない（佐藤さんだけ）', names(hitsOf(b, 'だし巻き卵')) === '佐藤 正一:卵', names(hitsOf(b, 'だし巻き卵')));
ok('朝: 退所した鈴木さんは出ない', !JSON.stringify(b.rows.map((x) => names(x.hits))).includes('鈴木'));
ok('朝: 印も材料も無い料理は「確認できない料理」に出る', b.unknown.map((x) => x.name).sort().join() === ['季節の煮物', '手書きの小鉢'].sort().join(), b.unknown);
ok('朝: 確認できない料理は当たりの表には出さない', !b.rows.some((x) => x.name === '季節の煮物'));

const l = AS.build(people, dishes, menu, { d: '2026-10-22', m: 'l' }, masters);
ok('昼: 版が切り替わり、だし巻き卵に山田さん（卵）', names(hitsOf(l, 'だし巻き卵')) === '山田 ハナ:卵', names(hitsOf(l, 'だし巻き卵')));
ok('昼: 欠食の佐藤さんは出ない（照り焼きに当たる人なし）', hitsOf(l, '照り焼き').length === 0, names(hitsOf(l, '照り焼き')));
ok('昼: 確認できない料理は無い', l.unknown.length === 0);
ok('昼: 食べる人の数（山田さんだけ）', l.eaters === 1, l.eaters);

// 禁食の代わりの物は併記、アレルギーは代わりの物のデータが無い
const d1 = AS.build([res('高橋 キヨ', { stays: [stay], diet: [ver('2026-10-01', 'b', { kinshi: [{ food: '鶏肉', sub: '白身魚' }] })] })], dishes, menu, { d: '2026-10-22', m: 'l' }, masters);
const th = hitsOf(d1, '照り焼き')[0];
ok('禁食 鶏肉 ← にわとり（言いかえ）で当たり、代わりの白身魚が付く', th && th.kind === 'kinshi' && th.sub === '白身魚', th);
ok('アレルギーの当たりは代わりの物が空（手書き欄にする）', hitsOf(b, '食パン')[0].sub === '');

// 食種の献立が無い人は、最初の食種の献立で判定して、その旨を残す
const dm = res('糖尿 太郎', { stays: [stay], diet: [ver('2026-10-01', 'b', { shokushu: 'dm', allergy: ['小麦'] })] });
const f = AS.build([dm], dishes, menu, { d: '2026-10-22', m: 'b' }, masters);
ok('自分の食種の献立が無い人は、常食の献立で判定する', names(hitsOf(f, '食パン')) === '糖尿 太郎:小麦' && f.fallback.length === 1, f.fallback);
// 食事情報が無い人は確かめられないので出す
const nod = AS.build([res('未設定 花子', { stays: [stay] })], dishes, menu, { d: '2026-10-22', m: 'b' }, masters);
ok('食事情報が未設定の人は「確認できない人」に出る', nod.noDiet.length === 1);

console.log('\n' + (n - bad) + '/' + n + ' 通過' + (bad ? '  ★ 失敗 ' + bad + ' 件' : ''));
process.exit(bad ? 1 : 0);
