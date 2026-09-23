// IndexedDB の薄いラッパ。window.DB で公開。
// ストア: residents(利用者=食事情報の版・在籍・欠食を内包) / measures(体重などの測定値) / rounds(ミールラウンド)
//         / daily(日ごとの手入力=職員食など) / meta(設定・マスタ)
// スキーマを変える時は既存ストアに触らず、version を上げて新ストアを足す。
(function () {
  'use strict';
  const DB = { name: 'eiyo_kanri_db', version: 5 };
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
  DB.getAll = (store) => run(store, 'readonly', (s) => s.getAll());
  DB.get = (store, id) => run(store, 'readonly', (s) => s.get(id));
  DB.put = (store, obj) => run(store, 'readwrite', (s) => s.put(obj));
  DB.putMany = (store, list) => run(store, 'readwrite', (s) => { list.forEach((o) => s.put(o)); });
  DB.del = (store, id) => run(store, 'readwrite', (s) => s.delete(id));
  DB.clear = (store) => run(store, 'readwrite', (s) => s.clear());
  DB.byIndex = (store, index, value) => run(store, 'readonly', (s) => s.index(index).getAll(value));
  DB.getMeta = async function (key, dflt) { const rec = await DB.get('meta', key); return rec ? rec.value : dflt; };
  DB.setMeta = (key, value) => DB.put('meta', { key: key, value: value });

  DB.residents = async function () { return (await DB.getAll('residents')).map(window.Model.normalizeResident); };

  // バックアップ: 全ストアを 1 つの JSON に
  DB.exportAll = async function () {
    const out = { app: 'eiyo-kanri', format: 1, exportedAt: new Date().toISOString(), stores: {} };
    for (const s of DB.STORES) out.stores[s] = await DB.getAll(s);
    return out;
  };
  DB.importAll = async function (data) {
    if (!data || data.app !== 'eiyo-kanri' || !data.stores) throw new Error('このアプリのバックアップではありません');
    for (const s of DB.STORES) { await DB.clear(s); if (data.stores[s]) await DB.putMany(s, data.stores[s]); }
  };

  window.DB = DB;
})();
