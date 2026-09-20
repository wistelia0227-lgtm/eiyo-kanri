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
  U.chipList = function (values, suggestions, placeholder) {
    const list = values.slice();
    const box = h('div', { class: 'chips' });
    const id = U.uid('dl');
    const input = h('input', { class: 'input', type: 'text', placeholder: placeholder || '入力して Enter', list: id });
    const add = () => { const v = input.value.trim(); if (v && list.indexOf(v) < 0) { list.push(v); draw(); } input.value = ''; };
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); add(); } });
    input.addEventListener('change', add);
    function draw() {
      box.innerHTML = '';
      list.forEach((v, i) => box.appendChild(h('span', { class: 'chip' }, v,
        h('button', { type: 'button', class: 'chip-x', title: '外す', onclick: () => { list.splice(i, 1); draw(); } }, '×'))));
    }
    draw();
    const el = h('div', { class: 'chiplist' }, box, input, h('datalist', { id: id }, (suggestions || []).map((s) => h('option', { value: s }))));
    el.get = () => { add(); return list.slice(); };
    el.peek = () => list.slice();
    el.push = (v) => { if (v && list.indexOf(v) < 0) { list.push(v); draw(); } };
    return el;
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
  // 表を CSV で（Excel で開ける BOM つき）
  U.csv = function (rows) {
    return '﻿' + rows.map((r) => r.map((c) => { c = c == null ? '' : String(c); return /[",\n]/.test(c) ? '"' + c.replace(/"/g, '""') + '"' : c; }).join(',')).join('\r\n');
  };

  window.U = U;
})();
