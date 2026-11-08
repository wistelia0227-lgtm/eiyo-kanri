// アレルギー照合の再現率・適合率を、正解表 tools/allergen_truth.json（成分表 2,538 食品＋初期料理 75 件 × 28 品目）で測る。
// C:/AI/_setup/node/node.exe tools/test_allergen_recall.js [--table]
// 見逃し（再現率）を最優先にする: 「含む」は 1 つ残らず当たること。誤検出は「要確認（maybe）」の段で許し、「確実（sure）」の誤検出は少なく。
'use strict';
global.window = global;
const fs = require('fs');
const path = require('path');
const M = require('../js/model.js');
const truth = JSON.parse(fs.readFileSync(path.join(__dirname, 'allergen_truth.json'), 'utf8'));
const ITEMS = truth.items;
const showTable = process.argv.indexOf('--table') >= 0 || !process.env.QUIET;

// 照合の段。新しい照合器は M.matchLevel(word, words) → 'sure' | 'maybe' | ''。無ければ旧い当たり判定を sure として扱う
const level = (item, words) => {
  if (M.matchLevel) return M.matchLevel(item, words);
  return M.wordHits(item, words).length ? 'sure' : '';
};

const rows = [];
Object.keys(truth.foods).forEach((no) => rows.push({ name: truth.foods[no].name, words: [truth.foods[no].name], a: truth.foods[no].a, kind: 'food' }));
Object.keys(truth.dishes).forEach((n) => rows.push({ name: n, words: truth.dishes[n].words, a: truth.dishes[n].a, kind: 'dish' }));

const stat = {};
ITEMS.forEach((k) => { stat[k] = { yes: 0, yesHit: 0, yesSure: 0, maybe: 0, maybeHit: 0, no: 0, fpSure: 0, fpMaybe: 0, missYes: [], missMaybe: [], fpS: [], fpM: [] }; });
rows.forEach((r) => {
  ITEMS.forEach((k) => {
    const t = r.a[k] || 'no', lv = level(k, r.words), s = stat[k];
    if (t === 'yes') { s.yes++; if (lv) s.yesHit++; else s.missYes.push(r.name); if (lv === 'sure') s.yesSure++; }
    else if (t === 'maybe') { s.maybe++; if (lv) s.maybeHit++; else s.missMaybe.push(r.name); }
    else { s.no++; if (lv === 'sure') { s.fpSure++; s.fpS.push(r.name); } else if (lv === 'maybe') { s.fpMaybe++; s.fpM.push(r.name); } }
  });
});
const pct = (a, b) => b ? (100 * a / b).toFixed(1) + '%' : '—';
const pad = (s, n) => { s = String(s); let w = 0; for (const c of s) w += c.charCodeAt(0) > 255 ? 2 : 1; return s + ' '.repeat(Math.max(0, n - w)); };
const T = { yes: 0, yesHit: 0, yesSure: 0, maybe: 0, maybeHit: 0, no: 0, fpSure: 0, fpMaybe: 0 };
if (showTable) console.log(pad('品目', 16) + pad('含む', 6) + pad('再現', 8) + pad('確実で', 8) + pad('可能性', 7) + pad('再現', 8) + pad('誤検出(確実)', 13) + '誤検出(要確認)');
ITEMS.forEach((k) => {
  const s = stat[k];
  Object.keys(T).forEach((x) => { T[x] += s[x]; });
  if (showTable) console.log(pad(k, 16) + pad(s.yes, 6) + pad(pct(s.yesHit, s.yes), 8) + pad(pct(s.yesSure, s.yes), 8) + pad(s.maybe, 7) + pad(pct(s.maybeHit, s.maybe), 8) + pad(s.fpSure, 13) + s.fpMaybe);
});
console.log(pad('合計', 16) + pad(T.yes, 6) + pad(pct(T.yesHit, T.yes), 8) + pad(pct(T.yesSure, T.yes), 8) + pad(T.maybe, 7) + pad(pct(T.maybeHit, T.maybe), 8) + pad(T.fpSure, 13) + T.fpMaybe);
const sureAll = T.yesSure + T.fpSure + ITEMS.reduce((a, k) => a + 0, 0);
console.log('含む を見逃した数: ' + (T.yes - T.yesHit) + ' ／ 可能性 を見逃した数: ' + (T.maybe - T.maybeHit) +
  ' ／ 確実の誤検出: ' + T.fpSure + ' ／ 要確認の誤検出: ' + T.fpMaybe + '（含まない ' + T.no + ' 組のうち）');
if (process.argv.indexOf('--miss') >= 0) {
  ITEMS.forEach((k) => {
    const s = stat[k];
    if (s.missYes.length) console.log('見逃し(含む) ' + k + ': ' + s.missYes.slice(0, 15).join(' | '));
    if (s.missMaybe.length) console.log('見逃し(可能性) ' + k + ': ' + s.missMaybe.slice(0, 15).join(' | '));
    if (s.fpS.length) console.log('誤検出(確実) ' + k + ': ' + s.fpS.slice(0, 15).join(' | '));
    if (s.fpM.length) console.log('誤検出(要確認) ' + k + ': ' + s.fpM.slice(0, 15).join(' | '));
  });
}

// ---- 合格の線 ----
let n = 0, bad = 0;
function ok(name, cond, extra) { n++; if (!cond) { bad++; console.log('NG  ' + name + (extra !== undefined ? '  → ' + JSON.stringify(extra) : '')); } else console.log('ok  ' + name); }
ok('正解表は成分表 2,538 件＋料理 75 件', Object.keys(truth.foods).length === 2538 && Object.keys(truth.dishes).length === 75);
ok('「含む」の見逃しが 0（再現率 100%）', T.yes === T.yesHit, ITEMS.filter((k) => stat[k].missYes.length).map((k) => k + ':' + stat[k].missYes.length));
ok('「含む」の 9 割以上を「確実」で当てる', T.yesSure >= T.yes * 0.9, pct(T.yesSure, T.yes));
ok('「含む可能性」の見逃しが 1 割以下', T.maybe - T.maybeHit <= T.maybe * 0.1, pct(T.maybeHit, T.maybe));
ok('「確実」の誤検出が 10 組以下', T.fpSure <= 10, ITEMS.filter((k) => stat[k].fpSure).map((k) => k + ':' + stat[k].fpSure));
ok('「要確認」の誤検出が 含まない の 1% 以下', T.fpMaybe <= T.no * 0.01, pct(T.fpMaybe, T.no));
['もも', 'いか', 'えび', 'かに', 'ごま', '乳', '牛肉', '鶏肉', 'そば', 'さば'].forEach((k) => ok(k + ' の「確実」の誤検出が 0', stat[k].fpSure === 0, stat[k].fpS.slice(0, 8)));
console.log('\n' + (n - bad) + '/' + n + ' 通過' + (bad ? '  ★ 失敗 ' + bad + ' 件' : ''));
process.exit(bad ? 1 : 0);
