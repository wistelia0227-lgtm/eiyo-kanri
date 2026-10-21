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
  // 返り: { rows, added, updated, removed, kept, merged, notes }
  //   利用者（residents）は 1 件まるごとの勝ち負けにせず、中身を混ぜる（S.mergeResident）。opts.meals = 食事の並び
  S.mergeStore = function (store, mine, theirs, tombs, opts) {
    const kp = S.KEYPATH[store] || 'id';
    const map = Object.create(null), side = Object.create(null);
    (mine || []).forEach((r) => { const k = String(r[kp]); map[k] = r; side[k] = 'mine'; });
    let added = 0, updated = 0, merged = 0;
    const notes = [];
    (theirs || []).forEach((r) => {
      const k = String(r[kp]);
      if (!(k in map)) { map[k] = r; side[k] = 'added'; added++; if (store === 'residents') notes.push(nameOf(r) + ': 相手のパソコンから足した'); return; }
      if (store === 'residents' && S.at(map[k]) !== S.at(r)) {
        const m = S.mergeResident(map[k], r, opts && opts.meals);
        if (m.rec !== map[k]) {
          if (side[k] === 'mine') updated++;
          if (m.rec !== r) merged++;
          map[k] = m.rec; side[k] = 'updated';
          notes.push(nameOf(m.rec) + ': ' + (m.notes.length ? m.notes.join('・') : '新しいほうにした'));
        }
        return;
      }
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
    return { rows: rows, added: added, updated: updated, removed: removed, kept: rows.length, merged: merged, notes: notes };
  };

  // ---- 利用者 1 件の中身を混ぜる ----
  // 同じ利用者を 2 台で別々に直した時、1 件まるごと新しいほうを採ると、古いほうで足した
  // 食事の版・在籍・欠食が消える。そこで:
  //   - 名前・部屋などの項目は新しいほう（_at）を採る
  //   - diet（食事の版）・stays（在籍）・absences（欠食）は id ごとに両方を残す。同じ id は、
  //     最後に動いた（記録・変更・取り消し）ほうを採り、取り消しの印と変更の履歴は両方から残す
  //   - アレルギー・禁食は両方の和を残す: 片方で足した物は、もう片方の後から効く版にも入れる。
  //     消すのは、版に「外した」印（removed）がある時だけ
  //   - 混ぜた結果が両方と違う時は _at を 1 進める（どちらのパソコンにも書き戻させる）
  // 結果は入力の順に依らない（どちらのパソコンで合わせても同じになる）
  S.LISTS = ['diet', 'stays', 'absences'];
  const nameOf = (r) => (r && r.name) || (r && r.id) || '';
  const clone = (o) => JSON.parse(JSON.stringify(o));
  const lastAct = (e) => Math.max(e.recordedAt || 0, e.cancelledAt || 0, ...((e.changes || []).map((c) => c.at || 0)));
  const DEFAULT_MEALS = ['b', 'l', 's', 'd'];
  function slotKey(p, meals) {
    if (!p || !p.d) return '9999-99-99:9';
    const order = (meals && meals.length) ? meals.map((m) => m.id) : DEFAULT_MEALS;
    const i = order.indexOf(p.m);
    return p.d + ':' + (i < 0 ? 0 : i);
  }
  // v が u より後から効く（u を上書きする）か
  function supersedes(v, u, meals) {
    const kv = slotKey(v.from, meals), ku = slotKey(u.from, meals);
    return kv > ku || (kv === ku && ((v.recordedAt || 0) > (u.recordedAt || 0) || ((v.recordedAt || 0) === (u.recordedAt || 0) && v.id > u.id)));
  }
  const algOf = (d) => ((d && d.allergy) || []).slice();
  const kinOf = (d) => ((d && d.kinshi) || []).map((k) => k.food);
  // 同じ id の要素どうし。diet の版はアレルギー・禁食を和にして、外した印のある物だけ外す
  function mergeElem(x, y, list) {
    if (JSON.stringify(x) === JSON.stringify(y)) return x;
    const ax = lastAct(x), ay = lastAct(y);
    const w = ay > ax ? y : ax > ay ? x : (JSON.stringify(y) > JSON.stringify(x) ? y : x);
    const o = clone(w), other = w === x ? y : x;
    if (!o.cancelledAt && other.cancelledAt) { o.cancelledAt = other.cancelledAt; o.cancelledBy = other.cancelledBy; }
    if (x.changes || y.changes) {
      const seen = Object.create(null);
      o.changes = (x.changes || []).concat(y.changes || []).filter((c) => { const k = JSON.stringify(c); if (seen[k]) return false; seen[k] = 1; return true; })
        .sort((a, b) => (a.at || 0) - (b.at || 0) || (JSON.stringify(a) < JSON.stringify(b) ? -1 : 1));
    }
    if (list === 'diet' && x.data && y.data) {
      const carried = (x.carried || []).concat(y.carried || []);
      const seen = Object.create(null);
      o.carried = carried.filter((c) => { const k = JSON.stringify(c); if (seen[k]) return false; seen[k] = 1; return true; })
        .sort((a, b) => (JSON.stringify(a) < JSON.stringify(b) ? -1 : 1));
      if (!o.carried.length) delete o.carried;
      const gone = Object.create(null);
      (o.carried || []).forEach((c) => (c.removed || []).forEach((wd) => { gone[wd] = 1; }));
      o.data.allergy = unionList(algOf(x.data), algOf(y.data)).filter((a) => !gone[a]);
      o.data.kinshi = unionKinshi(x.data.kinshi || [], y.data.kinshi || []).filter((k) => !gone[k.food]);
    }
    return o;
  }
  function unionList(a, b) { const out = a.slice(); b.forEach((v) => { if (out.indexOf(v) < 0) out.push(v); }); return out; }
  function unionKinshi(a, b) { const out = a.map((k) => Object.assign({}, k)); b.forEach((k) => { if (!out.some((o) => o.food === k.food)) out.push(Object.assign({}, k)); }); return out; }
  // その側の並びで、u の 1 つ前の版（u が足した物・外した物を出すため）
  function prevIn(list, u, meals) {
    let best = null;
    list.forEach((v) => {
      if (v === u || v.cancelledAt || !supersedes(u, v, meals)) return;
      if (!best || supersedes(v, best, meals)) best = v;
    });
    return best;
  }
  S.mergeResident = function (a, b, meals) {
    const win = S.newer(a, b) > 0 ? b : a;
    const out = clone(win), notes = [];
    S.LISTS.forEach((k) => {
      if (!Array.isArray(a[k]) && !Array.isArray(b[k])) return;
      const la = a[k] || [], lb = b[k] || [];
      const ma = Object.create(null), mb = Object.create(null);
      la.forEach((e) => { ma[e.id] = e; }); lb.forEach((e) => { mb[e.id] = e; });
      const ids = Object.keys(ma).concat(Object.keys(mb).filter((id) => !(id in ma)));
      const winner = win === a ? ma : mb;
      const fromLoser = ids.filter((id) => !(id in winner)).length;
      out[k] = ids.map((id) => (id in ma && id in mb) ? mergeElem(ma[id], mb[id], k) : clone(ma[id] || mb[id]))
        .sort((p, q) => (p.recordedAt || 0) - (q.recordedAt || 0) || (p.id < q.id ? -1 : p.id > q.id ? 1 : 0));
      if (fromLoser) notes.push({ diet: '食事の版', stays: '在籍', absences: '欠食' }[k] + ' ' + fromLoser + ' 件を混ぜた');
    });
    // アレルギー・禁食: 片方にしか無い版 u が足した物（外した印の物）を、もう片方にしか無い後から効く版 v に入れる
    if (Array.isArray(out.diet) && Array.isArray(a.diet) && Array.isArray(b.diet)) {
      const ia = Object.create(null), ib = Object.create(null);
      a.diet.forEach((e) => { ia[e.id] = e; }); b.diet.forEach((e) => { ib[e.id] = e; });
      const onlyA = a.diet.filter((e) => !(e.id in ib) && !e.cancelledAt), onlyB = b.diet.filter((e) => !(e.id in ia) && !e.cancelledAt);
      const byId = Object.create(null);
      out.diet.forEach((e) => { byId[e.id] = e; });
      const told = [];
      [[onlyA, a.diet, onlyB, b.diet], [onlyB, b.diet, onlyA, a.diet]].forEach((pair) => {
        pair[0].slice().sort((p, q) => (p.id < q.id ? -1 : 1)).forEach((u) => {
          const p = prevIn(pair[1], u, meals);
          const addA = algOf(u.data).filter((x) => algOf(p && p.data).indexOf(x) < 0);
          const addK = (u.data.kinshi || []).filter((kk) => kinOf(p && p.data).indexOf(kk.food) < 0);
          const rm = ((u.removed && u.removed.allergy) || []).concat((u.removed && u.removed.kinshi) || []);
          if (!addA.length && !addK.length && !rm.length) return;
          pair[2].forEach((v0) => {
            if (!supersedes(v0, u, meals)) return;
            const v = byId[v0.id];
            const own = prevIn(pair[3], v0, meals);   // v が自分で足した物は外さない
            const vAdds = algOf(v0.data).filter((x) => algOf(own && own.data).indexOf(x) < 0).concat(
              (v0.data.kinshi || []).filter((kk) => kinOf(own && own.data).indexOf(kk.food) < 0).map((kk) => kk.food));
            const vRm = ((v0.removed && v0.removed.allergy) || []).concat((v0.removed && v0.removed.kinshi) || []);
            const putA = addA.filter((x) => v.data.allergy.indexOf(x) < 0 && vRm.indexOf(x) < 0);
            const putK = addK.filter((kk) => !v.data.kinshi.some((o) => o.food === kk.food) && vRm.indexOf(kk.food) < 0);
            const drop = rm.filter((x) => vAdds.indexOf(x) < 0 && (v.data.allergy.indexOf(x) >= 0 || v.data.kinshi.some((o) => o.food === x)));
            if (!putA.length && !putK.length && !drop.length) return;
            v.data.allergy = v.data.allergy.concat(putA).filter((x) => drop.indexOf(x) < 0);
            v.data.kinshi = v.data.kinshi.concat(putK.map((kk) => Object.assign({}, kk))).filter((kk) => drop.indexOf(kk.food) < 0);
            const c = { from: u.id };
            if (putA.length || putK.length) c.added = putA.concat(putK.map((kk) => kk.food));
            if (drop.length) c.removed = drop;
            v.carried = (v.carried || []).concat([c]).sort((p2, q2) => (JSON.stringify(p2) < JSON.stringify(q2) ? -1 : 1));
            if (c.added) told.push('アレルギー・禁食の ' + c.added.join('、') + ' を後から効く食事情報にも残した');
            if (c.removed) told.push(c.removed.join('、') + ' を外した印どおり外した');
          });
        });
      });
      told.forEach((t) => { if (notes.indexOf(t) < 0) notes.push(t); });
    }
    if (JSON.stringify(out) === JSON.stringify(win)) return { rec: win, notes: [] };
    const other = win === a ? b : a;
    if (JSON.stringify(out) === JSON.stringify(other)) return { rec: other, notes: [] };
    out._at = Math.max(S.at(a), S.at(b)) + 1;
    out._by = S.by(a) > S.by(b) ? S.by(a) : S.by(b);
    return { rec: out, notes: notes };
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
  // 返り: { stores, tomb, stats: {store: {added,updated,removed,kept,merged}}, added, updated, removed, merged, changed,
  //        notes: ['山田 ハナ: 欠食 1 件を混ぜた・…'] }。opts.meals = 食事の並び（版の前後を決める）
  S.merge = function (local, remote, now, opts) {
    S.check(local); S.check(remote);
    const tomb = S.pruneTomb(S.mergeTomb(local.tomb, remote.tomb), now);
    const stores = {}, stats = {}, notes = [];
    let added = 0, updated = 0, removed = 0, merged = 0;
    S.STORES.forEach((s) => {
      const r = S.mergeStore(s, local.stores[s] || [], remote.stores[s] || [], tomb, opts);
      stores[s] = r.rows; stats[s] = r;
      added += r.added; updated += r.updated; removed += r.removed; merged += r.merged || 0;
      (r.notes || []).forEach((x) => notes.push(x));
    });
    return { stores: stores, tomb: tomb, stats: stats, added: added, updated: updated, removed: removed, merged: merged,
      notes: notes, changed: added + updated + removed + merged > 0 };
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
    if (res.merged) p.push('両方の変更を混ぜた ' + res.merged + ' 件');
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
