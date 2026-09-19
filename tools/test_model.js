// 計算の核の試験。ブラウザ無しで回す: C:/AI/_setup/node/node.exe tools/test_model.js
'use strict';
const M = require('../js/model.js');
const masters = require('../js/master.js').DEFAULTS;
const meals = masters.meals;
let n = 0, bad = 0;
function ok(name, cond, extra) { n++; if (!cond) { bad++; console.log('NG  ' + name + (extra !== undefined ? '  → ' + JSON.stringify(extra) : '')); } else console.log('ok  ' + name); }
let seq = 0; const uid = (p) => p + (++seq);
function res(name, o) { return M.normalizeResident(Object.assign(M.newResident(name, uid), o)); }
const ver = (d, m, data, at) => ({ id: uid('v'), from: { d: d, m: m }, data: Object.assign(M.emptyDiet(), data), recordedAt: at || 1 });

// 日付
ok('addDays 月またぎ', M.addDays('2026-09-30', 1) === '2026-10-01');
ok('addMonths 月末丸め', M.addMonths('2026-03-31', -1) === '2026-02-28');
ok('weekday', M.weekday('2026-09-20') === 0);

// 在籍: ショートは 入所日の昼から、退所日の朝まで
const a = res('短期A', { category: 'short', stays: [{ id: 's1', from: { d: '2026-09-20', m: 'l' }, to: { d: '2026-09-23', m: 'b' }, recordedAt: 1 }] });
ok('入所日の朝は在籍外', M.presence(a, { d: '2026-09-20', m: 'b' }, meals).state === 'out');
ok('入所日の昼は在籍', M.presence(a, { d: '2026-09-20', m: 'l' }, meals).state === 'in');
ok('退所日の朝は在籍', M.presence(a, { d: '2026-09-23', m: 'b' }, meals).state === 'in');
ok('退所日の昼は在籍外', M.presence(a, { d: '2026-09-23', m: 'l' }, meals).state === 'out');
// 欠食（外出で昼だけ）
a.absences.push({ id: 'a1', from: { d: '2026-09-21', m: 'l' }, to: { d: '2026-09-21', m: 'l' }, reason: '外出', recordedAt: 1 });
ok('外出の昼は欠食', M.presence(a, { d: '2026-09-21', m: 'l' }, meals).state === 'absent');
ok('外出の日の夕は食べる', M.presence(a, { d: '2026-09-21', m: 'd' }, meals).state === 'in');
// 取り消した欠食は無視
a.absences.push({ id: 'a2', from: { d: '2026-09-22', m: 'b' }, to: { d: '2026-09-22', m: 'd' }, cancelledAt: 5, recordedAt: 1 });
ok('取り消した欠食は数えない', M.presence(a, { d: '2026-09-22', m: 'l' }, meals).state === 'in');
// デイ: 月水金の昼だけ。退所日なし
const day = res('デイB', { category: 'day', weekdays: [1, 3, 5], mealsTaken: ['l'], stays: [{ id: 's2', from: { d: '2026-09-01' }, to: null, recordedAt: 1 }] });
ok('デイ 月曜の昼は食べる', M.presence(day, { d: '2026-09-21', m: 'l' }, meals).state === 'in');
ok('デイ 月曜の夕は対象外', M.presence(day, { d: '2026-09-21', m: 'd' }, meals).state === 'off');
ok('デイ 火曜は対象外', M.presence(day, { d: '2026-09-22', m: 'l' }, meals).state === 'off');
ok('在籍の見出し 在籍中', M.status(day, '2026-09-20', meals) === 'in');
ok('在籍の見出し 予定あり', M.status(a, '2026-09-19', meals) === 'planned');
ok('在籍の見出し 休止', M.status(a, '2026-09-24', meals) === 'rest');

// 食事情報の版
const c = res('入所C', { stays: [{ id: 's3', from: { d: '2026-01-01' }, to: null, recordedAt: 1 }] });
c.diet.push(ver('2026-01-01', 'b', { shokushu: 'jo', staple: 'rice', stapleG: 150, side: 'jo' }, 1));
c.diet.push(ver('2026-09-21', 'l', { shokushu: 'jo', staple: 'kayu', stapleG: 300, side: 'kizami', byMeal: { b: { staple: 'bread', stapleG: 60 } } }, 2));
ok('変更前の朝は米飯', M.dietAt(c, { d: '2026-09-21', m: 'b' }, meals).staple === 'rice');
ok('変更後の昼は全粥', M.dietAt(c, { d: '2026-09-21', m: 'l' }, meals).staple === 'kayu');
ok('翌朝は朝だけの個別設定でパン', M.dietAt(c, { d: '2026-09-22', m: 'b' }, meals).staple === 'bread');
ok('翌朝の副食は共通のきざみ', M.dietAt(c, { d: '2026-09-22', m: 'b' }, meals).side === 'kizami');
const diff = M.diffDiet(c.diet[0].data, c.diet[1].data, masters);
ok('違いの文に主食と副食が出る', diff.some((x) => x === '主食: 米飯 → 全粥') && diff.some((x) => x === '副食: 常菜 → きざみ'), diff);
// 同じ枠に 2 つ版があれば後から記録した方
c.diet.push(ver('2026-09-21', 'l', { shokushu: 'jo', staple: 'kayu', stapleG: 250, side: 'kizami' }, 3));
ok('同じ枠は後の記録が勝つ', M.dietAt(c, { d: '2026-09-21', m: 'l' }, meals).stapleG === 250);
c.diet[2].cancelledAt = 9;
ok('取り消した版は無視', M.dietAt(c, { d: '2026-09-21', m: 'l' }, meals).stapleG === 300);

// 食数
const all = [a, day, c];
a.diet.push(ver('2026-09-20', 'l', { shokushu: 'salt', staple: 'kayu', side: 'soft' }, 1));
const cen = M.census(all, { d: '2026-09-21', m: 'l' }, masters);
ok('食数: 昼は 2（短期Aは外出）', cen.total === 2, cen.total);
ok('食数: 欠食一覧に短期A', cen.absent.length === 1 && cen.absent[0].r === a);
ok('食数: 食事未設定のデイBを拾う', cen.noDiet.length === 1 && cen.noDiet[0] === day);
ok('食数: 主食別', cen.byStaple.kayu === 1 && cen.byStaple['(未設定)'] === 1, cen.byStaple);
const cen2 = M.census(all, { d: '2026-09-21', m: 'd' }, masters);
ok('食数: 夕は 2（A と C）', cen2.total === 2 && cen2.byCategory.short === 1 && cen2.byCategory.long === 1, cen2.byCategory);

// その日の変更
const ev = M.eventsOn(all, '2026-09-21', masters);
ok('変更一覧: 欠食の開始・終了と食事変更', ev.filter((e) => e.type === 'diet').length === 1 && ev.some((e) => e.type === 'absStart') && ev.some((e) => e.type === 'absEnd'), ev.map((e) => e.type));
ok('変更一覧: 最初の版は食事変更に数えない', !M.eventsOn(all, '2026-09-20', masters).some((e) => e.type === 'diet'));
const ids = M.cardChangedIds(all, '2026-09-21', masters);
ok('食札の刷り直し対象は C と（復帰の）A', ids[c.id] && ids[a.id] && !ids[day.id]);

// 締切のあとの変更
const dl = { daysBefore: 1, time: '15:00' };
const limit = M.deadlineMs('2026-09-23', dl);
ok('締切は前日の 15:00', new Date(limit).getHours() === 15 && new Date(limit).getDate() === 22);
const late = res('遅いD', { stays: [{ id: 's4', from: { d: '2026-09-23', m: 'l' }, to: { d: '2026-09-25', m: 'b' }, recordedAt: limit + 60000 }] });
const early = res('早いE', { stays: [{ id: 's5', from: { d: '2026-09-23', m: 'l' }, to: { d: '2026-09-25', m: 'b' }, recordedAt: limit - 60000,
  changes: [{ at: M.deadlineMs('2026-09-25', dl) + 1, label: '退所日', old: { d: '2026-09-26', m: 'b' }, new: { d: '2026-09-25', m: 'b' } }] }] });
const lc = M.lateChanges([late, early], dl, '2026-09-20');
ok('締切後の登録を拾う', lc.some((x) => x.r === late && x.d === '2026-09-23'));
ok('締切前の登録は拾わない', !lc.some((x) => x.r === early && x.what.indexOf('登録') >= 0));
ok('締切後の退所日変更を早い方の日付で拾う', lc.some((x) => x.r === early && x.d === '2026-09-25'), lc);

// 体重
const ws = [{ date: '2026-03-10', value: 50 }, { date: '2026-06-12', value: 48 }, { date: '2026-08-10', value: 47 }, { date: '2026-09-10', value: 45 }];
const cur = ws[3];
ok('1か月の減少率 4.26%', Math.abs(M.lossRate(ws, cur, 1).rate - (47 - 45) / 47 * 100) < 1e-9);
ok('3か月の減少率 6.25%', Math.abs(M.lossRate(ws, cur, 3).rate - 6.25) < 1e-9);
ok('6か月の減少率 10%', Math.abs(M.lossRate(ws, cur, 6).rate - 10) < 1e-9);
ok('測定が無い月は null', M.lossRate([{ date: '2026-01-01', value: 50 }, cur], cur, 1) === null);
const bmi = M.bmi(45, 150);
ok('BMI 20.0', Math.abs(bmi - 20) < 1e-9);
const rk = M.risk({ bmi: bmi, loss: { m1: 4.26, m3: 6.25, m6: 10 } }, masters.risk);
ok('リスク: 6か月 10% で高', rk.level === 'high' && rk.reasons.length === 3, rk);
ok('リスク: BMI 18.4 だけなら中', M.risk({ bmi: 18.4 }, masters.risk).level === 'mid');
ok('リスク: 問題なしは低', M.risk({ bmi: 22, loss: { m1: 0.5 } }, masters.risk).level === 'low');
ok('リスク: 材料なしは判定しない', M.risk({}, masters.risk).level === null);
ok('リスク: Alb 3.5 は中、2.9 は高', M.risk({ alb: 3.5 }, masters.risk).level === 'mid' && M.risk({ alb: 2.9 }, masters.risk).level === 'high');
ok('リスク: 経腸・静脈栄養は中、褥瘡は高', M.risk({ tube: true }, masters.risk).level === 'mid' && M.risk({ pressureUlcer: true }, masters.risk).level === 'high');
ok('年齢', M.age('1940-09-21', '2026-09-20') === 85 && M.age('1940-09-20', '2026-09-20') === 86);

console.log('\n' + (n - bad) + '/' + n + ' 通過' + (bad ? '  ★ 失敗 ' + bad + ' 件' : ''));
process.exit(bad ? 1 : 0);
