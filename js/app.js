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

  App.start = function () {
    window.addEventListener('hashchange', () => render(false));
    const boot = async () => {
      if (window.Nutri && window.FOODS_DATA) window.Nutri.load(window.FOODS_DATA);
      await window.Master.load();
      if (App.beforeStart) await App.beforeStart();
      render(false);
    };
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
  };

  window.App = App;
})();
