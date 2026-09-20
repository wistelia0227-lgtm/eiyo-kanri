// 情報リンクと、使っているデータの版（削除可能）: このファイルと index.html の script タグを消せば機能ごと消える。
// オフラインのアプリなので「最新かどうか」は人が確かめる。確かめた日を記録して、古くなったら画面に出す。
(function () {
  'use strict';
  const U = window.U, h = U.h, App = window.App;
  const ms = () => window.Master.current;
  const STALE_DAYS = 180;
  const days = (iso) => iso ? Math.floor((Date.now() - new Date(iso + 'T00:00:00').getTime()) / 86400000) : null;

  function linkRow(l) {
    return h('div', { class: 'linkrow' },
      h('a', { href: l.u, target: '_blank', rel: 'noopener noreferrer', class: 'linkname' }, l.n),
      h('div', { class: 'sub' }, l.d || ''),
      h('div', { class: 'linkurl' }, l.u));
  }

  App.registerScreen('links', async function (params, root) {
    const m = ms(), links = m.links || [];
    const cats = [];
    links.forEach((l) => { if (cats.indexOf(l.c) < 0) cats.push(l.c); });
    root.appendChild(h('header', { class: 'topbar' }, h('h1', null, '情報リンク'),
      h('a', { class: 'btn no-print', href: '#/settings' }, 'リンクを足す・直す')));
    root.appendChild(h('div', { class: 'sub' }, '外部のサイトが新しいタブで開きます（インターネットにつながっている時だけ）。'));

    // 版の確認
    const stale = (m.dataSources || []).filter((s) => !s.checkedAt || days(s.checkedAt) > STALE_DAYS);
    root.appendChild(h('section', { class: 'card' }, h('h2', null, '使っているデータの版'),
      h('div', { class: 'sub' }, '制度や成分表が新しくなっていないか、ときどき公式ページで確かめてください。確かめたら「確認した」を押すと日付が残ります。'),
      h('table', { class: 'list' }, h('thead', null, h('tr', null, ['データ', '今の版', '更新に気づく手がかり', '最後に確かめた日', ''].map((t) => h('th', null, t)))),
        h('tbody', null, (m.dataSources || []).map((s) => {
          const d = days(s.checkedAt);
          return h('tr', null,
            h('td', null, h('a', { href: s.url, target: '_blank', rel: 'noopener noreferrer' }, s.label),
              s.url2 ? [' ', h('a', { href: s.url2, target: '_blank', rel: 'noopener noreferrer', class: 'sub' }, '（予告のページ）')] : null,
              s.note ? h('div', { class: 'sub' }, s.note) : null),
            h('td', null, s.version),
            h('td', { class: 'sub how' }, s.how || ''),
            h('td', { class: (d == null || d > STALE_DAYS) ? 'warn-text' : '' }, s.checkedAt ? s.checkedAt + '（' + d + '日前）' : 'まだ'),
            h('td', { class: 'no-print' }, h('button', { class: 'btn small', onclick: async () => {
              s.checkedAt = U.today(); await window.Master.save(); U.toast(s.label + ' を確認済みにしました'); App.refresh();
            } }, '確認した')));
        }))),
      stale.length ? h('div', { class: 'sub warn-text' }, stale.length + ' 件が半年以上確かめられていません。') : null,
      h('div', { class: 'card info' }, h('b', null, 'まとめて自動で調べる'),
        h('div', null, 'インターネットにつながっているパソコンで、アプリのフォルダから次を実行すると、上の公式ページを見に行って前回との差を出します。'),
        h('code', null, 'python tools' + String.fromCharCode(92) + 'check_updates.py --save'),
        h('div', { class: 'sub' }, '結果は画面と tools' + String.fromCharCode(92) + 'update_report.txt に出ます。ブラウザからは他所のサイトを読めない決まりがあるので、この調べ物だけ外で行います。'))));

    cats.forEach((c) => {
      root.appendChild(h('h2', { class: 'sec' }, c));
      root.appendChild(h('div', { class: 'card' }, links.filter((l) => l.c === c).map(linkRow)));
    });
    if (!links.length) root.appendChild(h('div', { class: 'empty' }, 'リンクがありません。設定から足せます。'));
  });

  App.registerSettings({ order: 60, title: '情報リンク', render: function () {
    const m = ms();
    const box = h('div');
    function draw() {
      box.innerHTML = '';
      box.appendChild(h('table', { class: 'list edit' },
        h('thead', null, h('tr', null, ['分類', '名前', 'URL', '説明', ''].map((t) => h('th', null, t)))),
        h('tbody', null, m.links.map((l, i) => h('tr', null,
          ['c', 'n', 'u', 'd'].map((k) => h('td', null, h('input', { class: 'input', type: 'text', value: l[k] || '',
            onchange: async (e) => { l[k] = e.target.value.trim(); await window.Master.save(); } }))),
          h('td', null, h('button', { class: 'btn small', onclick: async () => {
            if (!await U.confirm('「' + l.n + '」を消します。', { okLabel: '消す', danger: true })) return;
            m.links.splice(i, 1); await window.Master.save(); draw();
          } }, '消す')))))));
      box.appendChild(h('div', { class: 'toolrow' },
        h('button', { class: 'btn', onclick: async () => { m.links.push({ c: 'その他', n: '', u: '', d: '' }); await window.Master.save(); draw(); } }, '＋ リンクを足す'),
        h('button', { class: 'btn', onclick: async () => {
          if (!await U.confirm('最初に入っていたリンク集に戻します。足したリンクは消えます。', { okLabel: '戻す', danger: true })) return;
          m.links = JSON.parse(JSON.stringify(window.Master.LINKS)); await window.Master.save(); draw();
        } }, '最初の状態に戻す')));
    }
    draw();
    return h('div', { class: 'card' }, h('div', { class: 'sub' }, '「情報」の画面に出るリンクです。よく見るページを足しておけます。'), h('div', { class: 'scroll-x' }, box));
  } });

  App.registerSettings({ order: 70, title: 'データの出典と版', render: function () {
    const m = ms();
    return h('div', { class: 'card' },
      h('div', { class: 'sub' }, 'このアプリが基にしているデータです。新しい版が出たら、ここの版と、関係する設定（判定値・マスタ）を直します。'),
      h('table', { class: 'list edit' }, h('thead', null, h('tr', null, ['データ', '版', '覚え書き', '確かめた日'].map((t) => h('th', null, t)))),
        h('tbody', null, m.dataSources.map((s) => h('tr', null,
          h('td', null, h('a', { href: s.url, target: '_blank', rel: 'noopener noreferrer' }, s.label)),
          h('td', null, h('input', { class: 'input', type: 'text', value: s.version, onchange: async (e) => { s.version = e.target.value.trim(); s.versionEdited = true; await window.Master.save(); } })),
          h('td', null, h('input', { class: 'input', type: 'text', value: s.note || '', onchange: async (e) => { s.note = e.target.value.trim(); s.noteEdited = true; await window.Master.save(); } })),
          h('td', null, h('input', { class: 'input', type: 'date', value: s.checkedAt || '', onchange: async (e) => { s.checkedAt = e.target.value; await window.Master.save(); } })))))),
      h('div', { class: 'sub' }, '更新の有無は tools' + String.fromCharCode(92) + 'check_updates.py で調べられます（「情報」の画面に手順）。食品成分表を新しい版に入れ替える手順は docs/PLAN.md に書いてあります。'));
  } });

  App.registerTodo(async function () {
    const m = ms();
    const stale = (m.dataSources || []).filter((s) => !s.checkedAt || days(s.checkedAt) > STALE_DAYS);
    // 一度も確かめていないだけの状態でせかさない。半年たったものがある時だけ出す
    const old = stale.filter((s) => s.checkedAt);
    return old.length ? [{ level: 'info', text: '制度・データの版を半年以上確かめていません（' + old.map((s) => s.label).join('、') + '）', href: '#/links' }] : [];
  });

  App.registerSettings({ order: 95, title: 'このアプリについて', render: function () {
    const n = window.Nutri;
    return h('div', { class: 'card' },
      h('div', null, '栄養・食事管理'),
      n && n.loaded() ? h('div', { class: 'sub' }, '栄養計算に使っているデータ: ' + n.meta.citation + '（' + n.count() + ' 食品）') : h('div', { class: 'sub warn-text' }, '成分表が読み込まれていません（js/foods_data.js）'),
      h('div', { class: 'sub' }, '食事摂取基準: 日本人の食事摂取基準（' + (n ? n.DRI_VERSION : '') + '）'));
  } });

  App.registerNav({ order: 80, feature: 'links', label: '情報', icon: '🔗', hash: '#/links', match: ['links'] });
})();
