// 複数のパソコンで同じデータを使うための突き合わせ。DOM にも DB にも触れない（Node で試験できる）。window.Sync で公開。
// 何のためか: ブラウザの保存領域(IndexedDB)はパソコンごと・ブラウザごとに別。共有フォルダに置いた
//   アプリを開いても、中身は共有されない。そこで「共有フォルダの 1 ファイル」を待ち合わせ場所にする。
// 考え方:
//   - 記録 1 件ごとに、最後に書いた時刻 _at と、書いたパソコンの印 _by を付ける（付けるのは js/db.js）
//   - 消した記録は消えた跡（tomb）を残す。跡が無いと、相手側の古い記録が毎回よみがえる
//   - 突き合わせは「同じ鍵の記録どうしで、_at が新しいほうを採る」だけ。_at が同じ時は _by の大きいほうを採る
//     （どちらのパソコンから見ても同じ答えになるように。先着順にすると 2 台で結果が食い違う）
//   - 跡（tomb）は、その鍵の記録の _at 以上なら消したものとして扱う
// 出来ないこと: 同じ記録を 2 台で同時に直した時、片方は消える。1 件まるごと単位でしか勝ち負けを決めない。
//   だから突き合わせの結果は必ず件数で見せる（黙って書き換えない）。
(function (root) {
  'use strict';
  const S = {};

  S.FORMAT = 2;            // 1 = 旧バックアップ（_at も tomb も無い）
  S.TOMB_KEEP_DAYS = 180;  // 消えた跡を持っておく日数

  // ストアごとの鍵。js/db.js の keyPath と合わせる
  S.KEYPATH = { residents: 'id', measures: 'id', rounds: 'id', daily: 'date', dishes: 'id',
    menus: 'date', ncm: 'id', plans: 'id', stock: 'id', meta: 'key' };
  S.STORES = Object.keys(S.KEYPATH);

  S.at = (rec) => (rec && typeof rec._at === 'number') ? rec._at : 0;
  S.by = (rec) => (rec && rec._by) ? String(rec._by) : '';

  // どちらが新しいか。1 = b が新しい / -1 = a が新しい / 0 = 同じ
  S.newer = function (a, b) {
    const ta = S.at(a), tb = S.at(b);
    if (tb !== ta) return tb > ta ? 1 : -1;
    const ba = S.by(a), bb = S.by(b);
    if (bb !== ba) return bb > ba ? 1 : -1;
    return 0;
  };

  // 1 ストアぶんの突き合わせ。
  //   mine/theirs: 記録の配列 / tombs: [{store,id,at,by}] （両方ぶんを混ぜて渡してよい）
  // 返り: { rows, added, updated, removed, kept }
  S.mergeStore = function (store, mine, theirs, tombs) {
    const kp = S.KEYPATH[store] || 'id';
    const map = Object.create(null), side = Object.create(null);
    (mine || []).forEach((r) => { const k = String(r[kp]); map[k] = r; side[k] = 'mine'; });
    let added = 0, updated = 0;
    (theirs || []).forEach((r) => {
      const k = String(r[kp]);
      if (!(k in map)) { map[k] = r; side[k] = 'added'; added++; return; }
      if (S.newer(map[k], r) > 0) { map[k] = r; if (side[k] === 'mine') updated++; side[k] = 'updated'; }
    });
    let removed = 0;
    (tombs || []).forEach((t) => {
      if (t.store !== store) return;
      const k = String(t.id);
      if (!(k in map)) return;
      // 跡のほうが新しければ消えたまま。同時刻なら「消した」を採る（消し直す手間を無くす）
      if ((t.at || 0) >= S.at(map[k])) { if (side[k] !== 'added') removed++; delete map[k]; delete side[k]; }
    });
    const rows = Object.keys(map).map((k) => map[k]);
    return { rows: rows, added: added, updated: updated, removed: removed, kept: rows.length };
  };

  // 消えた跡どうしを混ぜる。同じ (store,id) は新しいほうだけ残す
  S.mergeTomb = function (a, b) {
    const map = Object.create(null);
    (a || []).concat(b || []).forEach((t) => {
      if (!t || !t.store || t.id == null) return;
      const k = t.store + '\u0000' + t.id;
      if (!map[k] || (t.at || 0) > (map[k].at || 0)) map[k] = t;
    });
    return Object.keys(map).map((k) => map[k]);
  };

  // 期限切れの跡を捨てる。捨てた跡の記録は二度とよみがえらない前提（両方が取り込み済みのはず）
  S.pruneTomb = function (tombs, now, days) {
    const limit = (now || Date.now()) - (days == null ? S.TOMB_KEEP_DAYS : days) * 86400000;
    return (tombs || []).filter((t) => (t.at || 0) >= limit);
  };

  // 共有ファイルの中身を組み立てる
  S.pack = function (stores, tombs, device, now) {
    return { app: 'eiyo-kanri', format: S.FORMAT, exportedAt: new Date(now || Date.now()).toISOString(),
      device: device || '', savedAt: now || Date.now(), stores: stores || {}, tomb: tombs || [] };
  };

  S.check = function (data) {
    if (!data || data.app !== 'eiyo-kanri' || !data.stores) throw new Error('このアプリのファイルではありません');
    return data;
  };

  // 中身の要約（人に見せる用）
  S.summary = function (data) {
    S.check(data);
    const out = { savedAt: data.savedAt || 0, device: data.device || '', counts: {}, total: 0 };
    S.STORES.forEach((s) => { const n = (data.stores[s] || []).length; out.counts[s] = n; out.total += n; });
    return out;
  };

  // 全部の突き合わせ。local/remote はどちらも pack と同じ形
  // 返り: { stores, tomb, stats: {store: {added,updated,removed,kept}}, added, updated, removed, changed }
  S.merge = function (local, remote, now) {
    S.check(local); S.check(remote);
    const tomb = S.pruneTomb(S.mergeTomb(local.tomb, remote.tomb), now);
    const stores = {}, stats = {};
    let added = 0, updated = 0, removed = 0;
    S.STORES.forEach((s) => {
      const r = S.mergeStore(s, local.stores[s] || [], remote.stores[s] || [], tomb);
      stores[s] = r.rows; stats[s] = r;
      added += r.added; updated += r.updated; removed += r.removed;
    });
    return { stores: stores, tomb: tomb, stats: stats, added: added, updated: updated, removed: removed,
      changed: added + updated + removed > 0 };
  };

  // 突き合わせた結果が、こちらの手持ちと違うか（＝書き戻しが要るか）。
  // 件数が同じでも中身が入れ替わっていることがあるので、鍵と _at で見る
  S.differs = function (localStores, mergedStores) {
    return S.STORES.some((s) => {
      const kp = S.KEYPATH[s] || 'id';
      const a = localStores[s] || [], b = mergedStores[s] || [];
      if (a.length !== b.length) return true;
      const m = Object.create(null);
      a.forEach((r) => { m[String(r[kp])] = S.at(r); });
      return b.some((r) => { const k = String(r[kp]); return !(k in m) || m[k] !== S.at(r); });
    });
  };

  // 突き合わせの結果を 1 行で
  S.words = function (res) {
    if (!res.changed) return '変わりはありませんでした';
    const p = [];
    if (res.added) p.push('足した ' + res.added + ' 件');
    if (res.updated) p.push('新しくした ' + res.updated + ' 件');
    if (res.removed) p.push('消した ' + res.removed + ' 件');
    return p.join('・');
  };

  // どのストアで何が動いたか（多い順）
  S.detail = function (res) {
    return S.STORES.map((s) => Object.assign({ store: s }, res.stats[s]))
      .filter((x) => x.added || x.updated || x.removed)
      .sort((a, b) => (b.added + b.updated + b.removed) - (a.added + a.updated + a.removed));
  };

  S.STORE_LABEL = { residents: '利用者', measures: '測定値', rounds: 'ミールラウンド', daily: '日ごとの記録',
    dishes: '料理', menus: '献立', ncm: '栄養スクリーニング', plans: '栄養ケア計画', stock: '検収・在庫', meta: '設定' };

  // 旧いバックアップ（format 1）を突き合わせできる形にする。_at が無いので、指定の時刻で一律に印を付ける
  S.upgrade = function (data, at, by) {
    S.check(data);
    const stores = {};
    S.STORES.forEach((s) => {
      stores[s] = (data.stores[s] || []).map((r) => {
        if (typeof r._at === 'number') return r;
        const c = Object.assign({}, r); c._at = at; c._by = by || ''; return c;
      });
    });
    return { app: 'eiyo-kanri', format: S.FORMAT, exportedAt: data.exportedAt, device: data.device || by || '',
      savedAt: data.savedAt || at, stores: stores, tomb: data.tomb || [] };
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = S;
  root.Sync = S;
})(typeof window !== 'undefined' ? window : globalThis);
