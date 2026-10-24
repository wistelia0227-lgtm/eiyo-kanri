// 画面の切り替えと左メニュー。window.App で公開。
// 各モジュールは App.registerScreen / registerNav / registerSettings / registerTodo で自分を登録する。
(function () {
  'use strict';
  const U = window.U, h = U.h;
  const App = { screens: {}, nav: [], settings: [], todos: [] };
  let token = 0, lastRoute = '';

  App.registerScreen = (name, fn) => { App.screens[name] = fn; };
  App.registerNav = (item) => { App.nav.push(item); App.nav.sort((a, b) => a.order - b.order); };
  App.registerSettings = (sec) => { App.settings.push(sec); App.settings.sort((a, b) => a.order - b.order); };
  // 「今日やること」に行を出す係。fn(ctx) → [{level:'bad'|'warn'|'info', text, href}]
  App.registerTodo = (fn) => { App.todos.push(fn); };

  App.go = function (hash) { if (location.hash === hash) App.refresh(); else location.hash = hash; };
  App.refresh = () => render(true);

  function parse() {
    const parts = (location.hash || '#/home').replace(/^#\/?/, '').split('/').filter(Boolean);
    return { name: parts[0] || 'home', params: parts.slice(1).map(decodeURIComponent) };
  }

  // 印刷ボタンは画面ごとに置いてあるが、Excel を 20 画面ぶん書き足すと同じ物が増える。
  // 表を拾う仕組み（js/util.js の U.xlsxScreen）が画面に依らないので、ここで一度だけ付ける。
  // ボタンを置く入れ物を探す。画面によって見出しの作りが 3 通りある
  //   ふつう: header.topbar の中の .no-print
  //   見出しごと no-print（衛生・報告書）: その最後の div
  //   見出しを持たない（アレルギー表）: 先頭の操作の帯
  function barOf(box) {
    const bar = box.querySelector('header.topbar');
    if (!bar) return box.querySelector('.toolrow.no-print');
    return bar.querySelector('.no-print')
      || (bar.classList.contains('no-print') ? bar.querySelector(':scope > div:last-child') : null);
  }

  // この画面が何のためのものかを出す（js/help.js）。教えてくれる同僚がいない前提の画面内ヘルプ
  function addHelpButton(box, route) {
    if (!window.Help || !U || !U.modal) return;
    const t = window.Help.of(route.name);
    if (!t) return;
    const target = barOf(box);
    if (!target || target.querySelector('[data-help-btn]')) return;
    target.appendChild(h('button', {
      class: 'btn', 'data-help-btn': '1', title: 'この画面は何か',
      onclick: () => {
        let close;
        close = U.modal(h('div', null,
          h('h2', null, t.title),
          h('div', { class: 'card' },
            h('p', null, t.what),
            h('p', null, t.how),
            h('p', { class: 'sub' }, t.flow)),
          h('div', { class: 'modal-btns' },
            h('button', { class: 'btn primary', onclick: () => close() }, '閉じる'))));
      }
    }, '?'));
  }

  function addExcelButton(box, route) {
    if (!window.Xlsx || !U || !U.xlsxScreen) return;
    const target = barOf(box);
    if (!target) return;
    if (!U.tablesOf || U.tablesOf(box).length === 0) return;
    if (target.querySelector('[data-xlsx-btn]')) return;

    const btn = h('button', {
      class: 'btn',
      'data-xlsx-btn': '1',
      title: '画面に出ている表をそのまま Excel にします',
      onclick: () => {
        const item = App.nav.find(t => t.match && t.match.indexOf(route.name) >= 0);
        let screenName = route.name;
        if (item) {
          screenName = typeof item.label === 'function' ? item.label() : item.label;
        }
        const rootEl = document.getElementById('root');
        const h1 = (rootEl || box).querySelector('h1');
        const head = (h1 && h1.textContent.trim()) || screenName;
        const fileName = (screenName + '_' + U.today() + '.xlsx').replace(/[\\/:*?"<>|\s]/g, '_');
        U.xlsxScreen(fileName, document.getElementById('root'), head);
      }
    }, 'Excel');
    target.appendChild(btn);
  }

  async function render(keepScroll) {
    const my = ++token;
    const route = parse();
    const screen = App.screens[route.name] || App.screens.home;
    const y = (keepScroll && lastRoute === location.hash) ? window.scrollY : 0;
    const box = h('div', { class: 'screen screen-' + route.name });
    try {
      await screen(route.params, box);
    } catch (e) {
      box.appendChild(h('div', { class: 'card bad' }, '画面を表示できませんでした: ' + (e && e.message || e)));
      U.showError(e && e.message || String(e));
      console.error(e);
    }
    if (my !== token) return; // 後から来た描画が勝つ
    const root = document.getElementById('root');
    root.innerHTML = '';
    addHelpButton(box, route);   // ? が左、Excel が右に並ぶ
    addExcelButton(box, route);
    root.appendChild(box);
    lastRoute = location.hash;
    window.scrollTo(0, y);
    renderNav(route.name);
  }

  function renderNav(current) {
    const bar = document.getElementById('nav');
    bar.innerHTML = '';
    bar.appendChild(h('div', { class: 'nav-title' }, '栄養・食事管理'));
    const prof = window.Master.current.profile;
    // かたまり（group）が変わる所に見出しを挟む。項目が増えても迷わないようにするため
    let group = null;
    App.nav.filter((t) => window.Profile.enabled(prof, t.feature)).forEach((t) => {
      const g = t.group || '';
      if (g !== group) { bar.appendChild(g ? h('div', { class: 'nav-group' }, g) : h('div', { class: 'nav-sep' })); group = g; }
      const on = t.match.indexOf(current) >= 0;
      const label = typeof t.label === 'function' ? t.label() : t.label;
      bar.appendChild(h('a', { href: t.hash, class: 'nav-item' + (on ? ' on' : '') }, h('span', { class: 'nav-icon' }, t.icon), h('span', null, label)));
    });
    if (/eiyo_kanri_demo/.test(window.DB.name)) bar.appendChild(h('div', { class: 'nav-note' }, '見本データで表示中（本番のデータとは別）'));
  }

  // 画面が最初に出たあとに動かすもの（共有ファイルの突き合わせなど）。起動を待たせない
  App.ready = [];
  App.onReady = (fn) => App.ready.push(fn);

  App.start = function () {
    window.addEventListener('hashchange', () => render(false));
    const boot = async () => {
      if (window.Nutri && window.FOODS_DATA) window.Nutri.load(window.FOODS_DATA);
      await window.Master.load();
      if (App.beforeStart) await App.beforeStart();
      render(false);
      App.ready.forEach((fn) => { try { fn(); } catch (e) { console.warn('onReady', e); } });
    };
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
  };

  window.App = App;
})();