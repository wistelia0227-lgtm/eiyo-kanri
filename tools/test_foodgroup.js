// 食品群の分類の試験。C:/AI/_setup/node/node.exe tools/test_foodgroup.js
'use strict';
global.window = global;
require('../js/foods_data.js');
const N = require('../js/nutri.js');
N.load(global.FOODS_DATA);
const FG = require('../js/foodgroup.js');
let n = 0, bad = 0;
function ok(name, cond, extra) { n++; if (!cond) { bad++; console.log('NG  ' + name + (extra !== undefined ? '  → ' + JSON.stringify(extra) : '')); } else console.log('ok  ' + name); }

const cl = FG.classifier(N);
const nameOf = (no) => { const f = N.get(no); return f ? f.name : '(無い)'; };

// ---- 穀類の細分（報告書が「ごはん・パン・めん」で聞いてくる）----
ok('めしは ごはん', cl('01088') === 'rice', [nameOf('01088'), cl('01088')]);
ok('全かゆも ごはん', cl('01093') === 'rice', [nameOf('01093'), cl('01093')]);
ok('食パンは パン', cl('01026') === 'bread', [nameOf('01026'), cl('01026')]);
ok('米粉パンも パン', cl('01211') === 'bread', [nameOf('01211'), cl('01211')]);
ok('うどんは めん', cl('01038') === 'noodle', [nameOf('01038'), cl('01038')]);
ok('中華めんは めん', cl('01047') === 'noodle', [nameOf('01047'), cl('01047')]);
ok('小麦粉は 穀類その他（原材料なので食べる形ではない）', cl('01015') === 'grain', [nameOf('01015'), cl('01015')]);
ok('そば粉は 穀類その他（めんではない）', cl('01122') === 'grain', [nameOf('01122'), cl('01122')]);
ok('パン粉は 穀類その他（パンではない）', cl('01079') === 'grain', [nameOf('01079'), cl('01079')]);
// ぎょうざの皮は「めん」に入れない
const gyoza = global.FOODS_DATA.foods.find((r) => r[3].indexOf('ぎょうざの皮') >= 0);
ok('ぎょうざの皮は 穀類その他', gyoza && cl(gyoza[0]) === 'grain', gyoza && [gyoza[3], cl(gyoza[0])]);

// ---- 緑黄色野菜（厚生労働省 健健発0804第1号: β-カロテン当量 600μg 以上 ＋ 別表の 7 品目）----
ok('にんじんは 緑黄色野菜', cl('06212') === 'gvege', [nameOf('06212'), cl('06212')]);
ok('ほうれんそうは 緑黄色野菜', cl('06267') === 'gvege', [nameOf('06267'), cl('06267')]);
ok('キャベツは その他の野菜', cl('06061') === 'ovege', [nameOf('06061'), cl('06061')]);
ok('赤色トマトは 別表により 緑黄色野菜（カロテンは 600 未満）',
  cl('06182') === 'gvege' && N.val(N.get('06182'), 'cartbeq') < 600, [nameOf('06182'), N.val(N.get('06182'), 'cartbeq')]);
ok('青ピーマンは 別表により 緑黄色野菜', cl('06245') === 'gvege', [nameOf('06245'), cl('06245')]);
ok('アスパラガスは 別表により 緑黄色野菜', cl('06007') === 'gvege', [nameOf('06007'), cl('06007')]);
ok('きゅうりは その他の野菜', cl('06065') === 'ovege', [nameOf('06065'), cl('06065')]);
// カロテン 600 以上なら自動で緑黄色野菜になる
const auto = global.FOODS_DATA.foods.filter((r) => r[1] === '06' && N.val(N.get(r[0]), 'cartbeq') >= 600
  && r[3].indexOf('漬') < 0 && r[3].indexOf('キムチ') < 0);
ok('カロテン 600μg 以上の野菜はすべて緑黄色野菜', auto.every((r) => cl(r[0]) === 'gvege'),
  auto.filter((r) => cl(r[0]) !== 'gvege').slice(0, 3).map((r) => r[3]));

// ---- 漬物 ----
ok('きゅうりの塩漬は 野菜漬物類', cl('06066') === 'pickle', [nameOf('06066'), cl('06066')]);
const kimchi = global.FOODS_DATA.foods.find((r) => r[1] === '06' && r[3].indexOf('キムチ') >= 0);
ok('キムチも 野菜漬物類', kimchi && cl(kimchi[0]) === 'pickle', kimchi && [kimchi[3], cl(kimchi[0])]);

// ---- そのまま対応する群 ----
[['02017', 'potato'], ['03003', 'sugar'], ['04001', 'bean'], ['05001', 'seed'], ['07107', 'fruit'],
  ['08001', 'mushroom'], ['09003', 'alga'], ['10003', 'fish'], ['11001', 'meat'], ['12004', 'egg'],
  ['13001', 'milk'], ['14006', 'oil'], ['15001', 'sweets'], ['16001', 'drink'], ['17007', 'season']].forEach(([no, want]) => {
  ok('大分類そのまま: ' + nameOf(no).slice(0, 18) + ' → ' + want, cl(no) === want, [nameOf(no), cl(no)]);
});

// ---- 全食品に群が付くか（付かないものがあると帳票の合計が合わなくなる）----
const miss = global.FOODS_DATA.foods.filter((r) => !cl(r[0]));
ok('2,538 食品すべてに群が付く', miss.length === 0, miss.slice(0, 5).map((r) => [r[0], r[3]]));

// ---- 集計 ----
const t = FG.tally([{ no: '01088', g: 160 }, { no: '06212', g: 30 }, { no: '06061', g: 50 }, { no: '99999', g: 10 }], cl);
ok('群ごとに重さが足される', t.g.rice === 160 && t.g.gvege === 30 && t.g.ovege === 50, t.g);
ok('分からない食品番号は unknown に回る', t.unknown === 10, t.unknown);
ok('総量は全部の合計', t.total === 250, t.total);
const t2 = FG.addTally(t, FG.tally([{ no: '01088', g: 160 }], cl));
ok('2 日ぶんを足せる', t2.g.rice === 320 && t2.total === 410, [t2.g.rice, t2.total]);
const t3 = FG.scaleTally(t2, 0.5);
ok('日数で割れる', t3.g.rice === 160 && t3.total === 205, [t3.g.rice, t3.total]);
ok('空の集計が作れる', FG.emptyTally().total === 0 && Object.keys(FG.emptyTally().g).length === 0);

// ---- 報告書の欄 ----
ok('報告書の欄は 16 行', FG.REPORT_ROWS.length === 16, FG.REPORT_ROWS.length);
ok('報告書の欄の群はすべて GROUPS にある', FG.REPORT_ROWS.every((r) => FG.ids().indexOf(r.id) >= 0));
ok('群の名前が引ける', FG.label('gvege') === '緑黄色野菜', FG.label('gvege'));

console.log('\n' + (n - bad) + '/' + n + (bad ? '  ← NG ' + bad + ' 件' : ' 通過'));
process.exit(bad ? 1 : 0);
