// キーボードで動かす（削除可能）。画面が 28 枚あるので、マウスで探すより速い口を 1 つ置く。
// Ctrl+K（または / ）で画面を探す窓を出し、打ち込んで絞り、Enter で移る。
// Esc は開いている窓を閉じる。入力中のキーは邪魔しない。

(function () {
  'use strict';
  const U = window.U, h = U.h, App = window.App;

  const K = {
    isTyping(el) {
      const target = el || document.activeElement;
      if (!target) return false;
      const tag = (target.tagName || '').toLowerCase();
      if (tag === 'input' || tag === 'textarea' || tag === 'select') return true;
      if (target.isContentEditable) return true;
      return false;
    },

    list() {
      const nav = (window.App && window.App.nav) || [];
      const hasProfileCheck = window.Profile && window.Master && window.Master.current && typeof window.Profile.enabled === 'function';
      const res = [];
      for (const item of nav) {
        if (hasProfileCheck && item.feature) {
          if (!window.Profile.enabled(window.Master.current.profile, item.feature)) {
            continue;
          }
        }
        const label = typeof item.label === 'function' ? item.label() : item.label;
        res.push({
          label: label || '',
          hash: item.hash || '',
          name: item.name || ''
        });
      }
      return res;
    },

    match(list, q) {
      if (!q || !q.trim()) return list.slice();
      const query = q.trim().toLowerCase();
      const prefix = [];
      const partial = [];

      for (const item of list) {
        const lbl = (item.label || '').toLowerCase();
        const hsh = (item.hash || '').toLowerCase();
        if (lbl.startsWith(query) || hsh.startsWith(query)) {
          prefix.push(item);
        } else if (lbl.includes(query) || hsh.includes(query)) {
          partial.push(item);
        }
      }
      return prefix.concat(partial);
    },

    open() {
      if (document.querySelector('.keys-search-modal')) return;

      let selectedIndex = 0;
      let currentItems = [];
      let closeModal = null;   // U.modal は「閉じる関数」を返す（要素ではない）

      const go = (hash) => {
        if (closeModal) closeModal();
        if (window.App && typeof window.App.go === 'function') {
          window.App.go(hash);
        } else {
          location.hash = hash;
        }
      };

      const allItems = K.list();
      currentItems = allItems;

      const listContainer = h('div', { class: 'keys-list' });

      const renderList = () => {
        listContainer.innerHTML = '';
        if (currentItems.length === 0) {
          listContainer.appendChild(h('div', { class: 'empty' }, '見つかりません'));
          return;
        }
        currentItems.forEach((item, idx) => {
          const btnClass = 'btn' + (idx === selectedIndex ? ' on' : '');
          const btn = h('button', {
            type: 'button',
            class: btnClass,
            onclick: () => go(item.hash)
          }, item.label + (item.hash ? ' (' + item.hash + ')' : ''));
          listContainer.appendChild(btn);
        });
      };

      const input = h('input', {
        type: 'text',
        class: 'input',
        placeholder: '画面の名前を打つ（Enter で移る）'
      });

      input.addEventListener('input', () => {
        currentItems = K.match(allItems, input.value);
        selectedIndex = 0;
        renderList();
      });

      input.addEventListener('keydown', (e) => {
        if (e.key === 'ArrowDown') {
          e.preventDefault();
          if (currentItems.length > 0) {
            selectedIndex = (selectedIndex + 1) % currentItems.length;
            renderList();
            const activeBtn = listContainer.children[selectedIndex];
            if (activeBtn && activeBtn.scrollIntoView) {
              activeBtn.scrollIntoView({ block: 'nearest' });
            }
          }
        } else if (e.key === 'ArrowUp') {
          e.preventDefault();
          if (currentItems.length > 0) {
            selectedIndex = (selectedIndex - 1 + currentItems.length) % currentItems.length;
            renderList();
            const activeBtn = listContainer.children[selectedIndex];
            if (activeBtn && activeBtn.scrollIntoView) {
              activeBtn.scrollIntoView({ block: 'nearest' });
            }
          }
        } else if (e.key === 'Enter') {
          e.preventDefault();
          if (currentItems.length > 0 && currentItems[selectedIndex]) {
            go(currentItems[selectedIndex].hash);
          }
        } else if (e.key === 'Escape') {
          e.preventDefault();
          if (closeModal) closeModal();
        }
      });

      const body = h('div', { class: 'keys-search-modal' },
        h('h2', null, '画面を探す'),
        input,
        listContainer
      );

      closeModal = U.modal(body);
      renderList();
      setTimeout(() => input.focus(), 0);
    },

    start() {
      if (K._started) return;
      K._started = true;

      document.addEventListener('keydown', (e) => {
        const isCtrlK = (e.ctrlKey || e.metaKey) && (e.key === 'k' || e.key === 'K');
        if (isCtrlK) {
          e.preventDefault();
          K.open();
          return;
        }

        if (e.key === '/') {
          if (!K.isTyping(e.target)) {
            e.preventDefault();
            K.open();
            return;
          }
        }

        if (e.key === 'Escape') {
          const modals = document.querySelectorAll('.modal-bg');
          if (modals.length > 0) {
            const lastModal = modals[modals.length - 1];
            lastModal.remove();
          }
        }
      });
    }
  };

  window.Keys = K;
  if (window.App && App.onReady) {
    App.onReady(() => K.start());
  } else {
    window.addEventListener('load', () => K.start());
  }
})();