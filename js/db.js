// IndexedDB の薄いラッパ。window.DB で公開。
// ストア: residents(利用者=食事情報の版・在籍・欠食を内包) / measures(体重などの測定値) / rounds(ミールラウンド)
//         / daily(日ごとの手入力=職員食など) / meta(設定・マスタ) / tomb(消した記録の跡)
// スキーマを変える時は既存ストアに触らず、version を上げて新ストアを足す。
// 書くたびに、記録へ _at(時刻) と _by(このパソコンの印) を付ける。複数のパソコンで使う時の
// 突き合わせ（js/sync.js）が「どちらが新しいか」を決めるのに要る。消した時は tomb に跡を残す。
(function () {
  'use strict';
  const DB = { name: 'eiyo_kanri_db', version: 6 };
  const q = location.search;
  if (/[?&]selftest/.test(q)) DB.name = 'eiyo_kanri_selftest';
  else if (/[?&]demo/.test(q)) DB.name = 'eiyo_kanri_demo';
  let dbp = null;

  function open() {
    if (dbp) return dbp;
    dbp = new Promise((resolve, reject) => {
      if (!window.indexedDB) return reject(new Error('このブラウザは保存機能(IndexedDB)に対応していません'));
      const req = indexedDB.open(DB.name, DB.version);
      req.onupgradeneeded = () => {
        const db = req.result;
        const mk = (name, opt, idx) => {
          if (db.objectStoreNames.contains(name)) return;
          const s = db.createObjectStore(name, opt);
          (idx || []).forEach((i) => s.createIndex(i, i));
        };
        mk('residents', { keyPath: 'id' });
        mk('measures', { keyPath: 'id' }, ['residentId']);
        mk('rounds', { keyPath: 'id' }, ['residentId', 'date']);
        mk('daily', { keyPath: 'date' });
        mk('dishes', { keyPath: 'id' });
        mk('menus', { keyPath: 'date' });
        mk('ncm', { keyPath: 'id' }, ['residentId', 'date']);
        mk('plans', { keyPath: 'id' }, ['residentId']);
        mk('stock', { keyPath: 'id' }, ['date', 'no']);   // 検収と在庫の出入り（modules/stock.js）
        mk('meta', { keyPath: 'key' });
        mk('tomb', { keyPath: 'k' });   // 消した記録の跡 { k:'store\u0000id', store, id, at, by }
        mk('local', { keyPath: 'key' }); // このパソコンだけのもの（共有ファイルの場所など）。書き出しに入れない
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error || new Error('データベースを開けません'));
    });
    return dbp;
  }

  function run(store, mode, fn) {
    return open().then((db) => new Promise((resolve, reject) => {
      const tx = db.transaction(store, mode);
      const req = fn(tx.objectStore(store));
      let result;
      if (req) req.onsuccess = () => { result = req.result; };
      tx.oncomplete = () => resolve(result);
      tx.onerror = tx.onabort = () => reject(tx.error || new Error('保存に失敗しました'));
    }));
  }

  DB.STORES = ['residents', 'measures', 'rounds', 'daily', 'dishes', 'menus', 'ncm', 'plans', 'stock', 'meta'];

  // このパソコン（このブラウザ）の印。IndexedDB でなく localStorage に置く＝突き合わせで運ばれない
  DB.device = function () {
    let id = '';
    try { id = localStorage.getItem('eiyo_device') || ''; } catch (e) { id = ''; }
    if (!id) {
      id = 'pc' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
      try { localStorage.setItem('eiyo_device', id); } catch (e) { /* 使えなくても動く */ }
    }
    return id;
  };
  DB.deviceName = function (name) {
    try {
      if (name !== undefined) { localStorage.setItem('eiyo_device_name', name); return name; }
      return localStorage.getItem('eiyo_device_name') || '';
    } catch (e) { return ''; }
  };
  DB.touched = 0;   // 最後に何か書いた時刻（共有ファイルへ書き戻す合図。modules/share.js が見る）
  function stamp(o) { if (o && typeof o === 'object') { o._at = Date.now(); o._by = DB.device(); DB.touched = o._at; } return o; }
  const tombKey = (store, id) => store + '\u0000' + id;

  DB.getAll = (store) => run(store, 'readonly', (s) => s.getAll());
  DB.get = (store, id) => run(store, 'readonly', (s) => s.get(id));
  DB.put = (store, obj) => run(store, 'readwrite', (s) => s.put(stamp(obj)));
  DB.putMany = (store, list) => run(store, 'readwrite', (s) => { list.forEach((o) => s.put(stamp(o))); });
  // 印を付け直さずに書く（ファイルから取り込む時。取り込んだ記録の時刻は相手のものを保つ）
  DB.putRaw = (store, list) => run(store, 'readwrite', (s) => { list.forEach((o) => s.put(o)); });
  DB.del = async function (store, id) {
    await run(store, 'readwrite', (s) => s.delete(id));
    DB.touched = Date.now();
    await run('tomb', 'readwrite', (s) => s.put({ k: tombKey(store, id), store: store, id: id, at: DB.touched, by: DB.device() }));
  };
  // 中身を消すと、そのストアの「消した跡」も要らなくなる（全部消したのだから）
  DB.clear = async function (store) {
    await run(store, 'readwrite', (s) => s.clear());
    const rest = (await DB.tomb()).filter((t) => t.store !== store);
    await run('tomb', 'readwrite', (s) => s.clear());
    if (rest.length) await run('tomb', 'readwrite', (s) => { rest.forEach((t) => s.put(t)); });
  };
  DB.tomb = () => run('tomb', 'readonly', (s) => s.getAll());
  DB.setTomb = async function (list) {
    await run('tomb', 'readwrite', (s) => s.clear());
    await run('tomb', 'readwrite', (s) => { list.forEach((t) => s.put({ k: tombKey(t.store, t.id), store: t.store, id: t.id, at: t.at, by: t.by })); });
  };
  // このパソコンだけの覚え書き（共有ファイルの置き場所など）。書き出しにも突き合わせにも入らない
  DB.getLocal = async function (key, dflt) { const rec = await run('local', 'readonly', (s) => s.get(key)); return rec ? rec.value : dflt; };
  DB.setLocal = (key, value) => run('local', 'readwrite', (s) => s.put({ key: key, value: value }));
  DB.delLocal = (key) => run('local', 'readwrite', (s) => s.delete(key));

  DB.byIndex = (store, index, value) => run(store, 'readonly', (s) => s.index(index).getAll(value));
  DB.getMeta = async function (key, dflt) { const rec = await DB.get('meta', key); return rec ? rec.value : dflt; };
  DB.setMeta = (key, value) => DB.put('meta', { key: key, value: value });

  DB.residents = async function () { return (await DB.getAll('residents')).map(window.Model.normalizeResident); };

  // バックアップ / 共有ファイル: 全ストアを 1 つの JSON に
  DB.exportAll = async function () {
    const stores = {};
    for (const s of DB.STORES) stores[s] = await DB.getAll(s);
    const tomb = (await DB.tomb()).map((t) => ({ store: t.store, id: t.id, at: t.at, by: t.by }));
    return window.Sync.pack(stores, tomb, DB.deviceName() || DB.device());
  };
  // 丸ごと置き換える（ファイルから戻す）。取り込んだ記録の時刻は書き換えない
  DB.importAll = async function (data) {
    if (!data || data.app !== 'eiyo-kanri' || !data.stores) throw new Error('このアプリのバックアップではありません');
    for (const s of DB.STORES) { await DB.clear(s); if (data.stores[s]) await DB.putRaw(s, data.stores[s]); }
    await DB.setTomb(data.tomb || []);
  };
  // 突き合わせの結果を書き戻す
  DB.applyMerge = async function (res) {
    for (const s of DB.STORES) { await DB.clear(s); await DB.putRaw(s, res.stores[s] || []); }
    await DB.setTomb(res.tomb || []);
  };
  // まだ印の無い記録に、いま印を付ける（共有を始める時の 1 回だけ）
  DB.stampAll = async function () {
    const at = Date.now(), by = DB.device();
    let n = 0;
    for (const s of DB.STORES) {
      const rows = await DB.getAll(s);
      const need = rows.filter((r) => typeof r._at !== 'number');
      if (!need.length) continue;
      need.forEach((r) => { r._at = at; r._by = by; });
      await DB.putRaw(s, need);
      n += need.length;
    }
    return n;
  };

  window.DB = DB;
})();
