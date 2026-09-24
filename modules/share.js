// 複数のパソコンで同じデータを使う（共有フォルダに置いた 1 つのファイルで待ち合わせる）。
// なぜ要るか: このアプリのデータはブラウザの保存領域(IndexedDB)にある。共有フォルダに置いた index.html を
//   2 台から開いても、中身はパソコンごとに別々で、共有されない。
// やり方: 共有フォルダに置いた JSON ファイル 1 つを「待ち合わせ場所」にして、
//   開いた時・変えた時・相手が書いた時に、こちらの中身と突き合わせる（勝ち負けの決め方は js/sync.js）。
//   ファイルの場所は File System Access API で覚える（一度選べば、次からは選び直さなくてよい）。
//   この API が無いブラウザ（Firefox など）では、書き出し／読み込みを手で押す形に落ちる。
// 気をつけたこと:
//   - 取り込みは「置き換え」ではなく「突き合わせ」。相手にしか無い記録を消さない
//   - 動いた件数を必ず出す。黙って書き換えない
//   - 書き戻す直前にもう一度ファイルの更新時刻を見る。相手が書いていたら、混ぜ直してから書く
(function () {
  'use strict';
  const U = window.U, h = U.h, DB = window.DB, App = window.App, S = window.Sync;
  const Share = {};

  const HAS_FS = typeof window !== 'undefined' && typeof window.showSaveFilePicker === 'function';
  const SUGGEST = '栄養食事管理_共有.json';
  let handle = null;       // FileSystemFileHandle
  let info = null;         // { name, lastSync, remoteAt, auto }
  let timer = null, busy = false, lastPush = 0;

  Share.HAS_FS = HAS_FS;
  Share.info = () => info;
  Share.ready = () => !!(handle && info);

  async function loadState() {
    info = await DB.getLocal('share', null);
    if (info && HAS_FS && !handle) handle = await DB.getLocal('shareHandle', null);
    return info;
  }
  const saveState = () => DB.setLocal('share', info);

  // ---- ファイルの読み書き ----
  async function perm(write) {
    if (!handle) return 'none';
    const mode = { mode: write ? 'readwrite' : 'read' };
    let st = await handle.queryPermission(mode);
    if (st === 'granted') return st;
    return await handle.requestPermission(mode);   // 画面を触った流れの中でしか通らない
  }

  async function readRemote() {
    const file = await handle.getFile();
    const text = (await file.text()).trim();
    const empty = S.pack({}, [], '', 0);
    if (!text) return { data: empty, mtime: file.lastModified, size: 0 };
    let data;
    try { data = JSON.parse(text); } catch (e) { throw new Error('共有ファイルを読めませんでした（中身が壊れています）'); }
    S.check(data);
    if ((data.format || 1) < S.FORMAT) data = S.upgrade(data, data.savedAt || file.lastModified, data.device || '共有ファイル');
    return { data: data, mtime: file.lastModified, size: file.size };
  }

  async function writeRemote(pack) {
    const w = await handle.createWritable();
    await w.write(JSON.stringify(pack));
    await w.close();
    const f = await handle.getFile();
    return f.lastModified;
  }

  // ---- 突き合わせ本体 ----
  // 返り: { ok, res, wrote, words } / つながらない時は { ok:false, why }
  Share.sync = async function (opts) {
    opts = opts || {};
    if (!handle) return { ok: false, why: '共有ファイルが決まっていません' };
    if (busy) return { ok: false, why: 'いま合わせています' };
    busy = true;
    const mark = DB.touched;   // 合わせている間に直した分は、次の回で書き戻す
    try {
      const p = await perm(true);
      if (p !== 'granted') return { ok: false, why: '共有ファイルを使う許しが要ります', needPerm: true };
      let res = null, wrote = false;
      for (let i = 0; i < 3; i++) {
        const remote = await readRemote();
        const local = await DB.exportAll();
        res = S.merge(local, remote.data);
        if (S.differs(local.stores, res.stores)) { await DB.applyMerge(res); await window.Master.load(); }
        if (!S.differs(remote.data.stores, res.stores) && (remote.data.tomb || []).length === res.tomb.length) break;
        // 書く直前にもう一度見る。相手が書いていたら混ぜ直す
        const again = await handle.getFile();
        if (again.lastModified !== remote.mtime) continue;
        const pack = S.pack(res.stores, res.tomb, DB.deviceName() || DB.device());
        info.remoteAt = await writeRemote(pack);
        wrote = true;
        break;
      }
      info.lastSync = Date.now();
      if (!wrote) { const f = await handle.getFile(); info.remoteAt = f.lastModified; }
      info.lastWords = S.words(res) + (wrote ? '・共有ファイルへ書きました' : '');
      await saveState();
      lastPush = mark;
      if (!opts.silent) U.toast(info.lastWords);
      if (res.changed && !opts.noRefresh) App.refresh();
      return { ok: true, res: res, wrote: wrote, words: info.lastWords };
    } catch (e) {
      if (!opts.silent) U.toast(e.message, true);
      return { ok: false, why: e.message };
    } finally { busy = false; }
  };

  // ---- 自動で合わせる ----
  // 20 秒ごとに 1) こちらで何か書いて 5 秒たっていたら書き戻す  2) 相手のファイルの更新時刻が変わっていたら取り込む
  async function tick() {
    if (!handle || !info || !info.auto || busy || document.hidden) return;
    try {
      if (DB.touched && DB.touched !== lastPush && Date.now() - DB.touched > 5000) { await Share.sync({ silent: true }); return; }
      if (await handle.queryPermission({ mode: 'readwrite' }) !== 'granted') return;
      const f = await handle.getFile();
      if (info.remoteAt && f.lastModified === info.remoteAt) return;
      await Share.sync({ silent: true });
    } catch (e) { /* 共有フォルダが切れている時は黙って次の回に */ }
  }

  Share.start = async function () {
    await loadState();
    if (!info) return;
    if (timer) clearInterval(timer);
    timer = setInterval(tick, 20000);
    document.addEventListener('visibilitychange', () => { if (!document.hidden) tick(); });
    if (info.auto && handle && await handle.queryPermission({ mode: 'readwrite' }) === 'granted') await Share.sync({ silent: true });
  };

  // ---- 共有ファイルを決める ----
  async function setHandle(hd, label) {
    handle = hd;
    info = { name: label || hd.name, lastSync: 0, remoteAt: 0, auto: true, lastWords: '' };
    await DB.setLocal('shareHandle', hd);
    await saveState();
  }

  // 最初の 1 回。両方に中身がある時だけ、どうするか聞く
  async function firstJoin() {
    const stamped = await DB.stampAll();
    const remote = await readRemote();
    const mine = S.summary(await DB.exportAll()), theirs = S.summary(remote.data);
    if (mine.total && theirs.total) {
      const pick = await ask(mine, theirs);
      if (pick === null) { handle = null; info = null; await DB.delLocal('shareHandle'); await DB.delLocal('share'); return null; }
      if (pick === 'mine') { await writeRemote(await DB.exportAll()); }
      if (pick === 'theirs') { await DB.importAll(remote.data); await window.Master.load(); }
    }
    const r = await Share.sync({ silent: true, noRefresh: true });
    return { stamped: stamped, sync: r };
  }

  function ask(mine, theirs) {
    return new Promise((resolve) => {
      let close;
      const line = (t, s) => h('div', { class: 'rowline' }, h('span', null, t), h('span', { class: 'sub' }, s));
      close = U.modal(h('div', null,
        h('h2', null, 'どちらの内容から始めますか'),
        h('div', { class: 'sub' }, 'このパソコンにも共有ファイルにも中身があります。'),
        h('div', { class: 'card' },
          line('このパソコン', '利用者 ' + mine.counts.residents + ' 人・献立 ' + mine.counts.menus + ' 日・料理 ' + mine.counts.dishes + ' 件'),
          line('共有ファイル', '利用者 ' + theirs.counts.residents + ' 人・献立 ' + theirs.counts.menus + ' 日・料理 ' + theirs.counts.dishes + ' 件'
            + (theirs.savedAt ? '（' + U.fmtDateTime(theirs.savedAt) + ' ' + (theirs.device || '') + '）' : ''))),
        h('div', { class: 'sub' }, '「両方を混ぜる」は、同じ記録が両方にある時だけ新しいほうを残します。ふつうはこれで足ります。'),
        h('div', { class: 'modal-btns' },
          h('button', { class: 'btn', onclick: () => { close(); resolve(null); } }, 'やめる'),
          h('button', { class: 'btn', onclick: () => { close(); resolve('theirs'); } }, '共有ファイルの内容にする'),
          h('button', { class: 'btn', onclick: () => { close(); resolve('mine'); } }, 'このパソコンの内容にする'),
          h('button', { class: 'btn primary', onclick: () => { close(); resolve('merge'); } }, '両方を混ぜる'))));
    });
  }

  Share.choose = async function (createNew) {
    try {
      const hd = createNew
        ? await window.showSaveFilePicker({ suggestedName: SUGGEST, types: [{ description: '栄養食事管理のデータ', accept: { 'application/json': ['.json'] } }] })
        : (await window.showOpenFilePicker({ multiple: false, types: [{ description: '栄養食事管理のデータ', accept: { 'application/json': ['.json'] } }] }))[0];
      await setHandle(hd);
      const r = await firstJoin();
      if (r) U.toast('共有ファイルにつなぎました' + (r.sync && r.sync.res ? '（' + S.words(r.sync.res) + '）' : ''));
      App.refresh();
    } catch (e) {
      if (e && e.name === 'AbortError') return;
      U.toast(e.message, true);
    }
  };

  // 選ばずに場所を決める（自己テストが本物のファイルで往復を通すのに使う）
  Share.useHandle = async function (hd, label) { await setHandle(hd, label); };
  Share.detach = async function () {
    handle = null; info = null;
    await DB.delLocal('shareHandle'); await DB.delLocal('share');
    if (timer) { clearInterval(timer); timer = null; }
  };
  Share.forget = async function () {
    if (!await U.confirm('このパソコンの「共有ファイル」のつながりを外します。データそのものは消えません。', { okLabel: '外す' })) return;
    await Share.detach();
    App.refresh();
  };

  // ---- File System Access が無いブラウザ向け（手で渡す）----
  Share.mergeFromText = async function (text) {
    let data; try { data = JSON.parse(text); } catch (e) { throw new Error('ファイルを読めませんでした'); }
    S.check(data);
    if ((data.format || 1) < S.FORMAT) data = S.upgrade(data, data.savedAt || Date.now() - 86400000, data.device || 'ファイル');
    const local = await DB.exportAll();
    const res = S.merge(local, data);
    if (S.differs(local.stores, res.stores)) { await DB.applyMerge(res); await window.Master.load(); }
    return res;
  };

  // ---- 設定の画面 ----
  App.registerSettings({ order: 82, title: '複数のパソコンで使う', render: async function () {
    await loadState();
    const root = h('div', { class: 'card' });
    root.appendChild(h('div', { class: 'sub' },
      'データはパソコンごと・ブラウザごとに別々に入っています。共有フォルダ（や OneDrive のフォルダ）に'
      + 'ファイルを 1 つ置いて、開いた時と変えた時にそれと突き合わせます。'));

    if (!HAS_FS) {
      root.appendChild(h('div', { class: 'card warn' },
        'このブラウザはファイルの場所を覚えられません（Chrome / Edge なら覚えられます）。下の 2 つを手で押す形になります。'));
    } else if (!info) {
      root.appendChild(h('div', { class: 'toolrow' },
        h('button', { class: 'btn primary', onclick: () => Share.choose(true) }, '共有ファイルを新しく作る'),
        h('button', { class: 'btn', onclick: () => Share.choose(false) }, 'もうある共有ファイルを選ぶ')));
      root.appendChild(h('div', { class: 'sub' }, '1 台目は「新しく作る」、2 台目からは「もうある〜を選ぶ」で同じファイルを指します。'));
    } else {
      const st = handle ? await handle.queryPermission({ mode: 'readwrite' }) : 'none';
      root.appendChild(h('div', { class: 'rowline' }, h('span', null, '共有ファイル'), h('b', null, info.name)));
      root.appendChild(h('div', { class: 'rowline' }, h('span', null, '最後に合わせたのは'),
        h('span', { class: 'sub' }, info.lastSync ? U.fmtDateTime(info.lastSync) + '（' + (info.lastWords || '') + '）' : 'まだです')));
      if (st !== 'granted') {
        root.appendChild(h('div', { class: 'card warn' }, '共有ファイルを使う許しが切れています。ブラウザを開き直すと毎回こうなります。',
          h('div', { class: 'toolrow' }, h('button', { class: 'btn primary', onclick: async () => { await perm(true); await Share.sync({}); App.refresh(); } }, 'つなぎ直す'))));
      }
      const auto = h('input', { type: 'checkbox', checked: info.auto !== false,
        onchange: async (e) => { info.auto = e.target.checked; await saveState(); } });
      root.appendChild(h('label', { class: 'rowline' }, h('span', null, '開いた時と変えた時に自動で合わせる'), auto));
      root.appendChild(h('div', { class: 'toolrow' },
        h('button', { class: 'btn primary', onclick: async () => { await Share.sync({}); App.refresh(); } }, '今すぐ合わせる'),
        h('button', { class: 'btn', onclick: () => Share.forget() }, 'つながりを外す')));
    }

    root.appendChild(h('h3', { class: 'sec' }, 'ファイルを手で渡す'));
    root.appendChild(h('div', { class: 'sub' }, 'USB メモリで持って行く時や、上のやり方が使えないブラウザで。読み込みは置き換えではなく突き合わせです。'));
    root.appendChild(h('div', { class: 'toolrow' },
      h('button', { class: 'btn', onclick: async () => { U.download(SUGGEST, JSON.stringify(await DB.exportAll())); } }, '共有用に書き出す'),
      h('button', { class: 'btn', onclick: async () => {
        const text = await U.pickFile('.json'); if (!text) return;
        try {
          const res = await Share.mergeFromText(text);
          U.toast(S.words(res));
          App.refresh();
        } catch (e) { U.toast(e.message, true); }
      } }, 'ファイルを読んで合わせる')));

    const name = h('input', { class: 'input', value: DB.deviceName(), placeholder: '例: 事務所のノート',
      onchange: (e) => { DB.deviceName(e.target.value); } });
    root.appendChild(h('div', { class: 'sub' }, 'このパソコンの呼び方（どちらが書いたか分かるように）。決めないと ' + DB.device() + ' と出ます。'));
    root.appendChild(name);
    return root;
  } });

  window.Share = Share;
  if (window.App && App.onReady) App.onReady(() => Share.start());
  else window.addEventListener('load', () => Share.start());
})();
