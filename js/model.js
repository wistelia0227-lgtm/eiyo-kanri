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
  // 言葉をそろえる: 全角/半角（NFKC）・カタカナ→ひらがな・英字は小文字・空白は無視
  M.normWord = function (s) {
    return String(s == null ? '' : s).normalize('NFKC').toLowerCase()
      .replace(/[ァ-ヶ]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0x60)).replace(/\s+/g, '');
  };
  // アレルギー品目ごとの言いかえ表。same = 同じ物の別の書き方（登録された言葉がこれなら、この品目として扱う）
  // foods = その品目を含む成分表の名前・加工品・料理。消費者庁の特定原材料等（表示義務 9・推奨 19）を全部持つ。
  // 短すぎて別の物に当たる言葉（「ふ」「牛」「鶏」）は入れず、長い形で持つ。しょうゆ（小麦・大豆）はほぼ全部の料理に当たるので入れない
  M.ALLERGEN_WORDS = {
    'えび': { same: ['海老', '蝦', 'エビ'], foods: ['シュリンプ', 'ブラックタイガー', '桜海老', '甘海老', '車海老'] },
    'かに': { same: ['蟹', 'カニ'], foods: ['がに', 'がざみ', 'かにかま', 'かに風味'] },
    'くるみ': { same: ['胡桃', 'クルミ'], foods: ['ウォールナッツ'] },
    'カシューナッツ': { same: ['カシュー'], foods: [] },
    '小麦': { same: ['こむぎ', 'コムギ'], foods: ['小麦粉', 'パン', 'うどん', '饂飩', '麩', 'やきふ', '焼きふ', 'そうめん', '素麺', 'ひやむぎ', '冷麦',
      'ラーメン', '中華めん', '中華麺', 'やきそば', '焼きそば', 'マカロニ', 'スパゲッティ', 'スパゲティ', 'パスタ', 'ぎょうざ', '餃子', 'しゅうまい', '焼売',
      '春巻', '天ぷら', 'てんぷら', '天丼', 'フライ', 'ルウ', 'カレー', 'シチュー', 'グラタン', 'ホワイトソース', 'ケーキ', 'クッキー', 'ビスケット',
      'ホットケーキ', 'お好み焼', 'たこ焼', 'ちくわ', 'すいとん', 'ナン', 'ピザ'] },
    'そば': { same: ['蕎麦', 'ソバ'], foods: ['そば粉', '蕎麦粉', 'そばがき', 'そばボーロ', 'ガレット'] },
    '卵': { same: ['たまご', 'タマゴ', '玉子', '鶏卵', 'けいらん', 'エッグ'], foods: ['マヨネーズ', 'カスタード', 'プリン', '茶碗蒸し', '茶わん蒸し',
      'ちゃわんむし', 'だし巻', 'だしまき', 'オムレツ', 'かき玉', 'かきたま', 'メレンゲ', 'カステラ', '親子丼', 'タルタル', 'ピカタ', 'フレンチトースト', 'うずら'] },
    '乳': { same: ['牛乳', 'ぎゅうにゅう', 'ミルク', '乳製品'], foods: ['チーズ', 'バター', 'ヨーグルト', 'クリーム', '脱脂粉乳', '練乳', 'アイス',
      'グラタン', 'シチュー', 'ホワイトソース', 'ラクト', 'カフェオレ', 'プリン'] },
    '落花生': { same: ['らっかせい', 'ラッカセイ', 'ピーナッツ', 'ピーナツ', '南京豆'], foods: [] },
    'アーモンド': { same: [], foods: ['アマンド'] },
    'あわび': { same: ['鮑', '鰒', 'アワビ'], foods: [] },
    'いか': { same: ['烏賊', 'イカ'], foods: ['するめ', 'スルメ'] },
    'いくら': { same: ['イクラ'], foods: ['すじこ', '筋子'] },
    'オレンジ': { same: [], foods: ['ネーブル', 'バレンシア'] },
    'キウイフルーツ': { same: ['キウイ', 'キウィ'], foods: [] },
    '牛肉': { same: ['ぎゅうにく', 'うし', 'ビーフ', '牛にく'], foods: ['牛丼', '牛すじ', '牛ひき', '牛もも', '牛バラ', 'ハンバーグ', 'ミートボール', 'すき焼'] },
    'ごま': { same: ['胡麻', 'ゴマ', 'セサミ'], foods: [] },
    'さけ': { same: ['鮭', 'サーモン', 'しゃけ', 'シャケ'], foods: [] },
    'さば': { same: ['鯖', 'サバ'], foods: [] },
    '大豆': { same: ['だいず', 'ダイズ'], foods: ['豆腐', 'とうふ', '納豆', 'なっとう', '油揚げ', 'あぶらあげ', '油あげ', '厚揚げ', '生揚げ', 'がんも',
      '豆乳', 'おから', '湯葉', 'ゆば', 'きな粉', 'きなこ', 'みそ', '味噌', '枝豆', 'えだまめ'] },
    '鶏肉': { same: ['とりにく', '鳥肉', 'とり肉', 'にわとり', 'チキン'], foods: ['鶏の', '若鶏', '鶏つくね', '鶏ひき', '鶏もも', '鶏むね', '鶏ささ', '鶏手羽',
      '鶏がら', 'ささみ', 'ささ身', '手羽', '唐揚げ', 'から揚げ', 'からあげ', 'つくね', '親子丼', '焼き鳥', 'やきとり', 'とりがら'] },
    'バナナ': { same: [], foods: [] },
    '豚肉': { same: ['ぶたにく', 'ぶた', '豚', 'ポーク'], foods: ['ハム', 'ベーコン', 'ソーセージ', 'ウインナー', 'ウィンナー', 'とんかつ', 'とん汁', 'とんじる',
      'チャーシュー', 'ハンバーグ', 'ミートボール', 'しゅうまい', '焼売', 'ぎょうざ', '餃子'] },
    'マカダミアナッツ': { same: ['マカダミア', 'マカデミア'], foods: [] },
    'もも': { same: ['桃', 'ピーチ'], foods: ['白桃', '黄桃'] },
    'やまいも': { same: ['山芋', 'やまのいも', 'ヤマイモ'], foods: ['長芋', 'ながいも', 'とろろ', '大和芋', 'やまといも', '自然薯', 'じねんじょ', 'いちょういも'] },
    'りんご': { same: ['林檎', 'リンゴ', 'アップル'], foods: [] },
    'ゼラチン': { same: [], foods: ['ゼリー', 'ムース', 'グミ', 'マシュマロ', 'ババロア', 'コラーゲン'] }
  };
  // 登録された言葉（アレルギー・禁食）から、出る物の側で探す言葉の並び（そろえた形）。
  // 表の品目名か same に当たればその品目の言葉を全部、当たらなければその言葉だけ
  M.allergenTerms = function (word) {
    const w = M.normWord(word);
    if (!w) return [];
    const key = Object.keys(M.ALLERGEN_WORDS).find((k) => M.normWord(k) === w || M.ALLERGEN_WORDS[k].same.some((s) => M.normWord(s) === w));
    if (!key) return [w];
    const e = M.ALLERGEN_WORDS[key], out = [];
    [key].concat(e.same, e.foods, [word]).forEach((s) => { const x = M.normWord(s); if (x && out.indexOf(x) < 0) out.push(x); });
    return out;
  };
  // words のうち、word（アレルギー・禁食の言葉）に当たるもの
  M.wordHits = function (word, words) {
    const terms = M.allergenTerms(word);
    return (words || []).filter((w) => { const x = M.normWord(w); return x && terms.some((t) => x.indexOf(t) >= 0); });
  };
  // words = その食事に出る物を表す言葉の並び（料理名・材料名・料理に付けたアレルギー品目・「パン」「麺」などの合図）
  // 突き合わせは言いかえ表（M.ALLERGEN_WORDS）を通した名前の一致。表に無い加工品は漏れる（画面に必ずその旨を出すこと）
  M.matchRestrictions = function (diet, words) {
    const hits = [];
    if (!diet) return hits;
    const src = (words || []).filter(Boolean);
    const find = (needle) => M.wordHits(needle, src);
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
