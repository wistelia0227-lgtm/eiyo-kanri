// 料理と献立をまとめて取り込むための解析。DOM にも DB にも触れない（Node で試験できる）。window.Bulk で公開。
//
// なぜ「そのまま入れない」か: 食品名から食品番号を当てるのは外しやすい。旧 nutrition-app の料理データは
// 焼き鮭に いさき、ほうれん草に にんじん が当たっていた（調査で実測）。黙って入れると、
// 栄養価の数字が静かに狂う。ここでは当てた結果に確からしさを付けて返し、画面で人が直せるようにする。
//
// 表の形（1 行 = 1 つの材料。同じ料理名の行がまとまって 1 つの料理になる）:
//   料理名 / 区分 / 何人分 / 食品番号 / 食品名 / 重量 / 主材料 / 調理法 / アレルギー / メモ
//   見出しの行は必須。順番は自由。要るのは 料理名 と 重量、それに 食品番号 か 食品名 のどちらか。
(function (root) {
  'use strict';
  const B = {};

  // 見出しの言い換え。施設や Excel の書き方の揺れを吸収する
  B.HEADERS = {
    dish: ['料理名', '料理', '献立名', 'メニュー名', 'name'],
    kind: ['区分', '料理区分', '種別', 'kind'],
    servings: ['何人分', '人数分', '出来上がり人数', 'servings'],
    no: ['食品番号', '成分表番号', '食品コード', 'no', 'foodid'],
    food: ['食品名', '材料名', '材料', '食材', 'food'],
    g: ['重量', '純使用量', '使用量', 'g', 'グラム', '分量'],
    main: ['主材料', 'main'],
    method: ['調理法', 'method'],
    allergy: ['アレルギー', 'アレルゲン', '特定原材料'],
    memo: ['メモ', '作り方', '備考', '作業指示', 'memo'],
    // 献立の取り込みに使う
    date: ['日付', '日', 'date'],
    meal: ['食事', '朝昼夕', 'meal'],
    shokushu: ['食種', 'shokushu'],
    x: ['人数分', '倍率', 'x']
  };

  function norm(s) {
    return String(s == null ? '' : s)
      .replace(/[Ａ-Ｚａ-ｚ０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xFEE0))
      .replace(/[　\s]+/g, '').toLowerCase();
  }
  B.headerKey = function (cell) {
    const n = norm(cell);
    const keys = Object.keys(B.HEADERS);
    for (const k of keys) if (B.HEADERS[k].some((w) => norm(w) === n)) return k;
    return null;
  };

  // タブ・カンマどちらでも読む。" で囲まれた中のカンマは区切りにしない
  B.splitRows = function (text) {
    const lines = String(text || '').replace(/\r\n?/g, '\n').split('\n');
    const tab = lines.slice(0, 5).some((l) => l.indexOf('\t') >= 0);
    return lines.map((line) => (tab ? line.split('\t') : B.splitCsv(line)).map((c) => String(c).trim().replace(/^"|"$/g, '')))
      .filter((cells) => cells.some((c) => c !== ''));
  };
  B.splitCsv = function (line) {
    const out = [];
    let cur = '', q = false;
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (q) {
        if (c === '"' && line[i + 1] === '"') { cur += '"'; i++; }
        else if (c === '"') q = false;
        else cur += c;
      } else if (c === '"') q = true;
      else if (c === ',') { out.push(cur); cur = ''; }
      else cur += c;
    }
    out.push(cur);
    return out;
  };

  // 表 → 行の並び（見出しを key に読み替えたもの）
  B.parse = function (text) {
    const rows = B.splitRows(text);
    if (!rows.length) return { error: '中身がありません。', rows: [] };
    const head = rows[0].map(B.headerKey);
    if (!head.some((k) => k === 'dish')) return { error: '1 行目に見出しが要ります（「料理名」の列が見つかりません）。', rows: [] };
    const out = [];
    for (let i = 1; i < rows.length; i++) {
      const o = { line: i + 1 };
      head.forEach((k, c) => { if (k) o[k] = rows[i][c] == null ? '' : rows[i][c]; });
      out.push(o);
    }
    return { error: null, rows: out, head: head };
  };

  // 食品名から食品番号を当てる。how: 'no'=番号そのまま / 'exact'=名前が同じ / 'one'=候補が 1 つ / 'many'=候補が複数 / 'none'=見つからない
  B.matchFood = function (N, no, name) {
    if (no) {
      const f = N.get(String(no).trim());
      if (f) return { how: 'no', food: f, cands: [] };
      return { how: 'none', food: null, cands: [], why: '食品番号 ' + no + ' は成分表にありません' };
    }
    const q = String(name || '').trim();
    if (!q) return { how: 'none', food: null, cands: [], why: '食品名も食品番号もありません' };
    const hits = N.search(q, { limit: 30 });
    if (!hits.length) return { how: 'none', food: null, cands: [], why: '「' + q + '」に当たる食品がありません' };
    // 「こいくちしょうゆ」は成分表では「＜調味料類＞（しょうゆ類）こいくちしょうゆ」。
    // 分類の括りを外した名前でも「ぴったり」と見る
    const exact = hits.filter((f) => f.name === q || N.shortName(f.name) === q);
    if (exact.length === 1) return { how: 'exact', food: exact[0], cands: [] };
    if (hits.length === 1) return { how: 'one', food: hits[0], cands: [] };
    // 候補の並び: 書いた名前で始まるものを先に。
    // そうしないと「にんじん」で「つるにんじん」が先に出る（成分表の検索は短い名前を先にするため）
    const head = hits.filter((f) => N.shortName(f.name).indexOf(q) === 0);
    const rest = hits.filter((f) => N.shortName(f.name).indexOf(q) !== 0);
    const sorted = head.concat(rest);
    return { how: 'many', food: sorted[0], cands: sorted.slice(0, 8) };
  };

  // 行の並び → 料理の並び。同じ料理名がまとまる
  // N = window.Nutri。返り値の各料理に ok（そのまま入れてよいか）と、直すべき材料が付く
  B.toDishes = function (rows, N) {
    const order = [], byName = {};
    rows.forEach((r) => {
      const name = String(r.dish || '').trim();
      if (!name) return;
      let d = byName[name];
      if (!d) {
        d = byName[name] = { name: name, kind: '', servings: 1, main: '', method: '', allergy: [], memo: '', items: [], lines: [] };
        order.push(d);
      }
      // 料理の属性は、書いてある最初の値を使う
      if (!d.kind && r.kind) d.kind = String(r.kind).trim();
      if (!d.main && r.main) d.main = String(r.main).trim();
      if (!d.method && r.method) d.method = String(r.method).trim();
      if (!d.memo && r.memo) d.memo = String(r.memo).trim();
      if (r.servings && !d.servingsSet) { const v = parseFloat(r.servings); if (v > 0) { d.servings = Math.round(v); d.servingsSet = true; } }
      if (r.allergy) String(r.allergy).split(/[・,、\/]/).forEach((a) => { a = a.trim(); if (a && d.allergy.indexOf(a) < 0) d.allergy.push(a); });
      d.lines.push(r.line);
      // 材料
      const g = parseFloat(r.g);
      if (!r.no && !r.food) return;              // 料理の属性だけの行（材料なし）
      const m = B.matchFood(N, r.no, r.food);
      d.items.push({ line: r.line, given: String(r.food || r.no || '').trim(), g: (g > 0 ? g : 0),
        no: m.food ? m.food.no : '', name: m.food ? m.food.name : '', how: m.how, cands: m.cands, why: m.why || '',
        noG: !(g > 0) });
    });
    order.forEach((d) => {
      delete d.servingsSet;
      d.bad = d.items.filter((i) => i.how === 'none' || i.noG).length;
      d.check = d.items.filter((i) => i.how === 'many' || i.how === 'one').length;
      d.ok = d.bad === 0 && d.items.length > 0;
    });
    return order;
  };

  B.summary = function (dishes) {
    return {
      dishes: dishes.length,
      items: dishes.reduce((s, d) => s + d.items.length, 0),
      ok: dishes.filter((d) => d.ok).length,
      bad: dishes.filter((d) => d.bad).length,
      check: dishes.reduce((s, d) => s + d.check, 0),
      empty: dishes.filter((d) => !d.items.length).length
    };
  };

  // 料理 → 取り込み用の表（書き出しにも使う）
  B.EXPORT_HEAD = ['料理名', '区分', '何人分', '食品番号', '食品名', '重量', '主材料', '調理法', 'アレルギー', 'メモ'];
  B.toRows = function (dishes) {
    const out = [B.EXPORT_HEAD.slice()];
    dishes.forEach((d) => {
      const items = (d.items && d.items.length) ? d.items : [{ no: '', name: '', g: '' }];
      items.forEach((it, i) => {
        out.push([d.name, i === 0 ? (d.kind || '') : '', i === 0 ? (d.servings || 1) : '',
          it.no || '', it.name || '', it.g === '' ? '' : it.g,
          i === 0 ? (d.main || '') : '', i === 0 ? (d.method || '') : '',
          i === 0 ? (d.allergy || []).join('・') : '', i === 0 ? (d.memo || '') : '']);
      });
    });
    return out;
  };

  // ---- 献立の取り込み ----
  // 表の形: 日付 / 食事 / 食種 / 料理名 / 人数分
  B.parseMenu = function (text) {
    const rows = B.splitRows(text);
    if (!rows.length) return { error: '中身がありません。', rows: [] };
    const head = rows[0].map(B.headerKey);
    if (!head.some((k) => k === 'date') || !head.some((k) => k === 'dish')) {
      return { error: '1 行目に見出しが要ります（「日付」と「料理名」の列）。', rows: [] };
    }
    const out = [];
    for (let i = 1; i < rows.length; i++) {
      const o = { line: i + 1 };
      head.forEach((k, c) => { if (k) o[k] = rows[i][c] == null ? '' : rows[i][c]; });
      out.push(o);
    }
    return { error: null, rows: out };
  };
  // 日付の書き方の揺れを吸収（2026/10/1、2026-10-01、10/1）
  B.toDate = function (s, fallbackYear) {
    const t = String(s || '').trim().replace(/[年月]/g, '/').replace(/日/g, '');
    const m = t.match(/^(\d{4})[/-](\d{1,2})[/-](\d{1,2})/);
    if (m) return m[1] + '-' + ('0' + m[2]).slice(-2) + '-' + ('0' + m[3]).slice(-2);
    const m2 = t.match(/^(\d{1,2})[/-](\d{1,2})$/);
    if (m2 && fallbackYear) return fallbackYear + '-' + ('0' + m2[1]).slice(-2) + '-' + ('0' + m2[2]).slice(-2);
    return '';
  };
  // 名前 → マスタの ID（朝/昼/夕、常食/糖尿病食 など）。見つからなければ ''
  B.toId = function (list, s) {
    const n = norm(s);
    if (!n) return '';
    const hit = (list || []).find((x) => norm(x.label) === n || norm(x.id) === n);
    if (hit) return hit.id;
    const part = (list || []).find((x) => norm(x.label).indexOf(n) === 0 || n.indexOf(norm(x.label)) === 0);
    return part ? part.id : '';
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = B;
  root.Bulk = B;
})(typeof window !== 'undefined' ? window : globalThis);
