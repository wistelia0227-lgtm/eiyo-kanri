// 栄養ケア・マネジメントの試験。C:/AI/_setup/node/node.exe tools/test_ncm.js
'use strict';
const M = require('../js/model.js');
global.Model = M;
const N = require('../js/ncm.js');
const masters = require('../js/master.js').DEFAULTS;
let n = 0, bad = 0;
function ok(name, cond, extra) { n++; if (!cond) { bad++; console.log('NG  ' + name + (extra !== undefined ? '  → ' + JSON.stringify(extra) : '')); } else console.log('ok  ' + name); }
let seq = 0; const uid = (p) => p + (++seq);
const today = '2026-09-21';
function res(name, from) {
  return M.normalizeResident(Object.assign(M.newResident(name, uid), {
    stays: [{ id: uid('s'), from: { d: from, m: 'l' }, to: null, recordedAt: 1 }] }));
}
function rec(rid, date, o) { return N.normalize(Object.assign(N.empty(rid, date), o)); }

// 期限: 記録が無ければ入所から 7 日以内
const a = res('新規A', '2026-09-18');
let d = N.nextDue(a, [], masters, today);
ok('記録なし → 入所+7日が期限', d.kind === 'first' && d.due === '2026-09-25' && d.overdueDays === 0, d.due);
const b = res('遅れB', '2026-09-01');
d = N.nextDue(b, [], masters, today);
ok('入所から日が経つと期限切れの日数が出る', d.overdueDays === M.dayNum(today) - M.dayNum('2026-09-08'), d.overdueDays);

// リスク別の間隔
const c = res('入所C', '2026-01-01');
const recs = [rec(c.id, '2026-09-01', { process: 'screening', level: 'high' })];
d = N.nextDue(c, recs, masters, today);
ok('高リスクは 14 日毎', d.due === '2026-09-15' && d.kind === 'monitor', d);
recs[0].level = 'low';
d = N.nextDue(c, recs, masters, today);
ok('低リスクは 90 日毎', d.due === '2026-11-30', d.due);
recs[0].level = 'mid';
d = N.nextDue(c, recs, masters, today);
ok('中リスクは施設の設定（既定 30 日）', d.due === '2026-10-01', d.due);
// 再スクリーニングが先に来たらそちらが期限
recs.push(rec(c.id, '2026-09-20', { process: 'monitoring', level: 'low' }));
d = N.nextDue(c, recs, masters, today);
ok('再スクリーニング（前回スクリーニング+90日）が先ならそちらを出す', d.kind === 'rescreen' && d.due === '2026-11-30', d);
// 設定で間隔を変えられる
const m2 = Object.assign({}, masters, { ncm: { mid: 45, high: 7 } });
recs.length = 1; recs[0].level = 'high';
ok('設定で間隔を変えられる', N.nextDue(c, recs, m2, today).due === '2026-09-08');

// リスクの自動判定
const r1 = rec(c.id, today, { body: { heightCm: 150, weightKg: 40, loss1: null, loss3: 8, loss6: null, ulcer: false, feeding: 'oral' } });
let al = N.autoLevel(r1, masters.risk);
ok('BMI 17.8 と 3か月 8% 減 → 高', al.level === 'high' && al.reasons.length === 2, al);
const r2 = rec(c.id, today, { body: { heightCm: 150, weightKg: 50, feeding: 'enteral' } });
ok('経腸栄養は中', N.autoLevel(r2, masters.risk).level === 'mid');
const r3 = rec(c.id, today, { body: { heightCm: 150, weightKg: 50, ulcer: true } });
ok('褥瘡は高', N.autoLevel(r3, masters.risk).level === 'high');
const r4 = rec(c.id, today, { body: { heightCm: 150, weightKg: 50, feeding: 'oral' }, intake: { pct: 60 } });
ok('食事摂取量 60% は中', N.autoLevel(r4, masters.risk).level === 'mid');
const r5 = rec(c.id, today, { body: { heightCm: 150, weightKg: 50, feeding: 'oral' }, intake: { pct: 100 } });
ok('問題なしは低', N.autoLevel(r5, masters.risk).level === 'low');
ok('材料が無ければ判定しない', N.autoLevel(rec(c.id, today, {}), masters.risk).level === null);

// 前回複写
const prev = rec(c.id, '2026-08-01', { process: 'monitoring', level: 'mid', special: '前回のメモ', evaluation: 'maintained', planChange: true,
  body: { heightCm: 150, weightKg: 45, feeding: 'oral' }, issues: ['水分でむせる'],
  iji: { tests: ['水飲みテスト'], observe: { members: ['管理栄養士'], date: '2026-08-01' }, meeting: { members: ['医師'], date: '2026-08-01', items: { 0: 'change' } }, note: 'x' } });
const copy = N.copyFrom(prev, today, 'monitoring');
ok('複写: 体の値と課題は引き継ぐ', copy.body.weightKg === 45 && copy.issues[0] === '水分でむせる');
ok('複写: 特記・総合評価・計画変更は空にする', copy.special === '' && copy.evaluation === '' && copy.planChange === false);
ok('複写: 経口維持の実施日は空にし、参加者は残す', copy.iji.observe.date === '' && copy.iji.observe.members[0] === '管理栄養士' && Object.keys(copy.iji.meeting.items).length === 0);
ok('複写: 元の記録を壊さない', prev.special === '前回のメモ' && prev.iji.observe.date === '2026-08-01');

// 期限の一覧
const list = N.dueList([a, b, c], [rec(c.id, '2026-09-20', { level: 'low' })], masters, today, 7);
ok('一覧: 期限が近い順、低リスクの C は入らない', list.length === 2 && list[0].resident === b, list.map((x) => x.resident.name));
ok('一覧: 期限切れは日数がマイナス', list[0].daysLeft < 0 && list[0].overdueDays > 0, { left: list[0].daysLeft, over: list[0].overdueDays });
const outOf = M.normalizeResident(Object.assign(M.newResident('退所D', uid), { stays: [{ id: 's9', from: { d: '2026-01-01', m: 'l' }, to: { d: '2026-02-01', m: 'b' }, recordedAt: 1 }] }));
ok('一覧: 在籍していない人は出さない', !N.dueList([outOf], [], masters, today, 999).length);

// 様式の項目がそろっている
ok('口腔の課題 9 項目', N.ISSUES_ORAL.length === 9);
ok('その他の課題 13 項目', N.ISSUES_OTHER.length === 13);
ok('多職種会議の 5 視点', N.MEETING_ITEMS.length === 5);
ok('職種 11', N.JOBS.length === 11);
ok('計画書の分類 5', N.PLAN_CATEGORIES.length === 5);
ok('空の記録が正規化できる', N.normalize({ residentId: 'x', date: today }).body.heightCm === null);

console.log('\n' + (n - bad) + '/' + n + ' 通過' + (bad ? '  ★ 失敗 ' + bad + ' 件' : ''));
process.exit(bad ? 1 : 0);
