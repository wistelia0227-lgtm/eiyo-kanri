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
  // 今いちばん近い「次の食事」の枠。meals = 使う食事、hour = 今の時（0〜23）
  // 区切り = その時刻になったら次の食事へ進む（食事の設定の until）。無ければ既定の印（b/l/s/d）の値、
  // 印も変えてある時は並び順で 朝 7 時〜最後 17 時 を割る（最後の食事の後は翌日の最初の食事）
  M.MEAL_CUT = { b: 7, l: 11, s: 14, d: 17 };
  M.mealCut = function (meals, i) {
    const x = meals[i];
    if (x && typeof x.until === 'number' && x.until > 0) return x.until;
    if (x && M.MEAL_CUT[x.id] != null) return M.MEAL_CUT[x.id];
    return meals.length < 2 ? 17 : Math.round(7 + 10 * i / (meals.length - 1));
  };
  M.nextSlotAt = function (meals, today, hour) {
    const next = meals.find((x, i) => hour < M.mealCut(meals, i));
    return next ? { d: today, m: next.id } : { d: M.addDays(today, 1), m: meals[0].id };
  };

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
    r.intake = r.intake || null;           // 入所時の聞き取り（modules/intake.js）
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
  // 入所時の聞き取り（modules/intake.js）を食事情報に写す時の、元の内容
  // = その時点の版の中身そのもの（dietAt は朝食などの個別設定を上に混ぜた形なので使わない）
  M.intakeBase = function (r, slot, meals) {
    const v = M.versionAt(r, slot, meals);
    return v ? M.normalizeDiet(JSON.parse(JSON.stringify(v.data))) : null;
  };
  // 聞き取りのうち、食事情報に写せるものを写す。アレルギー・禁食は置き換えず和にする（消える方向に写さない）
  M.intakeToDiet = function (v, diet) {
    const d = M.normalizeDiet(JSON.parse(JSON.stringify(diet || M.emptyDiet())));
    const allergy = d.allergy, kinshi = d.kinshi;
    if (v.shokushu) d.shokushu = v.shokushu;
    if (v.staple) d.staple = v.staple;
    if (v.stapleG) d.stapleG = Number(v.stapleG) || null;
    if (v.side) d.side = v.side;
    if (v.drinkThick) d.drinkThick = v.drinkThick;
    if (v.assist) d.assist = v.assist;
    if (v.tools && v.tools.length) d.tools = v.tools.slice();
    (v.allergy || []).forEach((a) => { if (a && allergy.indexOf(a) < 0) allergy.push(a); });
    (v.kinshi || []).map((k) => (typeof k === 'string' ? { food: k, sub: '' } : k)).forEach((k) => {
      if (k && k.food && !kinshi.some((o) => o.food === k.food)) kinshi.push({ food: k.food, sub: k.sub || '' });
    });
    if (v.suppName) d.supplements = [{ name: v.suppName, when: '' }];
    const notes = [v.sideWord ? '前の施設: ' + v.sideWord : '', v.thickWord ? 'とろみの呼び方: ' + v.thickWord : '',
      v.swWay && v.swWay.length ? v.swWay.join('・') : '', v.drugNg ? '服薬の禁忌: ' + v.drugNg : ''].filter(Boolean).join('　');
    if (notes) d.notes = [d.notes, notes].filter(Boolean).join('　');
    return d;
  };
  // 食事を変更する時に、元の内容にする版 =「いつから」の時点で有効な版（先の予定の版ではない）
  M.editBase = function (r, slot, meals) { return M.versionAt(r, slot, meals); };
  // 「いつから」より後に始まる予定の版（取り消していないもの）。早い順
  M.laterVersions = function (r, slot, meals) {
    const k = M.slotKey(meals, slot);
    return r.diet.filter((v) => !v.cancelledAt && fromKey(meals, v.from) > k)
      .sort((a, b) => fromKey(meals, a.from) - fromKey(meals, b.from) || (a.recordedAt || 0) - (b.recordedAt || 0));
  };
  // 今回の変更で「足した」アレルギー・禁食（外した物は数えない＝消える方向は運ばない）
  M.restrictionAdds = function (before, after) {
    const a = M.normalizeDiet(before), b = M.normalizeDiet(after);
    return { allergy: b.allergy.filter((x) => a.allergy.indexOf(x) < 0),
      kinshi: b.kinshi.filter((k) => !a.kinshi.some((o) => o.food === k.food)) };
  };
  // 足したアレルギー・禁食を、後の予定の版にも入れる。予定の版は書き換えず、取り消しの印を付けて
  // 同じ「いつから」で中身を足した版に置き換える（版は消さない・上書きしない）。置き換えた数を返す
  M.applyToLater = function (r, later, add, opt) {
    opt = opt || {};
    let count = 0;
    (later || []).forEach((v) => {
      const d = M.normalizeDiet(JSON.parse(JSON.stringify(v.data)));
      const al = add.allergy.filter((x) => d.allergy.indexOf(x) < 0);
      const ks = add.kinshi.filter((k) => !d.kinshi.some((o) => o.food === k.food));
      if (!al.length && !ks.length) return;
      d.allergy = d.allergy.concat(al);
      d.kinshi = d.kinshi.concat(ks.map((k) => Object.assign({}, k)));
      const at = opt.at || Date.now();
      const nv = Object.assign({}, v, { id: (opt.uid ? opt.uid('v') : v.id + '_' + at), data: d, replaces: v.id,
        reason: [v.reason, 'アレルギー・禁食の追加（' + al.concat(ks.map((k) => k.food)).join('、') + '）を反映'].filter(Boolean).join('／'),
        by: opt.by || v.by, recordedAt: at });
      v.cancelledAt = at; v.cancelledBy = opt.by || '';
      r.diet.push(nv);
      count++;
    });
    return count;
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
  // 言葉をそろえる: 全角/半角（NFKC）・カタカナ→ひらがな・小書き（ぁぃぅぇぉ）→大きく・英字は小文字・
  //   ハイフン類は長音「ー」・空白と記号は境目「|」にする（「しか にほんじか」が「かに」に当たらないように）。
  //   成分表の群の見出し（＜えび・かに類＞ など）は境目に置き換える（ずわいがに が「えび」に当たらないように。
  //   小分類（（かに類））はそのまま残すので、「加工品 がん漬」のような名前も小分類で拾える）
  M.normWord = function (s) {
    let x = String(s == null ? '' : s).normalize('NFKC').toLowerCase();
    x = x.replace(/<[^>]*>/g, '|');
    x = x.replace(/[ァ-ヶ]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0x60));
    x = x.replace(/[ぁぃぅぇぉ]/g, (c) => String.fromCharCode(c.charCodeAt(0) + 1)).replace(/ゔ/g, 'う').replace(/ゕ/g, 'か').replace(/ゖ/g, 'け');
    x = x.replace(/[‐-―−-]/g, 'ー');
    x = x.replace(/[\s　・、，。．,.:;／/()\[\]{}「」『』【】〔〕"'“”‘’!?？！&+=~*#%|]+/g, '|').replace(/^\|+|\|+$/g, '');
    return x;
  };
  // アレルギー品目ごとの言いかえ表。消費者庁の特定原材料等（表示義務 9・推奨 19）を全部持つ。
  //   same  = 同じ物の別の書き方（登録された言葉がこれならこの品目として扱い、出る物の側でも探す）
  //   alias = 登録の言葉としてだけ認める短い書き方（「とり」など。出る物の側では短すぎて探さない）
  //   foods = その品目を必ず含む加工品・料理・成分表の名前 →「確実」
  //   maybe = 含むことが多いが製品で違う物（しょうゆ・カレー・ドレッシング など）→「要確認」
  //   not   = 名前の中のこの部分は見ない（豆乳→乳、すいか→いか、ごまさば→ごま、乳用肥育牛肉→乳 を止める）
  //   unless= 名前にこれがあれば、この品目は当てない（もも肉 の「もも」など）
  //   foods/maybe の要素は文字列か { t: 語, unless: [その語を無効にする文脈] }
  //   「ふ」「牛」のように短い語は、単独で意味が決まる漢字だけ入れる（「牛」は 牛乳・牛蒡 を not で外す）
  const U = (t, unless) => ({ t: t, unless: unless });
  const FRY_NOT = ['フライドポテト', 'フライパン', 'フライビーンズ', 'フライド', 'アーモンド', 'カシュー', 'ひまわり', 'ブラジルナッツ', 'ヘーゼル', 'ペカン', 'ピスタチオ',
    'ジャイアントコーン', 'ショートニング', 'ひよこまめ', 'そらまめ', '落花生', 'らっかせい', 'ピーナッツ', 'マカダミア', 'くるみ'];
  const KATSU_NOT = ['かつお', 'かつら', 'かつぶし', 'ぶかつ', 'かつぎ', 'かつどん|やさい'];
  const PIE_NOT = ['パインアップル', 'パイナップル', 'パイン', 'pineapple', 'スパイス', 'パパイア', 'パパイヤ'];
  const MENCHI_NOT = ['しちめんちょう', '七面鳥'];
  const OKONOMI_NOT = ['お好み焼きソース', 'お好み焼き用', 'お好み焼きの素'];
  const NAN_NOT = ['ナンプラー', 'ぎんなん', 'なんこつ', 'なんばん', 'なんきん', 'なんば', 'なんてん'];
  const NUTS_NOT = ['ドーナッツ', 'ココナッツ', 'バターナッツ', 'ピーナッツ'];
  const MIX_NOT = ['トマト', '野菜'];
  const CURRY_NOT = ['カレー粉', 'カレーパウダー', 'カレー塩', 'カレーこ'];
  const CHICKEN_NOT = ['チキン', '鶏', 'とりにく', '鳥'];
  const KARAAGE_NOT = ['あじ', 'いわし', 'さば', 'ふぐ', 'たこ', 'いか', 'えび', 'かれい', 'きす', 'わかさぎ', '魚', 'ぶた', '豚', '牛', 'うし', 'から揚げ用', '唐揚げ用', 'からあげ用', 'から揚げ粉', '唐揚げ粉'];
  const NUTS_MAYBE = ['ミックスナッツ', U('ナッツ', NUTS_NOT)];
  const SHOYU_MAYBE = ['しょうゆ', '醤油', 'しょう油', '正油', 'ぽん酢', 'ポン酢', 'めんつゆ', 'つゆ', 'だし醤油', 'たれ', '三杯酢', '二杯酢', '合わせ酢',
    'ウスターソース', '中濃ソース', '濃厚ソース', 'お好み焼きソース', '焼きそばソース', 'とんかつソース', 'オイスターソース', 'ごまだれ', 'ごま酢',
    'つくだ煮', '佃煮', 'あめ煮', '甘露煮', 'かば焼', '蒲焼', '照り焼', '照焼', '角煮', 'みたらし', 'しょうゆせんべい', '南蛮漬', 'きんぴら', '肉じゃが', '筑前煮',
    '牛丼', '牛飯', '親子丼', 'すき焼', '煮物', '煮浸し', 'お浸し', 'おひたし', '和え', 'ぎょうざ', '餃子', 'しゅうまい', '焼売', '春巻', '酢豚', 'チャーハン', '八宝菜',
    'ちまき', '焼き鳥缶詰', 'ビーフジャーキー', '味付け缶詰', 'ブイヨン', 'コンソメ', 'ルウ', U('カレー', CURRY_NOT), 'ハヤシ', 'デミグラス', 'ミートソース',
    'ハンバーグ', 'ミートボール', 'ナゲット', 'つくね', 'ちくわ', '竹輪', 'かまぼこ', '蒲鉾', 'はんぺん',
    'さつま揚げ', 'つみれ', 'なると', '魚肉ソーセージ', '魚肉ハム', 'たまご豆腐', '卵豆腐', 'たまご焼', 'だし巻', '即席めん', 'カップめん', 'キムチ',
    'お茶漬け', 'ふりかけ', '即席すまし', 'おでん', '中華だし', 'ラーメンスープ', 'エビチリ', '肉まん', 'カレーパン', 'みそ味', '卯の花', 'いため煮', 'ナムル', '松前漬',
    'から揚げ', '唐揚げ', 'からあげ', 'チキンナゲット', 'たまり', '味付けのり', 'みりん干し', '調味干し', '甘酢漬', 'マーボー', '麻婆', 'トウバンジャン', '豆板醤', 'テンメンジャン', '甜麺醤',
    '缶詰|味付け', '味付け開き', '焼き豚', '焼豚', '和風ドレッシング', 'ごまドレ', 'クリームスープ', 'ポタージュ', '和風だし', '顆粒和風', 'チキンライス'];
  M.ALLERGEN_WORDS = {
    'えび': { same: ['海老', '蝦', 'エビ', 'shrimp', 'prawn'],
      foods: ['シュリンプ', 'ブラックタイガー', '桜海老', '桜えび', 'さくらえび', '甘海老', 'あまえび', '車海老', 'くるまえび', '干しえび', '芝海老', 'しばえび', '大正えび', 'バナメイ',
        'えびマヨ', 'えび天', '海老天', 'えびフライ', 'えびせん', 'スカンピ', 'ロブスター', '伊勢海老', 'いせえび', 'オマール', 'あかえび'],
      maybe: ['あみ', 'おきあみ', 'しゃこ', 'エビチリ', 'えびちり', 'キムチ', '八宝菜', U('春巻', ['の皮']), U('お好み焼', OKONOMI_NOT), 'ちゃんぽん', 'シーフード', '海鮮', 'かき揚げ', 'かきあげ'],
      not: ['えびいも', 'えびす', 'えびね', 'えびがに'] },
    'かに': { same: ['蟹', 'カニ', 'crab'],
      foods: ['がに', 'がざみ', 'かにかま', 'かに風味', 'かにみそ', '蟹味噌', 'がん漬', 'ずわい', 'たらば', '毛がに', '渡りがに', 'わたりがに', 'かに玉', 'かにたま', 'カニクリーム', 'かにクリーム', 'かに缶', '松葉がに', 'ソフトシェル'],
      maybe: ['シーフード', '海鮮', U('クリームコロッケ', ['コーン'])], not: [] },
    'くるみ': { same: ['胡桃', 'クルミ', 'walnut'], foods: ['ウォールナッツ', 'ウォルナッツ', 'くるみゆべし'], maybe: ['ゆべし'].concat(NUTS_MAYBE), not: [] },
    'カシューナッツ': { same: ['カシュー', 'cashew'], foods: [], maybe: NUTS_MAYBE, not: [] },
    '小麦': { same: ['こむぎ', 'コムギ', 'wheat'],
      foods: ['小麦粉', '薄力粉', '強力粉', '中力粉', U('全粒粉', ['ライむぎ', 'ライ麦', '大麦', 'おおむぎ']), 'てんぷら粉', '天ぷら粉', 'ふすま', '胚芽', '小麦でん粉', 'グルテン', 'セモリナ', 'デュラム', 'ブルグル', 'クスクス',
        U('パン', ['パン酵母', 'パンプキン', 'フライパン', 'パンダ', 'パンチェッタ']), '食パン', 'パン粉', 'コロネ', 'うどん', '饂飩', U('そうめん', ['かぼちゃ']), '素麺', 'ひやむぎ', '冷麦', 'ラーメン', 'らーめん', '中華めん', '中華麺',
        '中華そば', '焼きそば', 'やきそば', '焼そば', '沖縄そば', 'ちゃんぽん', '皿うどん', 'ほうとう', 'きしめん', '冷めん', 'マカロニ', 'スパゲッティ', 'スパゲティ', 'パスタ', 'ペンネ', 'ラザニア',
        'ぎょうざ', '餃子', 'ギョーザ', 'しゅうまい', '焼売', 'シューマイ', 'ワンタン', '春巻', 'はるまき', '肉まん', '中華まん', 'あんまん', U('まんじゅう', ['くずまんじゅう', 'かるかんまんじゅう']), '饅頭',
        '天ぷら', 'てんぷら', '天丼', 'かき揚げ', 'かきあげ', 'とんかつ', 'トンカツ', U('カツ', KATSU_NOT), 'カツレツ', U('メンチ', MENCHI_NOT), 'コロッケ', 'フリッター', 'ムニエル', 'ピカタ', U('フライ', FRY_NOT),
        'ルウ', U('カレー', CURRY_NOT), 'シチュー', 'グラタン', 'ホワイトソース', 'ベシャメル', U('ドリア', ['ドリアン']), 'ピザ', 'ケーキ', 'カステラ', 'クッキー', 'ビスケット', 'クラッカー', 'プレッツェル',
        'ウエハース', 'サブレ', U('パイ', PIE_NOT), 'タルト', 'ドーナツ', 'ドーナッツ', 'ワッフル', 'ホットケーキ', 'パンケーキ', 'クレープ', 'シュークリーム', 'エクレア', 'マドレーヌ', 'スコーン',
        'クロワッサン', 'デニッシュ', 'ペストリー', 'バウムクーヘン', U('お好み焼', ['お好み焼きソース']), 'たこ焼', 'たこやき', 'もんじゃ', 'すいとん', '麩', '麸', 'やきふ', '焼きふ', '焼き麩', '生麩', '車麩', 'ちくわぶ',
        'チャパティ', 'ホットドッグ', 'サンドイッチ', 'サンドウィッチ', 'ハンバーガー', 'バーガー', '今川焼', 'どら焼', 'きんつば', U('かりんとう', ['芋かりんとう']), '松風', 'げっぺい', '月餅',
        'ちゃつう', 'おのろけ豆', 'テンメンジャン', '甜麺醤', 'デミグラス', 'チキンナゲット', 'ナゲット', 'アメリカンドッグ', '揚げパン', 'ラスク', '桜もち|関東', 'くずもち|関東',
        '蒸しようかん', 'そばボーロ', 'ロシアケーキ', '米粉パン', 'ロールパン', 'コッペパン', 'ベーグル', 'マフィン', 'ナン|'],
      maybe: ['そば', U('ナン', NAN_NOT), 'ボーロ', 'だて巻', '伊達巻', 'ういろう', 'ゆべし', 'プレミックス', '穀物酢', '和風だし', '顆粒和風', 'ちくわ', '竹輪', 'かまぼこ', '蒲鉾', 'はんぺん', 'さつま揚げ', 'つみれ', 'なると'].concat(SHOYU_MAYBE),
      not: ['パン酵母', 'パンプキン', 'フライパン', 'パンダ', 'ナンプラー', 'ぎんなん', 'なんこつ', '軟骨', 'なんばん', 'なんきん', 'なんば', 'さんどまめ', '三度豆', '麦茶', '大麦', 'おおむぎ',
        'ライ麦', 'ライむぎ', 'はとむぎ', 'えんばく', '麦みそ', '麦こがし', 'パインアップル', 'パイナップル', 'カレー粉', 'グルテン不使用', '|そば粉', 'そば米', 'そばがき'] },
    'そば': { same: ['蕎麦', 'ソバ', 'buckwheat'],
      foods: ['そば粉', '蕎麦粉', 'そばがき', 'そばボーロ', 'ガレット', 'そば米', 'そば茶', 'そばの実', '十割', '二八', 'ざるそば', 'もりそば', 'かけそば', '干しそば', 'そば|生', 'そば|ゆで', '半生そば'],
      maybe: ['そばつゆ'],
      not: ['やきそば', '焼きそば', '焼そば', '中華そば', '沖縄そば', 'そばかす', 'そばめし'] },
    '卵': { same: ['たまご', 'タマゴ', '玉子', '鶏卵', 'けいらん', 'egg', '卵黄', '卵白', '全卵'],
      foods: ['マヨネーズ', 'マヨ', 'カスタード', U('茶碗蒸し', ['茶碗蒸し風']), U('茶わん蒸し', ['茶わん蒸し風']), 'ちゃわんむし', 'だし巻', 'だしまき', '厚焼き', 'オムレツ', 'オムライス', 'かき玉', 'かきたま',
        'メレンゲ', 'カステラ', '親子丼', 'タルタル', 'ピカタ', 'フレンチトースト', 'うずら卵', 'うずらの卵', 'うずらたまご', 'ピータン', '皮蛋', '錦糸', 'いり卵', '炒り卵', 'スクランブル',
        '目玉焼', 'ゆで卵', '温泉卵', '半熟', '卵焼', '卵とじ', 'たまごとじ', '天津', 'かに玉', 'かにたま', 'キッシュ', U('エッグ', ['ひとえぐさ']), 'スフレ', 'ババロア', 'ボーロ', 'どら焼', '今川焼', 'シュークリーム', 'エクレア',
        'スポンジ', 'ショートケーキ', 'ベイクドチーズケーキ', 'バターケーキ', 'ホットケーキ', 'パンケーキ', 'ワッフル', 'ドーナツ', 'ドーナッツ', 'サブレ', 'クリームパン', 'メロンパン', 'タルト',
        'マドレーヌ', 'フィナンシェ', 'マカロン', 'とんかつ', 'トンカツ', U('カツ', KATSU_NOT), 'カツレツ', U('フライ', FRY_NOT), U('メンチ', MENCHI_NOT), 'コロッケ', 'だて巻', '伊達巻', '黄身酢', U('お好み焼', OKONOMI_NOT), 'たこ焼',
        'たこやき', 'チャーハン', '炒飯', 'ふりかけ|たまご', 'たまご豆腐', '卵豆腐'],
      maybe: ['プリン', U('うずら', ['うずら|肉', 'うずら豆', 'うずらまめ']), U('アイス', ['アイスプラント', 'アイスティー', 'アイスコーヒー']), 'クッキー', 'ビスケット', 'ウエハース', U('パイ', PIE_NOT),
        'デニッシュ', 'マシュマロ', 'あんパン', '揚げパン', 'カレーパン', 'ジャムパン', 'チョココロネ', 'チョコパン', '菓子パン', 'ちゃつう', '松風', 'きんつば', 'ロシアケーキ', 'ナゲット', 'つくね',
        U('ハンバーグ', []), 'ミートボール', '天ぷら', 'てんぷら', U('から揚げ', ['から揚げ用']), U('唐揚げ', ['唐揚げ用']), 'からあげ', 'ちくわ', '竹輪', 'かまぼこ', '蒲鉾', 'はんぺん', 'さつま揚げ',
        'つみれ', 'なると', '魚肉ソーセージ', '魚肉ハム', 'ドレッシング', 'サウザン', '即席めん', 'カップめん', 'プレミックス', '八宝菜', '南蛮漬', 'もんじゃ', 'レアチーズ', 'ソフトクリーム',
        'ミートパイ', 'アップルパイ', 'ロールパン', 'クロワッサン', 'リッチタイプ'],
      not: ['魚卵', '卵巣', '卵不使用', '卵なし', '卵抜き', 'eggplant'] },
    '乳': { same: ['牛乳', 'ぎゅうにゅう', 'ミルク', '乳製品', 'milk'],
      foods: ['チーズ', U('バター', ['ピーナッツバター', 'ピーナツバター', 'バターピーナッツ', 'カカオバター', 'ココアバター', 'シアバター', 'バターナッツ']), 'ヨーグルト',
        U('クリーム', ['クリームスタイル', 'クリームコーン', 'ピーナッツクリーム', 'ピーナツクリーム', 'ごまクリーム', 'チョコレートクリーム']), '生クリーム', 'ホイップ', '脱脂粉乳', '全粉乳', '粉乳', '練乳',
        'れん乳', 'コンデンス', 'アイスクリーム', 'アイスミルク', 'ラクト', 'ソフトクリーム', 'カゼイン', 'ホエイ', 'ホエー', '乳清', '乳糖', 'カフェオレ', 'カフェラテ', 'グラタン', 'ホワイトソース',
        'ベシャメル', U('ドリア', ['ドリアン']), U('ピザ', ['ピザ生地']), 'クリームシチュー', 'チーズケーキ', 'ショートケーキ', 'シュークリーム', 'エクレア', 'カスタード', 'ババロア', '牛乳寒天', 'キャラメル', 'バタースコッチ',
        'ミルクチョコ', 'ホワイトチョコ', 'アーモンドチョコ', 'カバーリングチョコ', 'フレンチトースト', 'ホットケーキ', 'パンケーキ', 'ワッフル', 'バターケーキ', 'サブレ', 'デニッシュ', 'クロワッサン',
        'チョココロネ', 'チョコパン', 'クリームパン', '乳酸菌飲料', '乳飲料', '加工乳', '脱脂乳', '生乳', 'ミルクココア', '乳成分', 'コーヒー牛乳', 'パンナコッタ', 'ティラミス', 'レアチーズ',
        'クラムチャウダー', 'カルボナーラ', 'ホワイトシチュー', 'クリームスープ', 'クリームコロッケ', '乳児用', 'チーズスプレッド', 'タルト|（洋菓子', 'ウエハース|クリーム入り', 'ゼリー|ミルク',
        'コーヒーホワイトナー|液状|乳脂肪', 'コーヒーホワイトナー|粉末状|乳脂肪'],
      maybe: ['プリン', 'タルト', 'マーガリン', 'ファットスプレッド', U('パン', ['フランスパン', 'ライ麦パン', 'ベーグル', 'パン粉', 'パン酵母', 'パンプキン', 'パンダ', 'パンチェッタ', 'イングリッシュマフィン', '全粒粉パン']),
        'カステラ', '今川焼', 'どら焼', 'スポンジ', 'ドーナツ', 'ドーナッツ', U('パイ', PIE_NOT), 'あんパン', '揚げパン', 'カレーパン', 'ジャムパン', 'メロンパン', '菓子パン', 'ウエハース', 'クラッカー',
        'クッキー', 'ビスケット', 'リーフパイ', 'ロシアケーキ', 'スイートチョコ', 'チョコレートクリーム', 'チョコレート', 'ケーキ', U('カレー', CURRY_NOT), 'ルウ', 'シチュー', 'ハンバーグ', 'ミートボール',
        U('メンチ', MENCHI_NOT), 'コロッケ', 'ブイヨン', 'コンソメ', 'ソーセージ', 'ウインナー', 'ランチョンミート', 'プレスハム', 'チョップドハム', 'ピラフ', 'リゾット', 'ポタージュ', 'ムース', 'シャーベット',
        U('アイス', ['アイスプラント', 'アイスティー', 'アイスコーヒー']), 'やぎ乳', U('ナン', NAN_NOT), 'プレミックス', 'コーヒーホワイトナー', 'ホワイトナー', 'ミートソース', 'デミグラス', 'ミートパイ', 'えびピラフ', 'スープ|粉末'],
      not: ['豆乳', '乳用肥育', '乳化液状', '乳化剤', '人乳', '乳酸カルシウム', '乳酸ナトリウム', 'ココナッツミルク', 'ココナツミルク', 'アーモンドミルク', 'オーツミルク', 'ライスミルク', 'ソイミルク',
        'アイスプラント', 'アイスティー', 'アイスコーヒー', '乳不使用', '乳なし'] },
    '落花生': { same: ['らっかせい', 'ラッカセイ', 'ピーナッツ', 'ピーナツ', '南京豆', 'peanut'],
      foods: ['おのろけ豆', 'ブリットル', 'ジーマーミ', 'ジーマミー', '落花生油'],
      maybe: ['担々', '坦々', 'サテ'].concat(NUTS_MAYBE), not: [] },
    'アーモンド': { same: ['almond', 'アマンド'], foods: ['マジパン', 'マカロン'], maybe: ['プラリネ', 'フロランタン'].concat(NUTS_MAYBE), not: [] },
    'あわび': { same: ['鮑', '鰒', 'アワビ', 'abalone'], foods: ['くろあわび', 'まだかあわび', 'めがいあわび'], maybe: ['とこぶし'], not: ['あわびたけ', 'あわびだけ', '鮑茸'] },
    'いか': { same: ['烏賊', 'イカ', 'squid'],
      foods: ['するめ', 'スルメ', 'さきいか', U('塩辛', ['かつお', 'あわび', 'あみ', 'うに', 'たこ', 'えび', 'なまこ', 'このわた', 'ほや', 'さば', 'ます', 'さけ']), 'いかそうめん', 'いか飯', 'いかめし', 'げそ', 'ゲソ', '松前漬', 'あたりめ', 'いかあられ', 'いかくん'],
      maybe: ['八宝菜', '海鮮', 'シーフード', 'キムチ', U('お好み焼', OKONOMI_NOT), 'ちゃんぽん'],
      not: ['すいか', 'いかなご', 'おいかわ', 'いかだ', 'いかり', 'いかる', 'いかく', 'いかが', 'あいかわ', 'インディカ', 'いんでぃか'] },
    'いくら': { same: ['イクラ'], foods: ['すじこ', '筋子', 'はらこ', '腹子'], maybe: [], not: ['いくらか'] },
    'オレンジ': { same: ['orange'], foods: ['ネーブル', 'バレンシア', 'マーマレード', 'オレンジジュース'],
      maybe: ['きよみ', '清見', 'しらぬひ', '不知火', 'デコポン', 'セミノール', 'たんかん', U('ミックスジュース', MIX_NOT), 'シトラス', '柑橘'],
      not: ['オレンジピーマン', 'オレンジパプリカ', 'オレンジカリフラワー', 'オレンジ色'] },
    'キウイフルーツ': { same: ['キウイ', 'キウィ', 'kiwi'], foods: [], maybe: [], not: [] },
    '牛肉': { same: ['ぎゅうにく', 'うし|', '|うし', 'ビーフ', '牛にく', 'beef', '牛'],
      foods: ['牛丼', '牛飯', '牛すじ', '牛ひき', '牛もも', '牛バラ', '牛ばら', '牛タン', '牛たん', 'ローストビーフ', 'コンビーフ', 'ビーフジャーキー', 'ビーフシチュー', 'ビーフカレー', 'すき焼', 'すきやき',
        U('メンチ', MENCHI_NOT), '合いびき', '合挽', 'あいびき', 'カルビ', 'ハラミ', 'サーロイン', 'タン塩', 'ユッケ', 'ハンバーグステーキ|合いびき'],
      maybe: [U('ハンバーグ', CHICKEN_NOT), U('ミートボール', CHICKEN_NOT), 'ミートソース', 'ミートパイ', 'ハヤシ', 'ステーキ', 'しゃぶしゃぶ', '肉じゃが', U('カレー', CURRY_NOT.concat(['チキン', 'ポーク', '鶏', '豚'])), 'ルウ', 'ブイヨン',
        'コンソメ', 'デミグラス', '洋風だし', U('コロッケ', ['クリーム', 'コーン', 'かに', 'カニ']), '牛脂', 'ヘット', 'チンジャオ', 'プルコギ', 'ビビンバ', '焼き肉', '焼肉', '肉団子', 'にくだんご', 'ミンチ'],
      not: ['牛乳', '牛蒡', 'ぎゅうにゅう', 'うしお', 'ビーフン'] },
    'ごま': { same: ['胡麻', 'ゴマ', 'セサミ', 'sesame'],
      foods: ['ごま油', 'ごまあぶら', 'ごま豆腐', 'ごまだれ', 'ごま酢', 'ごまみそ', 'ごま和え', 'ごまあえ', 'ごまドレ', 'ごま入り', 'ねりごま', '練りごま', 'すりごま', 'いりごま', 'ごまペースト', 'タヒニ',
        'ごま塩', 'ごましお', 'ナムル', '担々', '坦々', '棒棒鶏', 'バンバンジー'],
      maybe: ['白和え', 'しらあえ', 'きんぴら', 'ふりかけ', 'ラー油', 'おはぎ', 'しゃぶしゃぶ', '冷やし中華', '中華風合わせ酢', '焼き肉のたれ', '焼肉のたれ', 'ぎょうざ', '餃子'],
      not: ['ごまさば', 'ごまふぐ', 'ごまめ', 'えごま', 'エゴマ', '荏胡麻', 'ごまあざらし', 'ごまだら', 'ごまかし'] },
    'さけ': { same: ['鮭', 'サーモン', 'しゃけ', 'シャケ', 'salmon', 'サケ'],
      foods: ['しろさけ', 'ぎんざけ', 'べにざけ', 'たいせいようさけ', 'ますのすけ', 'からふとます', 'さくらます', 'にじます', 'トラウト', '塩ざけ', '新巻', 'めふん', 'サケ節', '鮭節', 'スモークサーモン',
        U('フレーク', ['かつお', 'まぐろ', 'ツナ', 'コーン', '鶏', 'チキン']), '鮭缶', 'はらす', 'ハラス', 'ちゃんちゃん焼', '石狩'],
      maybe: [U('ます', ['マスタード', 'マスカルポーネ', 'マスカット', 'クリスマス', 'ますます', 'ますく', 'かます', 'なます']), 'あまご', 'いわな', 'やまめ', 'ひめます', 'イクラ', 'いくら', 'すじこ', '筋子'],
      not: ['さけかす', '酒かす', 'ツナフレーク', 'コーンフレーク'] },
    'さば': { same: ['鯖', 'サバ', 'mackerel'],
      foods: ['まさば', 'ごまさば', 'たいせいようさば', 'さば節', '鯖節', 'しめさば', '塩さば', 'さばの', 'さばみそ', 'さば缶', 'さば水煮', 'さば味噌'],
      maybe: ['和風だし', '顆粒和風', 'めんつゆ', 'なべつゆ', 'ふりかけ', 'だしの素', '混合節', '混合削り'],
      not: ['キャッサバ', 'きゃっさば', 'さばふぐ', 'さばく'] },
    '大豆': { same: ['だいず', 'ダイズ', 'soy', 'ソイ'],
      foods: [U('豆腐', ['ごま豆腐', '胡麻豆腐', 'たまご豆腐', '卵豆腐', '玉子豆腐', '杏仁豆腐', 'ピーナッツ豆腐', 'くるみ豆腐']), U('とうふ', ['ごまどうふ', 'たまごどうふ', 'あんにんどうふ']), U('納豆', ['甘納豆']), U('なっとう', ['あまなっとう']),
        '油揚げ', 'あぶらあげ', '油あげ', 'あぶらげ', 'うす揚げ', '薄揚げ', '厚揚げ', '生揚げ', 'がんも', 'ひりょうず', '飛竜頭', '豆乳', 'とうにゅう', 'おから', '卯の花', 'うのはな', '湯葉', 'ゆば',
        'きな粉', 'きなこ', '黄粉', U('みそ', ['ぬかみそ', 'かにみそ', 'うにみそ']), U('味噌', ['糠味噌', '蟹味噌']), '枝豆', 'えだまめ', 'テンペ', '黒豆', 'くろまめ', '黒大豆', '青大豆', '黄大豆', '大豆',
        'だいずもやし', '大豆もやし', '豆もやし', '高野豆腐', '凍り豆腐', 'こうや', U('いなり', ['すし酢', '稲荷用']), U('稲荷', ['稲荷用']), 'ずんだ', 'ごかぼう', 'みしま豆', 'ぶどう豆', '五目豆', 'ひたし豆', '呉汁', 'ごじる', 'おぼろ',
        '大豆たんぱく', 'ソイミート', '大豆ミート', '麻婆', 'マーボー', '白和え', 'しらあえ', '酢みそ', 'ぬた', '西京', '田楽', 'うぐいすもち', 'うぐいす粉', 'とん汁', 'とんじる', '豚汁', 'みそ漬', 'みそ煮'],
      maybe: ['煮豆', 'きつね', 'うぐいす', 'もやし', 'ドレッシング', 'マヨネーズ', 'マヨ', '大豆油', '調合油', 'サラダ油', 'マーガリン', 'トウバンジャン', '豆板醤', 'テンメンジャン', '甜麺醤',
        'オイスターソース', 'ソース|分離', 'フレンチドレッシング', 'ソーセージ', 'ウインナー', 'ウィンナー', 'プレスハム', 'チョップドハム', 'ランチョンミート'].concat(SHOYU_MAYBE),
      not: ['ぬかみそ', '糠みそ', '杏仁豆腐', 'あんにん'] },
    '鶏肉': { same: ['とりにく', '鳥肉', 'とり肉', 'にわとり', 'チキン', 'chicken', U('鶏', ['鶏卵', 'けいらん']), U('鳥', ['鳥貝', 'とりがい'])], alias: ['とり'],
      foods: ['鶏の', '若鶏', '若どり', '鶏つくね', '鶏ひき', '鶏もも', '鶏むね', '鶏ささ', '鶏手羽', '鶏がら', 'とりがら', 'ささみ', 'ささ身', '手羽', U('唐揚げ', KARAAGE_NOT), U('から揚げ', KARAAGE_NOT),
        U('からあげ', KARAAGE_NOT), U('竜田揚げ', KARAAGE_NOT), 'つくね', '親子丼', '焼き鳥', 'やきとり', '焼鳥', 'ナゲット', '鶏皮', '砂肝', 'すなぎも', '水炊き', '筑前煮', 'がめ煮', 'とり天', '鶏天', 'チキンライス',
        '鶏飯', 'けいはん', '棒棒鶏', 'バンバンジー', '油淋鶏', 'ユーリンチー', 'タンドリー', '鶏そぼろ', '手羽先', '手羽元', 'ぼんじり', 'せせり', U('かしわ', ['かしわもち', 'かしわ餅']), '鶏団子', '鳥団子', 'とり団子', 'サムゲタン',
        '参鶏湯', '鶏がらだし', 'ハンバーグステーキ|チキン'],
      maybe: ['そぼろ', '中華だし', 'ブイヨン', 'コンソメ', '洋風だし', 'ソーセージ', 'ウインナー', 'ウィンナー', 'フランクフルト', 'プレスハム', 'ランチョンミート', 'チョップドハム', 'ミートボール',
        U('カレー', CURRY_NOT.concat(['ビーフ', 'ポーク', '牛', '豚', 'カレーパン'])), U('ルウ', ['ハヤシ']), 'ピラフ', U('シチュー', ['ビーフ', '牛']), 'クリームスープ', U('あひる', ['あひる卵']), 'かも', '合鴨', 'あいがも', U('うずら', ['うずら卵', 'うずらたまご', 'うずら豆', 'うずらまめ']), 'きじ', 'しちめんちょう',
        '七面鳥', 'ターキー', 'すずめ', U('はと', ['はとむぎ', 'はと麦']), 'ほろほろ', 'がちょう', 'フォアグラ', U('ダック', ['ソーダ']), '即席めん', 'カップめん', 'エビチリ', '豆腐ハンバーグ', 'ラーメンスープ', '肉団子',
        'にくだんご', 'ミンチ', 'スープ|粉末', 'かぼちゃのクリームスープ', 'コーンクリームスープ', 'マーボー豆腐の素'],
      not: ['鶏卵', 'けいらん', '鳥貝', 'とりがい', '焼き鳥のたれ', 'やきとりのたれ', 'から揚げ用', '唐揚げ用', 'からあげ用'] },
    'バナナ': { same: ['banana'], foods: [], maybe: [U('ミックスジュース', MIX_NOT)], not: [] },
    '豚肉': { same: ['ぶたにく', U('ぶた', ['ゼラチン']), U('豚', ['河豚', 'ゼラチン']), 'ポーク', 'pork'],
      foods: [U('ハム', ['魚肉ハム', '鶏ハム', 'とりハム', 'チキンハム', 'ハムスター']), 'ベーコン', U('ソーセージ', ['魚肉ソーセージ', 'ぎょにく', 'チキンソーセージ', '鶏ソーセージ']), 'ウインナー', 'ウィンナー',
        'フランクフルト', 'サラミ', 'パンチェッタ', 'プロシュート', 'ランチョンミート', 'スパム', 'とんかつ', 'トンカツ', 'とん汁', 'とんじる', '豚汁', 'チャーシュー', '焼き豚', '焼豚', '叉焼', U('角煮', ['かつお', 'まぐろ', '魚']),
        '豚バラ', '豚ばら', '豚こま', '豚ひき', '豚もも', '豚ロース', 'ロースかつ', 'ヒレかつ', 'しょうが焼き', '生姜焼き', 'しょうがやき', '回鍋肉', 'ホイコーロー', '酢豚', '酢ぶた', '肉まん', '豚まん',
        U('ぎょうざ', ['の皮']), U('餃子', ['の皮']), 'ギョーザ', U('しゅうまい', ['の皮']), U('焼売', ['の皮']), 'シューマイ', U('春巻', ['の皮']), '中華ちまき', '麻婆豆腐', 'マーボー豆腐', U('メンチ', MENCHI_NOT), '合いびき', '合挽',
        'あいびき', 'ポークカレー', 'カツ丼', 'かつ丼', 'ポークソテー', 'ポークビーンズ', '豚キムチ', 'とんこつ', '豚骨', U('お好み焼', OKONOMI_NOT), '八宝菜', 'スペアリブ', 'ジョウル', 'ベーコン', 'ランチョン'],
      maybe: [U('ハンバーグ', CHICKEN_NOT), U('ミートボール', CHICKEN_NOT), 'ミートソース', 'ミートパイ', '肉じゃが', 'ちまき', 'ホルモン', U('モツ', ['モッツァレラ', 'もつあれら']), 'レバー', U('カレー', CURRY_NOT.concat(['チキン', 'ビーフ', '鶏', '牛'])), U('ルウ', ['ハヤシ']), U('コロッケ', ['クリーム', 'コーン', 'かに', 'カニ']), 'ラード',
        'ラーメンスープ', '中華だし', '即席めん', 'カップめん', 'チャーハン', '炒飯', 'カレーパン', 'プレスハム', '中華風クッキー', 'ワンタン', '肉団子', 'にくだんご', 'いのぶた', 'ミンチ', '豆腐ハンバーグ',
        'マーボー豆腐の素', 'マーボー', '麻婆'],
      not: ['河豚', 'ふぐ'] },
    'マカダミアナッツ': { same: ['マカダミア', 'マカデミア', 'macadamia'], foods: [], maybe: NUTS_MAYBE, not: [] },
    'もも': { same: ['桃', 'ピーチ', 'peach'], foods: ['白桃', '黄桃', 'ネクタリン'], maybe: [],
      not: ['すもも', 'やまもも', 'ももひき'], unless: ['うし', 'ぶた', 'にわとり', '牛', '豚', '鶏', '鳥', '若どり', 'ささみ', 'めんよう', 'ラム', 'マトン', 'しか', 'うま', 'かも', '皮つき', '皮なし', '脂身', '赤肉', 'ひき肉', 'もも肉', 'ももにく'] },
    'やまいも': { same: ['山芋', 'やまのいも', 'ヤマイモ', '山の芋', 'やまいも'],
      foods: ['長芋', 'ながいも', '長いも', 'とろろ', '大和芋', 'やまといも', '自然薯', 'じねんじょ', 'いちょういも', 'だいじょ', '薯蕷', 'じょうよ', 'かるかん', 'つくねいも', 'むかご', '山かけ', 'やまかけ'],
      maybe: [U('お好み焼', OKONOMI_NOT), 'おこのみ'], not: ['とろろこんぶ', 'とろろ昆布'] },
    'りんご': { same: ['林檎', 'リンゴ', 'アップル', 'apple'], foods: ['アップルパイ', 'シードル', '紅玉', 'ジョナゴールド', '王林'],
      maybe: ['りんご酢', 'ウスターソース', '中濃ソース', '濃厚ソース', 'お好み焼きソース', '焼き肉のたれ', '焼肉のたれ', 'カレールウ', U('カレー', CURRY_NOT), 'キムチ', U('ミックスジュース', MIX_NOT), U('フルーツ', ['グレープフルーツ', 'キウイフルーツ', 'ドラゴンフルーツ', 'パッションフルーツ', 'フルーツトマト', '乳飲料'])],
      not: ['パインアップル', 'パイナップル', 'pineapple'] },
    'ゼラチン': { same: ['gelatin'], foods: ['マシュマロ', 'ババロア', 'コラーゲン', '煮こごり', 'にこごり', 'テリーヌ', 'アスピック'],
      maybe: ['ゼリー', 'ムース', U('グミ', ['ぐみ|生', 'ぐみ|果']), 'パンナコッタ', '杏仁豆腐', 'レアチーズ', 'ティラミス'],
      not: ['こんにゃくゼリー', '寒天ゼリー'] }
  };
  // 言いかえ表を、そろえた形の探す語にしたもの（品目ごとに 1 回だけ作る）
  const specCache = Object.create(null);
  // 語の前後の「|」は境目の指定（「うし|」= うし で終わる語）。そろえた後に付け直す
  const normTerm = (x) => { const n = M.normWord(x); return n ? (x[0] === '|' ? '|' : '') + n + (x[x.length - 1] === '|' ? '|' : '') : ''; };
  const termOf = (x) => (typeof x === 'string') ? { t: normTerm(x), unless: [] } : { t: normTerm(x.t), unless: (x.unless || []).map(normTerm).filter(Boolean) };
  const terms = (list) => (list || []).map(termOf).filter((x) => x.t);
  function specOf(key) {
    if (specCache[key]) return specCache[key];
    const e = M.ALLERGEN_WORDS[key];
    const s = { key: key, sure: terms([key].concat(e.same || [], e.foods || [])), maybe: terms(e.maybe || []),
      not: (e.not || []).map(normTerm).filter(Boolean), unless: (e.unless || []).map(normTerm).filter(Boolean) };
    // 「確実」にある語は「要確認」から外す（二重に数えない）
    const sureSet = Object.create(null); s.sure.forEach((t) => { sureSet[t.t] = 1; });
    s.maybe = s.maybe.filter((t) => !sureSet[t.t]);
    specCache[key] = s;
    return s;
  }
  // 登録された言葉（アレルギー・禁食）がどの品目か。表の品目名・same・alias のどれかに一致すればその品目
  const keyCache = Object.create(null);
  M.allergenKey = function (word) {
    const w = M.normWord(word);
    if (!w) return null;
    if (w in keyCache) return keyCache[w];
    const key = Object.keys(M.ALLERGEN_WORDS).find((k) => {
      const e = M.ALLERGEN_WORDS[k];
      return M.normWord(k) === w || (e.same || []).some((s) => M.normWord(typeof s === 'string' ? s : s.t) === w) || (e.alias || []).some((s) => M.normWord(s) === w);
    }) || null;
    keyCache[w] = key;
    return key;
  };
  // 登録された言葉から、探すための仕様。表に無い言葉は、その言葉だけを「確実」で探す
  const freeCache = Object.create(null);
  function specFor(word) {
    const key = M.allergenKey(word);
    if (key) return specOf(key);
    const w = M.normWord(word);
    if (!w) return null;
    return freeCache[w] || (freeCache[w] = { key: null, sure: [{ t: w, unless: [] }], maybe: [], not: [], unless: [] });
  }
  // 名前 1 つ（そろえた形 n）を、仕様 spec で判定。'sure' | 'maybe' | ''
  function levelOf(spec, n) {
    if (!n) return '';
    n = '|' + n + '|';
    for (let i = 0; i < spec.unless.length; i++) if (n.indexOf(spec.unless[i]) >= 0) return '';
    let x = n;
    for (let i = 0; i < spec.not.length; i++) if (x.indexOf(spec.not[i]) >= 0) x = x.split(spec.not[i]).join('|');
    const hit = (t) => x.indexOf(t.t) >= 0 && !t.unless.some((u) => n.indexOf(u) >= 0);
    for (let i = 0; i < spec.sure.length; i++) if (hit(spec.sure[i])) return 'sure';
    for (let i = 0; i < spec.maybe.length; i++) if (hit(spec.maybe[i])) return 'maybe';
    return '';
  }
  // 互換: 登録された言葉から、出る物の側で探す「確実」の語の並び（そろえた形）
  M.allergenTerms = function (word) {
    const spec = specFor(word);
    return spec ? spec.sure.map((t) => t.t) : [];
  };
  // 名前 1 つの判定（画面の料理マスタなどで使う）
  M.matchWord = function (word, name) {
    const spec = specFor(word);
    return spec ? levelOf(spec, M.normWord(name)) : '';
  };
  // words のうち word に当たるものを段ごとに。words は文字列の並びか、{ raw, n }（そろえ済み）の並び
  M.wordHitsLevel = function (word, words) {
    const out = { sure: [], maybe: [] };
    const spec = specFor(word);
    if (!spec) return out;
    (words || []).forEach((w) => {
      const raw = (w && typeof w === 'object') ? w.raw : w;
      const n = (w && typeof w === 'object') ? w.n : M.normWord(w);
      const lv = levelOf(spec, n);
      if (lv) out[lv].push(raw);
    });
    return out;
  };
  // 互換: 当たった言葉の並び（確実・要確認の両方）
  M.wordHits = function (word, words) {
    const r = M.wordHitsLevel(word, words);
    return r.sure.concat(r.maybe);
  };
  // 1 つの食事（言葉の並び）に対する段: 'sure' | 'maybe' | ''
  M.matchLevel = function (word, words) {
    const r = M.wordHitsLevel(word, words);
    return r.sure.length ? 'sure' : (r.maybe.length ? 'maybe' : '');
  };
  // 出る物の言葉をそろえた形にしておく（同じ食事を大勢の利用者と突き合わせる時に 1 回で済ませる）
  M.prepWords = function (words) {
    return (words || []).filter(Boolean).map((w) => (w && typeof w === 'object' && 'n' in w) ? w : { raw: w, n: M.normWord(w) });
  };
  // words = その食事に出る物を表す言葉の並び（料理名・材料名・料理に付けたアレルギー品目・「パン」「麺」などの合図）
  // 返り: [{ kind:'allergy'|'kinshi', word, sub, level:'sure'|'maybe', where:[当たった言葉], sure:[確実], maybe:[要確認] }]
  // level が 'maybe' の物は、含むことが多いが製品で違う物（しょうゆ・カレー・ドレッシング など）。画面では「要確認」として色を分ける
  M.matchRestrictions = function (diet, words) {
    const hits = [];
    if (!diet) return hits;
    const src = M.prepWords(words);
    const put = (kind, word, sub) => {
      const r = M.wordHitsLevel(word, src);
      if (!r.sure.length && !r.maybe.length) return;
      hits.push({ kind: kind, word: word, sub: sub || '', level: r.sure.length ? 'sure' : 'maybe', where: r.sure.concat(r.maybe), sure: r.sure, maybe: r.maybe });
    };
    (diet.allergy || []).forEach((a) => put('allergy', a, ''));
    (diet.kinshi || []).forEach((k) => put('kinshi', k.food, k.sub));
    return hits;
  };
  // その枠に食べる人それぞれについて、当たるものを返す
  M.restrictionsAt = function (residents, slot, masters, words) {
    const out = [];
    const src = M.prepWords(words);
    if (!src.length) return out;
    residents.forEach((r) => {
      if (r.archived) return;
      if (M.presence(r, slot, masters.meals).state !== 'in') return;
      const d = M.dietAt(r, slot, masters.meals);
      if (!d || (!d.allergy.length && !d.kinshi.length)) return;
      const hits = M.matchRestrictions(d, src);
      if (hits.length) out.push({ r: r, diet: d, hits: hits, level: hits.some((x) => x.level === 'sure') ? 'sure' : 'maybe' });
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
