// 栄養計算の核。DOM にも DB にも触れない（Node で試験できる）。window.Nutri で公開。
// 成分表は js/foods_data.js（日本食品標準成分表（八訂）増補2023年から引用）。可食部 100g 当たり。
// 記号の扱い: Tr と (Tr) は 0、() 付きの推定値は数値として使い、「-」（未測定）は null のまま足さない。
//   未測定を 0 として足すと合計が実際より小さく出るので、合計には「未測定が混じっているか」を付けて返す。
(function (root) {
  'use strict';
  const N = {};
  let DATA = null, INDEX = null;

  N.load = function (data) {
    DATA = data;
    N.meta = data.meta;
    N.nutrients = data.meta.nutrients;      // [{key,id,name,unit}]
    N.groups = data.groups || data.meta.groups || {}; // {'01':'穀類',...}
    N.head = data.meta.head;                // ['no','group','index','name','choMark','flags','remark']
    N.HEAD_LEN = N.head.length;
    N.key = {}; N.nutrients.forEach((x, i) => { N.key[x.key] = i; });
    INDEX = null;
    return N;
  };
  N.loaded = () => !!DATA;
  N.count = () => DATA ? DATA.foods.length : 0;

  // 1 件を扱いやすい形に
  function wrap(row) {
    if (!row) return null;
    return { no: row[0], group: row[1], groupName: N.groups[row[1]] || row[1], name: row[3],
      choMark: row[4], flags: row[5] || '', remark: row[6], raw: row };
  }
  N.get = function (no) {
    if (!DATA) return null;
    if (!INDEX) { INDEX = {}; DATA.foods.forEach((r) => { INDEX[r[0]] = r; }); }
    return wrap(INDEX[no]);
  };
  // 成分の値（100g 当たり）。未測定は null
  N.val = function (food, key) {
    const i = N.key[key];
    if (i == null || !food) return null;
    const v = food.raw[N.HEAD_LEN + i];
    return v == null ? null : v;
  };
  // その成分がどう書かれていたか: '.'=実測 'e'=推定 't'/'T'=Tr(微量) '-'=未測定 'd'=脚注 '*'=本表に値が無い（備考の第3章参照）
  N.flag = function (food, key) {
    const i = N.key[key];
    if (i == null || !food) return '.';
    return food.flags ? (food.flags[i] || '.') : '.';
  };

  // 一覧や取り込みに出す短い食品名。分類の括り（＜魚類＞ ［水稲めし］ （さけ・ます類））を落とす
  N.shortName = function (name) {
    const parts = String(name || '').replace(/　/g, ' ').split(/\s+/).filter(Boolean)
      .filter((w) => !/^[＜(（[［].*[＞)）\]］]$/.test(w));
    return parts.join(' ') || String(name || '');
  };

  // ---- 別冊（アミノ酸・脂肪酸の内訳・糖類の内訳）----
  // 本表だけで約 1MB ある。別冊は使う場面が限られるので、開いた時に読む。
  // fetch ではなく <script> で読むのは、file:// で開いたときに fetch が使えないため。
  N.DETAILS = [
    { id: 'amino', label: 'アミノ酸', file: 'js/foods_amino.js', global: 'FOODS_AMINO' },
    { id: 'fat', label: '脂肪酸の内訳', file: 'js/foods_fat.js', global: 'FOODS_FAT' },
    { id: 'carb', label: '糖類の内訳', file: 'js/foods_carb.js', global: 'FOODS_CARB' }
  ];
  const loaded = {}, loading = {};
  N.detailLoaded = (id) => !!loaded[id];
  N.loadDetail = function (id) {
    const def = N.DETAILS.find((x) => x.id === id);
    if (!def) return Promise.reject(new Error('知らない別冊: ' + id));
    if (loaded[id]) return Promise.resolve(loaded[id]);
    if (loading[id]) return loading[id];
    loading[id] = new Promise(function (resolve, reject) {
      if (typeof document === 'undefined') { reject(new Error('画面でのみ読めます')); return; }
      const s = document.createElement('script');
      s.src = def.file;
      s.onload = function () {
        const data = root[def.global];
        if (!data) { reject(new Error(def.file + ' を読めませんでした')); return; }
        data.index = {};
        data.foods.forEach((r) => { data.index[r[0]] = r; });
        data.key = {};
        data.meta.nutrients.forEach((x, i) => { data.key[x.key] = i; });
        loaded[id] = data;
        resolve(data);
      };
      s.onerror = function () { reject(new Error(def.file + ' が見つかりません')); };
      document.head.appendChild(s);
    });
    return loading[id];
  };
  // 別冊の 1 食品ぶん。[{key, name, unit, value, flag}]。読み込み前は null
  N.detailOf = function (id, no) {
    const data = loaded[id];
    if (!data) return null;
    const row = data.index[no];
    if (!row) return [];
    const head = data.meta.head.length;   // ['no','flags']
    return data.meta.nutrients.map((x, i) => ({ key: x.key, name: x.name, unit: x.unit,
      value: row[head + i] == null ? null : row[head + i],
      flag: (row[1] || '')[i] || '.' }));
  };

  // 検索: 空白区切りの語をすべて含むもの。ひらがな・カタカナ・全角半角の違いを吸収する
  function norm(s) {
    return String(s || '').replace(/[ぁ-ゖ]/g, (c) => String.fromCharCode(c.charCodeAt(0) + 0x60))
      .replace(/[Ａ-Ｚａ-ｚ０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xFEE0))
      .replace(/[　\s]+/g, '').toLowerCase();
  }
  N.norm = norm;
  N.search = function (query, opts) {
    opts = opts || {};
    if (!DATA) return [];
    const words = String(query || '').trim().split(/[\s　]+/).filter(Boolean).map(norm);
    const out = [];
    for (const r of DATA.foods) {
      if (opts.group && r[1] !== opts.group) continue;
      if (words.length) {
        const n = norm(r[3]);
        let hitAll = true;
        for (const w of words) if (n.indexOf(w) < 0) { hitAll = false; break; }
        if (!hitAll) continue;
      }
      out.push(wrap(r));
      if (out.length >= (opts.limit || 300)) break;
    }
    // 名前が短いものを先に（「こめ」で「精白米」より「米」が先に出るように）
    return out.sort((a, b) => a.name.length - b.name.length || a.no.localeCompare(b.no));
  };

  // 材料の並び [{no, g}] から成分の合計を出す
  // 返り値 { values:{key:数値}, missing:{key:[食品名]}, unknown:[番号] }
  N.sum = function (items) {
    const values = {}, missing = {}, unknown = [];
    N.nutrients.forEach((x) => { values[x.key] = 0; });
    (items || []).forEach((it) => {
      const f = N.get(it.no);
      if (!f) { if (it.no) unknown.push(it.no); return; }
      const g = Number(it.g) || 0;
      N.nutrients.forEach((x) => {
        const v = N.val(f, x.key);
        if (v == null) { (missing[x.key] = missing[x.key] || []).push(f.name); return; }
        if (x.key === 'refuse') return; // 廃棄率は足さない
        values[x.key] += v * g / 100;
      });
    });
    values.refuse = null;
    return { values: values, missing: missing, unknown: unknown };
  };
  // 複数の合計を足す（料理→1食→1日）
  N.add = function (a, b) {
    if (!a) return b; if (!b) return a;
    const values = {}, missing = {};
    N.nutrients.forEach((x) => { values[x.key] = (a.values[x.key] || 0) + (b.values[x.key] || 0); });
    [a, b].forEach((s) => Object.keys(s.missing || {}).forEach((k) => { missing[k] = (missing[k] || []).concat(s.missing[k]); }));
    values.refuse = null;
    return { values: values, missing: missing, unknown: (a.unknown || []).concat(b.unknown || []) };
  };
  N.scale = function (s, k) {
    const values = {};
    N.nutrients.forEach((x) => { values[x.key] = (s.values[x.key] || 0) * k; });
    values.refuse = null;
    return { values: values, missing: s.missing, unknown: s.unknown };
  };
  N.empty = function () {
    const values = {}; N.nutrients.forEach((x) => { values[x.key] = 0; }); values.refuse = null;
    return { values: values, missing: {}, unknown: [] };
  };

  // 表示用の丸め（成分表の桁に合わせる）
  const DIGITS = { kcal: 0, na: 0, k: 0, ca: 0, mg: 0, p: 0, iod: 0, se: 0, cr: 0, mo: 0, retol: 0, cartbeq: 0, vita: 0, vitk: 0, fol: 0, vitc: 0, chole: 0 };
  N.round = function (key, v) {
    if (v == null) return null;
    const d = DIGITS[key] != null ? DIGITS[key] : (['fe', 'zn', 'cu', 'mn', 'vitd', 'vite', 'b1', 'b2', 'nia', 'ne', 'b6', 'b12', 'pantac', 'biot', 'nacl'].indexOf(key) >= 0 ? 2 : 1);
    return Math.round(v * Math.pow(10, d)) / Math.pow(10, d);
  };
  N.fmt = function (key, v) { const r = N.round(key, v); return r == null ? '—' : String(r); };

  // ---- 給与栄養目標量・必要栄養量 ----
  // 日本人の食事摂取基準（2025年版）。設定データとして持ち、改定時はここを差し替える
  // 出典: 策定検討会報告書（令和6年10月11日公表）の表。使用期間 令和7〜11年度
  N.DRI_VERSION = '2025年版';
  N.DRI = {
    // 年齢区分ごと: bmr=基礎代謝基準値(kcal/kg/日), pal=身体活動レベル [低い, ふつう, 高い]
    ages: [
      { id: '18-29', label: '18〜29歳', min: 18, max: 29, bmr: { m: 23.7, f: 22.1 }, pal: [1.50, 1.75, 2.00] },
      { id: '30-49', label: '30〜49歳', min: 30, max: 49, bmr: { m: 22.5, f: 21.9 }, pal: [1.50, 1.75, 2.00] },
      { id: '50-64', label: '50〜64歳', min: 50, max: 64, bmr: { m: 21.8, f: 20.7 }, pal: [1.50, 1.75, 2.00] },
      { id: '65-74', label: '65〜74歳', min: 65, max: 74, bmr: { m: 21.6, f: 20.7 }, pal: [1.50, 1.70, 1.90] },
      { id: '75+', label: '75歳以上', min: 75, max: 200, bmr: { m: 21.5, f: 20.7 }, pal: [1.40, 1.70, null] }
    ],
    palLabels: ['低い（ほとんど外出しない／施設で自立に近い）', 'ふつう（自立している）', '高い'],
    // 1 日あたりの基準。min=推奨量や目標量の下限、max=上限（耐容上限量や目標量の上限）
    // %E = エネルギー比。energy は本人の推定エネルギー必要量から出す
    ref: {
      '65-74': { m: { prot: [60, null], fib: [21, null], nacl: [null, 7.5], k: [3000, null], ca: [750, null], fe: [7.0, null], zn: [9.0, null], vitc: [100, null], vita: [850, 2700], vitd: [9.0, 100], b1: [1.3, null], b2: [1.5, null], fol: [240, null] },
        f: { prot: [50, null], fib: [18, null], nacl: [null, 6.5], k: [2600, null], ca: [650, null], fe: [6.0, null], zn: [7.5, null], vitc: [100, null], vita: [700, 2700], vitd: [9.0, 100], b1: [1.1, null], b2: [1.2, null], fol: [240, null] } },
      '75+': { m: { prot: [60, null], fib: [20, null], nacl: [null, 7.5], k: [3000, null], ca: [750, null], fe: [6.5, null], zn: [9.0, null], vitc: [100, null], vita: [800, 2700], vitd: [9.0, 100], b1: [1.2, null], b2: [1.3, null], fol: [240, null] },
        f: { prot: [50, null], fib: [17, null], nacl: [null, 6.5], k: [2600, null], ca: [600, null], fe: [5.5, null], zn: [7.0, null], vitc: [100, null], vita: [650, 2700], vitd: [9.0, 100], b1: [0.9, null], b2: [1.0, null], fol: [240, null] } },
      '50-64': { m: { prot: [65, null], fib: [22, null], nacl: [null, 7.5], k: [3000, null], ca: [750, null], fe: [7.5, null], zn: [11, null], vitc: [100, null], vita: [900, 2700], vitd: [8.5, 100], b1: [1.3, null], b2: [1.5, null], fol: [240, null] },
        f: { prot: [50, null], fib: [18, null], nacl: [null, 6.5], k: [2600, null], ca: [650, null], fe: [6.5, null], zn: [8.0, null], vitc: [100, null], vita: [700, 2700], vitd: [8.5, 100], b1: [1.1, null], b2: [1.2, null], fol: [240, null] } }
    },
    // エネルギー産生栄養素バランス（％エネルギー）
    pfc: { prot: [15, 20], fat: [20, 30], cho: [50, 65], fasat: [null, 7] },
    targetBmi: { '65-74': [21.5, 24.9], '75+': [21.5, 24.9], '50-64': [20.0, 24.9], '30-49': [20.0, 24.9], '18-29': [18.5, 24.9] }
  };
  N.ageBand = function (age) {
    if (age == null) return null;
    return N.DRI.ages.find((a) => age >= a.min && age <= a.max) || N.DRI.ages[N.DRI.ages.length - 1];
  };
  // 推定エネルギー必要量。体重があれば本人の体重で、なければ null
  // method: 'bmr'=基礎代謝基準値×体重×身体活動レベル / 'kg'=体重×係数 / 'hb'=Harris-Benedict×活動×ストレス
  N.energyNeed = function (o) {
    const band = N.ageBand(o.age);
    const sex = o.sex === 'm' ? 'm' : 'f';
    const w = Number(o.weightKg) || null;
    if (!w) return null;
    if (o.method === 'kg') return Math.round(w * (Number(o.kcalPerKg) || 30));
    if (o.method === 'hb') {
      const hcm = Number(o.heightCm) || 0, age = Number(o.age) || 0;
      if (!hcm || !age) return null;
      const bee = sex === 'm' ? 66.47 + 13.75 * w + 5.0 * hcm - 6.76 * age : 655.1 + 9.56 * w + 1.85 * hcm - 4.68 * age;
      return Math.round(bee * (Number(o.activity) || 1.3) * (Number(o.stress) || 1.0));
    }
    if (!band) return null;
    const pal = o.pal != null ? Number(o.pal) : (band.pal[o.palIndex != null ? o.palIndex : 1] || band.pal[0]);
    return Math.round(band.bmr[sex] * w * pal);
  };
  // 1 日の基準（下限・上限）。energy から %E の栄養素も数値にする
  N.dailyTarget = function (o) {
    const band = N.ageBand(o.age);
    const sex = o.sex === 'm' ? 'm' : 'f';
    const kcal = o.energy != null ? o.energy : N.energyNeed(o);
    const ref = (band && N.DRI.ref[band.id] && N.DRI.ref[band.id][sex]) || null;
    const t = {};
    if (kcal) {
      t.kcal = [Math.round(kcal * 0.95), Math.round(kcal * 1.05)];
      const pfc = N.DRI.pfc;
      t.prot = [Math.round(kcal * pfc.prot[0] / 100 / 4), Math.round(kcal * pfc.prot[1] / 100 / 4)];
      t.fat = [Math.round(kcal * pfc.fat[0] / 100 / 9), Math.round(kcal * pfc.fat[1] / 100 / 9)];
      t.cho = [Math.round(kcal * pfc.cho[0] / 100 / 4), Math.round(kcal * pfc.cho[1] / 100 / 4)];
      t.fasat = [null, Math.round(kcal * pfc.fasat[1] / 100 / 9 * 10) / 10];
    }
    if (ref) Object.keys(ref).forEach((k) => {
      if (k === 'prot' && t.prot) { t.prot = [Math.max(t.prot[0], ref.prot[0]), t.prot[1]]; return; } // 目標量の下限は推奨量以上
      t[k] = ref[k].slice();
    });
    return { target: t, band: band, energy: kcal, version: N.DRI_VERSION };
  };
  // ---- 個人の必要栄養量 ----
  // 施設によって出し方が違う（基礎代謝基準値を使う所、体重×係数の所、Harris-Benedict を使う所）。
  // どれを使ったかを利用者ごとに残せるようにする。残さないと、あとで数字の根拠が分からなくなる。
  N.WEIGHT_BASE = [
    { id: 'actual', label: '実体重' },
    { id: 'ideal', label: '標準体重（BMI 22）' },
    { id: 'adjust', label: '調整体重（標準＋（実−標準）×0.25）' }
  ];
  N.NEED_METHODS = [
    { id: 'bmr', label: '基礎代謝基準値 × 体重 × 身体活動レベル', note: '日本人の食事摂取基準の推定エネルギー必要量。施設ではこれが基本' },
    { id: 'kg', label: '体重 × 係数（kcal/kg）', note: '25〜30 kcal/kg がよく使われる。手早く出したい時' },
    { id: 'hb', label: 'Harris-Benedict × 活動係数 × ストレス係数', note: '病院・NST でよく使う。身長と年齢が要る' },
    { id: 'manual', label: '手で入れる', note: '医師の指示など、計算に寄らない時' }
  ];
  N.idealWeight = function (heightCm) {
    const hm = (Number(heightCm) || 0) / 100;
    return hm > 0 ? Math.round(22 * hm * hm * 10) / 10 : null;
  };
  // 計算に使う体重を決める
  N.weightFor = function (base, actualKg, heightCm) {
    const a = Number(actualKg) || null;
    if (base === 'ideal' || base === 'adjust') {
      const ideal = N.idealWeight(heightCm);
      if (!ideal) return a;
      if (base === 'ideal') return ideal;
      if (!a) return ideal;
      return Math.round((ideal + (a - ideal) * 0.25) * 10) / 10;
    }
    return a;
  };
  N.emptyRule = function () {
    return { method: 'bmr', weightBase: 'actual', palIndex: 1, kcalPerKg: 30, activity: 1.3, stress: 1.0,
      kcal: null, protPerKg: 1.0, prot: null, setAt: '', by: '' };
  };
  // rule と本人の身体の値から、必要エネルギーとたんぱく質を出す
  // o = { age, sex, weightKg, heightCm }
  N.personalNeed = function (rule, o) {
    const r = Object.assign(N.emptyRule(), rule || {});
    const w = N.weightFor(r.weightBase, o.weightKg, o.heightCm);
    const kcal = r.method === 'manual' ? (r.kcal == null ? null : Math.round(r.kcal))
      : N.energyNeed({ age: o.age, sex: o.sex, weightKg: w, heightCm: o.heightCm,
        method: r.method, palIndex: r.palIndex, kcalPerKg: r.kcalPerKg, activity: r.activity, stress: r.stress });
    const prot = r.prot != null ? Math.round(r.prot * 10) / 10
      : (w ? Math.round(w * (Number(r.protPerKg) || 1.0) * 10) / 10 : null);
    return { rule: r, weightUsed: w, kcal: kcal, prot: prot,
      // 出し方を 1 行で（様式に根拠として書ける形）
      how: N.needHow(r, o, w, kcal) };
  };
  N.needHow = function (r, o, w, kcal) {
    const band = N.ageBand(o.age);
    const wb = (N.WEIGHT_BASE.find((x) => x.id === r.weightBase) || {}).label || '';
    if (r.method === 'manual') return '手で入れた値';
    if (!w) return '体重が無いので出せません';
    if (r.method === 'kg') return wb + ' ' + w + 'kg × ' + (r.kcalPerKg || 30) + ' kcal/kg = ' + (kcal == null ? '—' : kcal) + ' kcal';
    if (r.method === 'hb') return 'Harris-Benedict（' + wb + ' ' + w + 'kg・' + (o.heightCm || '—') + 'cm・' + (o.age == null ? '—' : o.age) + '歳）× 活動 ' +
      (r.activity || 1.3) + ' × ストレス ' + (r.stress || 1.0) + ' = ' + (kcal == null ? '—' : kcal) + ' kcal';
    if (!band) return '年齢が無いので出せません';
    const pal = band.pal[r.palIndex != null ? r.palIndex : 1] || band.pal[0];
    return '基礎代謝基準値 ' + band.bmr[o.sex === 'm' ? 'm' : 'f'] + ' × ' + wb + ' ' + w + 'kg × 身体活動レベル ' + pal +
      ' = ' + (kcal == null ? '—' : kcal) + ' kcal（' + band.label + '・' + N.DRI_VERSION + '）';
  };

  // 実際の値を基準と見比べる → 'low'（下限未満）/'high'（上限超え）/'ok'/null（基準なし）
  N.judge = function (target, key, value) {
    const r = target && target[key];
    if (!r || value == null) return null;
    if (r[0] != null && value < r[0]) return 'low';
    if (r[1] != null && value > r[1]) return 'high';
    return 'ok';
  };
  // 給与栄養目標量: 人員構成（性・年齢・活動レベル・体重の一覧）から、丸めた目標を出す
  // 手順の出典: 横浜市の手引き（推定エネルギー必要量を 50kcal 単位に丸める、荷重平均と最頻値）
  N.groupTarget = function (people, opts) {
    opts = opts || {};
    const step = opts.step || 50;
    const list = [];
    people.forEach((p) => {
      const e = N.energyNeed(p);
      if (e) list.push(Math.round(e / step) * step);
    });
    if (!list.length) return null;
    const count = {};
    list.forEach((e) => { count[e] = (count[e] || 0) + 1; });
    const mode = Number(Object.keys(count).sort((a, b) => count[b] - count[a] || Number(a) - Number(b))[0]);
    const mean = Math.round(list.reduce((s, x) => s + x, 0) / list.length / step) * step;
    return { list: list, dist: count, mode: mode, mean: mean, min: Math.min.apply(null, list), max: Math.max.apply(null, list),
      spread: Math.max.apply(null, list) - Math.min.apply(null, list) };
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = N;
  root.Nutri = N;
  // foods_data.js が先に読み込まれていれば、その場で使えるようにする
  if (root.FOODS_DATA) N.load(root.FOODS_DATA);
})(typeof window !== 'undefined' ? window : globalThis);
