// まとめて取り込みの試験。C:/AI/_setup/node/node.exe tools/test_bulk.js
// 食品名から食品番号を当てる所が肝。外した時に「外した」と分かることを確かめる。
'use strict';
global.window = global;
require('../js/foods_data.js');
const N = require('../js/nutri.js');
N.load(global.FOODS_DATA);
const B = require('../js/bulk.js');
let n = 0, bad = 0;
function ok(name, cond, extra) { n++; if (!cond) { bad++; console.log('NG  ' + name + (extra !== undefined ? '  → ' + JSON.stringify(extra) : '')); } else console.log('ok  ' + name); }

const NL = '\n', TAB = '\t';

// ---- 表の読み取り ----
ok('タブ区切りを読める', B.splitRows('a' + TAB + 'b' + NL + 'c' + TAB + 'd').length === 2);
ok('カンマ区切りを読める', B.splitRows('a,b' + NL + 'c,d')[1].join('|') === 'c|d');
ok('" で囲んだ中のカンマは区切らない', B.splitCsv('"あ,い",う').join('|') === 'あ,い|う', B.splitCsv('"あ,い",う'));
ok('"" は " になる', B.splitCsv('"a""b"')[0] === 'a"b');
ok('空の行は捨てる', B.splitRows('a,b' + NL + NL + 'c,d').length === 2);
ok('CRLF も読める', B.splitRows('a,b\r\nc,d').length === 2);

// 見出しの言い換え
ok('見出しを読み替える', B.headerKey('料理名') === 'dish' && B.headerKey('材料名') === 'food' && B.headerKey('純使用量') === 'g');
ok('全角と空白の違いを吸収する', B.headerKey('料 理 名') === 'dish' && B.headerKey('ｇ') === 'g', [B.headerKey('料 理 名'), B.headerKey('ｇ')]);
ok('知らない見出しは null', B.headerKey('なにこれ') === null);
ok('見出しが無ければ断る', /見出し/.test(B.parse('ごはん,こめ,160').error));
ok('空なら断る', !!B.parse('').error);

// ---- 食品の突き合わせ ----
const m1 = B.matchFood(N, '01088', '');
ok('食品番号があればそれを使う', m1.how === 'no' && m1.food.no === '01088', m1.how);
const m2 = B.matchFood(N, '99999', 'なにか');
ok('無い食品番号ははっきり断る', m2.how === 'none' && /成分表にありません/.test(m2.why), m2);
const m3 = B.matchFood(N, '', 'こいくちしょうゆ');
ok('名前がぴったり合えば exact', m3.how === 'exact' && m3.food.no === '17007', [m3.how, m3.food && m3.food.no]);
const m4 = B.matchFood(N, '', 'にんじん');
ok('候補が複数なら many（黙って決めない）', m4.how === 'many' && m4.cands.length > 1, [m4.how, m4.cands.length]);
const m5 = B.matchFood(N, '', 'ぜったいにない食品');
ok('見つからなければ none', m5.how === 'none', m5);
ok('候補は 8 件までに絞る', B.matchFood(N, '', 'こめ').cands.length <= 8);
// 「にんじん」で「つるにんじん」を先に出さない（書いた名前で始まるものを先に）
ok('書いた名前で始まる候補を先に出す', N.shortName(m4.food.name).indexOf('にんじん') === 0, N.shortName(m4.food.name));
ok('「キャベツ」でも先頭一致を優先する（めキャベツ・レッドキャベツを先に出さない）', (function () {
  const r = B.matchFood(N, '', 'キャベツ');
  return r.how !== 'none' && N.shortName(r.food.name).indexOf('キャベツ') === 0;
})(), N.shortName(B.matchFood(N, '', 'キャベツ').food.name));
// 先頭一致が 1 つも無ければ、成分表の並びのまま（作り話をしない）
ok('先頭一致が無ければ元の並びの先頭', (function () {
  const r = B.matchFood(N, '', 'ねぎ');
  return r.how === 'many' && r.cands.length > 1;
})(), B.matchFood(N, '', 'ねぎ').cands.map((f) => N.shortName(f.name)).slice(0, 3));

// ---- 料理にまとめる ----
const text = [
  ['料理名', '区分', '何人分', '食品番号', '食品名', '重量', 'アレルギー', 'メモ'].join(TAB),
  ['筑前煮', '副菜', '2', '11221', '', '80', '', '乱切り'].join(TAB),
  ['筑前煮', '', '', '02017', '', '80', '', ''].join(TAB),
  ['筑前煮', '', '', '', 'こいくちしょうゆ', '12', '小麦・大豆', ''].join(TAB),
  ['筑前煮', '', '', '', 'にんじん', '20', '', ''].join(TAB),
  ['たまご焼き', '主菜', '1', '12004', '', '50', '卵', ''].join(TAB),
  ['あやしい料理', '主菜', '1', '', 'ぜったいにない食品', '50', '', ''].join(TAB),
  ['重さなし', '副菜', '1', '01088', '', '', '', ''].join(TAB)
].join(NL);
const p = B.parse(text);
ok('見出しが読めた', !p.error && p.rows.length === 7, p.error || p.rows.length);
const dishes = B.toDishes(p.rows, N);
ok('料理は 4 件にまとまる', dishes.length === 4, dishes.map((d) => d.name));
const chikuzen = dishes[0];
ok('同じ料理名の 4 行が 1 つの料理になる', chikuzen.items.length === 4, chikuzen.items.length);
ok('区分・何人分・メモは最初の行から取る', chikuzen.kind === '副菜' && chikuzen.servings === 2 && chikuzen.memo === '乱切り', [chikuzen.kind, chikuzen.servings, chikuzen.memo]);
ok('アレルギーは「・」で分けて足す', chikuzen.allergy.join() === '小麦,大豆', chikuzen.allergy);
ok('そのまま入れられる', chikuzen.ok && chikuzen.bad === 0);
// 名前がぴったり合った「こいくちしょうゆ」は確かめ不要。候補が複数の「にんじん」だけ確かめに回す
ok('候補が複数だった行だけ「確かめて」に数える', chikuzen.check === 1, chikuzen.items.map((i) => i.given + ':' + i.how));
ok('名前がぴったりの行は確かめ不要（exact）', chikuzen.items[2].how === 'exact', chikuzen.items[2].how);
ok('候補が複数の行は many のまま', chikuzen.items[3].how === 'many', chikuzen.items[3].how);
ok('many でも仮の候補は入っている（画面でえらび直せる）', !!chikuzen.items[3].no && chikuzen.items[3].cands.length > 1);
const ayashii = dishes.find((d) => d.name === 'あやしい料理');
ok('当たらなかった料理は ok にならない', !ayashii.ok && ayashii.bad === 1, [ayashii.ok, ayashii.bad]);
const omosa = dishes.find((d) => d.name === '重さなし');
ok('重量が無い行も「直すところ」になる', !omosa.ok && omosa.items[0].noG === true, omosa.items[0]);

const s = B.summary(dishes);
ok('まとめの数が合う', s.dishes === 4 && s.ok === 2 && s.bad === 2, s);

// ---- 書き出し → 読み込みで元に戻る ----
const out = B.toRows([{ name: '筑前煮', kind: '副菜', servings: 2, main: '肉', method: '煮る', allergy: ['小麦'], memo: '乱切り',
  items: [{ no: '11221', name: 'にわとり　もも　皮つき　生', g: 80 }, { no: '02017', name: 'じゃがいも', g: 80 }] }]);
ok('書き出しは 見出し ＋ 材料の行数', out.length === 3, out.length);
ok('見出しが 10 列', out[0].length === 10, out[0]);
ok('料理の属性は 1 行目にだけ入る', out[1][1] === '副菜' && out[2][1] === '', [out[1][1], out[2][1]]);
const back = B.toDishes(B.parse(out.map((r) => r.join(TAB)).join(NL)).rows, N);
ok('書き出したものを読み戻せる', back.length === 1 && back[0].items.length === 2 && back[0].servings === 2 && back[0].ok,
  back[0] && [back[0].items.length, back[0].servings, back[0].ok]);
ok('読み戻した食品番号が同じ', back[0].items.map((i) => i.no).join() === '11221,02017', back[0].items.map((i) => i.no));

// ---- 献立 ----
ok('日付の書き方の揺れを吸収する',
  B.toDate('2026/10/1') === '2026-10-01' && B.toDate('2026-10-01') === '2026-10-01'
  && B.toDate('2026年10月1日') === '2026-10-01' && B.toDate('10/1', '2026') === '2026-10-01',
  [B.toDate('2026/10/1'), B.toDate('2026年10月1日'), B.toDate('10/1', '2026')]);
ok('読めない日付は空', B.toDate('きのう') === '' && B.toDate('10/1') === '');
const meals = [{ id: 'b', label: '朝' }, { id: 'l', label: '昼' }, { id: 'd', label: '夕' }];
ok('食事の名前から ID を引く', B.toId(meals, '昼') === 'l' && B.toId(meals, 'l') === 'l');
ok('前方一致でも引く', B.toId([{ id: 'jo', label: '常食' }], '常') === 'jo', B.toId([{ id: 'jo', label: '常食' }], '常'));
ok('引けなければ空', B.toId(meals, 'おやつ') === '');
const mp = B.parseMenu(['日付,食事,食種,料理名,人数分', '2026-10-01,昼,常食,ごはん,1'].join(NL));
ok('献立の表を読める', !mp.error && mp.rows.length === 1 && mp.rows[0].dish === 'ごはん', mp.error || mp.rows[0]);
ok('日付の列が無ければ断る', /日付/.test(B.parseMenu('料理名' + NL + 'ごはん').error));

console.log('\n' + (n - bad) + '/' + n + (bad ? '  ← NG ' + bad + ' 件' : ' 通過'));
process.exit(bad ? 1 : 0);
