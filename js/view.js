// 複数の画面で使う表示部品。window.View で公開。
(function () {
  'use strict';
  const U = window.U, h = U.h, M = window.Model;
  const V = {};
  const ms = () => window.Master.current;

  // 呼び方（事業所プロファイル）。person=利用者/入居者/患者/園児, suffix=様/ちゃん, place=ユニット, admit=入所, leave=退所
  const FALLBACK = { person: '利用者', suffix: '様', place: 'ユニット・フロア', admit: '入所', leave: '退所' };
  V.t = function (key) { const m = window.Master.current, p = m && m.profile; return (p && p.terms && p.terms[key]) || FALLBACK[key] || ''; };
  V.sama = function (name) { return name + ' ' + V.t('suffix'); };
  V.stayInCats = function () { return ms().categories.filter((c) => c.stayIn !== false).map((c) => c.id); };
  V.ncmCats = function () { return ms().categories.filter((c) => c.ncm).map((c) => c.id); };

  V.STATUS = { in: { label: '在籍中', cls: 'ok' }, planned: { label: '予定あり', cls: 'info' }, rest: { label: '休止中', cls: 'mute' } };
  V.statusBadge = (st) => h('span', { class: 'badge ' + V.STATUS[st].cls }, V.STATUS[st].label);
  V.slotText = function (p, tail) { return p ? U.fmtDate(p.d) + (p.m ? ' ' + M.label(ms().meals, p.m) + (tail || '') : '') : '未定'; };
  V.where = (r) => [M.label(ms().units.map((u) => ({ id: u, label: u })), r.unit), r.room].filter(Boolean).join(' ');

  // 警告（アレルギー・禁食）。どの画面でも一番上・同じ形で出す
  V.warnBox = function (d) {
    if (!d || (!d.allergy.length && !d.kinshi.length)) return null;
    return h('div', { class: 'warnbox' },
      d.allergy.length ? h('div', null, h('b', null, 'アレルギー '), d.allergy.join('、')) : null,
      d.kinshi.length ? h('div', null, h('b', null, '禁食 '), M.kinshiText(d)) : null);
  };
  // 食事情報を 1 行の要約に
  V.dietShort = function (d) {
    if (!d) return '食事情報が未設定';
    const m = ms();
    return [M.label(m.shokushu, d.shokushu), M.label(m.staple, d.staple) + (d.stapleG ? ' ' + d.stapleG + 'g' : ''), M.label(m.side, d.side),
      d.soupThick ? '汁:' + M.label(m.thick, d.soupThick) : '', d.drinkThick ? '飲:' + M.label(m.thick, d.drinkThick) : '', M.label(m.portion, d.portion)]
      .filter((x) => x && x.trim()).join(' / ');
  };
  // 食事情報を項目ごとの表に
  V.dietTable = function (d) {
    const m = ms(), rows = [];
    const add = (k, v) => { if (v) rows.push(h('tr', null, h('th', null, k), h('td', null, v))); };
    add('食種', M.label(m.shokushu, d.shokushu));
    add('主食', M.label(m.staple, d.staple) + (d.stapleG ? ' ' + d.stapleG + 'g' : ''));
    add('副食', M.label(m.side, d.side));
    add('汁のとろみ', M.label(m.thick, d.soupThick)); add('飲み物のとろみ', M.label(m.thick, d.drinkThick));
    add('量', M.label(m.portion, d.portion)); add('補食', M.suppText(d)); add('食器・自助具', d.tools.join('、'));
    add('条件つきの指示', M.condText(d, m)); add('介助', M.label(m.assist, d.assist)); add('配膳場所', d.place); add('注意', d.notes);
    Object.keys(d.byMeal || {}).forEach((k) => {
      const o = d.byMeal[k], t = [M.label(m.staple, o.staple) + (o.stapleG ? ' ' + o.stapleG + 'g' : ''), M.label(m.side, o.side), o.soupThick ? '汁:' + M.label(m.thick, o.soupThick) : ''].filter((x) => x && x.trim()).join(' / ');
      add(M.label(m.meals, k) + 'だけ', t);
    });
    return h('table', { class: 'kv' }, rows);
  };
  V.catLabel = (r) => M.label(ms().categories, r.category);

  // 記録者の名前（前回の入力を覚える）
  V.recorder = function () { try { return localStorage.getItem('eiyo.recorder') || ms().facility.recorder || ''; } catch (e) { return ms().facility.recorder || ''; } };
  V.setRecorder = function (v) { try { localStorage.setItem('eiyo.recorder', v); } catch (e) { /* 覚えられなくても続ける */ } };

  // 今いちばん近い「次の食事」の枠
  V.nextSlot = function () {
    const meals = M.activeMeals(ms()), hr = new Date().getHours();
    const cut = { b: 7, l: 11, s: 14, d: 17 };
    const next = meals.find((x) => hr < (cut[x.id] == null ? 24 : cut[x.id]));
    return next ? { d: U.today(), m: next.id } : { d: M.addDays(U.today(), 1), m: meals[0].id };
  };
  // 画面上部の「日付を前後に動かす」部品
  V.dateBar = function (date, onchange) {
    const inp = h('input', { class: 'input', type: 'date', value: date, onchange: () => inp.value && onchange(inp.value) });
    return h('div', { class: 'datebar no-print' },
      h('button', { class: 'btn', onclick: () => onchange(M.addDays(date, -1)) }, '◀ 前の日'), inp,
      h('button', { class: 'btn', onclick: () => onchange(M.addDays(date, 1)) }, '次の日 ▶'),
      date !== U.today() ? h('button', { class: 'btn', onclick: () => onchange(U.today()) }, '今日') : null);
  };

  window.View = V;
})();
