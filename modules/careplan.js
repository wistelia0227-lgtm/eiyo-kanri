// 栄養ケア計画書（削除可能）: 様式4-1-2。記録（様式4-1-1）と対になる。
// plans ストア: 1 版 = 1 レコード。見直すたびに新しい版を作り、前の版は残す（食事情報の版と同じ考え方）。
(function () {
  'use strict';
  const U = window.U, h = U.h, DB = window.DB, M = window.Model, N = window.NCM, V = window.View, App = window.App;
  const ms = () => window.Master.current;
  const P = {};
  const label = (list, id) => (list.find((x) => x.id === id) || { label: '' }).label;

  P.all = async function () { return (await DB.getAll('plans')).map(N.normalizePlan); };
  P.ofResident = async function (rid) {
    return (await DB.byIndex('plans', 'residentId', rid)).map(N.normalizePlan)
      .sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || '') || (b.recordedAt || 0) - (a.recordedAt || 0));
  };

  // ---------- 編集 ----------
  P.edit = async function (resident, plan) {
    const m = ms();
    const p = N.normalizePlan(JSON.parse(JSON.stringify(plan)));
    const isNew = !p.id;
    let close;

    const firstAt = h('input', { class: 'input', type: 'date', value: p.firstAt });
    const updatedAt = h('input', { class: 'input', type: 'date', value: p.updatedAt });
    const author = h('input', { class: 'input', type: 'text', value: p.author || V.recorder() });
    const wish = h('textarea', { class: 'input', rows: '2' }, p.wish);
    const explainedAt = h('input', { class: 'input', type: 'date', value: p.explainedAt });
    const explainedBy = h('input', { class: 'input', type: 'text', value: p.explainedBy, placeholder: '説明した人' });
    const needs = h('textarea', { class: 'input', rows: '2' }, p.needs);
    const level = U.select(N.LEVELS.map((x) => ({ id: x.id, label: x.label + 'リスク' })), p.level, { emptyLabel: '（未記入）' });
    const longGoal = h('textarea', { class: 'input', rows: '2' }, p.longGoal);
    const longTerm = h('input', { class: 'input', type: 'text', value: p.longTerm, placeholder: '例: 6か月' });
    const special = h('textarea', { class: 'input', rows: '2' }, p.special);

    // 直近の記録からリスクと課題を写す
    const pull = h('button', { class: 'btn', onclick: async () => {
      const recs = await window.Ncm.ofResident(resident.id);
      if (!recs.length) { U.toast('記録がまだありません', true); return; }
      const r = recs[0];
      level.value = r.level || '';
      const bits = [];
      if (r.issues.length) bits.push(r.issues.join('、'));
      if (r.special) bits.push(r.special);
      if (bits.length && !needs.value.trim()) needs.value = bits.join(' ／ ');
      U.toast(U.fmtDate(r.date) + ' の記録から写しました');
    } }, '直近の記録からリスク・課題を写す');

    // 短期目標の表
    const rowBox = h('div');
    function drawRows() {
      rowBox.innerHTML = '';
      rowBox.appendChild(h('div', { class: 'scroll-x' }, h('table', { class: 'list edit plan-rows' },
        h('thead', null, h('tr', null, ['分類', '短期目標', '期間', '栄養ケアの具体的内容', '頻度', '担当者', ''].map((t) => h('th', null, t)))),
        h('tbody', null, p.rows.map((r, i) => {
          const goal = h('textarea', { class: 'input', rows: '2' }, r.goal);
          goal.addEventListener('change', () => { r.goal = goal.value.trim(); });
          const care = h('textarea', { class: 'input', rows: '2' }, r.care);
          care.addEventListener('change', () => { r.care = care.value.trim(); });
          return h('tr', null,
            h('td', null, U.select(N.PLAN_CATEGORIES.map((c) => ({ id: c, label: c })), r.cat, { emptyLabel: '（選ぶ）', onchange: (e) => { r.cat = e.target.value; } })),
            h('td', null, U.withPhrases('plan.goal', goal)),
            h('td', null, h('input', { class: 'input', type: 'text', value: r.term, placeholder: '3か月', onchange: (e) => { r.term = e.target.value.trim(); } })),
            h('td', null, U.withPhrases('plan.care', care)),
            h('td', null, h('input', { class: 'input', type: 'text', value: r.freq, placeholder: '毎食・月1回', onchange: (e) => { r.freq = e.target.value.trim(); } })),
            h('td', null, h('input', { class: 'input', type: 'text', value: r.who, placeholder: '管理栄養士', onchange: (e) => { r.who = e.target.value.trim(); } })),
            h('td', null, h('button', { class: 'btn small', onclick: () => { p.rows.splice(i, 1); drawRows(); } }, '外す')));
        })))));
      rowBox.appendChild(h('div', { class: 'toolrow' },
        h('button', { class: 'btn', onclick: () => { p.rows.push({ cat: '', goal: '', term: '', care: '', freq: '', who: '' }); drawRows(); } }, '＋ 行を足す'),
        h('button', { class: 'btn', onclick: () => {
          // よくある組み合わせをまとめて入れる
          [{ cat: '栄養補給・食事', goal: '体重を維持する', term: '3か月', care: '毎食の摂取量を記録し、週1回まとめて確認する', freq: '毎食', who: '介護職員' },
            { cat: '多職種による課題の解決', goal: '低栄養リスクを中から低にする', term: '3か月', care: '月1回体重を測定する', freq: '月1回', who: '看護職員' }]
            .forEach((r) => p.rows.push(r));
          drawRows();
        } }, 'よくある行を入れる')));
    }
    drawRows();

    // 算定加算
    const addonBox = h('div', { class: 'pickgrid' }, N.PLAN_ADDONS.map((a) => h('label', { class: 'check' },
      h('input', { type: 'checkbox', checked: p.addons.indexOf(a.id) >= 0, onchange: (e) => {
        if (e.target.checked) p.addons.push(a.id); else p.addons.splice(p.addons.indexOf(a.id), 1);
      } }), ' ' + a.label)));

    const save = async () => {
      p.firstAt = firstAt.value || U.today();
      p.updatedAt = updatedAt.value || U.today();
      p.author = author.value.trim();
      p.wish = wish.value.trim(); p.explainedAt = explainedAt.value; p.explainedBy = explainedBy.value.trim();
      p.needs = needs.value.trim(); p.level = level.value;
      p.longGoal = longGoal.value.trim(); p.longTerm = longTerm.value.trim();
      p.special = special.value.trim();
      p.rows = p.rows.filter((r) => r.cat || r.goal || r.care);
      if (!p.rows.length) { U.toast('短期目標を 1 行は入れてください', true); return; }
      if (!p.id) p.id = U.uid('p');
      p.recordedAt = p.recordedAt || Date.now();
      V.setRecorder(p.author);
      await DB.put('plans', p);
      close(); U.toast('保存しました'); App.refresh();
    };

    close = U.modal(h('div', null,
      h('h2', null, V.sama(resident.name) + '　栄養ケア計画書'),
      h('div', { class: 'sub' }, '厚生労働省 別紙様式4-1-2 の項目です。施設サービス計画に同じ内容を書いている場合は、そちらで代えられます。'),
      h('div', { class: 'grid3' }, U.field('初回作成日', firstAt), U.field('作成（変更）日', updatedAt), U.field('作成者', author)),
      h('div', { class: 'toolrow' }, pull),
      U.field('利用者及び家族の意向', wish),
      h('div', { class: 'grid3' }, U.field('説明日', explainedAt), U.field('説明した人', explainedBy), U.field('低栄養状態のリスク', level)),
      U.field('解決すべき課題（ニーズ）', U.withPhrases('plan.needs', needs)),
      h('div', { class: 'grid3' }, U.field('長期目標', U.withPhrases('plan.goal', longGoal)), U.field('期間', longTerm), h('span')),
      h('h3', null, '短期目標と栄養ケアの具体的内容'), rowBox,
      h('h3', null, '算定加算'), addonBox,
      U.field('特記事項', special),
      h('div', { class: 'modal-btns' },
        isNew ? null : h('button', { class: 'btn danger-outline', onclick: async () => {
          if (!await U.confirm('この版の計画書を消します。', { okLabel: '消す', danger: true })) return;
          await DB.del('plans', p.id); close(); App.refresh();
        } }, '消す'),
        h('button', { class: 'btn', onclick: () => close() }, 'やめる'),
        h('button', { class: 'btn primary', onclick: save }, '保存'))), { wide: true });
  };

  // 新しく作る / 見直す
  P.start = async function (resident) {
    const list = await P.ofResident(resident.id);
    if (!list.length) {
      const p = N.emptyPlan(resident.id, U.today());
      const recs = await window.Ncm.ofResident(resident.id);
      if (recs[0]) p.level = recs[0].level || '';
      P.edit(resident, p);
      return;
    }
    P.edit(resident, N.revisePlan(list[0], U.today()));
  };

  // 経過記録（栄養ケア提供経過記録）
  P.addProgress = async function (resident, plan) {
    const date = h('input', { class: 'input', type: 'date', value: U.today() });
    const text = h('textarea', { class: 'input', rows: '3', placeholder: '栄養補給の状況、内容の変更、栄養食事相談の実施、関連職種のケアの状況など' });
    const by = h('input', { class: 'input', type: 'text', value: V.recorder() });
    let close;
    close = U.modal(h('div', null, h('h2', null, V.sama(resident.name) + '　栄養ケア提供経過記録'),
      h('div', { class: 'grid3' }, U.field('日付', date), U.field('記録した人', by), h('span')),
      U.field('サービス提供項目', U.withPhrases('ncm.special', text)),
      h('div', { class: 'modal-btns' }, h('button', { class: 'btn', onclick: () => close() }, 'やめる'),
        h('button', { class: 'btn primary', onclick: async () => {
          if (!text.value.trim()) { U.toast('内容を入れてください', true); return; }
          plan.progress.push({ date: date.value || U.today(), text: text.value.trim(), by: by.value.trim() });
          plan.progress.sort((a, b) => a.date.localeCompare(b.date));
          V.setRecorder(by.value.trim());
          await DB.put('plans', plan);
          close(); App.refresh();
        } }, '記録する'))));
  };

  // ---------- 個人画面の欄 ----------
  window.Residents.registerSection({ order: 6, render: async function (r) {
    const m = ms();
    if (V.ncmCats().indexOf(r.category) < 0) return null;
    const list = await P.ofResident(r.id);
    const cur = list[0] || null;
    const st = N.planState(list, r.id, m, U.today());
    return h('section', { class: 'card' },
      h('div', { class: 'sec-head' }, h('h2', null, '栄養ケア計画書'),
        h('div', { class: 'no-print' },
          cur ? h('button', { class: 'btn', onclick: () => P.addProgress(r, cur) }, '経過記録を足す') : null, ' ',
          cur ? h('button', { class: 'btn', onclick: () => P.edit(r, cur) }, '今の計画を直す') : null, ' ',
          h('button', { class: 'btn primary', onclick: () => P.start(r) }, cur ? '見直して新しい版にする' : '計画書を作る'))),
      !cur ? h('div', { class: 'card warn' }, '計画書がまだありません。')
        : h('div', null,
          h('div', { class: st.needsReview ? 'warn-text' : 'sub' },
            '作成（変更）日 ' + U.fmtDate(cur.updatedAt, true) + '（' + st.staleDays + '日前）' +
            (st.needsReview ? '　見直しの目安（' + N.intervals(m).planReview + '日）を過ぎています' : '') +
            (cur.explainedAt ? '　説明日 ' + U.fmtDate(cur.explainedAt) : '　説明日 未記入') + '　版 ' + list.length),
          h('table', { class: 'kv' },
            h('tr', null, h('th', null, '解決すべき課題'), h('td', null, cur.needs || '—')),
            h('tr', null, h('th', null, '長期目標'), h('td', null, (cur.longGoal || '—') + (cur.longTerm ? '（' + cur.longTerm + '）' : ''))),
            h('tr', null, h('th', null, 'リスク'), h('td', null, label(N.LEVELS, cur.level) || '—')),
            h('tr', null, h('th', null, '算定加算'), h('td', null, cur.addons.map((a) => label(N.PLAN_ADDONS, a)).join('、') || 'なし'))),
          h('table', { class: 'list' },
            h('thead', null, h('tr', null, ['分類', '短期目標', '期間', '具体的内容', '頻度', '担当'].map((t) => h('th', null, t)))),
            h('tbody', null, cur.rows.map((x) => h('tr', null, h('td', null, x.cat), h('td', null, x.goal),
              h('td', null, x.term), h('td', null, x.care), h('td', null, x.freq), h('td', null, x.who))))),
          cur.progress.length ? h('details', { class: 'no-print' }, h('summary', null, '栄養ケア提供経過記録（' + cur.progress.length + '件）'),
            h('table', { class: 'list' }, h('tbody', null, cur.progress.slice().reverse().map((x) => h('tr', null,
              h('td', null, U.fmtDate(x.date, true)), h('td', null, x.text), h('td', { class: 'sub' }, x.by)))))) : null,
          h('div', { class: 'toolrow no-print' }, h('a', { class: 'btn', href: '#/plan/' + r.id }, '様式の形で見る・印刷'))));
  } });

  // ---------- 印刷用の様式 ----------
  App.registerScreen('plan', async function (params, root) {
    if (!params[0]) { root.appendChild(h('div', { class: 'empty' }, V.t('person') + 'の画面から開いてください。')); return; }
    const r = await DB.get('residents', params[0]);
    if (!r) { root.appendChild(h('div', { class: 'empty' }, 'この方は見つかりません。')); return; }
    M.normalizeResident(r);
    const m = ms();
    const list = await P.ofResident(r.id);
    const idx = params[1] ? list.findIndex((x) => x.id === params[1]) : 0;
    const cur = list[Math.max(0, idx)] || null;
    root.appendChild(h('header', { class: 'topbar no-print' },
      h('div', null, h('a', { href: '#/resident/' + r.id, class: 'back' }, '← ' + V.sama(r.name)), h('h1', null, '栄養ケア計画書')),
      h('div', null, h('button', { class: 'btn', onclick: () => window.print() }, '印刷'), ' ',
        cur ? h('button', { class: 'btn', onclick: () => P.edit(r, cur) }, '直す') : null)));
    if (!cur) { root.appendChild(h('div', { class: 'empty' }, '計画書がありません。')); return; }
    if (list.length > 1) root.appendChild(h('div', { class: 'toolrow no-print' }, h('span', { class: 'sub' }, '版'),
      list.map((x, i) => h('a', { class: 'btn seg' + (x === cur ? ' on' : ''), href: '#/plan/' + r.id + '/' + x.id }, U.fmtDate(x.updatedAt, true)))));

    const age = M.age(r.birth, U.today());
    root.appendChild(h('div', { class: 'form4' },
      h('h2', { class: 'form-title' }, '栄養ケア計画書（' + V.t('person') + '）'),
      h('table', { class: 'form-head' }, h('tbody', null,
        h('tr', null, h('th', null, '氏名'), h('td', null, V.sama(r.name)), h('th', null, '生年月日'), h('td', null, r.birth ? U.fmtDate(r.birth, true) + (age != null ? '（' + age + '歳）' : '') : ''), h('th', null, '性別'), h('td', null, r.gender === 'm' ? '男' : r.gender === 'f' ? '女' : '')),
        h('tr', null, h('th', null, '初回作成日'), h('td', null, U.fmtDate(cur.firstAt, true)), h('th', null, '作成（変更）日'), h('td', null, U.fmtDate(cur.updatedAt, true)), h('th', null, '作成者'), h('td', null, cur.author)),
        h('tr', null, h('th', null, '説明日'), h('td', null, cur.explainedAt ? U.fmtDate(cur.explainedAt, true) : ''), h('th', null, '説明した人'), h('td', null, cur.explainedBy), h('th', null, '低栄養リスク'), h('td', null, label(N.LEVELS, cur.level))))),
      h('table', { class: 'form-body' }, h('tbody', null,
        h('tr', null, h('th', null, '利用者及び家族の意向'), h('td', { colspan: '5' }, cur.wish)),
        h('tr', null, h('th', null, '解決すべき課題（ニーズ）'), h('td', { colspan: '5' }, cur.needs)),
        h('tr', null, h('th', null, '長期目標と期間'), h('td', { colspan: '5' }, cur.longGoal + (cur.longTerm ? '（' + cur.longTerm + '）' : ''))))),
      h('table', { class: 'form-body' },
        h('thead', null, h('tr', null, ['分類', '短期目標と期間', '栄養ケアの具体的内容（頻度、期間）', '担当者'].map((t) => h('th', null, t)))),
        h('tbody', null, cur.rows.map((x) => h('tr', null,
          h('td', null, x.cat),
          h('td', null, x.goal + (x.term ? '（' + x.term + '）' : '')),
          h('td', null, x.care + (x.freq ? '（' + x.freq + '）' : '')),
          h('td', null, x.who))))),
      h('table', { class: 'form-body' }, h('tbody', null,
        h('tr', null, h('th', null, '特記事項'), h('td', null, cur.special)),
        h('tr', null, h('th', null, '算定加算'), h('td', null, N.PLAN_ADDONS.map((a) => (cur.addons.indexOf(a.id) >= 0 ? '☑ ' : '☐ ') + a.label).join('　'))))),
      h('h3', null, '栄養ケア提供経過記録'),
      h('table', { class: 'form-body' },
        h('thead', null, h('tr', null, h('th', { class: 'w-date' }, '月日'), h('th', null, 'サービス提供項目'), h('th', { class: 'w-who' }, '記録者'))),
        h('tbody', null, (cur.progress.length ? cur.progress : [{ date: '', text: '', by: '' }, { date: '', text: '', by: '' }, { date: '', text: '', by: '' }])
          .map((x) => h('tr', null, h('td', null, x.date ? U.fmtDate(x.date) : ''), h('td', null, x.text), h('td', null, x.by)))))));
    void m;
  });

  // 今日やること
  App.registerTodo(async function (ctx) {
    const m = ms(), cats = V.ncmCats();
    const plans = await P.all();
    const target = ctx.residents.filter((r) => r._st === 'in' && cats.indexOf(r.category) >= 0);
    const none = target.filter((r) => !N.planState(plans, r.id, m, ctx.today).has);
    const stale = target.filter((r) => { const st = N.planState(plans, r.id, m, ctx.today); return st.has && st.needsReview; });
    const out = [];
    if (none.length) out.push({ level: 'warn', text: '栄養ケア計画書がまだない人: ' + none.map((r) => r.name).join('、'), href: '#/resident/' + none[0].id });
    if (stale.length) out.push({ level: 'info', text: '計画書の見直しの目安を過ぎている人: ' + stale.map((r) => r.name).join('、'), href: '#/resident/' + stale[0].id });
    return out;
  });

  // やること一覧の列
  if (window.Board) window.Board.registerColumn({
    order: 15, id: 'plan', feature: 'ncm', label: '計画書',
    prepare: async function (ctx) { ctx.plans = await P.all(); ctx.planCats = V.ncmCats(); },
    cell: function (r, ctx) {
      if (ctx.planCats.indexOf(r.category) < 0) return { text: '—', state: 'none' };
      const st = N.planState(ctx.plans, r.id, ctx.m, ctx.today);
      if (!st.has) return { text: 'まだ', sub: '作成が必要', state: 'over', onclick: () => P.start(r) };
      return { text: U.fmtDate(st.current.updatedAt), sub: st.staleDays + '日前' + (st.current.explainedAt ? '' : '・説明日なし'),
        state: st.needsReview ? 'soon' : 'ok', onclick: () => App.go('#/plan/' + r.id) };
    }
  });

  window.CarePlan = P;
})();
