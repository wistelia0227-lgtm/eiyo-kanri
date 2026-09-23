// 様式の印刷（削除可能）: 様式4-1-1（スクリーニング・アセスメント・モニタリング）と
// 様式4-2（栄養情報提供書 = 退所時栄養情報連携加算）。紙の様式に近い形で出す。
(function () {
  'use strict';
  const U = window.U, h = U.h, DB = window.DB, M = window.Model, N = window.NCM, V = window.View, App = window.App;
  const ms = () => window.Master.current;
  const F = {};
  const label = (list, id) => (list.find((x) => x.id === id) || { label: '' }).label;
  // ☑ / ☐ の選択肢を並べる
  const pick = (opts, val) => opts.map((o) => (o.id === val ? '☑ ' : '☐ ') + o.label).join('　');
  const yn = (v) => (v ? '☑ 有' : '☐ 有') + '　' + (v ? '☐ 無' : '☑ 無');

  // ---------- 様式4-1-1 ----------
  App.registerScreen('form411', async function (params, root) {
    if (!params[0]) { root.appendChild(h('div', { class: 'empty' }, V.t('person') + 'の画面から開いてください。')); return; }
    const r = await DB.get('residents', params[0]);
    if (!r) { root.appendChild(h('div', { class: 'empty' }, 'この方は見つかりません。')); return; }
    M.normalizeResident(r);
    const m = ms();
    const all = await window.Ncm.ofResident(r.id);  // 新しい順
    if (!all.length) { root.appendChild(h('div', { class: 'empty' }, '記録がありません。')); return; }
    const page = Math.max(0, parseInt(params[1] || '0', 10) || 0);
    const cols = all.slice(page * 4, page * 4 + 4).reverse(); // 様式は 1 枚に 4 回分を左から古い順
    const pages = Math.ceil(all.length / 4);

    root.appendChild(h('header', { class: 'topbar no-print' },
      h('div', null, h('a', { href: '#/resident/' + r.id, class: 'back' }, '← ' + V.sama(r.name)),
        h('h1', null, '栄養・摂食嚥下スクリーニング／アセスメント／モニタリング')),
      h('button', { class: 'btn', onclick: () => window.print() }, '印刷')));
    if (pages > 1) root.appendChild(h('div', { class: 'toolrow no-print' }, h('span', { class: 'sub' }, '用紙'),
      Array.from({ length: pages }, (x, i) => h('a', { class: 'btn seg' + (i === page ? ' on' : ''), href: '#/form411/' + r.id + '/' + i },
        (i + 1) + '枚目'))));

    const age = M.age(r.birth, U.today());
    const row = (head, fn, cls) => h('tr', { class: cls || '' }, h('th', null, head), cols.map((c) => h('td', null, fn(c))));
    const sub = (head) => h('tr', { class: 'sect' }, h('th', { colspan: String(cols.length + 1) }, head));

    root.appendChild(h('div', { class: 'form4' },
      h('h2', { class: 'form-title' }, '栄養・摂食嚥下スクリーニング／アセスメント／モニタリング（' + V.t('person') + '）'),
      h('table', { class: 'form-head' }, h('tbody', null,
        h('tr', null, h('th', null, 'フリガナ'), h('td', null, r.kana), h('th', null, '性別'), h('td', null, r.gender === 'm' ? '男' : r.gender === 'f' ? '女' : ''),
          h('th', null, '生年月日'), h('td', null, (r.birth ? U.fmtDate(r.birth, true) : '') + (age != null ? '（' + age + '歳）' : ''))),
        h('tr', null, h('th', null, '氏名'), h('td', null, V.sama(r.name)), h('th', null, '要介護度'), h('td', null, window.Life ? label(window.Life.CARE_LEVELS, r.careLevel) : ''),
          h('th', null, '場所'), h('td', null, V.where(r))),
        h('tr', null, h('th', null, '病名・特記事項等'), h('td', { colspan: '5' }, r.memo)))),
      h('div', { class: 'scroll-x' }, h('table', { class: 'form-body form411' },
        h('thead', null, h('tr', null, h('th', null, '項目'), cols.map((c) => h('th', null, U.fmtDate(c.date, true), h('div', { class: 'sub' }, c.by || ''))))),
        h('tbody', null,
          row('プロセス', (c) => label(N.PROCESS, c.process)),
          row('低栄養状態のリスクレベル', (c) => label(N.LEVELS, c.level), 'strong'),
          sub('低栄養状態のリスク（状況）'),
          row('身長 (cm)', (c) => c.body.heightCm || ''),
          row('体重 (kg)', (c) => c.body.weightKg || ''),
          row('BMI', (c) => { const b = M.bmi(c.body.weightKg, c.body.heightCm); return b ? b.toFixed(1) : ''; }),
          row('3%以上の体重減少率 1か月', (c) => c.body.loss1 == null ? '' : (c.body.loss1 >= 3 ? '有 ' + c.body.loss1 + '%' : '無')),
          row('　　　　　　　　　　 3か月', (c) => c.body.loss3 == null ? '' : (c.body.loss3 >= 3 ? '有 ' + c.body.loss3 + '%' : '無')),
          row('　　　　　　　　　　 6か月', (c) => c.body.loss6 == null ? '' : (c.body.loss6 >= 3 ? '有 ' + c.body.loss6 + '%' : '無')),
          row('褥瘡', (c) => c.body.ulcer ? '有' : '無'),
          row('栄養補給法', (c) => label(N.FEEDING, c.body.feeding)),
          row('その他', (c) => c.body.other),
          sub('食生活状況等'),
          row('食事摂取量（割合 %）', (c) => c.intake.pct == null ? '' : c.intake.pct),
          row('主食の摂取量 (%)', (c) => c.intake.staple == null ? '' : c.intake.staple),
          row('主菜・副菜の摂取量 (%)', (c) => c.intake.side == null ? '' : c.intake.side),
          row('その他（補助食品など）', (c) => c.intake.other),
          row('摂取栄養量 kcal / g', (c) => [c.nut.inKcal, c.nut.inProt].filter((x) => x != null).join(' / ')),
          row('提供栄養量 kcal / g', (c) => [c.nut.outKcal, c.nut.outProt].filter((x) => x != null).join(' / ')),
          row('必要栄養量 kcal / g', (c) => [c.nut.needKcal, c.nut.needProt].filter((x) => x != null).join(' / ')),
          row('嚥下調整食の必要性', (c) => c.swallow.need ? '有' : '無'),
          row('食事の形態（コード）', (c) => c.swallow.code),
          row('とろみ', (c) => label(m.thick, c.swallow.thick)),
          row('食事の留意事項', (c) => c.caution.text ? '有: ' + c.caution.text : '無'),
          row('本人の意欲', (c) => c.will.motivation ? c.will.motivation + ' ' + N.FIVE[c.will.motivation - 1] : ''),
          row('食欲・食事の満足感', (c) => c.will.satisfaction ? c.will.satisfaction + ' ' + N.FIVE_SAT[c.will.satisfaction - 1] : ''),
          row('食事に対する意識', (c) => c.will.attitude ? c.will.attitude + ' ' + N.FIVE_SAT[c.will.attitude - 1] : ''),
          sub('多職種による栄養ケアの課題（低栄養関連問題）'),
          N.ISSUES_ORAL.concat(N.ISSUES_OTHER).map((t) => row(t, (c) => (c.issues || []).indexOf(t) >= 0 ? '✓' : '')),
          sub('まとめ'),
          row('特記事項', (c) => c.special),
          row('総合評価', (c) => label(N.EVAL, c.evaluation), 'strong'),
          row('計画変更', (c) => c.planChange ? '有' : '無'),
          row('GLIM基準による評価', (c) => label(N.GLIM, c.glim))))),
      h('div', { class: 'sub' }, '注1）スクリーニングにおいては、把握可能な項目（BMI、体重減少率、血清アルブミン値等）により、低栄養状態のリスクを把握する。' +
        '注2）利用者の状態及び家族等の状況により、確認できない場合は空欄でもかまわない。')));
  });

  // ---------- 様式4-2 栄養情報提供書 ----------
  F.infoSheet = async function (resident, opts) {
    opts = opts || {};
    const m = ms();
    const recs = await window.Ncm.ofResident(resident.id);
    const last = recs[0] || null;
    const ws = (await DB.byIndex('measures', 'residentId', resident.id)).filter((x) => x.kind === 'weight')
      .sort((a, b) => a.date.localeCompare(b.date));
    const cur = ws[ws.length - 1] || null;
    const prev = cur ? M.weightAt(ws.filter((w) => w.date < cur.date), M.addMonths(cur.date, -1), 20) : null;
    const slot = V.nextSlot();
    const diet = M.dietAt(resident, slot, m.meals);
    const to = h('input', { class: 'input', type: 'text', placeholder: '○○病院 ご担当者様' });
    const note = h('textarea', { class: 'input', rows: '3', placeholder: '入所中の経過・栄養食事相談の内容等' });
    let close;
    const show = () => {
      close();
      App.go('#/form42/' + resident.id + '/' + encodeURIComponent(to.value) + '/' + encodeURIComponent(note.value));
    };
    close = U.modal(h('div', null, h('h2', null, V.sama(resident.name) + '　栄養情報提供書'),
      h('div', { class: 'sub' }, '別紙様式4-2。退所時栄養情報連携加算で、退所先の医療機関・施設やケアマネジャーに渡すものです。'),
      U.field('宛先', to), U.field('入所中の経過・栄養食事相談の内容等', U.withPhrases('ncm.special', note)),
      h('div', { class: 'card' }, h('div', { class: 'sub' }, '今のデータから入るもの'),
        h('div', null, '体重 ' + (cur ? cur.value + 'kg（' + U.fmtDate(cur.date) + '）' : 'なし') +
          '　1か月前 ' + (prev ? prev.value + 'kg（' + U.fmtDate(prev.date) + '）' : 'なし')),
        h('div', null, '食事 ' + (diet ? V.dietShort(diet) : '未設定')),
        h('div', null, '直近の記録 ' + (last ? U.fmtDate(last.date, true) : 'なし'))),
      h('div', { class: 'modal-btns' }, h('button', { class: 'btn', onclick: () => close() }, 'やめる'),
        h('button', { class: 'btn primary', onclick: show }, '様式を作る'))), { wide: true });
  };

  App.registerScreen('form42', async function (params, root) {
    if (!params[0]) { root.appendChild(h('div', { class: 'empty' }, V.t('person') + 'の画面から開いてください。')); return; }
    const r = await DB.get('residents', params[0]);
    if (!r) { root.appendChild(h('div', { class: 'empty' }, 'この方は見つかりません。')); return; }
    M.normalizeResident(r);
    const m = ms();
    const to = params[1] ? decodeURIComponent(params[1]) : '';
    const note = params[2] ? decodeURIComponent(params[2]) : '';
    const recs = await window.Ncm.ofResident(r.id);
    const last = recs[0] || null;
    const ws = (await DB.byIndex('measures', 'residentId', r.id)).filter((x) => x.kind === 'weight').sort((a, b) => a.date.localeCompare(b.date));
    const cur = ws[ws.length - 1] || null;
    const prev = cur ? M.weightAt(ws.filter((w) => w.date < cur.date), M.addMonths(cur.date, -1), 20) : null;
    const slot = V.nextSlot();
    const d = M.dietAt(r, slot, m.meals);
    const age = M.age(r.birth, U.today());
    const bmi = (w) => { const b = M.bmi(w && w.value, r.heightCm); return b ? b.toFixed(1) : ''; };

    root.appendChild(h('header', { class: 'topbar no-print' },
      h('div', null, h('a', { href: '#/resident/' + r.id, class: 'back' }, '← ' + V.sama(r.name)), h('h1', null, '栄養情報提供書')),
      h('button', { class: 'btn', onclick: () => window.print() }, '印刷')));

    const staple = m.staple.map((x) => ({ id: x.id, label: x.label }));
    const side = m.side.map((x) => ({ id: x.id, label: x.label }));
    root.appendChild(h('div', { class: 'form4' },
      h('h2', { class: 'form-title' }, '栄養情報提供書'),
      h('div', { class: 'form-right' }, '記入日　' + U.fmtDate(U.today(), true)),
      h('table', { class: 'form-head' }, h('tbody', null,
        h('tr', null, h('th', null, '宛先'), h('td', { colspan: '5' }, to || '　')),
        h('tr', null, h('th', null, 'ふりがな'), h('td', null, r.kana), h('th', null, '性別'), h('td', null, r.gender === 'm' ? '男' : r.gender === 'f' ? '女' : ''),
          h('th', null, '生年月日'), h('td', null, (r.birth ? U.fmtDate(r.birth, true) : '') + (age != null ? '（' + age + '歳）' : ''))),
        h('tr', null, h('th', null, '氏名'), h('td', null, V.sama(r.name)), h('th', null, '病名'), h('td', { colspan: '3' }, r.memo)))),
      h('table', { class: 'form-body' }, h('tbody', null,
        h('tr', null, h('th', null, '身長'), h('td', null, r.heightCm ? r.heightCm + ' cm' : ''),
          h('th', null, '体重（直近①）'), h('td', null, cur ? cur.value + ' kg（' + U.fmtDate(cur.date, true) + '）' : ''),
          h('th', null, 'BMI（①）'), h('td', null, bmi(cur))),
        h('tr', null, h('th', null, ''), h('td', null, ''),
          h('th', null, '①から1か月前'), h('td', null, prev ? prev.value + ' kg（' + U.fmtDate(prev.date, true) + '）' : ''),
          h('th', null, 'BMI（1か月前）'), h('td', null, bmi(prev))))),
      h('h3', null, '栄養補給に関する事項'),
      h('table', { class: 'form-body' }, h('tbody', null,
        h('tr', null, h('th', null, '必要栄養量'), h('td', null, last && last.nut.needKcal ? last.nut.needKcal + ' kcal' : ''), h('td', null, last && last.nut.needProt ? last.nut.needProt + ' g' : '')),
        h('tr', null, h('th', null, '摂取栄養量'), h('td', null, last && last.nut.inKcal ? last.nut.inKcal + ' kcal' : ''), h('td', null, last && last.nut.inProt ? last.nut.inProt + ' g' : '')),
        h('tr', null, h('th', null, '食種'), h('td', { colspan: '2' }, d ? label(m.shokushu, d.shokushu) : '')),
        h('tr', null, h('th', null, '補助食品'), h('td', { colspan: '2' }, d && M.suppText(d) ? '☑ 有: ' + M.suppText(d) : '☑ 無')),
        h('tr', null, h('th', null, '主食'), h('td', { colspan: '2' }, d ? pick(staple, d.staple) + (d.stapleG ? '　' + d.stapleG + 'g' : '') : '')),
        h('tr', null, h('th', null, '副食'), h('td', { colspan: '2' }, d ? pick(side, d.side) + (last && last.swallow.code ? '　学会分類コード ' + last.swallow.code : '') : '')),
        h('tr', null, h('th', null, 'とろみ'), h('td', { colspan: '2' }, d ? (d.soupThick || d.drinkThick ? '☑ 有: ' + pick(m.thick, d.soupThick || d.drinkThick) : '☑ 無') : '')),
        h('tr', null, h('th', null, '経管栄養'), h('td', { colspan: '2' }, (last && (last.body.feeding === 'enteral')) ? '☑ 有' : '☑ 無')),
        h('tr', null, h('th', null, '静脈栄養'), h('td', { colspan: '2' }, (last && (last.body.feeding === 'parenteral')) ? '☑ 有' : '☑ 無')))),
      h('h3', null, '食事に関する留意事項'),
      h('table', { class: 'form-body' }, h('tbody', null,
        h('tr', null, h('th', null, '食物アレルギー'), h('td', null, d && d.allergy.length ? '☑ 有（' + d.allergy.join('、') + '）' : yn(false))),
        h('tr', null, h('th', null, 'その他禁止食品'), h('td', null, d && d.kinshi.length ? '☑ 有（' + M.kinshiText(d) + '）' : yn(false))),
        h('tr', null, h('th', null, 'その他問題点'), h('td', null,
          last && last.issues.length ? last.issues.map((t) => '☑ ' + t).join('　') : '☑ 無')),
        h('tr', null, h('th', null, '食器・自助具'), h('td', null, d ? d.tools.join('、') : '')),
        h('tr', null, h('th', null, '注意'), h('td', null, d ? d.notes : '')))),
      h('h3', null, '入所中の経過・栄養食事相談の内容等'),
      h('div', { class: 'form-free' }, note || ' '),
      h('table', { class: 'form-body' }, h('tbody', null,
        h('tr', null, h('th', null, '問合せ先'), h('td', null, m.facility.name || '　'),
          h('th', null, '担当管理栄養士'), h('td', null, m.facility.recorder || '　')),
        h('tr', null, h('th', null, '電話'), h('td', null, '　'), h('th', null, 'FAX'), h('td', null, '　')))),
      h('div', { class: 'sub' }, '※ コードととろみは日本摂食嚥下リハビリテーション学会の分類です。必要事項が書ければ別の様式でも構いません。')));
  });

  // 個人画面のボタン
  window.Residents.registerSection({ order: 7, render: async function (r) {
    if (V.ncmCats().indexOf(r.category) < 0) return null;
    return h('section', { class: 'card no-print' },
      h('div', { class: 'sec-head' }, h('h2', null, '様式を出す'), h('span')),
      h('div', { class: 'toolrow' },
        h('a', { class: 'btn', href: '#/form411/' + r.id }, '様式4-1-1（スクリーニング等）'),
        h('a', { class: 'btn', href: '#/plan/' + r.id }, '様式4-1-2（計画書）'),
        h('button', { class: 'btn', onclick: () => F.infoSheet(r) }, '様式4-2（栄養情報提供書）')),
      h('div', { class: 'sub' }, '栄養情報提供書は、退所時に医療機関・施設・ケアマネジャーへ渡すものです（退所時栄養情報連携加算）。'));
  } });

  window.Forms = F;
})();
