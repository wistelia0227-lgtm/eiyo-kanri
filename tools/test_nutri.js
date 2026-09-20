// 栄養計算の試験。C:/AI/_setup/node/node.exe tools/test_nutri.js
'use strict';
const fs = require('fs');
const path = require('path');
global.window = global;
require('../js/foods_data.js'); // window.FOODS_DATA
const N = require('../js/nutri.js');
N.load(global.FOODS_DATA);
let n = 0, bad = 0;
function ok(name, cond, extra) { n++; if (!cond) { bad++; console.log('NG  ' + name + (extra !== undefined ? '  → ' + JSON.stringify(extra) : '')); } else console.log('ok  ' + name); }

ok('成分表が読める（2538 食品）', N.count() === 2538, N.count());
ok('出典の表記がある', /増補2023年/.test(N.meta.citation), N.meta.citation);
ok('成分は 52 項目', N.nutrients.length === 52, N.nutrients.length);

// 食品を引く
const rice = N.get('01088'); // こめ [水稲めし] 精白米 うるち米
ok('食品番号で引ける', rice && rice.name.indexOf('めし') >= 0, rice && rice.name);
ok('エネルギーが取れる', N.val(rice, 'kcal') === 156, N.val(rice, 'kcal'));
ok('食品群の名前が付く', rice.groupName === '穀類', rice.groupName);

// 検索
ok('「精白米」で引ける', N.search('精白米').length > 0);
ok('ひらがなでも引ける（にんじん）', N.search('にんじん').length > 0, N.search('にんじん').length);
ok('複数の語で絞れる', N.search('こめ めし').every((f) => f.name.indexOf('めし') >= 0));
ok('短い名前が先に出る', N.search('たまねぎ')[0].name.length <= N.search('たまねぎ')[3].name.length);

// 合計
const meshi = N.sum([{ no: '01088', g: 150 }]);
ok('ごはん 150g は 234kcal', N.round('kcal', meshi.values.kcal) === 234, meshi.values.kcal);
ok('ごはん 150g のたんぱく質 3.8g', N.round('prot', meshi.values.prot) === 3.8, meshi.values.prot);
const miso = N.sum([{ no: '17045', g: 12 }, { no: '04032', g: 30 }, { no: '09041', g: 1 }]); // 米みそ・淡色辛みそ / 木綿豆腐 / 乾燥わかめ
ok('みそ汁の食塩相当量が 1.5g 前後', miso.values.nacl > 1.2 && miso.values.nacl < 1.8, N.round('nacl', miso.values.nacl));
const both = N.add(meshi, miso);
ok('足し合わせ', Math.abs(both.values.kcal - (meshi.values.kcal + miso.values.kcal)) < 1e-9);
ok('2 倍', Math.abs(N.scale(meshi, 2).values.kcal - meshi.values.kcal * 2) < 1e-9);
ok('無い食品番号は unknown に入る', N.sum([{ no: '99999', g: 10 }]).unknown.length === 1);

// 未測定（-）の扱い
const withMissing = N.sum([{ no: '01001', g: 100 }]); // アマランサス玄穀 は 糖アルコール等が -
ok('未測定の成分は合計から外し、名前を控える', Object.keys(withMissing.missing).length > 0, Object.keys(withMissing.missing));
ok('未測定は 0 として足されない（polyl）', withMissing.values.polyl === 0 && withMissing.missing.polyl);
ok('Tr は 0 として扱う', N.flag(N.get('01002'), 'alc') !== undefined);

// 食事摂取基準
ok('年齢区分 80歳 → 75歳以上', N.ageBand(80).id === '75+');
ok('年齢区分 70歳 → 65〜74歳', N.ageBand(70).id === '65-74');
const e1 = N.energyNeed({ age: 80, sex: 'f', weightKg: 45, palIndex: 0 });
ok('80歳女性 45kg 活動レベル低い → 20.7×45×1.40 = 1304kcal', e1 === Math.round(20.7 * 45 * 1.40), e1);
const e2 = N.energyNeed({ age: 80, sex: 'f', weightKg: 45, method: 'kg', kcalPerKg: 30 });
ok('簡易式 30kcal/kg → 1350kcal', e2 === 1350, e2);
const e3 = N.energyNeed({ age: 70, sex: 'm', weightKg: 60, heightCm: 165, method: 'hb', activity: 1.3, stress: 1.0 });
ok('Harris-Benedict が計算できる', e3 > 1500 && e3 < 2200, e3);
ok('体重が無ければ出さない', N.energyNeed({ age: 80, sex: 'f' }) === null);

const dt = N.dailyTarget({ age: 80, sex: 'f', weightKg: 45, palIndex: 0 });
ok('目標: エネルギーは ±5% の幅', dt.target.kcal[0] < dt.energy && dt.target.kcal[1] > dt.energy, dt.target.kcal);
ok('目標: たんぱく質の下限は推奨量 50g 以上', dt.target.prot[0] >= 50, dt.target.prot);
ok('目標: 食塩は上限のみ 6.5g', dt.target.nacl[0] === null && dt.target.nacl[1] === 6.5, dt.target.nacl);
ok('目標: 食物繊維 75歳以上女性 17g', dt.target.fib[0] === 17, dt.target.fib);
ok('判定: 食塩 8g は上限超え', N.judge(dt.target, 'nacl', 8) === 'high');
ok('判定: たんぱく質 30g は下限未満', N.judge(dt.target, 'prot', 30) === 'low');
ok('判定: 範囲内は ok', N.judge(dt.target, 'nacl', 5) === 'ok');
ok('判定: 基準が無い成分は null', N.judge(dt.target, 'biot', 5) === null);

// 給与栄養目標量
const people = [
  { age: 80, sex: 'f', weightKg: 45, palIndex: 0 }, { age: 82, sex: 'f', weightKg: 47, palIndex: 0 },
  { age: 78, sex: 'f', weightKg: 43, palIndex: 0 }, { age: 85, sex: 'm', weightKg: 55, palIndex: 0 },
  { age: 90, sex: 'f', weightKg: 40, palIndex: 0 }];
const gt = N.groupTarget(people);
ok('給与栄養目標量: 50kcal 単位に丸める', gt.list.every((x) => x % 50 === 0), gt.list);
ok('給与栄養目標量: 最頻値と荷重平均が出る', gt.mode > 0 && gt.mean > 0, { mode: gt.mode, mean: gt.mean, spread: gt.spread });
ok('給与栄養目標量: 人がいなければ null', N.groupTarget([]) === null);

console.log('\n' + (n - bad) + '/' + n + ' 通過' + (bad ? '  ★ 失敗 ' + bad + ' 件' : ''));
process.exit(bad ? 1 : 0);
