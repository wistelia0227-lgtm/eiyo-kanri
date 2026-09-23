// 個人別の必要栄養量（削除可能）。利用者ごとに「どの式で出したか」を残す。
// 様式4-1-1 の「必要栄養量」は数字だけを書く欄だが、後から見返した時に根拠が分からないと直せない。
// ここで出し方（基礎代謝基準値／体重×係数／Harris-Benedict／手入力）と、使った体重を残しておき、
// 栄養ケアの記録に「必要栄養量を入れる」ボタンで写す。
(function () {
  'use strict';
  const U = window.U, h = U.h, DB = window.DB, M = window.Model, N = window.Nutri, V = window.View, App = window.App;
  const ms = () => window.Master.current;
  const Needs = {};

  // 本人の身体の値（年齢・性別・身長・直近の体重）
  Needs.bodyOf = async function (resident, date) {
    const d = date || U.today();
    const ws = (await DB.byIndex('measures', 'residentId', resident.id))
      .filter((x) => x.kind === 'weight' && x.date <= d).sort((a, b) => a.date.localeCompare(b.date));
    const last = ws[ws.length - 1] || null;
    return { age: M.age(resident.birth, d), sex: resident.gender === 'm' ? 'm' : 'f',
      heightCm: resident.heightCm || null, weightKg: last ? last.value : null, weightAt: last ? last.date : null };
  };
  Needs.of = async function (resident, date) {
    const body = await Needs.bodyOf(resident, date);
    return Object.assign({ body: body }, N.personalNeed(resident.energyRule, body));
  };

  // ---- 出し方を決める画面 ----
  Needs.edit = async function (resident) {
    const body = await Needs.bodyOf(resident);
    const r = Object.assign(N.emptyRule(), resident.energyRule || {});
    const out = h('div', { class: 'card' });
    const method = U.select(N.NEED_METHODS, r.method, { noEmpty: true });
    const wbase = U.select(N.WEIGHT_BASE, r.weightBase, { noEmpty: true });
    const pal = U.select(N.DRI.palLabels.map((l, i) => ({ id: String(i), label: l })), String(r.palIndex), { noEmpty: true });
    const perKg = h('input', { class: 'input num', type: 'number', step: '0.5', value: r.kcalPerKg });
    const act = h('input', { class: 'input num', type: 'number', step: '0.05', value: r.activity });
    const str = h('input', { class: 'input num', type: 'number', step: '0.05', value: r.stress });
    const manual = h('input', { class: 'input num', type: 'number', step: '10', value: r.kcal == null ? '' : r.kcal });
    const protKg = h('input', { class: 'input num', type: 'number', step: '0.1', value: r.protPerKg });
    const protManual = h('input', { class: 'input num', type: 'number', step: '1', value: r.prot == null ? '' : r.prot });
    const rows = {
      bmr: U.field('身体活動レベル', pal, '施設で自立に近い方は「低い」、自立している方は「ふつう」'),
      kg: U.field('体重 1kg あたり (kcal)', perKg, '25〜30 がよく使われます'),
      hbA: U.field('活動係数', act, '寝たきり 1.2 / ベッド上安静 1.2 / ベッド外活動 1.3 / 歩行 1.4'),
      hbS: U.field('ストレス係数', str, '平常 1.0 / 褥瘡 1.2〜1.6 / 感染 1.2〜1.5 / 骨折 1.2〜1.3'),
      manual: U.field('必要エネルギー (kcal)', manual, '医師の指示など')
    };
    const box = h('div', { class: 'grid2' });

    function current() {
      return { method: method.value, weightBase: wbase.value, palIndex: parseInt(pal.value, 10) || 0,
        kcalPerKg: parseFloat(perKg.value) || 30, activity: parseFloat(act.value) || 1.3, stress: parseFloat(str.value) || 1.0,
        kcal: manual.value === '' ? null : parseFloat(manual.value),
        protPerKg: parseFloat(protKg.value) || 1.0, prot: protManual.value === '' ? null : parseFloat(protManual.value) };
    }
    function draw() {
      box.innerHTML = '';
      const md = method.value;
      box.appendChild(U.field('出し方', method));
      if (md !== 'manual') box.appendChild(U.field('計算に使う体重', wbase));
      if (md === 'bmr') box.appendChild(rows.bmr);
      if (md === 'kg') box.appendChild(rows.kg);
      if (md === 'hb') { box.appendChild(rows.hbA); box.appendChild(rows.hbS); }
      if (md === 'manual') box.appendChild(rows.manual);
      box.appendChild(U.field('たんぱく質 体重 1kg あたり (g)', protKg, '高齢者は 1.0〜1.2 が目安'));
      box.appendChild(U.field('たんぱく質を手で入れる (g)', protManual, '入れるとこちらが優先されます'));
      const got = N.personalNeed(current(), body);
      out.innerHTML = '';
      const note = N.NEED_METHODS.find((x) => x.id === md);
      out.appendChild(h('div', { class: 'sub' }, note ? note.note : ''));
      out.appendChild(h('div', null, h('b', null, '必要エネルギー '), got.kcal == null ? '—' : got.kcal + ' kcal　',
        h('b', null, '必要たんぱく質 '), got.prot == null ? '—' : got.prot + ' g'));
      out.appendChild(h('div', { class: 'sub' }, got.how));
      const miss = [];
      if (body.weightKg == null) miss.push('体重');
      if (body.age == null) miss.push('生年月日');
      if (md === 'hb' && !body.heightCm) miss.push('身長');
      if ((wbase.value === 'ideal' || wbase.value === 'adjust') && !body.heightCm) miss.push('身長（標準体重に要ります）');
      if (miss.length) out.appendChild(h('div', { class: 'warn-text' }, miss.join('・') + ' が入っていません。'));
    }
    [method, wbase, pal, perKg, act, str, manual, protKg, protManual].forEach((el) => el.addEventListener('change', draw));
    draw();

    let close;
    close = U.modal(h('div', null, h('h2', null, V.sama(resident.name) + '　必要栄養量'),
      h('div', { class: 'sub' }, '今の身体の値: ' + (body.age == null ? '年齢—' : body.age + '歳') + '　' + (body.sex === 'm' ? '男' : '女') +
        '　身長 ' + (body.heightCm || '—') + 'cm　体重 ' + (body.weightKg == null ? '—' : body.weightKg + 'kg' + (body.weightAt ? '（' + U.fmtDate(body.weightAt, true) + '）' : ''))),
      box, out,
      h('div', { class: 'modal-btns' }, h('button', { class: 'btn', onclick: () => close() }, 'やめる'),
        h('button', { class: 'btn primary', onclick: async () => {
          const rec = await DB.get('residents', resident.id);
          rec.energyRule = Object.assign(current(), { setAt: U.today(), by: V.recorder() });
          await DB.put('residents', rec);
          close(); U.toast('保存しました'); App.refresh();
        } }, '保存'))), { wide: true });
  };

  // ---- 個人画面の欄 ----
  window.Residents.registerSection({ order: 11, render: async function (r) {
    const got = await Needs.of(r);
    const set = !!r.energyRule;
    const body = h('div');
    if (!set) body.appendChild(h('div', { class: 'sub' }, 'まだ出し方を決めていません。既定（基礎代謝基準値 × 体重 × 身体活動レベル ふつう）で出すと下の値になります。'));
    body.appendChild(h('table', { class: 'list' }, h('tbody', null,
      h('tr', null, h('th', null, '必要エネルギー'), h('td', null, got.kcal == null ? h('span', { class: 'warn-text' }, '出せません（体重か生年月日が要ります）') : got.kcal + ' kcal')),
      h('tr', null, h('th', null, '必要たんぱく質'), h('td', null, got.prot == null ? '—' : got.prot + ' g')),
      h('tr', null, h('th', null, '出し方'), h('td', { class: 'sub' }, got.how)),
      r.energyRule && r.energyRule.setAt ? h('tr', null, h('th', null, '決めた日'),
        h('td', { class: 'sub' }, U.fmtDate(r.energyRule.setAt, true) + (r.energyRule.by ? '　' + r.energyRule.by : ''))) : null)));
    // 提供栄養量（今の食種の献立）と見比べる
    const cmp = await Needs.compare(r, got);
    if (cmp) body.appendChild(cmp);
    return h('section', { class: 'card' }, h('h2', null, '必要栄養量'), body,
      h('div', { class: 'toolrow no-print' }, h('button', { class: 'btn', onclick: () => Needs.edit(r) }, set ? '出し方を直す' : '出し方を決める')));
  } });

  // その人の食種の献立から、直近で献立が入っている日の提供栄養量を出して見比べる
  Needs.compare = async function (r, got) {
    if (!window.Menu || !window.Dishes || got.kcal == null) return null;
    const m = ms(), meals = M.activeMeals(m), today = U.today();
    const d = M.dietAt(r, { d: today, m: meals[meals.length - 1].id }, m.meals);
    const sId = d && d.shokushu;
    if (!sId) return null;
    const dishMap = {};
    (await window.Dishes.all()).forEach((x) => { dishMap[x.id] = x; });
    // 今日から 14 日さかのぼって、献立が入っている最初の日
    let found = null;
    for (let i = 0; i < 14; i++) {
      const day = M.addDays(today, -i);
      const rec = await window.Menu.get(day);
      if (meals.some((ml) => window.Menu.cellDishes(rec, ml.id, sId).length)) { found = { day: day, rec: rec }; break; }
    }
    if (!found) return null;
    const s = window.Menu.sumDay(found.rec, meals, sId, dishMap);
    const ratio = (v, need) => (need ? Math.round(v / need * 100) : null);
    const rk = ratio(s.values.kcal, got.kcal), rp = got.prot ? ratio(s.values.prot, got.prot) : null;
    const cls = (x) => x == null ? '' : (x < 90 ? 'j-low' : (x > 110 ? 'j-high' : ''));
    return h('div', { class: 'card' }, h('b', null, M.label(m.shokushu, sId) + ' の提供栄養量と見比べる'),
      h('div', { class: 'sub' }, U.fmtDate(found.day, true) + ' の献立（1 日分）'),
      h('table', { class: 'list' }, h('tbody', null,
        h('tr', null, h('th', null, 'エネルギー'), h('td', null, N.fmt('kcal', s.values.kcal) + ' kcal / ' + got.kcal + ' kcal'),
          h('td', { class: cls(rk) }, rk == null ? '' : rk + ' %')),
        h('tr', null, h('th', null, 'たんぱく質'), h('td', null, N.fmt('prot', s.values.prot) + ' g' + (got.prot ? ' / ' + got.prot + ' g' : '')),
          h('td', { class: cls(rp) }, rp == null ? '' : rp + ' %')))),
      h('div', { class: 'sub' }, '主食の量や半量の指示は、この比較には入っていません（献立そのものの値です）。'));
  };

  window.Needs = Needs;
})();
