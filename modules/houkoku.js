// 保健所に出す栄養（管理）報告書（削除可能）。様式は js/houkoku_forms.js（県の Excel の中身のとおり）。
// 入っているのは 福岡県 様式第5号 と 熊本県 別記第6号様式その1 の 2 つ。
//   大牟田市は福岡県の管轄、荒尾市は熊本県の管轄（政令市・中核市だけが自前の様式を持つ）。
// この画面がすること:
//   1. アプリが持っている数字（食数・食種別食数・給与栄養量・食品群別給与量・年齢構成・BMI など）を欄に入れる
//   2. 残りを手で埋める。入れた内容は様式ごと・期間ごとに保存する
//   3. 様式の項目順のまま刷る。県の Excel に書き写す時に、目が迷わないようにするため
// 自動で入れた欄には印を付ける。どこが計算でどこが手入力かが分からないまま出すと、間違いに気づけないため。
(function () {
  'use strict';
  const U = window.U, h = U.h, DB = window.DB, M = window.Model, N = window.Nutri, V = window.View;
  const FG = window.FoodGroup, App = window.App, HK = window.HoukokuForms;
  const ms = () => window.Master.current;
  const H = {};
  let formId = 'fukuoka5', period = '', sId = '';

  H.periodNow = () => window.Report ? window.Report.monthNow() : U.today().slice(0, 7);
  H.key = HK.key;
  H.load = async function (fid, per) { return (await DB.getMeta(HK.key(fid, per), null)) || {}; };
  H.save = function (fid, per, values) { return DB.setMeta(HK.key(fid, per), values); };

  // ---- アプリが持っている数字を集める ----
  // 2 段構えにしてある。
  //   H.collect  … 様式に関係なく「アプリが知っていること」を集める
  //   H.mapXxx   … それを、その様式の欄の id に割り当てる
  // 同じ中身でも欄の id と選択肢の番号が県ごとに違うので、集めるのと割り当てるのを分けた。
  H.collect = async function (per, shokushuId) {
    const m = ms(), meals = M.activeMeals(m);
    const fac = m.facility || {};
    const shok = m.shokushu || [];
    const days = window.Report ? window.Report.daysOf(per) : [];
    const past = days.filter((d) => d <= U.today());
    const year = per.slice(0, 4);
    const residents = (await DB.residents()).filter((r) => !r.archived);
    const d = { fac: fac, kinds: (m.profile || {}).kinds || [], per: per, year: year, days: days.length, past: past.length };

    // 食数: その月の各日・各食の人数を数え、1 日あたりの平均にする
    const cen = { b: [], l: [], d: [], o: [] }, byShokushu = {};
    let staff = 0, staffN = 0, kikouDays = 0, hygieneDays = 0;
    const dailyAll = await DB.getAll('daily');
    const dailyBy = {}; dailyAll.forEach((x) => { if (x.date) dailyBy[x.date] = x; });
    dailyAll.forEach((x) => {
      if (String(x.date || '').slice(0, 4) !== year) return;
      if (x.kikou && Object.keys(x.kikou).length) kikouDays++;
    });
    for (const dt of past) {
      const daily = dailyBy[dt] || {};
      meals.forEach((ml) => {
        const c = M.census(residents, { d: dt, m: ml.id }, m);
        const slot = (ml.id === 'b' || ml.id === 'l' || ml.id === 'd') ? ml.id : 'o';
        cen[slot].push(c.total);
        Object.keys(c.byShokushu).forEach((k) => { byShokushu[k] = (byShokushu[k] || 0) + c.byShokushu[k]; });
      });
      const ex = daily.extra || {};
      const sN = Object.keys(ex).reduce((a, k) => a + (Number(ex[k]) || 0), 0);
      if (sN) { staff += sN; staffN++; }
      if (daily.hygiene && Object.keys(daily.hygiene).length) hygieneDays++;
    }
    const avg = (list) => list.length ? Math.round(list.reduce((a, b) => a + b, 0) / list.length) : '';
    const nDays = Math.max(1, past.length);
    d.meals = { b: avg(cen.b), l: avg(cen.l), d: avg(cen.d), o: avg(cen.o) };
    d.staffMeals = staffN ? Math.round(staff / staffN) : '';
    d.kikouDays = kikouDays;
    d.hygieneDays = hygieneDays;
    d.shokushu = Object.keys(byShokushu)
      .map((k) => ({ id: k, name: M.label(shok, k) || '（未設定）', n: Math.round(byShokushu[k] / nDays) }))
      .filter((x) => x.n > 0).sort((a, b) => b.n - a.n);

    // 献立から: 給与栄養量・食品群別給与量
    const sid = shokushuId || (shok[0] && shok[0].id) || '';
    d.sid = sid;
    d.shokushuName = M.label(shok, sid);
    d.filled = 0;
    if (window.Report && days.length) {
      const got = await window.Report.gather(days, sid, 'plan');
      d.filled = got.filled;
      if (got.filled) {
        d.nut = got.avgNut.values || {};
        d.group = got.avgGroup.g || {};
        d.perDay = got.perDay.filter((x) => !x.empty);
      }
    }

    // 献立の日ごとの印から: 選択メニュー・残食調査・行事食
    let sentakuDays = 0, zanDays = 0, gyojiDays = 0;
    for (const dt of days) {
      const rec = await window.Menu.get(dt);
      if (rec.choice && Object.keys(rec.choice).length) sentakuDays++;
      if (rec.left && Object.keys(rec.left).length) zanDays++;
      if (rec.poster && (rec.poster.name || rec.poster.mark)) gyojiDays++;
    }
    d.sentakuDays = sentakuDays; d.zanDays = zanDays; d.gyojiDays = gyojiDays;

    // 給食会議の議事録（modules/poster.js）
    const minutes = ((await DB.getMeta('minutes', [])) || []).filter((x) => String(x.date || '').slice(0, 4) === year);
    d.kaigiN = minutes.length;
    d.kaigiGidai = minutes.map((x) => x.agenda).filter(Boolean).join('／');

    // 掲示（modules/poster.js）
    d.keiji = d.filled > 0;
    d.seibunKomoku = window.Poster
      ? window.Poster.keys().map((k) => (N.nutrients.find((x) => x.key === k) || { name: k }).name).join('、') : '';

    // 年齢構成と BMI。体重は一番新しい測定値
    const wv = {};
    (await DB.getAll('measures')).forEach((x) => {
      if (x.kind !== 'weight') return;
      const p2 = wv[x.residentId];
      if (!p2 || p2.date < x.date) wv[x.residentId] = x;
    });
    const w2 = {}; Object.keys(wv).forEach((k) => { w2[k] = wv[k].value; });
    const ab = H.ageBmi(residents, m, w2);
    d.age = ab.age; d.bmi = ab.bmi; d.live = ab.live.length;

    // 必要栄養量の出し方（個別に作っているか）
    d.ruleN = residents.filter((r) => r.energyRule).length;
    d.residentN = residents.length;
    d.stapleN = (m.staple || []).length;
    d.sideN = (m.side || []).length;
    return d;
  };

  const r0 = (v) => v == null ? '' : Math.round(v);
  const r1 = (v) => v == null ? '' : Math.round(v * 10) / 10;
  const r2 = (v) => v == null ? '' : Math.round(v * 100) / 100;
  const yes = (b) => b ? 'yes' : 'no';

  // ---- 福岡県 様式第5号 の欄に割り当てる ----
  H.mapFukuoka = function (d) {
    const out = {}, fac = d.fac;
    if (fac.name) out.shisetsu = fac.name;
    if (fac.kanrisha) out.kanrisha = fac.kanrisha;
    if (fac.zip) out.zip = fac.zip;
    if (fac.addr) out.addr = fac.addr;
    if (fac.tel) out.tel = fac.tel;
    if (fac.fax) out.fax = fac.fax;
    if (fac.mail) out.mail = fac.mail;
    const kind = H.kindOf('fukuoka5', d.kinds);
    if (kind) out.kind = kind;

    out.kyushoku = { nyusho: { b: d.meals.b, l: d.meals.l, d: d.meals.d, o: d.meals.o } };
    if (d.staffMeals) out.kyushoku.staff = { l: d.staffMeals };
    if (d.shokushu.length) out.shokushu = d.shokushu.map((x) => ({ name: x.name, n: x.n }));
    if (d.shokushuName) out.kijunShu = d.shokushuName;

    if (d.filled) {
      const v = d.nut, kcal = v.kcal || 0;
      const pct = (g, k) => kcal ? ((g || 0) * k / kcal * 100).toFixed(1) : '';
      const pe = pct(v.prot, 4), fe = pct(v.fat, 9);
      out.nut = {
        kcal: { jitsu: r0(kcal) }, prot: { jitsu: r1(v.prot) }, fat: { jitsu: r1(v.fat) },
        ca: { jitsu: r0(v.ca) }, fe: { jitsu: r1(v.fe) }, va: { jitsu: r0(v.vita) },
        b1: { jitsu: r2(v.b1) }, b2: { jitsu: r2(v.b2) }, vc: { jitsu: r0(v.vitc) },
        fib: { jitsu: r1(v.fib) }, nacl: { jitsu: r1(v.nacl) },
        pe: { jitsu: pe }, fe2: { jitsu: fe },
        ce: { jitsu: kcal ? (100 - Number(pe || 0) - Number(fe || 0)).toFixed(1) : '' }
      };
      out.food = {};
      HK.FG_FUKUOKA.forEach((row, i) => {
        if (!row.ids.length) return;
        out.food['f' + i] = { given: Math.round(row.ids.reduce((a, id) => a + (d.group[id] || 0), 0)) };
      });
    }

    if (d.kaigiN) { out.kaigi = d.kaigiN; if (d.kaigiGidai) out.kaigiGidai = d.kaigiGidai; }
    if (d.kikouDays) out.shiko = d.kikouDays;
    if (d.zanDays) out.zanshoku = d.zanDays + ' 回／月';
    if (d.sentakuDays) { out.sentaku = 'yes'; out.sentakuN = '有（' + d.sentakuDays + ' 日／月）'; }
    if (d.keiji) {
      out.kondate = 'yes';
      out.seibun = 'yes';
      if (d.seibunKomoku) out.seibunKomoku = '実施（項目：' + d.seibunKomoku + '）';
    }
    return out;
  };

  // ---- 熊本県 別記第6号様式その1 の欄に割り当てる ----
  H.mapKumamoto = function (d) {
    const out = {}, fac = d.fac;
    if (fac.name) out.shisetsu = fac.name;
    if (fac.addr) out.addr = (fac.zip ? '〒' + fac.zip + ' ' : '') + fac.addr;
    if (fac.tel) out.tel = fac.tel;
    if (fac.kanrisha) out.kanrishaName = fac.kanrisha;
    if (fac.setchiName) out.setchiName = fac.setchiName;
    if (fac.setchiAddr) out.setchiAddr = fac.setchiAddr;
    const kind = H.kindOf('kumamoto6', d.kinds);
    if (kind) out.kind = kind;

    // 食事の種類と食数。アプリの食種は施設ごとに決めるので、まとめて「一般食 その他」に入れる
    out.shokusu = { b: { ippanOther: d.meals.b }, l: { ippanOther: d.meals.l }, d: { ippanOther: d.meals.d } };
    if (d.meals.o) out.shokusu.o = { ippanOther: d.meals.o };
    if (d.staffMeals) out.shokusu.l = Object.assign(out.shokusu.l || {}, { shokuin: d.staffMeals });

    if (d.kaigiN) { out.kaigi = 'yes'; out.kaigiKai = H.kaisuOpt(d.kaigiN); }
    out.age = d.age;
    if (Object.keys(d.bmi).length) out.bmi = d.bmi;
    if (d.zanDays) { out.sesshu = 'yes'; out.sesshuHoho = '2'; }   // 残食調査（個別：主食、副食別）
    if (d.kikouDays) out.anketo = 'yes';
    if (d.ruleN) {
      out.settei = d.ruleN === d.residentN ? '3' : '2';
      out.setteiKomoku = ['1', '2', '4'];
      out.kijun = '1';
    }
    if (d.filled) {
      out.sanshutsuCond = '算出期間 ' + d.filled + ' 日／食種 ' + d.shokushuName + '／平均喫食者数 ' + (d.meals.l || '') + ' 人';
      out.kyuyo = H.kumaKyuyo(d);
    }
    out.shushoku = '主食の量（' + d.stapleN + '）種類　副食の量（' + d.sideN + '）種類';
    if (d.gyojiDays) out.gyoji = 'yes';
    if (d.hygieneDays) out.eisei = 'yes';
    if (d.keiji) {
      out.keiji = 'yes';
      out.seibun = 'yes';
    }
    return out;
  };

  H.MAPPERS = { fukuoka5: H.mapFukuoka, kumamoto6: H.mapKumamoto };
  H.auto = async function (form, per, shokushuId) {
    const d = await H.collect(per, shokushuId);
    const fn = H.MAPPERS[form.id];
    const out = fn ? fn(d) : {};
    out._filled = d.filled;
    out._days = d.past;
    return out;
  };

  // 事業所の種類（js/profile.js の id）→ 様式の選択肢の番号。
  // 併設があると事業所は種類を複数持つので、先に見る順番を決めておく（本体の施設を先に）。
  H.KIND_ORDER = ['hospital', 'roken', 'iryoin', 'tokuyo', 'chiiki', 'yuryo', 'short', 'hoiku', 'gh', 'shoki', 'day', 'shogai'];
  H.KIND_MAP = {
    // 福岡 様式第5号: 1病院 2介護老人保健施設 3介護医療院 4老人福祉施設 5社会福祉施設
    fukuoka5: { hospital: 1, roken: 2, iryoin: 3, tokuyo: 4, chiiki: 4, yuryo: 4, short: 4,
      hoiku: 5, gh: 5, shoki: 5, day: 5, shogai: 5 },
    // 熊本 別記第6号様式: 1病院 2介護老人保健施設 3介護医療院 4老人福祉施設 5児童福祉施設 6社会福祉施設
    kumamoto6: { hospital: 1, roken: 2, iryoin: 3, tokuyo: 4, chiiki: 4, yuryo: 4, short: 4,
      hoiku: 5, gh: 6, shoki: 6, day: 6, shogai: 6 }
  };
  H.kindOf = function (formId, kinds) {
    const map = H.KIND_MAP[formId] || {};
    for (const k of H.KIND_ORDER) if (kinds.indexOf(k) >= 0 && map[k]) return String(map[k]);
    return '';
  };
  // 年に何回か → 熊本の「回数」の選択肢
  H.kaisuOpt = function (n) {
    if (!n) return '';
    if (n <= 1) return '1';
    if (n <= 3) return '2';
    if (n <= 6) return '3';
    if (n <= 11) return '4';
    return '5';
  };
  // 熊本 E の給与栄養量（平均・最小・最大）。日ごとの値から出す
  H.KUMA_NUT = [
    { col: 'kcal', key: 'kcal', dec: 0 }, { col: 'prot', key: 'prot', dec: 1 },
    { col: 'va', key: 'vita', dec: 0 }, { col: 'b1', key: 'b1', dec: 2 }, { col: 'b2', key: 'b2', dec: 2 },
    { col: 'vc', key: 'vitc', dec: 0 }, { col: 'ca', key: 'ca', dec: 0 }, { col: 'fe', key: 'fe', dec: 1 },
    { col: 'nacl', key: 'nacl', dec: 1 }, { col: 'fib', key: 'fib', dec: 1 }, { col: 'k', key: 'k', dec: 0 }
  ];
  H.kumaKyuyo = function (d) {
    const out = { avg: {}, min: {}, max: {} };
    const days = d.perDay || [];
    H.KUMA_NUT.forEach((c) => {
      const vals = days.map((x) => (x.nut.values || {})[c.key]).filter((x) => x != null);
      if (!vals.length) return;
      const f = (x) => c.dec === 0 ? Math.round(x) : Math.round(x * Math.pow(10, c.dec)) / Math.pow(10, c.dec);
      out.avg[c.col] = f(vals.reduce((a, b) => a + b, 0) / vals.length);
      out.min[c.col] = f(Math.min.apply(null, vals));
      out.max[c.col] = f(Math.max.apply(null, vals));
    });
    const v = d.nut || {};
    if (v.kcal) {
      out.avg.protE = ((v.prot || 0) * 4 / v.kcal * 100).toFixed(1);
      out.avg.fatE = ((v.fat || 0) * 9 / v.kcal * 100).toFixed(1);
    }
    return out;
  };

  // 年齢階級別の人数と BMI の割合（熊本 C）。BMI の境目は様式に書かれている値をそのまま使う
  H.AGE_BANDS = [[0, 17], [18, 29], [30, 49], [50, 64], [65, 74], [75, 84], [85, 999]];
  H.BMI_ROWS = [
    { id: 'y3', from: 3, to: 17, low: null, high: null },     // やせ・肥満は成長曲線で見るので自動では出さない
    { id: 'y18', from: 18, to: 49, low: 18.5, high: 25.0 },
    { id: 'y50', from: 50, to: 64, low: 20.0, high: 25.0 },
    { id: 'y65', from: 65, to: 999, low: 21.5, high: 25.0 }
  ];
  H.ageBmi = function (residents, m, weights) {
    const today = U.today();
    const live = residents.filter((r) => M.status(r, today, m.meals) === 'in');
    const age = { m: {}, f: {} };
    const bmi = {};
    const n = {}, lowN = {}, highN = {};
    H.BMI_ROWS.forEach((b) => { n[b.id] = 0; lowN[b.id] = 0; highN[b.id] = 0; });
    live.forEach((r) => {
      const a = M.age(r.birth, today);
      const bi = H.AGE_BANDS.findIndex((b) => a != null && a >= b[0] && a <= b[1]);
      if (bi >= 0) { const s = r.gender === 'm' ? 'm' : 'f'; const k = 'a' + (bi + 1); age[s][k] = (age[s][k] || 0) + 1; }
      const row = H.BMI_ROWS.find((b) => a != null && a >= b.from && a <= b.to);
      if (!row || row.low == null) return;
      const w = (weights || {})[r.id];
      if (!w || !r.heightCm) return;
      const v = w / Math.pow(r.heightCm / 100, 2);
      n[row.id]++;
      if (v < row.low) lowN[row.id]++;
      if (v >= row.high) highN[row.id]++;
    });
    H.BMI_ROWS.forEach((b) => {
      if (!n[b.id]) return;
      bmi[b.id] = { low: (lowN[b.id] / n[b.id] * 100).toFixed(1), high: (highN[b.id] / n[b.id] * 100).toFixed(1) };
    });
    return { age: age, bmi: bmi, counted: n, live: live };
  };

  // ---- 画面 ----
  App.registerScreen('houkoku', async function (params, root) {
    if (params[0] && HK.form(params[0])) formId = params[0];
    period = params[1] || period || H.periodNow();
    const form = HK.form(formId), m = ms();
    const shok = m.shokushu || [];
    if (!sId) sId = (shok[0] && shok[0].id) || '';
    const values = await H.load(formId, period);
    const auto = await H.auto(form, period, sId);
    const save = async () => { await H.save(formId, period, values); };
    const val = (f) => (values[f.id] !== undefined && values[f.id] !== '') ? values[f.id] : (auto[f.id] !== undefined ? auto[f.id] : '');
    const isAuto = (f) => (values[f.id] === undefined || values[f.id] === '') && auto[f.id] !== undefined && auto[f.id] !== '';

    root.appendChild(h('header', { class: 'topbar no-print' }, h('h1', null, '栄養管理報告書'),
      h('div', null, h('button', { class: 'btn primary', onclick: () => window.print() }, '印刷'))));
    root.appendChild(h('div', { class: 'toolrow no-print' },
      HK.FORMS.map((f) => h('a', { class: 'btn seg' + (f.id === formId ? ' on' : ''), href: '#/houkoku/' + f.id + '/' + period },
        f.pref + '　' + f.title)),
      h('span', { class: 'gap' }),
      h('a', { class: 'btn', href: '#/houkoku/' + formId + '/' + window.Report.addMonth(period, -1) }, '◀ 前月'),
      h('b', null, period.replace('-', '年') + '月'),
      h('a', { class: 'btn', href: '#/houkoku/' + formId + '/' + window.Report.addMonth(period, 1) }, '次月 ▶'),
      h('span', { class: 'gap' }), h('span', { class: 'sub' }, '食種'),
      U.select(shok, sId, { noEmpty: true, onchange: (e) => { sId = e.target.value; App.refresh(); } })));

    const pr = HK.progress(form, values);
    root.appendChild(h('div', { class: 'card info no-print' },
      h('div', null, h('b', null, form.pref + '　' + form.formNo + '　' + form.title)),
      h('div', null, form.who),
      h('div', null, '出すところ: ' + form.to + '　／　' + form.when),
      h('div', null, '根拠: ' + form.law),
      h('div', null, h('a', { href: form.url, target: '_blank', rel: 'noopener' }, form.url), '（県の Excel はここから）'),
      form.attach.length ? h('div', null, '添付: ' + form.attach.join('・')) : null,
      h('div', { class: 'sub' }, '青い欄はアプリが計算した数字です。上書きすると手入力になります。'
        + 'この紙は県の Excel に書き写すためのものです（様式の項目順に並べてあります）。'),
      h('div', null, '手で書いた欄 ' + pr.done + ' / ' + pr.all)));

    const paper = U.paper(form.title, { date: '', note: form.formNo });
    paper.querySelector('.paper-right').appendChild(h('div', { class: 'sub' }, form.pref + '　' + period.replace('-', '年') + '月分'));
    root.appendChild(paper);
    paper.appendChild(h('div', { class: 'paper-sec' }, form.to));
    form.head.forEach((f) => paper.appendChild(row(f)));

    form.pages.forEach((pg) => {
      paper.appendChild(h('h3', { class: 'paper-page' }, pg.label));
      pg.blocks.forEach((b) => {
        paper.appendChild(h('div', { class: 'paper-sec' }, (b.no ? b.no + '　' : '') + b.title));
        b.fields.forEach((f) => paper.appendChild(row(f)));
      });
    });

    function row(f) {
      // 見出しの無い欄（表など）は幅いっぱいに使う
      const full = !f.label || f.k === 'grid' || f.k === 'list';
      const box = h('div', { class: 'hk-row' + (full ? ' hk-full' : '') + (isAuto(f) ? ' hk-auto' : '') });
      if (f.label) box.appendChild(h('div', { class: 'hk-label' }, f.label,
        isAuto(f) ? h('span', { class: 'hk-badge no-print' }, '自動') : null,
        f.hint ? h('div', { class: 'sub no-print' }, f.hint) : null));
      box.appendChild(h('div', { class: 'hk-body' }, control(f)));
      return box;
    }

    function setV(f, v) { values[f.id] = v; return save(); }

    function control(f) {
      if (f.k === 'text' || f.k === 'num') {
        const el = h('input', { class: 'input' + (f.k === 'num' ? ' num' : '') + (f.wide ? ' wide' : ''),
          type: 'text', value: val(f) === '' ? '' : String(val(f)) });
        el.addEventListener('change', () => setV(f, el.value));
        return f.unit ? [el, h('span', { class: 'sub' }, ' ' + f.unit)] : el;
      }
      if (f.k === 'note') {
        const el = h('textarea', { class: 'input', rows: String(f.rows || 2) });
        el.value = val(f) === '' ? '' : String(val(f));
        el.addEventListener('change', () => setV(f, el.value));
        return el;
      }
      if (f.k === 'yesno') {
        const cur = val(f);
        const words = { yes: f.yes || '有', no: f.no || '無' };
        // 画面はボタン、紙は選んだほうの文字だけ（.paper の中では .segrow を刷らない）
        return [h('span', { class: 'print-only pick' }, words[cur] || ''),
          h('div', { class: 'segrow' }, [['yes', f.yes || '有'], ['no', f.no || '無']].map((o) =>
          h('button', { type: 'button', class: 'btn seg small' + (cur === o[0] ? ' on' : ''),
            onclick: async () => { await setV(f, cur === o[0] ? '' : o[0]); App.refresh(); } }, o[1])))];
      }
      if (f.k === 'choice') {
        const cur = String(val(f) || '');
        const picked = cur ? cur + '　' + f.opts[Number(cur) - 1] : '';
        return [h('span', { class: 'print-only pick' }, picked),
          h('div', { class: 'segrow' }, f.opts.map((o, i) =>
          h('button', { type: 'button', class: 'btn seg small' + (cur === String(i + 1) ? ' on' : ''),
            onclick: async () => { await setV(f, cur === String(i + 1) ? '' : String(i + 1)); App.refresh(); } },
          (i + 1) + '　' + o)))];
      }
      if (f.k === 'multi') {
        const cur = Array.isArray(val(f)) ? val(f).slice() : [];
        const picked = cur.slice().sort((a2, b2) => Number(a2) - Number(b2))
          .map((id) => id + '　' + f.opts[Number(id) - 1]).join('　／　');
        return [h('span', { class: 'print-only pick' }, picked),
          h('div', { class: 'segrow' }, f.opts.map((o, i) => {
          const id = String(i + 1), on = cur.indexOf(id) >= 0;
          return h('button', { type: 'button', class: 'btn seg small' + (on ? ' on' : ''), onclick: async () => {
            const next = cur.slice();
            if (on) next.splice(next.indexOf(id), 1); else next.push(id);
            await setV(f, next); App.refresh();
          } }, id + '　' + o);
        }))];
      }
      if (f.k === 'grid') return grid(f);
      if (f.k === 'list') return list(f);
      return h('span', null, '');
    }

    function grid(f) {
      const cur = (typeof values[f.id] === 'object' && values[f.id]) ? values[f.id] : {};
      const au = (typeof auto[f.id] === 'object' && auto[f.id]) ? auto[f.id] : {};
      const cell = (rid, cid) => {
        const mine = (cur[rid] || {})[cid];
        const a = (au[rid] || {})[cid];
        const v = (mine === undefined || mine === '') ? (a === undefined ? '' : a) : mine;
        const fromAuto = (mine === undefined || mine === '') && a !== undefined && a !== '';
        const el = h('input', { class: 'input' + (f.text ? '' : ' num'), type: 'text', value: v === '' ? '' : String(v) });
        el.addEventListener('change', async () => {
          cur[rid] = cur[rid] || {}; cur[rid][cid] = el.value;
          await setV(f, cur);
        });
        return h('td', { class: fromAuto ? 'hk-auto-cell' : '' }, el);
      };
      const sumOf = (cid) => f.rows.reduce((a, r) => {
        const mine = (cur[r.id] || {})[cid], av = (au[r.id] || {})[cid];
        const v = (mine === undefined || mine === '') ? av : mine;
        return a + (Number(v) || 0);
      }, 0);
      return h('div', { class: 'scroll-x' }, h('table', { class: 'list bordered small hk-grid' },
        h('thead', null, h('tr', null, [h('th', null, '')].concat(f.cols.map((c) => h('th', null, c.label))))),
        h('tbody', null,
          f.rows.map((r) => h('tr', null,
            h('th', null, r.label, r.unit ? h('span', { class: 'sub' }, ' ' + r.unit) : null,
              r.note ? h('div', { class: 'sub no-print' }, r.note) : null),
            f.cols.map((c) => c.total
              ? h('td', { class: 'num sub' }, rowSum(r.id) || '')
              : cell(r.id, c.id)))),
          f.totalRow ? h('tr', { class: 'total' }, h('th', null, f.totalRow),
            f.cols.map((c) => h('td', { class: 'num' }, c.total ? '' : (sumOf(c.id) || '')))) : null)),
        f.foot ? h('div', { class: 'sub' }, f.foot) : null);

      function rowSum(rid) {
        return f.cols.filter((c) => !c.total).reduce((a, c) => {
          const mine = (cur[rid] || {})[c.id], av = (au[rid] || {})[c.id];
          const v = (mine === undefined || mine === '') ? av : mine;
          return a + (Number(v) || 0);
        }, 0);
      }
    }

    function list(f) {
      const cur = Array.isArray(values[f.id]) ? values[f.id] : null;
      const rows = cur || (Array.isArray(auto[f.id]) ? auto[f.id].map((x) => Object.assign({}, x)) : []);
      while (rows.length < (f.min || 3)) rows.push({});
      const box = h('div');
      const draw = () => {
        box.innerHTML = '';
        box.appendChild(h('table', { class: 'list bordered small' },
          h('thead', null, h('tr', null, f.cols.map((c) => h('th', null, c.label)))),
          h('tbody', null, rows.map((r) => h('tr', null, f.cols.map((c) => {
            const el = h('input', { class: 'input' + (c.num ? ' num' : ''), type: 'text', value: r[c.id] == null ? '' : String(r[c.id]) });
            el.addEventListener('change', async () => { r[c.id] = el.value; await setV(f, rows); });
            return h('td', null, el);
          }))),
          f.totalCol ? h('tr', { class: 'total' }, f.cols.map((c) => h('th', null,
            c.id === f.totalCol ? String(rows.reduce((a, r) => a + (Number(r[c.id]) || 0), 0)) : (c.id === f.cols[0].id ? '合計' : ''))) ) : null)));
        box.appendChild(h('button', { class: 'btn small no-print', onclick: async () => { rows.push({}); await setV(f, rows); draw(); } }, '＋ 行を足す'));
      };
      draw();
      return box;
    }

    root.appendChild(h('div', { class: 'sub no-print' },
      'この画面の数字は献立と利用者台帳から出しています。'
      + (auto._filled ? '献立が入っているのは ' + auto._filled + ' 日ぶんです。' : 'この月の献立がまだ入っていないので、栄養量の欄は空です。')));
  });

  App.registerNav({ order: 76, group: 'まとめ', label: '報告書', icon: '🏛️', hash: '#/houkoku',
    match: ['houkoku'], feature: 'reports' });
  window.Houkoku = H;
})();
