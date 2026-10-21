// 食事情報の版を足す・写す時の試験（2026-10-22 の修正）。C:/AI/_setup/node/node.exe tools/test_diet.js
// アレルギー・禁食の取り違えは命に関わるので、「元にする版」と「消えない」ことを確かめる。
'use strict';
global.window = global;
const M = require('../js/model.js');
const Master = require('../js/master.js');
const masters = Master.DEFAULTS;
const meals = masters.meals;
let n = 0, bad = 0;
function ok(name, cond, extra) { n++; if (!cond) { bad++; console.log('NG  ' + name + (extra !== undefined ? '  → ' + JSON.stringify(extra) : '')); } else console.log('ok  ' + name); }
let seq = 0; const uid = (p) => p + (++seq);
const res = (o) => M.normalizeResident(Object.assign(M.newResident('試験', uid), o));
const ver = (d, m, data, at) => ({ id: uid('v'), from: { d: d, m: m }, data: Object.assign(M.emptyDiet(), data), recordedAt: at || 1 });

// ---- 1. 予定の版（未来の日付）がある人の食事を変える ----
(function () {
  const now = ver('2026-10-01', 'b', { staple: 'rice', allergy: ['えび'] }, 1);
  const plan = ver('2026-11-01', 'b', { staple: 'kayu', allergy: ['えび'], kinshi: [{ food: '鶏肉', sub: '魚' }] }, 2);
  const r = res({ diet: [now, plan] });
  const slot = { d: '2026-10-22', m: 'l' };
  ok('元の内容は「いつから」時点で有効な版（先の予定の版ではない）', M.editBase(r, slot, meals) === now, (M.editBase(r, slot, meals) || {}).id);
  ok('「いつから」が予定の版より後なら、予定の版が元になる', M.editBase(r, { d: '2026-11-05', m: 'b' }, meals) === plan);
  ok('後に予定の版があることが分かる', M.laterVersions && M.laterVersions(r, slot, meals).length === 1);

  // 今回の変更: アレルギーに卵、禁食にそばを足し、主食を軟飯に。えびは外さない
  const data = Object.assign(M.emptyDiet(), { staple: 'soft', allergy: ['えび', '卵'], kinshi: [{ food: 'そば', sub: 'うどん' }] });
  const add = M.restrictionAdds ? M.restrictionAdds(now.data, data) : { allergy: [], kinshi: [] };
  ok('足したアレルギー・禁食を拾う', add.allergy.join() === '卵' && add.kinshi.map((k) => k.food).join() === 'そば', add);
  r.diet.push(ver('2026-10-22', 'l', data, 3));
  const k = M.applyToLater ? M.applyToLater(r, M.laterVersions(r, slot, meals), add, { at: 10, by: '試験' }) : 0;
  ok('予定の版 1 件に反映した', k === 1, k);
  const after = M.dietAt(r, { d: '2026-11-02', m: 'b' }, meals);
  ok('予定の版の日にもアレルギーの卵がある', after.allergy.indexOf('卵') >= 0 && after.allergy.indexOf('えび') >= 0, after.allergy);
  ok('予定の版の日にも禁食のそばがある（元の鶏肉も残る）', after.kinshi.map((x) => x.food).sort().join() === ['そば', '鶏肉'].sort().join(), after.kinshi);
  ok('予定の版の主食（全粥）はそのまま（主食の変更は運ばない）', after.staple === 'kayu');
  ok('元の予定の版は消さず、取り消しの印で残る', plan.cancelledAt === 10 && r.diet.length === 4);
  ok('置き換えた版は同じ「いつから」', r.diet[3].from.d === '2026-11-01' && r.diet[3].replaces === plan.id && !('cancelledAt' in r.diet[3]));
  const ev = M.eventsOn([r], '2026-11-01', masters).filter((e) => e.type === 'diet');
  ok('予定の日の食事変更は 1 件だけ出る', ev.length === 1, ev.length);
  ok('もう入っている物は二重に足さない', M.applyToLater(r, M.laterVersions(r, slot, meals), add, { at: 11 }) === 0);
})();
(function () {
  // 外す変更は運ばない（消える方向は人が予定の版で直す）
  const now = ver('2026-10-01', 'b', { allergy: ['えび', 'かに'] }, 1);
  const plan = ver('2026-11-01', 'b', { allergy: ['えび', 'かに'] }, 2);
  const add = M.restrictionAdds(now.data, Object.assign(M.emptyDiet(), { allergy: ['えび'] }));
  ok('外しただけなら運ぶ物は無い', add.allergy.length === 0 && add.kinshi.length === 0, add);
  const r = res({ diet: [now, plan] });
  ok('外しただけなら予定の版は触らない', M.applyToLater(r, [plan], add, { at: 5 }) === 0 && !plan.cancelledAt);
})();

// ---- 4. 入所時の聞き取りを食事情報に写す ----
(function () {
  const v1 = ver('2026-10-01', 'b', { staple: 'rice', allergy: ['えび'], kinshi: [{ food: '鶏肉', sub: '魚' }], byMeal: { b: { staple: 'bread' } } }, 1);
  const r = res({ diet: [v1] });
  const base = M.intakeBase(r, { d: '2026-10-22', m: 'b' }, meals);
  ok('元の内容は朝食用の個別設定を混ぜていない（主食は米飯のまま）', base.staple === 'rice', base.staple);
  ok('朝だけパンの個別設定は残る', base.byMeal && base.byMeal.b && base.byMeal.b.staple === 'bread', base.byMeal);
  const next = M.intakeToDiet({ allergy: ['卵'], kinshi: ['そば'] }, base);
  ok('聞き取りのアレルギーは足す（元のえびが消えない）', next.allergy.join() === 'えび,卵', next.allergy);
  ok('聞き取りの禁食は足す（元の鶏肉→魚が消えない）', next.kinshi.map((k) => k.food + '→' + k.sub).join() === '鶏肉→魚,そば→', next.kinshi);
  const again = M.intakeToDiet({ allergy: ['えび'], kinshi: [{ food: '鶏肉', sub: '' }] }, next);
  ok('同じ物は二重にしない（代わりの物の指定も消さない）', again.allergy.join() === 'えび,卵' && again.kinshi.find((k) => k.food === '鶏肉').sub === '魚', again);
  ok('元の版の中身は書き換えない', v1.data.allergy.join() === 'えび' && v1.data.kinshi.length === 1);
})();

// ---- 6. 次の食事の枠（17 時以降は翌朝）。食事の印を変えた施設でも効く ----
(function () {
  const std = meals.filter((x) => x.on !== false);
  const at = (ms, h) => { const s = M.nextSlotAt(ms, '2026-10-22', h); return s.d + '/' + s.m; };
  ok('既定: 8 時は昼', at(std, 8) === '2026-10-22/l');
  ok('既定: 18 時は翌朝', at(std, 18) === '2026-10-23/b');
  // 食事を作り直した施設（印が b/l/d ではない）
  const own = Master.merge({ meals: [{ id: 'm1', label: '朝食' }, { id: 'm2', label: '昼食' }, { id: 'm3', label: '夕食' }] }).meals;
  ok('印を変えた施設: 18 時は翌朝', at(own, 18) === '2026-10-23/m1', at(own, 18));
  ok('印を変えた施設: 12 時は夕', at(own, 12) === '2026-10-22/m3', at(own, 12));
  // 区切りを食事の設定に持たせて、施設が決められる
  const set = [{ id: 'm1', label: '朝食', until: 8 }, { id: 'm2', label: '昼食', until: 13 }, { id: 'm3', label: '夕食', until: 19 }];
  ok('区切りの設定どおり: 18 時はまだ夕', at(set, 18) === '2026-10-22/m3', at(set, 18));
  ok('区切りの設定どおり: 19 時は翌朝', at(set, 19) === '2026-10-23/m1', at(set, 19));
  ok('既定の食事には区切りが入っている', Master.merge({ meals: [{ id: 'd', label: '夕' }] }).meals[0].until === 17);
})();

console.log('\n' + (n - bad) + '/' + n + ' 通過' + (bad ? '  ★ 失敗 ' + bad + ' 件' : ''));
process.exit(bad ? 1 : 0);
