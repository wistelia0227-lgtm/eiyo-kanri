// 利用者台帳: 一覧・個人画面・食事変更（版を足す）・入退所・欠食。
// 個人画面に他のモジュールが欄を足す時は Residents.registerSection(fn) を使う。
(function () {
  'use strict';
  const U = window.U, h = U.h, DB = window.DB, M = window.Model, V = window.View, App = window.App;
  const ms = () => window.Master.current;
  const R = { sections: [] };
  R.registerSection = (sec) => { R.sections.push(sec); R.sections.sort((a, b) => a.order - b.order); };
  let filter = 'in', query = '';

  // ---------- 一覧 ----------
  App.registerScreen('residents', async function (params, root) {
    const today = U.today(), meals = ms().meals, slot = V.nextSlot();
    const all = (await DB.residents()).filter((r) => !r.archived);
    const count = { in: 0, planned: 0, rest: 0 };
    all.forEach((r) => { r._st = M.status(r, today, meals); count[r._st]++; });

    root.appendChild(h('header', { class: 'topbar' }, h('h1', null, '利用者'),
      h('button', { class: 'btn primary', onclick: () => R.editBasic(null) }, '＋ 利用者を登録')));
    const search = h('input', { class: 'input', type: 'search', placeholder: '氏名・ふりがな・部屋でさがす', value: query,
      oninput: () => { query = search.value; draw(); } });
    root.appendChild(h('div', { class: 'toolrow no-print' },
      [['in', '在籍中'], ['planned', '予定あり'], ['rest', '休止中'], ['all', '全員']].map((f) => h('button', {
        class: 'btn seg' + (filter === f[0] ? ' on' : ''), onclick: () => { filter = f[0]; App.refresh(); }
      }, f[1] + ' ' + (f[0] === 'all' ? all.length : count[f[0]]))), search));
    const listBox = h('div');
    root.appendChild(listBox);

    function draw() {
      listBox.innerHTML = '';
      const q = query.trim();
      const rows = all.filter((r) => (filter === 'all' || r._st === filter) && (!q || (r.name + r.kana + r.room + r.unit).indexOf(q) >= 0))
        .sort((a, b) => (a.unit + a.room).localeCompare(b.unit + b.room, 'ja') || (a.kana || a.name).localeCompare(b.kana || b.name, 'ja'));
      if (!rows.length) { listBox.appendChild(h('div', { class: 'empty' }, all.length ? 'この条件に当てはまる利用者はいません。' : 'まだ利用者が登録されていません。右上のボタンから登録します。')); return; }
      listBox.appendChild(h('table', { class: 'list' },
        h('thead', null, h('tr', null, ['場所', '氏名', '区分', '状態', '食事（' + V.slotText(slot) + '）', '注意'].map((t) => h('th', null, t)))),
        h('tbody', null, rows.map((r) => {
          const d = M.dietAt(r, slot, meals);
          const go = () => App.go('#/resident/' + r.id);
          return h('tr', { class: 'click', onclick: go },
            h('td', null, V.where(r)), h('td', null, h('a', { href: '#/resident/' + r.id, class: 'name' }, r.name), h('div', { class: 'sub' }, r.kana)),
            h('td', null, V.catLabel(r)), h('td', null, V.statusBadge(r._st)),
            h('td', { class: d ? '' : 'warn-text' }, V.dietShort(d)),
            h('td', null, d && d.allergy.length ? h('span', { class: 'tag bad' }, 'アレルギー ' + d.allergy.join('・')) : null,
              d && d.kinshi.length ? h('span', { class: 'tag warn' }, '禁食 ' + d.kinshi.map((k) => k.food).join('・')) : null));
        }))));
    }
    draw();
  });

  // ---------- 基本情報 ----------
  R.editBasic = function (r) {
    const isNew = !r;
    const m = ms();
    const f = {
      name: h('input', { class: 'input', type: 'text', value: r ? r.name : '', placeholder: '例: 山田 ハナ' }),
      kana: h('input', { class: 'input', type: 'text', value: r ? r.kana : '', placeholder: 'やまだ はな' }),
      category: U.select(m.categories, r ? r.category : 'long', { noEmpty: true }),
      unit: h('input', { class: 'input', type: 'text', value: r ? r.unit : '', list: 'dl-units', placeholder: 'ユニット・フロア' }),
      room: h('input', { class: 'input', type: 'text', value: r ? r.room : '', placeholder: '部屋・席' }),
      gender: U.select([{ id: 'f', label: '女' }, { id: 'm', label: '男' }], r ? r.gender : ''),
      birth: h('input', { class: 'input', type: 'date', value: r ? r.birth : '' }),
      height: h('input', { class: 'input', type: 'number', step: '0.1', value: r && r.heightCm || '', placeholder: 'cm' }),
      memo: h('textarea', { class: 'input', rows: '2' }, r ? r.memo : '')
    };
    const wd = (r ? r.weekdays : []).slice(), mt = (r ? r.mealsTaken : []).slice();
    const toggles = (list, cur) => h('div', { class: 'toggles' }, list.map((x) => {
      const b = h('button', { type: 'button', class: 'btn seg' + (cur.indexOf(x.id) >= 0 ? ' on' : ''), onclick: () => {
        const i = cur.indexOf(x.id); if (i >= 0) cur.splice(i, 1); else cur.push(x.id); b.classList.toggle('on');
      } }, x.label); return b;
    }));
    let close;
    const save = async () => {
      const name = f.name.value.trim();
      if (!name) { U.toast('氏名を入れてください', true); return; }
      const rec = r || M.newResident(name, U.uid);
      Object.assign(rec, { name: name, kana: f.kana.value.trim(), category: f.category.value, unit: f.unit.value.trim(), room: f.room.value.trim(),
        gender: f.gender.value, birth: f.birth.value, heightCm: parseFloat(f.height.value) || null, memo: f.memo.value.trim(), weekdays: wd.sort(), mealsTaken: mt });
      await DB.put('residents', rec);
      if (rec.unit && m.units.indexOf(rec.unit) < 0) { m.units.push(rec.unit); await window.Master.save(); }
      close();
      if (isNew) { U.toast('登録しました。続けて入所日と食事情報を入れます'); App.go('#/resident/' + rec.id); R.editStay(rec, null); } else App.refresh();
    };
    close = U.modal(h('div', null, h('h2', null, isNew ? '利用者を登録' : '基本情報を直す'),
      h('div', { class: 'grid2' }, U.field('氏名', f.name), U.field('ふりがな', f.kana), U.field('区分', f.category), U.field('性別', f.gender),
        U.field('ユニット・フロア', f.unit), U.field('部屋・席', f.room), U.field('生年月日', f.birth), U.field('身長 (cm)', f.height, 'BMI の計算に使います')),
      h('datalist', { id: 'dl-units' }, m.units.map((u) => h('option', { value: u }))),
      h('details', { open: !!(wd.length || mt.length) || null }, h('summary', null, '決まった曜日・食事だけ利用する（デイなど）'),
        U.field('利用する曜日（選ばなければ毎日）', toggles(U.WD.map((w, i) => ({ id: i, label: w })), wd)),
        U.field('食べる食事（選ばなければ全部）', toggles(M.activeMeals(m), mt))),
      U.field('メモ', f.memo),
      h('div', { class: 'modal-btns' }, h('button', { class: 'btn', onclick: () => close() }, 'やめる'), h('button', { class: 'btn primary', onclick: save }, '保存'))), { wide: true });
  };

  // ---------- 入退所 ----------
  R.editStay = function (r, stay) {
    const m = ms(), meals = M.activeMeals(m), isShort = r.category !== 'long';
    const from = U.slotInput(meals, stay ? stay.from : { d: U.today() }, { suffix: 'から', defaultMeal: 'l' });
    const to = U.slotInput(meals, stay ? stay.to : null, { suffix: 'まで', defaultMeal: 'b' });
    const note = h('input', { class: 'input', type: 'text', value: stay ? stay.note || '' : '' });
    let close;
    const save = async () => {
      const a = from.get(), b = to.get();
      if (!a) { U.toast('入所日を入れてください', true); return; }
      if (b && M.slotKey(m.meals, b) < M.slotKey(m.meals, a)) { U.toast('退所が入所より前になっています', true); return; }
      const clash = r.stays.find((s) => s !== stay && !s.cancelledAt && M.inRange(m.meals, s, a));
      if (clash) { U.toast('その日は別の在籍期間（' + V.slotText(clash.from) + '〜）と重なっています', true); return; }
      if (stay) {
        stay.changes = stay.changes || [];
        const chg = (label, o, n) => { if (JSON.stringify(o || null) !== JSON.stringify(n || null)) stay.changes.push({ at: Date.now(), by: V.recorder(), label: label, old: o || null, new: n || null }); };
        chg('入所日', stay.from, a); chg('退所日', stay.to, b);
        stay.from = a; stay.to = b; stay.note = note.value.trim();
      } else r.stays.push({ id: U.uid('s'), from: a, to: b, note: note.value.trim(), recordedAt: Date.now(), by: V.recorder() });
      await DB.put('residents', r);
      close();
      if (!r.diet.some((v) => !v.cancelledAt)) { App.refresh(); R.editDiet(r, a); } else App.refresh();
    };
    const last = r.diet.filter((v) => !v.cancelledAt).length;
    close = U.modal(h('div', null, h('h2', null, r.name + ' 様　' + (stay ? '在籍期間を直す' : '入所を登録')),
      (!stay && last && isShort) ? h('div', { class: 'card info' }, '前回までの食事情報がそのまま使われます。変わった所だけ、登録後に「食事を変更する」で直してください。') : null,
      U.field('入所', from), U.field('退所（決まっていなければ空のまま）', to), U.field('メモ', note),
      h('div', { class: 'modal-btns' }, h('button', { class: 'btn', onclick: () => close() }, 'やめる'), h('button', { class: 'btn primary', onclick: save }, '保存'))));
  };

  // ---------- 欠食（外出・外泊・入院など） ----------
  R.editAbsence = function (r, ab) {
    const m = ms(), meals = M.activeMeals(m);
    const from = U.slotInput(meals, ab ? ab.from : V.nextSlot(), { suffix: 'から' });
    const to = U.slotInput(meals, ab ? ab.to : null, { suffix: 'まで', defaultMeal: meals[meals.length - 1].id });
    const reason = h('input', { class: 'input', type: 'text', list: 'dl-abs', value: ab ? ab.reason || '' : '', placeholder: '外出・外泊・入院など' });
    let close;
    const save = async () => {
      const a = from.get(), b = to.get();
      if (!a) { U.toast('いつから欠食かを入れてください', true); return; }
      if (b && M.slotKey(m.meals, b) < M.slotKey(m.meals, a)) { U.toast('終わりが始まりより前になっています', true); return; }
      if (ab) {
        ab.changes = ab.changes || [];
        const chg = (label, o, n) => { if (JSON.stringify(o || null) !== JSON.stringify(n || null)) ab.changes.push({ at: Date.now(), by: V.recorder(), label: label, old: o || null, new: n || null }); };
        chg('開始', ab.from, a); chg('終了', ab.to, b);
        ab.from = a; ab.to = b; ab.reason = reason.value.trim();
      } else r.absences.push({ id: U.uid('a'), from: a, to: b, reason: reason.value.trim(), recordedAt: Date.now(), by: V.recorder() });
      await DB.put('residents', r); close(); App.refresh();
    };
    close = U.modal(h('div', null, h('h2', null, r.name + ' 様　欠食を' + (ab ? '直す' : '登録')),
      U.field('理由', reason), h('datalist', { id: 'dl-abs' }, m.absenceReasons.map((x) => h('option', { value: x }))),
      U.field('欠食の始まり', from), U.field('欠食の終わり（戻る日が未定なら空のまま）', to, '例: 昼だけ外出なら、始まりも終わりも同じ日の「昼」'),
      h('div', { class: 'modal-btns' }, h('button', { class: 'btn', onclick: () => close() }, 'やめる'), h('button', { class: 'btn primary', onclick: save }, '保存'))));
  };

  async function cancelRec(r, rec, what) {
    if (!await U.confirm(what + 'を取り消します。記録は履歴に残ります。', { okLabel: '取り消す', danger: true })) return;
    rec.cancelledAt = Date.now(); rec.cancelledBy = V.recorder();
    await DB.put('residents', r); App.refresh();
  }

  // ---------- 食事を変更する（版を足す） ----------
  R.editDiet = function (r, fromSlot) {
    const m = ms(), meals = M.activeMeals(m);
    const slot0 = fromSlot || V.nextSlot();
    const base = M.versionAt(r, { d: '9999-12-31', m: meals[0].id }, m.meals);
    const d = M.normalizeDiet(base ? JSON.parse(JSON.stringify(base.data)) : null);
    const first = !base;

    const from = U.slotInput(meals, slot0, { suffix: 'から' });
    const source = h('input', { class: 'input', type: 'text', list: 'dl-src', value: first ? '' : '', placeholder: '誰の指示・依頼か' });
    const reason = h('input', { class: 'input', type: 'text', placeholder: '例: むせ込みが増えたため' });
    const doctor = U.select([{ id: 'na', label: '医師の確認は不要' }, { id: 'wait', label: '医師の確認待ち' }, { id: 'ok', label: '医師が確認済み' }], 'na', { noEmpty: true });
    const risk = h('input', { type: 'checkbox' });
    const riskRow = h('label', { class: 'check warn-text', hidden: true }, risk, ' 食形態を上げる場合: 誤嚥・窒息のリスクを説明し、医師・看護師に確認した');
    const by = h('input', { class: 'input', type: 'text', value: V.recorder(), placeholder: '記録した人' });
    source.addEventListener('input', () => { riskRow.hidden = !/家族|本人/.test(source.value); });

    const sel = (key, list) => U.select(list, d[key]);
    const f = {
      shokushu: sel('shokushu', m.shokushu), staple: sel('staple', m.staple), side: sel('side', m.side),
      stapleG: h('input', { class: 'input', type: 'number', value: d.stapleG || '', placeholder: 'g' }),
      soupThick: U.select(m.thick, d.soupThick, { emptyLabel: 'とろみなし' }), drinkThick: U.select(m.thick, d.drinkThick, { emptyLabel: 'とろみなし' }),
      portion: U.select(m.portion, d.portion, { emptyLabel: '普通' }), assist: sel('assist', m.assist),
      place: h('input', { class: 'input', type: 'text', value: d.place }), notes: h('textarea', { class: 'input', rows: '2', placeholder: '例: 冷まして提供／冬は主食 300g' }, d.notes),
      allergy: U.chipList(d.allergy, m.allergens, 'アレルギーの食品'), tools: U.chipList(d.tools, m.tools, '食器・自助具')
    };
    // 行を足せる表（禁食・補食・条件つき指示）
    function rowsEditor(items, cols, addLabel) {
      const box = h('div', { class: 'rows-editor' }), rows = [];
      const addRow = (it) => {
        const inputs = cols.map((c) => c.make(it ? it[c.key] : ''));
        const row = h('div', { class: 'rowline' }, inputs, h('button', { type: 'button', class: 'btn small', onclick: () => { rows.splice(rows.indexOf(rec), 1); row.remove(); } }, '外す'));
        const rec = { inputs: inputs }; rows.push(rec); box.appendChild(row);
      };
      items.forEach(addRow);
      const el = h('div', null, box, h('button', { type: 'button', class: 'btn small', onclick: () => addRow(null) }, '＋ ' + addLabel));
      el.get = () => rows.map((x) => { const o = {}; cols.forEach((c, i) => { o[c.key] = x.inputs[i].value.trim(); }); return o; }).filter((o) => o[cols[0].key] && (cols.length < 2 || cols[0].key !== 'when' || o.text));
      return el;
    }
    const txt = (ph) => (v) => h('input', { class: 'input', type: 'text', value: v || '', placeholder: ph });
    const kinshi = rowsEditor(d.kinshi, [{ key: 'food', make: txt('食べられない物（例: 鶏肉）') }, { key: 'sub', make: txt('代わりに出す物（例: 魚）') }], '禁食を足す');
    const supp = rowsEditor(d.supplements, [{ key: 'name', make: txt('品名（例: 高カロリーゼリー）') }, { key: 'when', make: txt('いつ（例: 15時）') }], '補食を足す');
    const cond = rowsEditor(d.cond, [{ key: 'when', make: (v) => U.select(m.cond, v, { noEmpty: true }) }, { key: 'text', make: txt('その日だけの対応（例: 10cm にカット）') }], '条件つきの指示を足す');
    // 食事ごとの違い
    const bm = {};
    const byMealBox = h('details', { open: Object.keys(d.byMeal).length > 0 || null }, h('summary', null, '朝だけパン など、食事ごとに変える（空欄は上と同じ）'),
      meals.map((ml) => {
        const o = d.byMeal[ml.id] || {};
        bm[ml.id] = { staple: U.select(m.staple, o.staple, { emptyLabel: '同じ' }), stapleG: h('input', { class: 'input', type: 'number', value: o.stapleG || '', placeholder: 'g' }),
          side: U.select(m.side, o.side, { emptyLabel: '同じ' }), soupThick: U.select(m.thick, o.soupThick, { emptyLabel: '同じ' }) };
        return h('div', { class: 'rowline' }, h('b', { class: 'rowhead' }, ml.label), bm[ml.id].staple, bm[ml.id].stapleG, bm[ml.id].side, bm[ml.id].soupThick);
      }));

    let close;
    const save = async () => {
      const a = from.get();
      if (!a) { U.toast('いつから変えるかを入れてください', true); return; }
      const data = M.emptyDiet();
      ['shokushu', 'staple', 'side', 'soupThick', 'drinkThick', 'portion', 'assist'].forEach((k) => { data[k] = f[k].value; });
      data.stapleG = parseFloat(f.stapleG.value) || null; data.place = f.place.value.trim(); data.notes = f.notes.value.trim();
      data.allergy = f.allergy.get(); data.tools = f.tools.get(); data.kinshi = kinshi.get(); data.supplements = supp.get(); data.cond = cond.get();
      Object.keys(bm).forEach((k) => {
        const o = {}; ['staple', 'side', 'soupThick'].forEach((x) => { if (bm[k][x].value) o[x] = bm[k][x].value; });
        const g = parseFloat(bm[k].stapleG.value); if (g) o.stapleG = g;
        if (Object.keys(o).length) data.byMeal[k] = o;
      });
      if (base && !M.diffDiet(base.data, data, m).length) { U.toast('前と同じ内容です。変わった所を直してから保存してください', true); return; }
      if (!first && !source.value.trim()) { U.toast('誰の指示・依頼かを入れてください', true); return; }
      V.setRecorder(by.value.trim());
      r.diet.push({ id: U.uid('v'), from: a, data: data, source: source.value.trim(), reason: reason.value.trim(), doctor: doctor.value,
        riskExplained: risk.checked, by: by.value.trim(), recordedAt: Date.now() });
      await DB.put('residents', r); close(); U.toast('保存しました'); App.refresh();
    };
    close = U.modal(h('div', null, h('h2', null, r.name + ' 様　' + (first ? '食事情報を登録' : '食事を変更する')),
      h('div', { class: 'card' }, h('div', { class: 'grid3' }, U.field('いつから', from), U.field('誰の指示・依頼か' + (first ? '（任意）' : ''), source), U.field('医師の確認', doctor)),
        h('datalist', { id: 'dl-src' }, m.sources.map((x) => h('option', { value: x }))),
        h('div', { class: 'grid2' }, U.field('理由', reason), U.field('記録した人', by)), riskRow),
      h('h3', null, 'アレルギー・禁食'),
      U.field('アレルギー', f.allergy), U.field('禁食と代わりの物', kinshi),
      h('h3', null, '食事の内容'),
      h('div', { class: 'grid3' }, U.field('食種', f.shokushu), U.field('主食', f.staple), U.field('主食の量 (g)', f.stapleG),
        U.field('副食', f.side), U.field('汁のとろみ', f.soupThick), U.field('飲み物のとろみ', f.drinkThick),
        U.field('量', f.portion), U.field('介助', f.assist), U.field('配膳場所', f.place)),
      byMealBox,
      U.field('補食・栄養補助食品', supp), U.field('条件つきの指示', cond), U.field('食器・自助具', f.tools), U.field('注意（食札にそのまま出ます）', f.notes),
      h('div', { class: 'modal-btns' }, h('button', { class: 'btn', onclick: () => close() }, 'やめる'), h('button', { class: 'btn primary', onclick: save }, '保存'))), { wide: true });
  };

  // ---------- 個人画面 ----------
  App.registerScreen('resident', async function (params, root) {
    const r = await DB.get('residents', params[0]);
    if (!r) { root.appendChild(h('div', { class: 'empty' }, 'この利用者は見つかりません。')); return; }
    M.normalizeResident(r);
    const m = ms(), today = U.today(), slot = V.nextSlot();
    const d = M.dietAt(r, slot, m.meals);
    const age = M.age(r.birth, today);
    root.appendChild(h('header', { class: 'topbar' },
      h('div', null, h('a', { href: '#/residents', class: 'back no-print' }, '← 利用者の一覧'),
        h('h1', null, r.name + ' 様 ', V.statusBadge(M.status(r, today, m.meals))),
        h('div', { class: 'sub' }, [r.kana, V.catLabel(r), V.where(r), age != null ? age + '歳' : '', r.heightCm ? r.heightCm + 'cm' : ''].filter(Boolean).join('　'))),
      h('button', { class: 'btn no-print', onclick: () => R.editBasic(r) }, '基本情報を直す')));
    if (r.memo) root.appendChild(h('div', { class: 'card' }, r.memo));

    // 食事
    const pending = r.diet.filter((v) => !v.cancelledAt && M.slotKey(m.meals, { d: v.from.d, m: v.from.m || m.meals[0].id }) > M.slotKey(m.meals, slot));
    const waits = r.diet.filter((v) => !v.cancelledAt && v.doctor === 'wait');
    root.appendChild(h('section', { class: 'card' },
      h('div', { class: 'sec-head' }, h('h2', null, '今の食事（' + V.slotText(slot) + '）'), h('button', { class: 'btn primary no-print', onclick: () => R.editDiet(r) }, d ? '食事を変更する' : '食事情報を登録')),
      V.warnBox(d), d ? V.dietTable(d) : h('div', { class: 'empty' }, '食事情報がまだありません。'),
      pending.map((v) => h('div', { class: 'card info' }, h('b', null, V.slotText(v.from, 'から') + ' 変更予定: '), (M.diffDiet((M.prevVersion(r, v, m.meals) || {}).data, v.data, m)).join(' ／ '))),
      waits.map((v) => h('div', { class: 'card warn' }, '医師の確認待ち: ' + V.slotText(v.from, 'から') + ' の変更　',
        h('button', { class: 'btn small no-print', onclick: async () => { v.doctor = 'ok'; v.doctorAt = Date.now(); await DB.put('residents', r); App.refresh(); } }, '確認済みにする')))));

    // 在籍と欠食
    const stays = r.stays.slice().sort((a, b) => b.from.d.localeCompare(a.from.d));
    const abs = r.absences.slice().sort((a, b) => b.from.d.localeCompare(a.from.d));
    const recRow = (rec, text, onEdit, what) => h('tr', { class: rec.cancelledAt ? 'cancelled' : '' }, h('td', null, text),
      h('td', { class: 'sub' }, rec.cancelledAt ? '取り消し ' + U.fmtDateTime(rec.cancelledAt) : '登録 ' + U.fmtDateTime(rec.recordedAt) + ((rec.changes || []).length ? '・変更 ' + rec.changes.length + '回' : '')),
      h('td', { class: 'no-print' }, rec.cancelledAt ? null : [h('button', { class: 'btn small', onclick: onEdit }, '直す'), ' ', h('button', { class: 'btn small', onclick: () => cancelRec(r, rec, what) }, '取り消す')]));
    root.appendChild(h('section', { class: 'card' },
      h('div', { class: 'sec-head' }, h('h2', null, '在籍'), h('div', { class: 'no-print' },
        h('button', { class: 'btn', onclick: () => R.editStay(r, null) }, '＋ 入所を登録'), ' ', h('button', { class: 'btn', onclick: () => R.editAbsence(r, null) }, '＋ 欠食（外出・外泊・入院）'))),
      stays.length ? h('table', { class: 'list' }, h('tbody', null, stays.map((s) => recRow(s, V.slotText(s.from, 'から') + ' 〜 ' + V.slotText(s.to, 'まで') + (s.note ? '　' + s.note : ''), () => R.editStay(r, s), '在籍期間')))) : h('div', { class: 'empty' }, '在籍期間がまだありません。'),
      abs.length ? [h('h3', null, '欠食'), h('table', { class: 'list' }, h('tbody', null, abs.map((a) => recRow(a, (a.reason || '欠食') + '　' + V.slotText(a.from, 'から') + ' 〜 ' + V.slotText(a.to, 'まで'), () => R.editAbsence(r, a), '欠食'))))] : null));

    // 他のモジュールが足す欄（体重・ミールラウンドなど）
    for (const sec of R.sections) { const el = await sec.render(r); if (el) root.appendChild(el); }

    // 食事の変更履歴
    const vers = r.diet.slice().sort((a, b) => M.slotKey(m.meals, { d: b.from.d, m: b.from.m || '' }) - M.slotKey(m.meals, { d: a.from.d, m: a.from.m || '' }) || (b.recordedAt || 0) - (a.recordedAt || 0));
    root.appendChild(h('section', { class: 'card' }, h('h2', null, '食事の変更履歴'),
      vers.length ? h('table', { class: 'list' }, h('thead', null, h('tr', null, ['いつから', '変わった所', '指示・理由', '記録'].map((t) => h('th', null, t)), h('th', { class: 'no-print' }))),
        h('tbody', null, vers.map((v) => {
          const prev = M.prevVersion(r, v, m.meals);
          const lines = prev ? M.diffDiet(prev.data, v.data, m) : ['最初の登録: ' + V.dietShort(M.normalizeDiet(v.data))];
          return h('tr', { class: v.cancelledAt ? 'cancelled' : '' }, h('td', null, V.slotText(v.from, 'から')), h('td', null, lines.map((l) => h('div', null, l))),
            h('td', null, [v.source, v.reason].filter(Boolean).join('／'), v.doctor === 'wait' ? h('div', { class: 'tag warn' }, '医師の確認待ち') : v.doctor === 'ok' ? h('div', { class: 'tag ok' }, '医師確認済み') : null,
              v.riskExplained ? h('div', { class: 'tag' }, 'リスク説明済み') : null),
            h('td', { class: 'sub' }, (v.by ? v.by + '　' : '') + U.fmtDateTime(v.recordedAt), v.cancelledAt ? h('div', null, '取り消し ' + U.fmtDateTime(v.cancelledAt)) : null),
            h('td', { class: 'no-print' }, v.cancelledAt ? null : h('button', { class: 'btn small', onclick: () => cancelRec(r, v, 'この変更') }, '取り消す')));
        }))) : h('div', { class: 'empty' }, 'まだありません。')));

    root.appendChild(h('div', { class: 'toolrow no-print' }, h('button', { class: 'btn danger-outline', onclick: async () => {
      if (!await U.confirm(r.name + ' 様を一覧から外します。記録は消えず、設定の「外した利用者」から戻せます。', { okLabel: '一覧から外す', danger: true })) return;
      r.archived = true; await DB.put('residents', r); App.go('#/residents');
    } }, 'この利用者を一覧から外す')));
  });

  App.registerNav({ order: 20, label: '利用者', icon: '👤', hash: '#/residents', match: ['residents', 'resident'] });
  window.Residents = R;
})();
