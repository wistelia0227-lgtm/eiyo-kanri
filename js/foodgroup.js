// 食品群の分類。DOM にも DB にも触れない（Node で試験できる）。window.FoodGroup で公開。
// 何のためか: 行政に出す「栄養管理報告書」の裏面と「食品構成表」は、栄養素ではなく食品群ごとの重量で書く。
//   成分表の大分類（食品番号の上 2 桁）だけでは足りず、次の 3 つを自分で分ける必要がある。
//   ・穀類 → ごはん・パン・めん・その他（報告書が「穀類（ごはん・パン・めん）」と分けている）
//   ・野菜類 → 緑黄色野菜・野菜漬物類・その他の野菜
//   ・きのこ類は報告書の欄に無いので「その他の野菜」に寄せる自治体がある（既定は独立の欄のまま、設定で寄せられる）
// 緑黄色野菜の定義（厚生労働省 健健発0804第1号 令和3年8月4日「日本食品標準成分表2020年版（八訂）の取扱いについて」）:
//   原則として可食部 100g 当たり β-カロテン当量 600μg 以上。
//   ただし 600μg 未満でも、摂取量と摂取頻度から緑黄色野菜として扱うものが別表にある
//   （アスパラガス／さやいんげん／さやえんどう／ししとう／たらのめ／赤色トマト／青ピーマン）。
//   ここでは前者を成分値から自動で判定し、後者だけを名前で足す（表を手で持つ範囲を最小にする）。
(function (root) {
  'use strict';
  const FG = {};

  // 報告書・食品構成表で使う群。order は帳票に並べる順
  FG.GROUPS = [
    { id: 'rice', label: '穀類（ごはん）', base: '01' },
    { id: 'bread', label: '穀類（パン）', base: '01' },
    { id: 'noodle', label: '穀類（めん）', base: '01' },
    { id: 'grain', label: '穀類（その他）', base: '01' },
    { id: 'potato', label: 'いも及びでん粉類', base: '02' },
    { id: 'sugar', label: '砂糖及び甘味類', base: '03' },
    { id: 'bean', label: '豆類', base: '04' },
    { id: 'seed', label: '種実類', base: '05' },
    { id: 'gvege', label: '緑黄色野菜', base: '06' },
    { id: 'ovege', label: 'その他の野菜', base: '06' },
    { id: 'pickle', label: '野菜漬物類', base: '06' },
    { id: 'fruit', label: '果実類', base: '07' },
    { id: 'mushroom', label: 'きのこ類', base: '08' },
    { id: 'alga', label: '藻類', base: '09' },
    { id: 'fish', label: '魚介類', base: '10' },
    { id: 'meat', label: '肉類', base: '11' },
    { id: 'egg', label: '卵類', base: '12' },
    { id: 'milk', label: '乳類', base: '13' },
    { id: 'oil', label: '油脂類', base: '14' },
    { id: 'sweets', label: '菓子類', base: '15' },
    { id: 'drink', label: 'し好飲料類', base: '16' },
    { id: 'season', label: '調味料及び香辛料類', base: '17' },
    { id: 'ready', label: '調理済み流通食品類', base: '18' }
  ];
  FG.label = (id) => { const g = FG.GROUPS.find((x) => x.id === id); return g ? g.label : id; };
  FG.ids = () => FG.GROUPS.map((g) => g.id);

  // 成分表の大分類 → 群（細分の要らないもの）
  const DIRECT = { '02': 'potato', '03': 'sugar', '04': 'bean', '05': 'seed', '07': 'fruit', '08': 'mushroom',
    '09': 'alga', '10': 'fish', '11': 'meat', '12': 'egg', '13': 'milk', '14': 'oil', '15': 'sweets',
    '16': 'drink', '17': 'season', '18': 'ready' };

  // 緑黄色野菜の別表（β-カロテン当量が 600μg 未満でも緑黄色野菜として扱うもの）
  // 通知の別表の書き方に寄せて「食品名の頭」で見る。ゆで・油いためなどの調理形も同じ扱いになる。
  const GREEN_EXCEPT = ['アスパラガス', 'さやいんげん', 'さやえんどう', 'ししとう', 'たらのめ', '赤色トマト', '青ピーマン'];
  // 逆に、名前に緑黄色野菜の語が入っていても野菜ではないもの（果実のトマト加工品など）は base で弾くので要らない

  const RICE = ['めし', 'かゆ', 'おもゆ', 'おにぎり', '赤飯', 'アルファ化米'];
  const BREAD = ['パン', 'ナン', 'チャパティ', 'クロワッサン', 'ベーグル', 'マフィン'];
  const NOODLE = ['めん', 'うどん', 'そうめん', 'ひやむぎ', 'そば', 'スパゲッティ', 'マカロニ', 'パスタ', 'ビーフン'];
  // 名前に「めん」「そば」等が入っていても、食べる形ではなく原材料や皮のもの
  const NOT_NOODLE = ['そば粉', 'そば米', '皮'];

  function has(name, list) { return list.some((w) => String(name || '').indexOf(w) >= 0); }

  // 穀類の細分。成分表の 01 は「原材料（米・小麦粉・そば粉）」と「食べる形（めし・パン・めん）」が混ざっている。
  // 報告書が数えたいのは食べる形なので、原材料と皮（ぎょうざの皮など）は「穀類（その他）」に置く。
  function grainKind(name) {
    const n = String(name || '');
    if (has(n, RICE)) return 'rice';
    if (has(n, BREAD) && n.indexOf('パン粉') < 0) return 'bread';
    if (has(n, NOODLE) && !has(n, NOT_NOODLE)) return 'noodle';
    return 'grain';
  }

  // 野菜の細分
  function vegeKind(name, carotene) {
    const n = String(name || '');
    // 漬物（塩漬・ぬかみそ漬・梅干し・キムチなど）。名前に「漬」か「キムチ」か「梅干し」が入る
    if (n.indexOf('漬') >= 0 || n.indexOf('キムチ') >= 0 || n.indexOf('梅干し') >= 0) return 'pickle';
    if (GREEN_EXCEPT.some((w) => n.indexOf(w) >= 0)) return 'gvege';
    if (carotene != null && carotene >= 600) return 'gvege';
    return 'ovege';
  }

  // 食品 1 件の群を決める。food は Nutri.get() が返す形（{no, group, name}）、
  // carotene は β-カロテン当量（μg/100g。未測定なら null）
  FG.classify = function (food, carotene) {
    if (!food) return null;
    const g = food.group || String(food.no || '').slice(0, 2);
    if (g === '01') return grainKind(food.name);
    if (g === '06') return vegeKind(food.name, carotene);
    return DIRECT[g] || null;
  };

  // Nutri を渡して、食品番号から群を引く関数を作る（成分値を読むのに Nutri が要る）
  FG.classifier = function (N) {
    const cache = {};
    return function (no) {
      if (cache[no] !== undefined) return cache[no];
      const f = N.get(no);
      const c = f ? N.val(f, 'cartbeq') : null;
      return (cache[no] = FG.classify(f, c));
    };
  };

  // 材料の並び [{no, g}] を群ごとの重量にまとめる。unknown = 群が分からなかった重量
  FG.tally = function (items, classify) {
    const out = {}, r = { g: out, unknown: 0, total: 0 };
    (items || []).forEach((it) => {
      const g = Number(it.g) || 0;
      if (!g) return;
      r.total += g;
      const k = classify(it.no);
      if (!k) { r.unknown += g; return; }
      out[k] = (out[k] || 0) + g;
    });
    return r;
  };

  FG.addTally = function (a, b) {
    const out = { g: {}, unknown: (a.unknown || 0) + (b.unknown || 0), total: (a.total || 0) + (b.total || 0) };
    [a, b].forEach((x) => Object.keys(x.g || {}).forEach((k) => { out.g[k] = (out.g[k] || 0) + x.g[k]; }));
    return out;
  };
  FG.scaleTally = function (a, k) {
    const out = { g: {}, unknown: (a.unknown || 0) * k, total: (a.total || 0) * k };
    Object.keys(a.g || {}).forEach((x) => { out.g[x] = a.g[x] * k; });
    return out;
  };
  FG.emptyTally = function () { return { g: {}, unknown: 0, total: 0 }; };

  // 報告書の「1人1日当たり平均提供食品量」の欄に合わせてまとめる
  // （穀類は ごはん・パン・めん を分けたまま、きのこを「その他の野菜」に寄せるかは opt.mushroomToVege）
  FG.REPORT_ROWS = [
    { id: 'rice', label: '穀類（ごはん）' }, { id: 'bread', label: '穀類（パン）' }, { id: 'noodle', label: '穀類（めん）' },
    { id: 'potato', label: 'いも及びでんぷん類' }, { id: 'sugar', label: '砂糖及び甘味類' }, { id: 'bean', label: '豆類' },
    { id: 'gvege', label: '緑黄色野菜' }, { id: 'ovege', label: 'その他の野菜' }, { id: 'pickle', label: '野菜漬物類' },
    { id: 'fruit', label: '果実類' }, { id: 'alga', label: '藻類' }, { id: 'fish', label: '魚介類' },
    { id: 'meat', label: '肉類' }, { id: 'egg', label: '卵類' }, { id: 'milk', label: '乳類' }, { id: 'oil', label: '油脂類' }
  ];

  if (typeof module !== 'undefined' && module.exports) module.exports = FG;
  root.FoodGroup = FG;
})(typeof window !== 'undefined' ? window : globalThis);
