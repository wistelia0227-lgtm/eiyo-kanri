// 体重: まとめて入力 → 前回との差・BMI・減少率(1/3/6か月)・低栄養リスクを自動で出す。
// 測定値は measures ストアに { id, residentId, kind:'weight', date, value } で持つ（Alb など他の測定も同じ形で足せる）。
(function () {
  'use strict';
  const U = window.U, h = U.h, DB = window.DB, M = window.Model, V = window.View, App = window.App;
  const ms = () => window.Master.current;
  const W = {};
  let onlyMissing = false;
  const RISK = { high: { label: '高', cls: 'bad' }, mid: { label: '中', cls: 'warn' }, low: { label: '低', cls: 'ok' } };

  W.byResident = async function () {
    const out = {};
    (await DB.getAll('measures')).forEach((x) => { if (x.kind === 'weight') (out[x.residentId] = out[x.residentId] || []).push(x); });
    Object.values(out).forEach((l) => l.sort((a, b) => a.date.localeCompare(b.date)));
    return out;
  };
  // 基準日までの測定で評価する
  W.evaluate = function (r, list, asOf) {
    const upto = (list || []).filter((w) => w.date <= asOf);
    const cur = upto[upto.length - 1] || null, prev = upto[upto.length - 2] || null;
    if (!cur) return { cur: null, prev: null, bmi: null, loss: {}, risk: { level: null, reasons: [] } };
    const loss = {};
    [['m1', 1], ['m3', 3], ['m6', 6]].forEach((k) => { const x = M.lossRate(upto, cur, k[1]); loss[k[0]] = x ? x.rate : null; });
    const bmi = M.bmi(cur.value, r.heightCm);
    return { cur: cur, prev: prev, bmi: bmi, loss: loss, risk: M.risk({ bmi: bmi, loss: loss }, ms().risk) };
  };
  W.riskBadge = (risk) => risk.level ? h('span', { class: 'badge ' + RISK[risk.level].cls, title: risk.reasons.join('\n') }, RISK[risk.level].label) : h('span', { class: 'sub' }, '—');
  const pct = (v) => v == null ? '—' : (v > 0 ? '▼' : v < 0 ? '▲' : '') + Math.abs(v).toFixed(1) + '%';

  App.registerScreen('weights', async function (params, root) {
    const m = ms(), date = params[0] || U.today(), month = date.slice(0, 7);
    const residents = (await DB.residents()).filter((r) => !r.archived && M.status(r, date, m.meals) === 'in')
      .sort((a, b) => (a.unit + a.room).localeCompare(b.unit + b.room, 'ja') || (a.kana || a.name).localeCompare(b.kana || b.name, 'ja'));
    const all = await W.byResident();
    const doneThisMonth = (r) => (all[r.id] || []).some((w) => w.date.slice(0, 7) === month);
    const missing = residents.filter((r) => !doneThisMonth(r)).length;

    root.appendChild(h('header', { class: 'topbar' }, h('h1', null, '体重　' + U.fmtDate(date, true) + ' の測定'),
      h('div', { class: 'no-print' }, h('button', { class: 'btn', onclick: () => window.print() }, '一覧を印刷（ユニットに返す）'))));
    root.appendChild(V.dateBar(date, (d) => App.go('#/weights/' + d)));
    root.appendChild(h('div', { class: 'toolrow no-print' },
      h('button', { class: 'btn seg' + (onlyMissing ? ' on' : ''), onclick: () => { onlyMissing = !onlyMissing; App.refresh(); } }, date.slice(5, 7) * 1 + '月がまだの人だけ（' + missing + '）'),
      h('span', { class: 'sub' }, '数字を入れて Enter で次の人へ。測定日は上の日付です。')));

    const inputs = [];
    const rows = residents.filter((r) => !onlyMissing || !doneThisMonth(r)).map((r) => {
      const list = all[r.id] || [];
      const today = list.find((w) => w.date === date);
      const before = list.filter((w) => w.date < date);
      const prev = before[before.length - 1] || null;
      const ev = W.evaluate(r, list, date);
      const outCells = h('span');
      const inp = h('input', { class: 'input num', type: 'number', step: '0.1', min: '0', value: today ? today.value : '', placeholder: 'kg' });
      const showDiff = () => {
        outCells.innerHTML = '';
        const v = parseFloat(inp.value);
        if (!v || !prev) return;
        const diff = v - prev.value, big = Math.abs(diff) >= m.weightAlertKg, odd = Math.abs(diff) >= Math.max(8, prev.value * 0.15);
        outCells.appendChild(h('span', { class: big ? 'bad-text' : '' }, (diff > 0 ? '+' : '') + diff.toFixed(1) + 'kg' + (odd ? '　入力まちがいでは？' : '')));
      };
      inp.addEventListener('input', showDiff);
      inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); const nx = inputs[inputs.indexOf(inp) + 1]; if (nx) nx.focus(); else inp.blur(); } });
      inp.addEventListener('change', async () => {
        const v = parseFloat(inp.value), id = r.id + '_w_' + date;
        if (v > 0) await DB.put('measures', { id: id, residentId: r.id, kind: 'weight', date: date, value: v, recordedAt: Date.now(), by: V.recorder() });
        else if (today) await DB.del('measures', id);
        if (document.activeElement && document.activeElement.tagName === 'INPUT') { saved.textContent = '保存'; return; } // 入力の途中で表を描き直さない
        App.refresh();
      });
      const saved = h('span', { class: 'sub' });
      inputs.push(inp); showDiff();
      return h('tr', null, h('td', null, V.where(r)), h('td', null, h('a', { href: '#/resident/' + r.id }, r.name)),
        h('td', { class: 'sub' }, prev ? prev.value.toFixed(1) + 'kg（' + U.fmtDate(prev.date) + '）' : '—'),
        h('td', { class: 'no-print-border' }, inp, ' ', saved), h('td', null, outCells),
        h('td', null, ev.bmi ? ev.bmi.toFixed(1) : (r.heightCm ? '—' : h('span', { class: 'sub' }, '身長なし'))),
        h('td', null, pct(ev.loss.m1)), h('td', null, pct(ev.loss.m3)), h('td', null, pct(ev.loss.m6)), h('td', null, W.riskBadge(ev.risk), ' ', h('span', { class: 'sub' }, ev.risk.reasons.join('、'))));
    });
    root.appendChild(rows.length ? h('table', { class: 'list bordered' },
      h('thead', null, h('tr', null, ['場所', '氏名', '前回', '今回 (kg)', '前回との差', 'BMI', '1か月', '3か月', '6か月', '低栄養リスク（体重・BMI から）'].map((t) => h('th', null, t)))),
      h('tbody', null, rows)) : h('div', { class: 'empty' }, onlyMissing ? '今月は全員測定済みです。' : 'この日に在籍している人がいません。'));
    root.appendChild(h('div', { class: 'sub' }, '減少率は、それぞれ 1・3・6 か月前にいちばん近い測定（前後 15 日以内）との比較です。▼は減少、▲は増加。リスクは体重と BMI だけで出した目安で、Alb・食事摂取量・褥瘡などは含みません。'));
    if (inputs.length && !params[1]) { const first = inputs.find((i) => !i.value); if (first) setTimeout(() => first.focus(), 0); }
  });

  // 個人画面の欄
  window.Residents.registerSection({ order: 10, render: async function (r) {
    const list = (await DB.byIndex('measures', 'residentId', r.id)).filter((x) => x.kind === 'weight').sort((a, b) => b.date.localeCompare(a.date));
    const ev = W.evaluate(r, list.slice().reverse(), U.today());
    return h('section', { class: 'card' },
      h('div', { class: 'sec-head' }, h('h2', null, '体重 ', W.riskBadge(ev.risk)), h('a', { class: 'btn no-print', href: '#/weights' }, '体重の入力へ')),
      ev.risk.reasons.length ? h('div', { class: 'sub' }, ev.risk.reasons.join('、')) : null,
      list.length ? h('table', { class: 'list' }, h('thead', null, h('tr', null, ['測定日', '体重', '前回との差', 'BMI'].map((t) => h('th', null, t)))),
        h('tbody', null, list.slice(0, 12).map((w, i) => {
          const p = list[i + 1], diff = p ? w.value - p.value : null, b = M.bmi(w.value, r.heightCm);
          return h('tr', null, h('td', null, U.fmtDate(w.date, true)), h('td', null, w.value.toFixed(1) + ' kg'),
            h('td', { class: diff != null && Math.abs(diff) >= ms().weightAlertKg ? 'bad-text' : '' }, diff == null ? '—' : (diff > 0 ? '+' : '') + diff.toFixed(1)), h('td', null, b ? b.toFixed(1) : '—'));
        }))) : h('div', { class: 'empty' }, 'まだ測定がありません。'));
  } });

  App.registerTodo(async function (ctx) {
    const all = await W.byResident(), month = ctx.today.slice(0, 7), out = [];
    const target = ctx.residents.filter((r) => r._st === 'in');
    const missing = target.filter((r) => !(all[r.id] || []).some((w) => w.date.slice(0, 7) === month));
    if (missing.length && target.length) out.push({ level: 'info', text: '今月の体重がまだの人: ' + missing.length + '人', href: '#/weights' });
    const high = target.filter((r) => W.evaluate(r, all[r.id], ctx.today).risk.level === 'high');
    if (high.length) out.push({ level: 'warn', text: '体重の減り方が大きい人（リスク高）: ' + high.map((r) => r.name).join('、'), href: '#/weights' });
    return out;
  });

  App.registerNav({ order: 50, feature: 'weights', label: '体重', icon: '⚖️', hash: '#/weights', match: ['weights'] });
  window.Weights = W;
})();
