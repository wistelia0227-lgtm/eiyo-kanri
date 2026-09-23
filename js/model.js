// 計算の核。DOM にも DB にも触れない（Node でも試験できる）。window.Model で公開。
// 考え方:
//  - 利用者 1 件が唯一の元データ。食札・食数・変更者一覧・禁食一覧は全部ここから計算する
//  - 「いつの・どの食事か」は枠 slot = { d:'YYYY-MM-DD', m:食事ID } で表す
//  - 食事情報は上書きせず「版」を足す（いつから・誰の指示で）。消さずに cancelledAt を付ける
//  - 入所/ショート/デイを分けて処理しない。在籍期間 + 曜日 + 食べる食事 + 欠食 の 1 つの判定で扱う
(function (root) {
  'use strict';
  const M = {};

  // ---- 日付 ----
  M.dayNum = function (s) { const p = s.split('-').map(Number); return Math.round(Date.UTC(p[0], p[1] - 1, p[2]) / 86400000); };
  M.dayStr = function (n) { return new Date(n * 86400000).toISOString().slice(0, 10); };
  M.addDays = function (s, k) { return M.dayStr(M.dayNum(s) + k); };
  M.weekday = function (s) { return new Date(M.dayNum(s) * 86400000).getUTCDay(); };
  M.addMonths = function (s, k) {
    const p = s.split('-').map(Number);
    const d = new Date(Date.UTC(p[0], p[1] - 1 + k, 1));
    const last = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
    d.setUTCDate(Math.min(p[2], last));
    return d.toISOString().slice(0, 10);
  };

  // ---- 枠 ----
  function mealIndex(meals, id) { const i = meals.findIndex((x) => x.id === id); return i < 0 ? 0 : i; }
  M.slotKey = function (meals, slot) { return M.dayNum(slot.d) * 10 + mealIndex(meals, slot.m); };
  function fromKey(meals, p) { return M.dayNum(p.d) * 10 + (p.m ? mealIndex(meals, p.m) : 0); }
  function toKey(meals, p) { return (!p || !p.d) ? Infinity : M.dayNum(p.d) * 10 + (p.m ? mealIndex(meals, p.m) : 9); }
  M.inRange = function (meals, rec, slot) {
    const k = M.slotKey(meals, slot);
    return fromKey(meals, rec.from) <= k && k <= toKey(meals, rec.to);
  };
  M.activeMeals = function (masters) { return masters.meals.filter((x) => x.on !== false); };

  // ---- 利用者（足りない項目は既定値で補う＝古いデータも壊さない） ----
  M.newResident = function (name, uid) {
    return M.normalizeResident({ id: uid('r'), name: name, createdAt: Date.now() });
  };
  M.normalizeResident = function (r) {
    r.kana = r.kana || ''; r.gender = r.gender || ''; r.birth = r.birth || '';
    r.heightCm = r.heightCm || null;
    r.insuredNo = r.insuredNo || ''; r.insurerNo = r.insurerNo || ''; r.careLevel = r.careLevel || '';
    r.category = r.category || 'long';
    r.unit = r.unit || ''; r.room = r.room || '';
    r.weekdays = r.weekdays || [];     // 空 = 毎日
    r.mealsTaken = r.mealsTaken || []; // 空 = 全部の食事
    r.stays = r.stays || []; r.absences = r.absences || []; r.diet = r.diet || [];
    r.memo = r.memo || ''; r.archived = !!r.archived;
    r.energyRule = r.energyRule || null;   // 必要栄養量の出し方（js/nutri.js の N.personalNeed）
    return r;
  };
  M.emptyDiet = function () {
    return { shokushu: '', staple: '', stapleG: null, side: '', soupThick: '', drinkThick: '', portion: '',
      kinshi: [], allergy: [], supplements: [], tools: [], cond: [], assist: '', place: '', notes: '', byMeal: {} };
  };
  M.normalizeDiet = function (d) { return Object.assign(M.emptyDiet(), d || {}); };

  // ---- 在籍判定 ----
  // 返り値 state: 'in'=食べる / 'absent'=在籍だが欠食 / 'off'=在籍だがその曜日・食事は対象外 / 'out'=在籍していない
  M.presence = function (r, slot, meals) {
    const stay = r.stays.find((s) => !s.cancelledAt && M.inRange(meals, s, slot));
    if (!stay) return { state: 'out' };
    if (r.weekdays.length && r.weekdays.indexOf(M.weekday(slot.d)) < 0) return { state: 'off', stay: stay };
    if (r.mealsTaken.length && r.mealsTaken.indexOf(slot.m) < 0) return { state: 'off', stay: stay };
    const ab = r.absences.find((a) => !a.cancelledAt && M.inRange(meals, a, slot));
    if (ab) return { state: 'absent', stay: stay, absence: ab };
    return { state: 'in', stay: stay };
  };
  // 今日を基準にした在籍の見出し: 在籍中 / 予定あり / 休止
  M.status = function (r, today, meals) {
    const live = r.stays.filter((s) => !s.cancelledAt);
    const t = M.dayNum(today) * 10;
    if (live.some((s) => fromKey(meals, s.from) <= t + 9 && t <= toKey(meals, s.to))) return 'in';
    if (live.some((s) => fromKey(meals, s.from) > t + 9)) return 'planned';
    return 'rest';
  };

  // ---- 食事情報の版 ----
  M.versionAt = function (r, slot, meals) {
    const k = M.slotKey(meals, slot);
    let best = null;
    r.diet.forEach((v) => {
      if (v.cancelledAt) return;
      const vk = fromKey(meals, v.from);
      if (vk > k) return;
      if (!best || vk > best.k || (vk === best.k && (v.recordedAt || 0) > (best.v.recordedAt || 0))) best = { k: vk, v: v };
    });
    return best ? best.v : null;
  };
  M.dietAt = function (r, slot, meals) {
    const v = M.versionAt(r, slot, meals);
    if (!v) return null;
    const d = M.normalizeDiet(v.data);
    return Object.assign({}, d, d.byMeal[slot.m] || {});
  };
  M.prevVersion = function (r, v, meals) {
    const vk = fromKey(meals, v.from);
    return r.diet.filter((x) => x !== v && !x.cancelledAt &&
      (fromKey(meals, x.from) < vk || (fromKey(meals, x.from) === vk && (x.recordedAt || 0) < (v.recordedAt || 0))))
      .sort((a, b) => fromKey(meals, b.from) - fromKey(meals, a.from) || (b.recordedAt || 0) - (a.recordedAt || 0))[0] || null;
  };

  // 表示名。マスタに無い ID はそのまま出す（名前を消しても落ちない）
  M.label = function (list, id) { if (!id) return ''; const x = (list || []).find((y) => y.id === id); return x ? x.label : id; };
  M.item = function (list, id) { return (list || []).find((y) => y.id === id) || null; };

  const DIET_FIELDS = [
    ['shokushu', '食種', 'shokushu'], ['staple', '主食', 'staple'], ['stapleG', '主食量(g)', null], ['side', '副食', 'side'],
    ['soupThick', '汁のとろみ', 'thick'], ['drinkThick', '飲み物のとろみ', 'thick'], ['portion', '量', 'portion'],
    ['assist', '介助', 'assist'], ['place', '配膳場所', null], ['notes', '注意', null]];
  function listText(a, f) { return (a || []).map(f).filter(Boolean).join('、'); }
  M.kinshiText = function (d) { return listText(d.kinshi, (k) => k.food + (k.sub ? '→' + k.sub : '')); };
  M.suppText = function (d) { return listText(d.supplements, (s) => s.name + (s.when ? '(' + s.when + ')' : '')); };
  M.condText = function (d, masters) { return listText(d.cond, (c) => M.label(masters.cond, c.when) + ': ' + c.text); };
  // 2 つの食事情報の違いを「項目: 前 → 後」の文で返す
  M.diffDiet = function (a, b, masters) {
    a = M.normalizeDiet(a); b = M.normalizeDiet(b);
    const out = [];
    const show = (v, mk) => (v == null || v === '') ? 'なし' : (mk ? M.label(masters[mk], v) : String(v));
    DIET_FIELDS.forEach((f) => { if ((a[f[0]] || '') !== (b[f[0]] || '')) out.push(f[1] + ': ' + show(a[f[0]], f[2]) + ' → ' + show(b[f[0]], f[2])); });
    [['禁食', M.kinshiText], ['アレルギー', (d) => d.allergy.join('、')], ['補食', M.suppText],
      ['食器・自助具', (d) => d.tools.join('、')], ['条件つきの指示', (d) => M.condText(d, masters)],
      ['食事ごとの違い', (d) => JSON.stringify(d.byMeal) === '{}' ? '' : Object.keys(d.byMeal).map((m) => M.label(masters.meals, m)).join('・') + 'に個別設定']
    ].forEach((f) => { const x = f[1](a), y = f[1](b); if (x !== y) out.push(f[0] + ': ' + (x || 'なし') + ' → ' + (y || 'なし')); });
    return out;
  };

  // 変更連絡票の「前／後」2 行に並べる項目。値が変わった所だけ ★ を付けて読む人が拾えるようにする
  M.ROW_FIELDS = [
    { key: 'shokushu', label: '食種', master: 'shokushu' },
    { key: 'staple', label: '主食', master: 'staple', withG: true },
    { key: 'side', label: '副食', master: 'side' },
    { key: 'soupThick', label: '汁とろみ', master: 'thick' },
    { key: 'drinkThick', label: '飲物とろみ', master: 'thick' },
    { key: 'portion', label: '量', master: 'portion' },
    { key: 'kinshi', label: '禁食' },
    { key: 'allergy', label: 'アレルギー' },
    { key: 'notes', label: '注意' }
  ];
  M.rowOf = function (data, masters) {
    const d = M.normalizeDiet(data);
    return M.ROW_FIELDS.map((f) => {
      if (f.key === 'kinshi') return M.kinshiText(d);
      if (f.key === 'allergy') return d.allergy.join('、');
      if (f.key === 'notes') return d.notes || '';
      const v = f.master ? M.label(masters[f.master], d[f.key]) : (d[f.key] || '');
      return f.withG && d.stapleG ? (v + ' ' + d.stapleG + 'g') : v;
    });
  };

  // ---- 食数 ----
  M.census = function (residents, slot, masters) {
    const meals = masters.meals;
    const c = { total: 0, byCategory: {}, byShokushu: {}, byStaple: {}, bySide: {}, rows: [], absent: [], noDiet: [] };
    const inc = (o, k) => { k = k || '(未設定)'; o[k] = (o[k] || 0) + 1; };
    residents.forEach((r) => {
      if (r.archived) return;
      const p = M.presence(r, slot, meals);
      if (p.state === 'absent') { c.absent.push({ r: r, absence: p.absence }); return; }
      if (p.state !== 'in') return;
      const d = M.dietAt(r, slot, meals);
      c.total++; inc(c.byCategory, r.category);
      if (!d) { c.noDiet.push(r); inc(c.byShokushu, ''); inc(c.byStaple, ''); inc(c.bySide, ''); c.rows.push({ r: r, diet: null }); return; }
      inc(c.byShokushu, d.shokushu); inc(c.byStaple, d.staple); inc(c.bySide, d.side);
      c.rows.push({ r: r, diet: d });
    });
    return c;
  };

  // ---- 禁食・アレルギー × その日に出る物 ----
  // words = その食事に出る物を表す言葉の並び（料理名・材料名・料理に付けたアレルギー品目・「パン」「麺」などの合図）
  // 突き合わせは名前の一致。加工品は名前に出ないので漏れる（画面に必ずその旨を出すこと）
  M.matchRestrictions = function (diet, words) {
    const hits = [];
    if (!diet) return hits;
    const src = (words || []).filter(Boolean);
    const find = (needle) => src.filter((w) => w.indexOf(needle) >= 0);
    diet.allergy.forEach((a) => { const w = find(a); if (w.length) hits.push({ kind: 'allergy', word: a, sub: '', where: w }); });
    diet.kinshi.forEach((k) => { const w = find(k.food); if (w.length) hits.push({ kind: 'kinshi', word: k.food, sub: k.sub || '', where: w }); });
    return hits;
  };
  // その枠に食べる人それぞれについて、当たるものを返す
  M.restrictionsAt = function (residents, slot, masters, words) {
    const out = [];
    residents.forEach((r) => {
      if (r.archived) return;
      if (M.presence(r, slot, masters.meals).state !== 'in') return;
      const d = M.dietAt(r, slot, masters.meals);
      const hits = M.matchRestrictions(d, words);
      if (hits.length) out.push({ r: r, diet: d, hits: hits });
    });
    return out.sort((a, b) => (a.r.unit + a.r.room).localeCompare(b.r.unit + b.r.room, 'ja'));
  };

  // ---- その日の変更（変更者一覧・変更連絡票・「変更があった人だけ食札」） ----
  M.eventsOn = function (residents, date, masters) {
    const meals = masters.meals, out = [];
    const ml = (m) => m ? M.label(meals, m) + 'から' : '';
    const mlTo = (m) => m ? M.label(meals, m) + 'まで' : '';
    residents.forEach((r) => {
      if (r.archived) return;
      r.stays.forEach((s) => {
        if (s.cancelledAt) return;
        if (s.from.d === date) out.push({ type: 'in', r: r, m: s.from.m, text: '入所 ' + ml(s.from.m), rec: s });
        if (s.to && s.to.d === date) out.push({ type: 'out', r: r, m: s.to.m, text: '退所 ' + mlTo(s.to.m), rec: s });
      });
      r.absences.forEach((a) => {
        if (a.cancelledAt) return;
        if (a.from.d === date) out.push({ type: 'absStart', r: r, m: a.from.m, text: (a.reason || '欠食') + ' ' + ml(a.from.m) + '欠食', rec: a });
        if (a.to && a.to.d === date) out.push({ type: 'absEnd', r: r, m: a.to.m, text: (a.reason || '欠食') + ' ' + mlTo(a.to.m) + '欠食（以後は食事あり）', rec: a });
      });
      r.diet.forEach((v) => {
        if (v.cancelledAt || v.from.d !== date) return;
        const prev = M.prevVersion(r, v, meals);
        if (!prev) return; // 最初の版は「入所」で足りる
        out.push({ type: 'diet', r: r, m: v.from.m, text: '食事変更 ' + ml(v.from.m), lines: M.diffDiet(prev.data, v.data, masters), rec: v });
      });
    });
    return out.sort((a, b) => mealIndex(meals, a.m) - mealIndex(meals, b.m) || (a.r.unit + a.r.room).localeCompare(b.r.unit + b.r.room, 'ja'));
  };
  // 食札を刷り直す必要がある人（その日に 入所・復帰・食事変更 がある）
  M.cardChangedIds = function (residents, date, masters) {
    const ids = {};
    M.eventsOn(residents, date, masters).forEach((e) => { if (e.type === 'in' || e.type === 'absEnd' || e.type === 'diet') ids[e.r.id] = true; });
    return ids;
  };

  // ---- 締切のあとに入った変更 ----
  // deadline = { daysBefore, time:'HH:MM' }。対象日 d の締切時刻（ローカル時刻のミリ秒）
  M.deadlineMs = function (date, dl) {
    const p = M.addDays(date, -(dl.daysBefore || 0)).split('-').map(Number), t = (dl.time || '17:00').split(':').map(Number);
    return new Date(p[0], p[1] - 1, p[2], t[0], t[1] || 0).getTime();
  };
  // 記録 1 件が、いつ・どの日付に影響したかの列 [{at, d, what}]
  function touches(rec, kind) {
    const out = [{ at: rec.recordedAt || 0, d: rec.from.d, what: kind + 'を登録' }];
    (rec.changes || []).forEach((c) => {
      const ds = [c.old && c.old.d, c.new && c.new.d].filter(Boolean).sort();
      out.push({ at: c.at, d: ds[0] || rec.from.d, what: kind + 'の' + c.label + 'を変更' });
    });
    if (rec.cancelledAt) out.push({ at: rec.cancelledAt, d: rec.from.d, what: kind + 'を取り消し' });
    return out;
  }
  M.lateChanges = function (residents, dl, fromDate) {
    const out = [];
    residents.forEach((r) => {
      const all = [];
      r.stays.forEach((s) => touches(s, '入退所').forEach((t) => all.push(t)));
      r.absences.forEach((a) => touches(a, '欠食').forEach((t) => all.push(t)));
      r.diet.forEach((v) => touches(v, '食事内容').forEach((t) => all.push(t)));
      all.forEach((t) => { if (t.d >= fromDate && t.at > M.deadlineMs(t.d, dl)) out.push({ r: r, d: t.d, at: t.at, what: t.what }); });
    });
    return out.sort((a, b) => a.d.localeCompare(b.d) || a.at - b.at);
  };

  // ---- 体重 ----
  // list = [{date, value}]。基準日の months か月前に最も近い測定（前後 windowDays 日以内）と比べた減少率(%)。増加は負
  M.weightAt = function (list, date, windowDays) {
    const t = M.dayNum(date); let best = null;
    list.forEach((w) => { const gap = Math.abs(M.dayNum(w.date) - t); if (gap <= windowDays && (!best || gap < best.gap)) best = { gap: gap, w: w }; });
    return best ? best.w : null;
  };
  M.lossRate = function (list, cur, months, windowDays) {
    const past = M.weightAt(list.filter((w) => w.date < cur.date), M.addMonths(cur.date, -months), windowDays == null ? 15 : windowDays);
    if (!past || !past.value) return null;
    return { rate: (past.value - cur.value) / past.value * 100, past: past };
  };
  M.bmi = function (kg, cm) { return (kg && cm) ? kg / Math.pow(cm / 100, 2) : null; };
  // 低栄養リスク。閾値は masters.risk（設定データ）から。返り値 { level:'low'|'mid'|'high'|null, reasons:[] }
  M.risk = function (input, th) {
    const reasons = []; let lv = 0, known = false;
    const hit = (n, text) => { lv = Math.max(lv, n); reasons.push((n === 2 ? '高: ' : '中: ') + text); };
    if (input.bmi != null) { known = true; if (input.bmi < th.bmiMid) hit(1, 'BMI ' + input.bmi.toFixed(1)); }
    [['m1', 1], ['m3', 3], ['m6', 6]].forEach((k) => {
      const v = input.loss && input.loss[k[0]]; if (v == null) return; known = true;
      const t = th.loss[k[0]];
      if (v >= t.high) hit(2, k[1] + 'か月で ' + v.toFixed(1) + '% 減');
      else if (v >= t.mid) hit(1, k[1] + 'か月で ' + v.toFixed(1) + '% 減');
    });
    if (input.alb != null) { known = true; if (input.alb < th.albHigh) hit(2, 'Alb ' + input.alb); else if (input.alb <= th.albMid) hit(1, 'Alb ' + input.alb); }
    if (input.intake != null) { known = true; if (input.intake <= th.intakeMid) hit(1, '食事摂取量 ' + input.intake + '%'); }
    if (input.tube) { known = true; hit(1, '経腸・静脈栄養'); }
    if (input.pressureUlcer) { known = true; hit(2, '褥瘡'); }
    return { level: known ? ['low', 'mid', 'high'][lv] : null, reasons: reasons };
  };
  M.age = function (birth, today) {
    if (!birth) return null;
    const b = birth.split('-').map(Number), t = today.split('-').map(Number);
    return t[0] - b[0] - ((t[1] < b[1] || (t[1] === b[1] && t[2] < b[2])) ? 1 : 0);
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = M;
  root.Model = M;
})(typeof window !== 'undefined' ? window : globalThis);
