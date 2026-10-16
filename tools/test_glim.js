// GLIM 基準の試験。C:/AI/_setup/node/node.exe tools/test_glim.js
'use strict';
global.window = global;
const G = require('../js/glim.js');
let n = 0, bad = 0;
function ok(name, cond, extra) { n++; if (!cond) { bad++; console.log('NG  ' + name + (extra !== undefined ? '  → ' + JSON.stringify(extra) : '')); } else console.log('ok  ' + name); }

ok('体重減少 6か月以内 5%', G.CUT.loss.m6 === 5);
ok('体重減少 6か月超 10%', G.CUT.loss.over6 === 10);
ok('体重減少 重度 10%', G.CUT.loss.severeM6 === 10);
ok('体重減少 重度 20%', G.CUT.loss.severeOver6 === 20);
ok('低BMI 70歳未満 18.5', G.CUT.bmi.under70 === 18.5);
ok('低BMI 70歳以上 20', G.CUT.bmi.from70 === 20);
ok('年齢の境目 70', G.CUT.bmi.age === 70);
ok('G.CC_SETS 3件', G.CC_SETS.length === 3);
ok('G.CC_SETS id acute', G.CC_SETS[0].id === 'acute');
ok('G.CC_SETS id kaifuku', G.CC_SETS[1].id === 'kaifuku');
ok('G.CC_SETS id bmiAdj', G.CC_SETS[2].id === 'bmiAdj');
ok('重度基準初期値 null', G.CUT.severe.bmiUnder70 === null && G.CUT.severe.bmiFrom70 === null && G.CUT.severe.ccM === null && G.CUT.severe.ccF === null);

ok('ccCut acute m', G.ccCut('m', 'acute').cut === 30);
ok('ccCut acute f', G.ccCut('f', 'acute').cut === 29);
ok('ccCut acute adj 0', G.ccCut('m', 'acute').adj === 0);
ok('ccCut kaifuku m', G.ccCut('m', 'kaifuku').cut === 33);
ok('ccCut kaifuku f', G.ccCut('f', 'kaifuku').cut === 32);
ok('ccCut bmiAdj 20', G.ccCut('m', 'bmiAdj', 20).adj === 0);
ok('ccCut bmiAdj 27', G.ccCut('m', 'bmiAdj', 27).adj === -3);
ok('ccCut bmiAdj 35', G.ccCut('m', 'bmiAdj', 35).adj === -7);
ok('ccCut bmiAdj no-bmi', G.ccCut('m', 'bmiAdj').adj === 0);

let r;
r = G.assess({ loss: 7, lossMonths: 6 });
ok('loss 7/6 hit', r.pheno[0].hit === true);
ok('loss 7/6 severe false', r.pheno[0].severe === false);

r = G.assess({ loss: 12, lossMonths: 6 });
ok('loss 12/6 severe', r.pheno[0].severe === true);

r = G.assess({ loss: 4, lossMonths: 6 });
ok('loss 4/6 hit false', r.pheno[0].hit === false);

r = G.assess({ loss: 12, lossMonths: 12 });
ok('loss 12/12 hit true', r.pheno[0].hit === true);
ok('loss 12/12 severe false', r.pheno[0].severe === false);

r = G.assess({ loss: 25, lossMonths: 12 });
ok('loss 25/12 severe true', r.pheno[0].severe === true);

r = G.assess({ age: 69, bmi: 18.0 });
ok('age 69 bmi 18.0 hit', r.pheno[1].hit === true);
r = G.assess({ age: 69, bmi: 19.0 });
ok('age 69 bmi 19.0 no hit', r.pheno[1].hit === false);

r = G.assess({ age: 70, bmi: 19.0 });
ok('age 70 bmi 19.0 hit', r.pheno[1].hit === true);
r = G.assess({ age: 70, bmi: 20.5 });
ok('age 70 bmi 20.5 no hit', r.pheno[1].hit === false);

r = G.assess({ bmi: 19.5 });
ok('no age bmi 19.5 hit', r.pheno[1].hit === true);

r = G.assess({ sex: 'm', cc: 28, ccSet: 'acute' });
ok('cc 28 m acute muscle hit', r.pheno[2].hit === true);
r = G.assess({ sex: 'm', cc: 31, ccSet: 'acute' });
ok('cc 31 m acute muscle hit false', r.pheno[2].hit === false);
r = G.assess({ sex: 'm', cc: 31, ccSet: 'kaifuku' });
ok('cc 31 m kaifuku muscle hit', r.pheno[2].hit === true);

r = G.assess({ muscleLow: true });
ok('muscleLow true hit', r.pheno[2].hit === true);

r = G.assess({});
ok('lacking CC', r.lacking.includes('下腿周囲長'));

r = G.assess({ intakeLow1: true });
ok('intakeLow1 hit', r.etio[0].hit === true);
r = G.assess({ giChronic: true });
ok('giChronic hit', r.etio[0].hit === true);
r = G.assess({ acute: true });
ok('acute hit', r.etio[1].hit === true);
r = G.assess({});
ok('empty etioHit 0', r.etioHit === 0);

r = G.assess({ age: 80, bmi: 17, intakeLow1: true, screened: true });
ok('malnutrition true', r.malnutrition === true);
ok('severity moderate', r.severity === 'moderate');

r = G.assess({ age: 80, bmi: 17, screened: true });
ok('bmi only no mal', r.malnutrition === false);
ok('bmi only severity null', r.severity === null);

r = G.assess({ intakeLow1: true, screened: true });
ok('intake only no mal', r.malnutrition === false);

r = G.assess({ age: 80, bmi: 17, intakeLow1: true, screened: false });
ok('screened false no mal', r.malnutrition === false);

r = G.assess({ loss: 15, lossMonths: 6, acute: true, screened: true });
ok('loss 15/6 acute severe', r.severity === 'severe');

r = G.assess({ age: 80, bmi: 17, intakeLow1: true, screened: true });
ok('severeUnknown contains bmi', r.severeUnknown.includes('bmi'));

const customCut = JSON.parse(JSON.stringify(G.CUT));
customCut.severe.bmiUnder70 = 17.0;
r = G.assess({ age: 65, bmi: 16.5, intakeLow1: true, screened: true }, customCut);
ok('custom cut severe bmi', r.severity === 'severe');
ok('original G.CUT remains null', G.CUT.severe.bmiUnder70 === null);

r = G.assess({});
ok('words not hit', G.words(r) === '低栄養には当てはまりません');
r = G.assess({ age: 80, bmi: 17, intakeLow1: true, screened: true });
ok('words moderate included', G.words(r).includes('中等度低栄養'));
ok('words unknown included', G.words(r).includes('未設定'));
ok('label loss', G.label('loss') === '意図しない体重減少');

r = G.assess({});
ok('assess shape pheno 3', r.pheno.length === 3);
ok('assess shape pheno order', r.pheno[0].id === 'loss' && r.pheno[1].id === 'bmi' && r.pheno[2].id === 'muscle');
ok('assess shape etio 2', r.etio.length === 2);
ok('assess shape etio order', r.etio[0].id === 'intake' && r.etio[1].id === 'disease');
ok('assess shape lacking 3', r.lacking.length === 3);

console.log('\n' + (n - bad) + '/' + n + (bad ? '  ← NG ' + bad + ' 件' : ' 通過'));
process.exit(bad ? 1 : 0);