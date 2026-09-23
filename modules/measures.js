// 測定値（削除可能）: 体重のほかに 血清アルブミン・ヘモグロビン・血糖・HbA1c・下腿周囲長・体脂肪率 などを持つ。
// 種類は 設定 → 測定の種類 で足せる。個人画面に推移のグラフ（SVG）を出す。
(function () {
  'use strict';
  const U = window.U, h = U.h, DB = window.DB, M = window.Model, V = window.View, App = window.App;
  const ms = () => window.Master.current;
  const X = {};

  X.kinds = () => (ms().measures || []).slice();
  X.kind = (id) => X.kinds().find((k) => k.id === id) || { id: id, label: id, unit: '', dec: 1 };
  X.ofResident = async function (rid) {
    const out = {};
    (await DB.byIndex('measures', 'residentId', rid)).forEach((x) => { (out[x.kind] = out[x.kind] || []).push(x); });
    Object.keys(out).forEach((k) => out[k].sort((a, b) => a.date.localeCompare(b.date)));
    return out;
  };
  X.fmt = function (kindId, v) {
    if (v == null) return '';
    const k = X.kind(kindId);
    return Number(v).toFixed(k.dec == null ? 1 : k.dec);
  };
  // 基準から外れているか（マスタの low / high）
  X.out = function (kindId, v) {
    const k = X.kind(kindId);
    if (v == null) return '';
    if (k.low != null && v < k.low) return 'low';
    if (k.high != null && v > k.high) return 'high';
    return '';
  };

  // ---- 折れ線グラフ（SVG）----
  X.chart = function (points, opts) {
    opts = opts || {};
    const W = opts.width || 560, H = opts.height || 150, pad = { l: 44, r: 10, t: 10, b: 22 };
    const pts = (points || []).filter((p) => p.value != null);
    if (pts.length < 2) return h('div', { class: 'sub' }, '記録が 2 件以上になるとグラフが出ます。');
    const xs = pts.map((p) => M.dayNum(p.date));
    const ys = pts.map((p) => p.value);
    const x0 = Math.min.apply(null, xs), x1 = Math.max.apply(null, xs);
    let y0 = Math.min.apply(null, ys), y1 = Math.max.apply(null, ys);
    if (opts.low != null) y0 = Math.min(y0, opts.low);
    if (opts.high != null) y1 = Math.max(y1, opts.high);
    const span = (y1 - y0) || 1;
    y0 -= span * 0.12; y1 += span * 0.12;
    const px = (d) => pad.l + (x1 === x0 ? 0 : (M.dayNum(d) - x0) / (x1 - x0) * (W - pad.l - pad.r));
    const py = (v) => pad.t + (1 - (v - y0) / (y1 - y0)) * (H - pad.t - pad.b);
    const svg = (tag, attrs, kids) => {
      const el = document.createElementNS('http://www.w3.org/2000/svg', tag);
      Object.keys(attrs || {}).forEach((k) => el.setAttribute(k, attrs[k]));
      (kids || []).forEach((k) => el.appendChild(k));
      return el;
    };
    const text = (x, y, s, cls) => { const t = svg('text', { x: x, y: y, class: cls || '' }); t.textContent = s; return t; };
    const kids = [];
    // 目盛り（上・下・中）
    [y1, (y0 + y1) / 2, y0].forEach((v) => {
      kids.push(svg('line', { x1: pad.l, y1: py(v), x2: W - pad.r, y2: py(v), class: 'grid' }));
      kids.push(text(4, py(v) + 4, X.fmt(opts.kind, v), 'axis'));
    });
    // 基準の線
    if (opts.low != null) kids.push(svg('line', { x1: pad.l, y1: py(opts.low), x2: W - pad.r, y2: py(opts.low), class: 'ref' }));
    if (opts.high != null) kids.push(svg('line', { x1: pad.l, y1: py(opts.high), x2: W - pad.r, y2: py(opts.high), class: 'ref' }));
    // 線と点
    kids.push(svg('polyline', { points: pts.map((p) => px(p.date) + ',' + py(p.value)).join(' '), class: 'line' }));
    pts.forEach((p) => {
      kids.push(svg('circle', { cx: px(p.date), cy: py(p.value), r: '3', class: 'dot ' + (X.out(opts.kind, p.value) || '') }));
    });
    kids.push(text(pad.l, H - 6, U.fmtDate(pts[0].date, true), 'axis'));
    const last = text(W - pad.r, H - 6, U.fmtDate(pts[pts.length - 1].date, true), 'axis');
    last.setAttribute('text-anchor', 'end');
    kids.push(last);
    return svg('svg', { viewBox: '0 0 ' + W + ' ' + H, class: 'chart', preserveAspectRatio: 'none' }, kids);
  };

  // ---- 入力 ----
  X.edit = async function (resident, kindId, rec) {
    const k = X.kind(kindId);
    const date = h('input', { class: 'input', type: 'date', value: rec ? rec.date : U.today() });
    const val = h('input', { class: 'input num', type: 'number', step: k.dec ? Math.pow(10, -k.dec).toFixed(k.dec) : '1',
      value: rec ? rec.value : '', placeholder: k.unit });
    let close;
    const save = async () => {
      const v = parseFloat(val.value);
      if (!(v > 0)) { U.toast('数字を入れてください', true); return; }
      const d = date.value || U.today();
      await DB.put('measures', { id: resident.id + '_' + kindId + '_' + d, residentId: resident.id, kind: kindId,
        date: d, value: v, recordedAt: Date.now(), by: V.recorder() });
      close(); App.refresh();
    };
    close = U.modal(h('div', null, h('h2', null, V.sama(resident.name) + '　' + k.label),
      h('div', { class: 'grid2' }, U.field('測定日', date), U.field(k.label + '（' + k.unit + '）', val)),
      h('div', { class: 'modal-btns' },
        rec ? h('button', { class: 'btn danger-outline', onclick: async () => {
          if (!await U.confirm('この記録を消します。', { okLabel: '消す', danger: true })) return;
          await DB.del('measures', rec.id); close(); App.refresh();
        } }, '消す') : null,
        h('button', { class: 'btn', onclick: () => close() }, 'やめる'),
        h('button', { class: 'btn primary', onclick: save }, '保存'))));
  };

  // ---- 個人画面の欄（体重以外の測定と、推移のグラフ）----
  window.Residents.registerSection({ order: 12, render: async function (r) {
    const data = await X.ofResident(r.id);
    const kinds = X.kinds();
    const box = h('div');
    const draw = (kindId) => {
      const k = X.kind(kindId);
      const list = data[kindId] || [];
      box.innerHTML = '';
      box.appendChild(h('div', { class: 'toolrow' },
        kinds.map((x) => h('button', { class: 'btn seg small' + (x.id === kindId ? ' on' : ''), onclick: () => draw(x.id) },
          x.label + ((data[x.id] || []).length ? ' ' + data[x.id].length : ''))),
        h('button', { class: 'btn small primary', onclick: () => X.edit(r, kindId, null) }, '＋ ' + k.label + 'を入れる')));
      if (!list.length) { box.appendChild(h('div', { class: 'empty' }, k.label + 'の記録はまだありません。')); return; }
      box.appendChild(X.chart(list, { kind: kindId, low: k.low, high: k.high }));
      box.appendChild(h('table', { class: 'list' },
        h('thead', null, h('tr', null, ['測定日', k.label + '（' + k.unit + '）', '前回との差', ''].map((t) => h('th', null, t)))),
        h('tbody', null, list.slice().reverse().slice(0, 12).map((x, i, arr) => {
          const prev = arr[i + 1];
          const diff = prev ? x.value - prev.value : null;
          const o = X.out(kindId, x.value);
          return h('tr', null, h('td', null, U.fmtDate(x.date, true)),
            h('td', { class: o ? (o === 'low' ? 'j-low' : 'j-high') : '' }, X.fmt(kindId, x.value)),
            h('td', null, diff == null ? '—' : (diff > 0 ? '+' : '') + X.fmt(kindId, diff)),
            h('td', { class: 'no-print' }, h('button', { class: 'btn small', onclick: () => X.edit(r, kindId, x) }, '直す')));
        }))));
      if (k.low != null || k.high != null) box.appendChild(h('div', { class: 'sub' },
        '基準の線: ' + [k.low != null ? k.low + ' 未満は青' : '', k.high != null ? k.high + ' 超は赤' : ''].filter(Boolean).join('、')));
    };
    const first = kinds.find((k) => (data[k.id] || []).length) || kinds[0];
    draw(first.id);
    return h('section', { class: 'card' }, h('h2', null, '測定値'), box);
  } });

  // 設定
  App.registerSettings({ order: 44, title: '測定の種類', render: function () {
    const m = ms();
    const box = h('div');
    function draw() {
      box.innerHTML = '';
      box.appendChild(h('div', { class: 'scroll-x' }, h('table', { class: 'list edit' },
        h('thead', null, h('tr', null, ['名前', '単位', '小数桁', 'これ未満は青', 'これ超は赤', ''].map((t) => h('th', null, t)))),
        h('tbody', null, m.measures.map((k, i) => {
          const inp = (key, type) => h('input', { class: 'input' + (type === 'number' ? ' num' : ''), type: type || 'text',
            step: 'any', value: k[key] == null ? '' : k[key],
            onchange: async (e) => {
              const v = e.target.value.trim();
              k[key] = (type === 'number') ? (v === '' ? null : parseFloat(v)) : v;
              await window.Master.save();
            } });
          return h('tr', null, h('td', null, inp('label')), h('td', null, inp('unit')), h('td', null, inp('dec', 'number')),
            h('td', null, inp('low', 'number')), h('td', null, inp('high', 'number')),
            h('td', null, k.core ? h('span', { class: 'sub' }, '消せません') : h('button', { class: 'btn small', onclick: async () => {
              if (!await U.confirm('「' + k.label + '」を消します。記録は残りますが、画面に出なくなります。', { okLabel: '消す', danger: true })) return;
              m.measures.splice(i, 1); await window.Master.save(); draw();
            } }, '消す')));
        })))));
      const add = h('input', { class: 'input', type: 'text', placeholder: '新しい測定の名前' });
      const doAdd = async () => {
        const v = add.value.trim();
        if (!v) return;
        m.measures.push({ id: U.uid('k'), label: v, unit: '', dec: 1 });
        await window.Master.save(); draw();
      };
      add.addEventListener('keydown', (e) => { if (e.key === 'Enter') doAdd(); });
      box.appendChild(h('div', { class: 'toolrow' }, add, h('button', { class: 'btn', onclick: doAdd }, '足す')));
    }
    draw();
    return h('div', { class: 'card' },
      h('div', { class: 'sub' }, '体重のほかに記録したい値を足せます。低栄養リスクの判定に使うのは体重・BMI と血清アルブミンです。'),
      box);
  } });

  window.Measures = X;
})();
