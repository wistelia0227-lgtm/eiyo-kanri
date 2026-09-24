// 複数のパソコンで使う時の突き合わせの試験。C:/AI/_setup/node/node.exe tools/test_sync.js
'use strict';
global.window = global;
const S = require('../js/sync.js');
let n = 0, bad = 0;
function ok(name, cond, extra) { n++; if (!cond) { bad++; console.log('NG  ' + name + (extra !== undefined ? '  → ' + JSON.stringify(extra) : '')); } else console.log('ok  ' + name); }

const T = 1700000000000;
// 時刻は実際の値に近づける（消した跡は 180 日で捨てられるので、小さい数だと試験が本物と違う動きになる）
const r = (id, at, by, extra) => Object.assign({ id: id, _at: T + at, _by: by || 'a' }, extra || {});
const pack = (stores, tomb) => S.pack(stores, tomb || [], 'test', T);

// ---- 新しいほうが勝つ ----
ok('新しいほうが勝つ', S.newer(r('x', 100), r('x', 200)) === 1);
ok('古いほうは負ける', S.newer(r('x', 300), r('x', 200)) === -1);
ok('同じ時刻は印の大きいほうが勝つ', S.newer(r('x', 100, 'aaa'), r('x', 100, 'bbb')) === 1);
ok('同じ時刻・同じ印は引き分け', S.newer(r('x', 100, 'aaa'), r('x', 100, 'aaa')) === 0);
ok('どちらから見ても同じ答えになる', (function () {
  const a = r('x', 100, 'zzz'), b = r('x', 100, 'aaa');
  return S.newer(a, b) === -S.newer(b, a);
})());
ok('印の無い記録は一番古い扱い', S.newer(r('x', 0), { id: 'x' }) === -1, [S.at({ id: 'x' })]);

// ---- 1 ストアの突き合わせ ----
(function () {
  const mine = [r('a', 100), r('b', 100)];
  const theirs = [r('b', 200, 'b'), r('c', 150, 'b')];
  const res = S.mergeStore('residents', mine, theirs, []);
  const byId = {}; res.rows.forEach((x) => { byId[x.id] = x; });
  ok('相手にしか無い記録が足される', res.added === 1 && !!byId.c);
  ok('相手のほうが新しい記録で置き換わる', res.updated === 1 && byId.b._at === T + 200);
  ok('こちらにしか無い記録は消えない', !!byId.a);
  ok('全部で 3 件', res.rows.length === 3, res.rows.map((x) => x.id));
})();

// ---- 消した跡 ----
(function () {
  const mine = [r('a', 100)];
  const theirs = [r('a', 100)];
  const res = S.mergeStore('residents', mine, theirs, [{ store: 'residents', id: 'a', at: T + 150, by: 'b' }]);
  ok('相手が消した記録は消えたまま', res.rows.length === 0 && res.removed === 1);
})();
(function () {
  // 消したあとに、もう一度同じ ID で作り直した場合（跡より新しい）
  const res = S.mergeStore('residents', [r('a', 300)], [], [{ store: 'residents', id: 'a', at: T + 150 }]);
  ok('跡より新しく作り直した記録は残る', res.rows.length === 1 && res.removed === 0);
})();
(function () {
  const res = S.mergeStore('dishes', [r('a', 100)], [], [{ store: 'residents', id: 'a', at: T + 999 }]);
  ok('跡はストアをまたがない', res.rows.length === 1, res.rows);
})();

// ---- 跡そのものの突き合わせ ----
(function () {
  const t = S.mergeTomb([{ store: 'residents', id: 'a', at: T + 100 }], [{ store: 'residents', id: 'a', at: T + 200 }, { store: 'dishes', id: 'b', at: T + 50 }]);
  ok('同じ跡は 1 つにまとまる', t.length === 2, t);
  ok('まとまった跡は新しいほうの時刻', t.filter((x) => x.id === 'a')[0].at === T + 200);
  ok('古い跡は捨てられる', S.pruneTomb([{ store: 'x', id: 'y', at: T - 300 * 86400000 }], T).length === 0);
  ok('新しい跡は残る', S.pruneTomb([{ store: 'x', id: 'y', at: T - 10 * 86400000 }], T).length === 1);
})();

// ---- 全体 ----
(function () {
  const local = pack({ residents: [r('r1', 100), r('r2', 100)], dishes: [r('d1', 100)] });
  const remote = pack({ residents: [r('r2', 500, 'b'), r('r3', 300, 'b')], menus: [{ date: '2026-01-05', _at: T + 400, _by: 'b' }] },
    [{ store: 'dishes', id: 'd1', at: T + 600, by: 'b' }]);
  const res = S.merge(local, remote, T);
  ok('足した 2 件', res.added === 2, res.added);
  ok('新しくした 1 件', res.updated === 1, res.updated);
  ok('消した 1 件', res.removed === 1, res.removed);
  ok('利用者は 3 人', res.stores.residents.length === 3);
  ok('料理は 0 件（相手が消した）', res.stores.dishes.length === 0);
  ok('献立の鍵は date で扱える', res.stores.menus.length === 1 && res.stores.menus[0].date === '2026-01-05');
  ok('文にできる', S.words(res) === '足した 2 件・新しくした 1 件・消した 1 件', S.words(res));
  ok('動いたストアだけ挙がる', S.detail(res).map((x) => x.store).sort().join(',') === 'dishes,menus,residents', S.detail(res).map((x) => x.store));
  ok('こちらと結果が違う＝書き戻しが要る', S.differs(local.stores, res.stores));
  ok('相手とも違う＝相手にも書く', S.differs(remote.stores, res.stores));
})();

// ---- 何も変わらない時 ----
(function () {
  const same = { residents: [r('r1', 100)] };
  const res = S.merge(pack(same), pack({ residents: [r('r1', 100)] }), T);
  ok('同じ内容どうしは何も動かない', !res.changed, [res.added, res.updated, res.removed]);
  ok('同じ内容なら書き戻しも要らない', !S.differs(same, res.stores) && !S.differs({ residents: [r('r1', 100)] }, res.stores));
  ok('変わらない時の言い方', S.words(res) === '変わりはありませんでした', S.words(res));
})();

// ---- 2 回続けてやっても同じ（収束する）----
(function () {
  const a = pack({ residents: [r('r1', 100, 'a'), r('r2', 700, 'a')] }, [{ store: 'dishes', id: 'd9', at: T + 200, by: 'a' }]);
  const b = pack({ residents: [r('r2', 300, 'b'), r('r3', 900, 'b')], dishes: [r('d9', 150, 'b')] });
  const one = S.merge(a, b, T);
  const two = S.merge(S.pack(one.stores, one.tomb, 'a', T), S.pack(one.stores, one.tomb, 'b', T), T);
  ok('2 回目は何も動かない', !two.changed, [two.added, two.updated, two.removed]);
  ok('どちらを local にしても結果は同じ', (function () {
    const x = S.merge(a, b, T), y = S.merge(b, a, T);
    const key = (o) => S.STORES.map((s) => (o.stores[s] || []).map((v) => v[S.KEYPATH[s]] + ':' + v._at).sort().join(',')).join('|');
    return key(x) === key(y);
  })());
})();

// ---- 古いバックアップ（format 1）を取り込む ----
(function () {
  const old = { app: 'eiyo-kanri', format: 1, exportedAt: '2026-01-01T00:00:00.000Z', stores: { residents: [{ id: 'r1', name: '山田' }] } };
  const up = S.upgrade(old, 1000, 'old');
  ok('古い形でも印を付ければ扱える', up.stores.residents[0]._at === 1000 && up.format === S.FORMAT);
  ok('元の記録を書き換えない', old.stores.residents[0]._at === undefined);
  const res = S.merge(pack({ residents: [r('r1', 5000)] }), up, T);
  ok('印を付けた古い記録は、あとから直した記録に負ける', res.stores.residents[0]._at === T + 5000, res.stores.residents[0]);
})();

// ---- 中身の要約 ----
(function () {
  const sm = S.summary(pack({ residents: [r('a', 1), r('b', 1)], dishes: [r('c', 1)] }));
  ok('要約は件数が出る', sm.counts.residents === 2 && sm.counts.dishes === 1 && sm.total === 3, sm);
  let threw = false;
  try { S.check({ app: 'ほかのアプリ' }); } catch (e) { threw = true; }
  ok('よそのファイルは弾く', threw);
})();

// ---- ストアの鍵が js/db.js と合っているか ----
(function () {
  const fs = require('fs'), path = require('path');
  const src = fs.readFileSync(path.join(__dirname, '..', 'js', 'db.js'), 'utf8');
  const stores = (src.match(/DB\.STORES = \[([^\]]*)\]/) || [])[1] || '';
  const list = stores.split(',').map((x) => x.trim().replace(/'/g, '')).filter(Boolean);
  ok('ストアの並びが db.js と一致', list.join(',') === S.STORES.join(','), [list, S.STORES]);
  const bad2 = list.filter((s) => {
    const m = new RegExp("mk\\('" + s + "', \\{ keyPath: '([^']+)'").exec(src);
    return !m || m[1] !== S.KEYPATH[s];
  });
  ok('鍵（keyPath）も db.js と一致', bad2.length === 0, bad2);
  ok('全部のストアに名前が付いている', S.STORES.every((s) => !!S.STORE_LABEL[s]));
})();

console.log((n - bad) + '/' + n + ' 通過' + (bad ? '（NG ' + bad + '）' : ''));
process.exit(bad ? 1 : 0);
