// 共通の小道具。window.U で公開。
(function () {
  'use strict';
  const U = {};

  // エラーは握りつぶさず画面上部に出す
  function showError(msg) {
    const bar = document.getElementById('errbar');
    if (!bar) return;
    bar.hidden = false;
    bar.textContent = 'エラー: ' + msg;
  }
  window.addEventListener('error', (e) => showError(e.message + ' (' + (e.filename || '').split('/').pop() + ':' + e.lineno + ')'));
  window.addEventListener('unhandledrejection', (e) => showError(String(e.reason && e.reason.message || e.reason)));
  U.showError = showError;

  // DOM生成: h('div', {class:'x', onclick:fn}, 子...)
  const PROPS = { value: 1, checked: 1, disabled: 1, selected: 1 };
  function append(el, kid) {
    if (kid == null || kid === false || kid === true) return;
    if (Array.isArray(kid)) { kid.forEach((k) => append(el, k)); return; }
    el.appendChild(kid instanceof Node ? kid : document.createTextNode(String(kid)));
  }
  // null を渡しても落ちないようにする（作る関数が「該当なし」で null を返すことがある）
  U.add = function (parent, kid) { if (kid) parent.appendChild(kid); return parent; };
  U.h = function (tag, attrs) {
    const el = document.createElement(tag);
    const later = [];
    if (attrs) {
      Object.keys(attrs).forEach((k) => {
        const v = attrs[k];
        if (v == null || v === false) return;
        if (k === 'class') el.className = v;
        else if (k === 'style') el.style.cssText = v;
        else if (k.slice(0, 2) === 'on' && typeof v === 'function') el.addEventListener(k.slice(2), v);
        else if (PROPS[k]) later.push(k);
        else el.setAttribute(k, v === true ? '' : v);
      });
    }
    for (let i = 2; i < arguments.length; i++) append(el, arguments[i]);
    later.forEach((k) => { el[k] = attrs[k]; }); // selectのvalueは子の後でないと効かない
    return el;
  };
  const h = U.h;

  U.uid = function (prefix) { return (prefix || 'x') + Date.now().toString(36) + Math.random().toString(36).slice(2, 7); };

  // 日付
  const WD = ['日', '月', '火', '水', '木', '金', '土'];
  U.WD = WD;
  U.today = function () {
    const d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  };
  U.fmtDate = function (s, withYear) {
    if (!s) return '';
    const p = s.split('-').map(Number);
    const d = new Date(p[0], p[1] - 1, p[2]);
    return (withYear ? p[0] + '/' : '') + p[1] + '/' + p[2] + '(' + WD[d.getDay()] + ')';
  };
  U.fmtDateTime = function (ms) {
    if (!ms) return '';
    const d = new Date(ms);
    return (d.getMonth() + 1) + '/' + d.getDate() + '(' + WD[d.getDay()] + ') ' + d.getHours() + ':' + String(d.getMinutes()).padStart(2, '0');
  };

  // トースト
  let toastTimer = null;
  U.toast = function (msg, isError) {
    const t = document.getElementById('toast');
    t.textContent = msg;
    t.className = isError ? 'err' : '';
    t.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { t.hidden = true; }, isError ? 5000 : 2200);
  };

  // モーダル。close() を返す。背景クリックでは閉じない（入力の消失防止）
  U.modal = function (content, opts) {
    const bg = h('div', { class: 'modal-bg no-print' + (opts && opts.wide ? ' wide' : '') }, h('div', { class: 'modal' }, content));
    document.body.appendChild(bg);
    return function close() { bg.remove(); };
  };
  U.confirm = function (message, opts) {
    opts = opts || {};
    return new Promise((resolve) => {
      let close;
      const done = (v) => { close(); resolve(v); };
      close = U.modal(h('div', null,
        h('div', { class: 'modal-msg' }, message),
        h('div', { class: 'modal-btns' },
          h('button', { class: 'btn', onclick: () => done(false) }, opts.cancelLabel || 'やめる'),
          h('button', { class: 'btn ' + (opts.danger ? 'danger' : 'primary'), onclick: () => done(true) }, opts.okLabel || 'OK'))));
    });
  };

  // 入力部品
  U.field = function (label, control, hint) {
    return h('label', { class: 'field' }, h('span', { class: 'field-label' }, label), control, hint ? h('span', { class: 'hint' }, hint) : null);
  };
  // マスタ（[{id,label}]）から選ぶ。マスタから消えた値も選択肢に残す
  U.select = function (list, value, opts) {
    opts = opts || {};
    const items = list.slice();
    if (value && !items.some((x) => x.id === value)) items.push({ id: value, label: value + '（マスタに無い）' });
    return h('select', { class: 'input', value: value || '', onchange: opts.onchange },
      opts.noEmpty ? null : h('option', { value: '' }, opts.emptyLabel || '（なし）'),
      items.map((x) => h('option', { value: x.id }, x.label + (x.code ? '［' + x.code + '］' : ''))));
  };
  // 食事の枠（日付 + 食事）の入力。get() で {d, m} を返す
  U.slotInput = function (meals, value, opts) {
    opts = opts || {};
    const d = h('input', { class: 'input', type: 'date', value: (value && value.d) || '' });
    const m = h('select', { class: 'input', value: (value && value.m) || '' },
      opts.anyMeal ? h('option', { value: '' }, opts.anyMeal) : null,
      meals.map((x) => h('option', { value: x.id }, x.label + (opts.suffix || ''))));
    if (!opts.anyMeal && !(value && value.m)) m.value = opts.defaultMeal || meals[0].id;
    const el = h('div', { class: 'slot-input' }, d, m);
    el.get = () => (d.value ? { d: d.value, m: m.value || undefined } : null);
    return el;
  };
  // 文字列の並びを編集（チップ + 追加欄 + 候補）
  U.chipList = function (values, suggestions, placeholder, onchange) {
    const list = values.slice();
    const box = h('div', { class: 'chips' });
    const id = U.uid('dl');
    const input = h('input', { class: 'input', type: 'text', placeholder: placeholder || '入力して Enter', list: id });
    const changed = () => { if (onchange) onchange(list.slice()); };
    const add = () => { const v = input.value.trim(); if (v && list.indexOf(v) < 0) { list.push(v); draw(); changed(); } input.value = ''; };
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); add(); } });
    input.addEventListener('change', add);
    function draw() {
      box.innerHTML = '';
      list.forEach((v, i) => box.appendChild(h('span', { class: 'chip' }, v,
        h('button', { type: 'button', class: 'chip-x', title: '外す', onclick: () => { list.splice(i, 1); draw(); changed(); } }, '×'))));
    }
    draw();
    const el = h('div', { class: 'chiplist' }, box, input, h('datalist', { id: id }, (suggestions || []).map((s) => h('option', { value: s }))));
    el.get = () => { add(); return list.slice(); };
    el.peek = () => list.slice();
    el.push = (v) => { if (v && list.indexOf(v) < 0) { list.push(v); draw(); changed(); } };
    return el;
  };

  // 文例つきの入力欄。欄の右肩に 本マーク（文例を選ぶ）と 鉛筆（今の文を文例に足す）
  // key = js/phrases.js の欄 ID。target = input か textarea
  U.withPhrases = function (key, target, opts) {
    opts = opts || {};
    const P = window.Phrases, ms = () => window.Master.current;
    const open = () => {
      const list = P.get(ms(), key);
      const picked = [];
      let close, draw;
      const box = h('div', { class: 'picklist' });
      let editing = false;
      draw = function () {
        box.innerHTML = '';
        if (!list.length) box.appendChild(h('div', { class: 'empty' }, 'まだ文例がありません。下の「今の文を文例に足す」か、設定 → 文例 で足せます。'));
        list.forEach((t, i) => {
          const cb = h('input', { type: 'checkbox', checked: picked.indexOf(t) >= 0,
            onchange: (e) => { if (e.target.checked) picked.push(t); else picked.splice(picked.indexOf(t), 1); } });
          box.appendChild(h('label', { class: 'phrase' }, cb, h('span', null, t),
            editing ? h('button', { type: 'button', class: 'btn small', onclick: async () => {
              list.splice(i, 1); ms().phrases[key] = list; await window.Master.save(); draw();
            } }, '消す') : null));
        });
      };
      draw();
      const put = (mode) => {
        if (!picked.length) { U.toast('文を選んでください', true); return; }
        target.value = P.apply(target.value, picked, mode, opts.sep);
        target.dispatchEvent(new Event('change'));
        close();
      };
      close = U.modal(h('div', null,
        h('h2', null, P.label(key) + ' の文例'),
        h('div', { class: 'sub' }, 'チェックを入れて「入れる」か「今の文に足す」。複数選ぶとつながります。'),
        box,
        h('div', { class: 'toolrow' },
          h('button', { class: 'btn primary', onclick: () => put('replace') }, '入れる'),
          h('button', { class: 'btn', onclick: () => put('append') }, '今の文に足す'),
          h('button', { class: 'btn', onclick: async () => {
            if (!P.add(ms(), key, target.value)) { U.toast('空か、もう入っています', true); return; }
            await window.Master.save(); U.toast('文例に足しました'); draw();
          } }, '今の文を文例に足す'),
          h('button', { class: 'btn small', onclick: () => { editing = !editing; draw(); } }, '文例を消す')),
        h('div', { class: 'modal-btns' }, h('button', { class: 'btn', onclick: () => close() }, '閉じる'))), { wide: true });
    };
    const btn = h('button', { type: 'button', class: 'btn small phrase-btn', title: '文例から選ぶ', onclick: open }, '文例');
    return h('div', { class: 'phrase-wrap' }, target, btn);
  };

  // Excel のファイルとして保存（js/xlsx.js）。sheets = [{name, rows}]
  U.xlsx = function (filename, sheets) {
    if (!window.Xlsx) { U.toast('Excel の書き出しが読み込まれていません', true); return; }
    const bytes = window.Xlsx.build(sheets);
    const url = URL.createObjectURL(new Blob([bytes], { type: window.Xlsx.MIME }));
    const a = h('a', { href: url, download: filename });
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 3000);
  };

  // ファイルとして保存 / 読み込み
  U.download = function (filename, text, mime) {
    const url = URL.createObjectURL(new Blob([text], { type: mime || 'application/json' }));
    const a = h('a', { href: url, download: filename });
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 3000);
  };
  U.pickFile = function (accept) {
    return new Promise((resolve) => {
      const input = h('input', { type: 'file', accept: accept, style: 'display:none' });
      document.body.appendChild(input);
      input.addEventListener('cancel', () => { input.remove(); resolve(null); });
      input.addEventListener('change', async () => { const f = input.files[0]; input.remove(); resolve(f ? await f.text() : null); });
      input.click();
    });
  };
  // 紙の様式に寄せた台紙。通知や手引きの様式は、たいてい
  //   左上に表題／右上に日付／その下に〈責任者・衛生管理者〉の印欄／下に自由記入の枠
  // という同じ形をしている。その形を 1 か所で作る。
  //   opts: { date: '2026-09-25', stamps: ['責任者','衛生管理者'], note: '（別紙）' }
  U.paper = function (title, opts) {
    opts = opts || {};
    const head = h('div', { class: 'paper-head' },
      h('div', { class: 'paper-title' }, opts.note ? h('div', { class: 'paper-note-label' }, opts.note) : null, h('h1', null, title)),
      h('div', { class: 'paper-right' },
        opts.date ? h('div', { class: 'paper-date' }, U.fmtDate(opts.date, true)) : null,
        (opts.stamps && opts.stamps.length) ? h('table', { class: 'stamps' },
          h('thead', null, h('tr', null, opts.stamps.map((t) => h('th', null, t)))),
          h('tbody', null, h('tr', null, opts.stamps.map((t, i) => h('td', { class: 'stamp-cell', 'data-i': String(i) }, ''))))) : null));
    const sheet = h('div', { class: 'paper' }, head);
    sheet.head = head;
    return sheet;
  };
  // 様式の下にある自由記入の枠（〈改善を行った点〉など。見出しは枠の中の左上）
  U.paperBox = function (label, value, onchange, rows) {
    const el = h('textarea', { class: 'paper-free', rows: String(rows || 3) });
    el.value = value || '';
    if (onchange) el.addEventListener('change', () => onchange(el.value));
    return h('div', { class: 'paper-boxed' }, h('div', { class: 'paper-box-label' }, label), el);
  };

  // さし絵を選ぶ。選んだ絵は小さくしてから data URL にする。
  //   データは共有ファイル（modules/share.js）にも乗るので、大きいまま持たない。
  //   透明のある絵（PNG など）は PNG のまま、写真は JPEG にする（透明を失わないため）。
  U.pickImage = function (maxPx, quality) {
    return new Promise((resolve) => {
      const input = h('input', { type: 'file', accept: 'image/*', style: 'display:none' });
      document.body.appendChild(input);
      input.addEventListener('cancel', () => { input.remove(); resolve(null); });
      input.addEventListener('change', () => {
        const f = input.files[0];
        input.remove();
        if (!f) return resolve(null);
        const url = URL.createObjectURL(f);
        const img = new Image();
        img.onload = function () {
          const k = Math.min(1, (maxPx || 320) / Math.max(img.width, img.height));
          const w = Math.max(1, Math.round(img.width * k)), hh = Math.max(1, Math.round(img.height * k));
          const cv = document.createElement('canvas');
          cv.width = w; cv.height = hh;
          cv.getContext('2d').drawImage(img, 0, 0, w, hh);
          URL.revokeObjectURL(url);
          const keepAlpha = /png|gif|webp|svg/.test(f.type || '');
          let out = '';
          try { out = keepAlpha ? cv.toDataURL('image/png') : cv.toDataURL('image/jpeg', quality || 0.82); } catch (e) { out = ''; }
          resolve(out ? { url: out, w: w, h: hh, bytes: Math.round(out.length * 0.75) } : null);
        };
        img.onerror = function () { URL.revokeObjectURL(url); resolve(null); };
        img.src = url;
      });
      input.click();
    });
  };

  // 表を CSV で（Excel で開ける BOM つき）
  U.csv = function (rows) {
    return '﻿' + rows.map((r) => r.map((c) => { c = c == null ? '' : String(c); return /[",\n]/.test(c) ? '"' + c.replace(/"/g, '""') + '"' : c; }).join(',')).join('\r\n');
  };

  window.U = U;
})();
