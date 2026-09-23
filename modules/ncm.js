// 栄養ケア・マネジメント（削除可能）: 期限の一覧 → 1 操作で入力、様式4-1-1 の記録、前回複写、印刷。
// ncm ストア: 1 回の実施 = 1 レコード。plans ストア: 栄養ケア計画書（様式4-1-2）。
(function () {
  'use strict';
  const U = window.U, h = U.h, DB = window.DB, M = window.Model, N = window.NCM, V = window.View, App = window.App;
  const ms = () => window.Master.current;
  const X = {};
  const label = (list, id) => (list.find((x) => x.id === id) || { label: '' }).label;

  X.all = async function () { return (await DB.getAll('ncm')).map(N.normalize); };
  X.ofResident = async function (rid) {
    return (await DB.byIndex('ncm', 'residentId', rid)).map(N.normalize).sort((a, b) => b.date.localeCompare(a.date));
  };

  // 学会分類2021 のコードの候補。主食・副食マスタのコード欄から集める（施設の呼び方を添える）
  function codeOptions(m) {
    const out = [{ id: '常食', label: '常食' }];
    const seen = {};
    m.staple.concat(m.side).forEach((x) => {
      if (!x.code || seen[x.code]) { if (x.code && seen[x.code]) seen[x.code].push(x.label); return; }
      seen[x.code] = [x.label];
      out.push({ id: x.code, label: x.code });
    });
    out.forEach((o) => { if (seen[o.id]) o.label = o.id + '（' + seen[o.id].join('・') + '）'; });
    return out;
  }

  // ---------- 入力 ----------
  X.edit = async function (resident, rec, opts) {
    opts = opts || {};
    const m = ms();
    const isNew = !rec.id;
    const r = N.normalize(JSON.parse(JSON.stringify(rec)));
    let close, refreshLevel;

    const date = h('input', { class: 'input', type: 'date', value: r.date });
    const process = U.select(N.PROCESS, r.process, { noEmpty: true });
    const by = h('input', { class: 'input', type: 'text', value: r.by || V.recorder() });
    const num = (obj, key, step, ph) => h('input', { class: 'input num', type: 'number', step: step || '0.1', value: obj[key] == null ? '' : obj[key],
      placeholder: ph || '', onchange: (e) => { obj[key] = e.target.value === '' ? null : parseFloat(e.target.value); refreshLevel(); } });
    const chk = (obj, key, text) => h('label', { class: 'check' }, h('input', { type: 'checkbox', checked: !!obj[key],
      onchange: (e) => { obj[key] = e.target.checked; refreshLevel(); } }), ' ' + text);

    const f = {
      height: num(r.body, 'heightCm', '0.1', 'cm'), weight: num(r.body, 'weightKg', '0.1', 'kg'),
      loss1: num(r.body, 'loss1', '0.1', '%'), loss3: num(r.body, 'loss3', '0.1', '%'), loss6: num(r.body, 'loss6', '0.1', '%'),
      feeding: U.select(N.FEEDING, r.body.feeding, { emptyLabel: '（未記入）', onchange: (e) => { r.body.feeding = e.target.value; refreshLevel(); } }),
      otherBody: h('input', { class: 'input', type: 'text', value: r.body.other }),
      pct: num(r.intake, 'pct', '1', '％'), staple: num(r.intake, 'staple', '1', '％'), side: num(r.intake, 'side', '1', '％'),
      otherIntake: h('input', { class: 'input', type: 'text', value: r.intake.other, placeholder: '補助食品など' }),
      inKcal: num(r.nut, 'inKcal', '1'), inProt: num(r.nut, 'inProt', '0.1'),
      outKcal: num(r.nut, 'outKcal', '1'), outProt: num(r.nut, 'outProt', '0.1'),
      needKcal: num(r.nut, 'needKcal', '1'), needProt: num(r.nut, 'needProt', '0.1'),
      swCode: U.select(codeOptions(m), r.swallow.code, { emptyLabel: '（未記入）' }),
      swThick: U.select(m.thick, r.swallow.thick, { emptyLabel: 'とろみなし' }),
      cautionText: h('input', { class: 'input', type: 'text', value: r.caution.text, placeholder: '療養食の指示、食事形態、嗜好、薬剤影響食品、アレルギーなど' }),
      special: h('textarea', { class: 'input', rows: '2' }, r.special),
      evaluation: U.select(N.EVAL, r.evaluation, { emptyLabel: '（未記入）' }),
      glim: U.select(N.GLIM, r.glim, { noEmpty: true })
    };
    const five = (key, words) => h('div', { class: 'toggles' }, words.map((w, i) => {
      const bt = h('button', { type: 'button', class: 'btn seg' + (r.will[key] === i + 1 ? ' on' : ''), onclick: () => {
        r.will[key] = (r.will[key] === i + 1) ? 0 : i + 1;
        Array.prototype.forEach.call(bt.parentNode.children, (el, j) => el.classList.toggle('on', r.will[key] === j + 1));
      } }, (i + 1) + ' ' + w);
      return bt;
    }));
    const issueBox = (list) => h('div', { class: 'pickgrid' }, list.map((t) => h('label', { class: 'check' },
      h('input', { type: 'checkbox', checked: r.issues.indexOf(t) >= 0, onchange: (e) => {
        if (e.target.checked) r.issues.push(t); else r.issues.splice(r.issues.indexOf(t), 1);
      } }), ' ' + t)));

    // リスク判定（自動の候補＋人の上書き）
    const levelBox = h('div');
    refreshLevel = function () {
      const auto = N.autoLevel(r, m.risk);
      if (!r.levelManual && auto.level) r.level = auto.level;
      levelBox.innerHTML = '';
      levelBox.appendChild(h('div', { class: 'toolrow' },
        N.LEVELS.map((lv) => h('button', { type: 'button', class: 'btn seg' + (r.level === lv.id ? ' on' : ''), onclick: () => {
          r.level = lv.id; r.levelManual = true; refreshLevel();
        } }, lv.label + 'リスク')),
        r.levelManual ? h('button', { type: 'button', class: 'btn small', onclick: () => { r.levelManual = false; refreshLevel(); } }, '自動に戻す') : null));
      levelBox.appendChild(h('div', { class: 'sub' },
        auto.level ? ('入力からの候補: ' + label(N.LEVELS, auto.level) + 'リスク' + (auto.reasons.length ? '（' + auto.reasons.join('、') + '）' : '') +
          (auto.bmi ? '　BMI ' + auto.bmi.toFixed(1) : ''))
          : '身長・体重などを入れると候補が出ます'));
      if (r.levelManual) levelBox.appendChild(h('div', { class: 'sub warn-text' }, '手で決めた判定です（BMI・食事摂取量・栄養補給法は、程度や状態に応じて高リスクと判断してよいことになっています）。'));
    };
    refreshLevel();

    // 経口維持加算を算定している施設だけ出す
    const usesIji = (m.profile.addons || []).indexOf('iji') >= 0;
    const ijiBox = h('div');
    if (usesIji) {
      r.iji = r.iji || { tests: [], testDate: '', targets: [], observe: { members: [], date: '' }, meeting: { members: [], date: '', items: {} }, note: '' };
      const members = (holder) => h('div', { class: 'pickgrid' }, N.JOBS.map((j) => h('label', { class: 'check' },
        h('input', { type: 'checkbox', checked: holder.members.indexOf(j) >= 0, onchange: (e) => {
          if (e.target.checked) holder.members.push(j); else holder.members.splice(holder.members.indexOf(j), 1);
        } }), ' ' + j)));
      const obsDate = h('input', { class: 'input', type: 'date', value: r.iji.observe.date, onchange: (e) => { r.iji.observe.date = e.target.value; } });
      const mtgDate = h('input', { class: 'input', type: 'date', value: r.iji.meeting.date, onchange: (e) => { r.iji.meeting.date = e.target.value; } });
      const testDate = h('input', { class: 'input', type: 'date', value: r.iji.testDate, onchange: (e) => { r.iji.testDate = e.target.value; } });
      ijiBox.appendChild(h('details', { class: 'card', open: true }, h('summary', null, '経口維持加算を算定する場合（月1回以上の食事の観察と多職種会議）'),
        U.field('摂食・嚥下機能検査', h('div', { class: 'pickgrid' }, N.TESTS.map((t) => h('label', { class: 'check' },
          h('input', { type: 'checkbox', checked: r.iji.tests.indexOf(t) >= 0, onchange: (e) => {
            if (e.target.checked) r.iji.tests.push(t); else r.iji.tests.splice(r.iji.tests.indexOf(t), 1);
          } }), ' ' + t)))),
        U.field('検査の実施日', testDate),
        U.field('課題の所在', h('div', { class: 'toggles' }, ['認知機能', '咀嚼・口腔機能', '嚥下機能'].map((t) => {
          const bt = h('button', { type: 'button', class: 'btn seg' + (r.iji.targets.indexOf(t) >= 0 ? ' on' : ''), onclick: () => {
            const i = r.iji.targets.indexOf(t); if (i >= 0) r.iji.targets.splice(i, 1); else r.iji.targets.push(t); bt.classList.toggle('on');
          } }, t); return bt;
        }))),
        h('h3', null, '食事の観察'), U.field('参加者', members(r.iji.observe)), U.field('実施日', obsDate),
        h('h3', null, '多職種会議'), U.field('参加者', members(r.iji.meeting)), U.field('実施日', mtgDate),
        h('div', { class: 'sub' }, '（Ⅱ）を算定する場合は、医師（配置医師を除く）・歯科医師・歯科衛生士・言語聴覚士のいずれかが参加していること'),
        h('table', { class: 'list edit' }, h('tbody', null, N.MEETING_ITEMS.map((t, i) => h('tr', null, h('td', null, (i + 1) + '. ' + t),
          h('td', null, h('div', { class: 'toggles' }, [['keep', '現状維持'], ['change', '変更']].map((o) => {
            const bt = h('button', { type: 'button', class: 'btn seg' + (r.iji.meeting.items[i] === o[0] ? ' on' : ''), onclick: () => {
              r.iji.meeting.items[i] = r.iji.meeting.items[i] === o[0] ? '' : o[0];
              Array.prototype.forEach.call(bt.parentNode.children, (el, j) => el.classList.toggle('on', r.iji.meeting.items[i] === ['keep', 'change'][j]));
            } }, o[1]); return bt;
          })))))))));
    }

    // 体重・身長を台帳と測定値から引いてくる
    const pull = h('button', { class: 'btn', onclick: async () => {
      const all = await DB.byIndex('measures', 'residentId', resident.id);
      const alb = all.filter((x) => x.kind === 'alb' && x.date <= date.value).sort((a, b) => a.date.localeCompare(b.date)).slice(-1)[0];
      if (alb) { r.alb = alb.value; }
      const list = all.filter((x) => x.kind === 'weight')
        .sort((a, b) => a.date.localeCompare(b.date));
      const upto = list.filter((w) => w.date <= date.value);
      const cur = upto[upto.length - 1];
      if (resident.heightCm) { r.body.heightCm = resident.heightCm; f.height.value = resident.heightCm; }
      if (cur) {
        r.body.weightKg = cur.value; f.weight.value = cur.value;
        [['loss1', 1], ['loss3', 3], ['loss6', 6]].forEach((k) => {
          const x = M.lossRate(upto, cur, k[1]);
          r.body[k[0]] = x ? Math.round(x.rate * 10) / 10 : null;
          f[k[0]].value = r.body[k[0]] == null ? '' : r.body[k[0]];
        });
        U.toast(U.fmtDate(cur.date) + ' の体重 ' + cur.value + 'kg を入れました');
      } else U.toast('この日までの体重の記録がありません', true);
      refreshLevel();
    } }, '体重・身長を記録から入れる');

    const save = async () => {
      r.date = date.value || U.today();
      r.process = process.value;
      r.by = by.value.trim();
      r.body.other = f.otherBody.value.trim();
      r.intake.other = f.otherIntake.value.trim();
      r.swallow.code = f.swCode.value; r.swallow.thick = f.swThick.value;
      r.caution.text = f.cautionText.value.trim(); r.caution.has = !!r.caution.text;
      r.special = f.special.value.trim();
      r.evaluation = f.evaluation.value; r.glim = f.glim.value;
      if (!r.level) { U.toast('低栄養状態のリスクを決めてください', true); return; }
      if (!r.id) r.id = U.uid('n');
      r.recordedAt = r.recordedAt || Date.now();
      r.updatedAt = Date.now();
      V.setRecorder(r.by);
      await DB.put('ncm', r);
      close(); U.toast('保存しました');
      if (opts.then) opts.then(); else App.refresh();
    };

    close = U.modal(h('div', null,
      h('h2', null, V.sama(resident.name) + '　栄養・摂食嚥下スクリーニング／アセスメント／モニタリング'),
      h('div', { class: 'sub' }, '厚生労働省 別紙様式4-1-1 の項目です。分かる所だけで構いません（確認できない項目は空欄でよいと注記されています）。'),
      h('div', { class: 'grid3' }, U.field('実施日', date), U.field('種類', process), U.field('記入者', by)),
      h('h3', null, '低栄養状態のリスク'), levelBox,
      h('div', { class: 'card' },
        h('div', { class: 'toolrow' }, pull),
        h('div', { class: 'grid3' }, U.field('身長 (cm)', f.height), U.field('体重 (kg)', f.weight), U.field('栄養補給法', f.feeding)),
        h('div', { class: 'grid3' }, U.field('体重減少率 1か月 (%)', f.loss1), U.field('3か月 (%)', f.loss3), U.field('6か月 (%)', f.loss6)),
        chk(r.body, 'ulcer', '褥瘡あり'), U.field('その他', U.withPhrases('ncm.other', f.otherBody))),
      h('h3', null, '食生活の状況'),
      h('div', { class: 'card' },
        h('div', { class: 'grid3' }, U.field('食事摂取量 (%)', f.pct), U.field('主食 (%)', f.staple), U.field('主菜・副菜 (%)', f.side)),
        U.field('その他（補助食品など）', U.withPhrases('ncm.intakeOther', f.otherIntake)),
        h('table', { class: 'list edit' }, h('thead', null, h('tr', null, ['', 'エネルギー (kcal)', 'たんぱく質 (g)'].map((t) => h('th', null, t)))),
          h('tbody', null,
            h('tr', null, h('td', null, '摂取栄養量'), h('td', null, f.inKcal), h('td', null, f.inProt)),
            h('tr', null, h('td', null, '提供栄養量'), h('td', null, f.outKcal), h('td', null, f.outProt)),
            h('tr', null, h('td', null, '必要栄養量'), h('td', null, f.needKcal), h('td', null, f.needProt),
              h('td', { class: 'no-print' }, window.Needs ? h('button', { class: 'btn small', onclick: async () => {
                const got = await window.Needs.of(resident, date.value);
                if (got.kcal == null) { U.toast('体重か生年月日が入っていないので出せません', true); return; }
                r.nut.needKcal = got.kcal; f.needKcal.value = got.kcal;
                if (got.prot != null) { r.nut.needProt = got.prot; f.needProt.value = got.prot; }
                U.toast(got.how);
              } }, '出し方から入れる') : null)))),
        h('div', { class: 'grid3' }, U.field('食事の形態（学会分類コード）', f.swCode), U.field('とろみ', f.swThick),
          U.field('嚥下調整食の必要性', h('div', null, chk(r.swallow, 'need', '必要あり')))),
        U.field('食事の留意事項', U.withPhrases('ncm.caution', f.cautionText)),
        h('div', { class: 'grid3' }, U.field('本人の意欲', five('motivation', N.FIVE)), U.field('食欲・食事の満足感', five('satisfaction', N.FIVE_SAT)), U.field('食事に対する意識', five('attitude', N.FIVE_SAT)))),
      h('h3', null, '多職種による栄養ケアの課題'),
      h('div', { class: 'card' }, h('div', { class: 'sub' }, '口腔・摂食嚥下'), issueBox(N.ISSUES_ORAL),
        h('div', { class: 'sub' }, 'その他'), issueBox(N.ISSUES_OTHER)),
      ijiBox,
      h('div', { class: 'grid3' }, U.field('総合評価', f.evaluation),
        U.field('計画変更', h('div', null, chk(r, 'planChange', '計画を変更する'))),
        U.field('GLIM基準（医療機関から情報提供があった場合）', f.glim)),
      U.field('特記事項', U.withPhrases('ncm.special', f.special)),
      h('div', { class: 'modal-btns' },
        (!isNew) ? h('button', { class: 'btn danger-outline', onclick: async () => {
          if (!await U.confirm('この記録を消します。', { okLabel: '消す', danger: true })) return;
          await DB.del('ncm', r.id); close(); App.refresh();
        } }, '消す') : null,
        h('button', { class: 'btn', onclick: () => close() }, 'やめる'),
        h('button', { class: 'btn primary', onclick: save }, '保存'))), { wide: true });
  };

  // 期限の一覧から 1 操作で入力へ
  X.start = async function (resident, kind) {
    const prev = (await X.ofResident(resident.id))[0];
    const proc = kind === 'first' ? 'screening' : (kind === 'rescreen' ? 'screening' : 'monitoring');
    const rec = prev ? N.copyFrom(prev, U.today(), proc) : Object.assign(N.empty(resident.id, U.today()), { process: proc, heightCm: resident.heightCm });
    if (!prev && resident.heightCm) rec.body.heightCm = resident.heightCm;
    X.edit(resident, rec, {});
  };

  // ---------- 一覧 ----------
  App.registerScreen('ncm', async function (params, root) {
    const m = ms(), today = U.today();
    const residents = (await DB.residents()).filter((r) => !r.archived);
    const recs = await X.all();
    const cats = V.ncmCats();
    const inHouse = residents.filter((r) => M.status(r, today, m.meals) === 'in' && cats.indexOf(r.category) >= 0);
    const others = residents.filter((r) => M.status(r, today, m.meals) === 'in' && cats.indexOf(r.category) < 0);
    const rows = inHouse.map((r) => Object.assign({ resident: r }, N.nextDue(r, recs, m, today)))
      .map((x) => Object.assign(x, { daysLeft: M.dayNum(x.due) - M.dayNum(today) }))
      .sort((a, b) => a.daysLeft - b.daysLeft);
    const over = rows.filter((x) => x.daysLeft < 0), soon = rows.filter((x) => x.daysLeft >= 0 && x.daysLeft <= 7);

    root.appendChild(h('header', { class: 'topbar' }, h('h1', null, '栄養ケア・マネジメント'),
      h('div', { class: 'no-print' }, h('button', { class: 'btn', onclick: () => window.print() }, '一覧を印刷'))));
    root.appendChild(h('div', { class: 'sub' }, '在籍 ' + inHouse.length + ' 人　期限切れ ' + over.length + ' 人　7日以内 ' + soon.length + ' 人'));
    if (others.length) root.appendChild(h('div', { class: 'sub' }, '対象外の区分（' +
      others.map((r) => V.catLabel(r)).filter((v, i, a) => a.indexOf(v) === i).join('・') + '）の ' + others.length + ' 人は出していません。対象は 設定 → 呼び方（マスタ）→ 利用者の区分 で変えられます。'));
    if (!inHouse.length) { root.appendChild(h('div', { class: 'empty' }, cats.length ? '対象になる方が在籍していません。' : '栄養ケアの対象になる区分が設定されていません（設定 → 呼び方（マスタ）→ 利用者の区分）。')); return; }

    root.appendChild(h('table', { class: 'list bordered' },
      h('thead', null, h('tr', null, ['場所', '氏名', '前回', '前回のリスク', '次の期限', '次にやること', ''].map((t) => h('th', null, t)))),
      h('tbody', null, rows.map((x) => {
        const lv = N.LEVELS.find((l) => l.id === x.lastLevel);
        const cls = x.daysLeft < 0 ? 'bad-text' : (x.daysLeft <= 7 ? 'warn-text' : '');
        return h('tr', null,
          h('td', null, V.where(x.resident)),
          h('td', null, h('a', { href: '#/resident/' + x.resident.id }, x.resident.name)),
          h('td', { class: 'sub' }, x.last ? U.fmtDate(x.last.date, true) + ' ' + label(N.PROCESS, x.last.process) : 'まだ'),
          h('td', null, lv ? h('span', { class: 'badge ' + (x.lastLevel === 'high' ? 'bad' : x.lastLevel === 'mid' ? 'warn' : 'ok') }, lv.label) : h('span', { class: 'sub' }, '—')),
          h('td', { class: cls }, U.fmtDate(x.due, true) + (x.daysLeft < 0 ? '（' + (-x.daysLeft) + '日超過）' : x.daysLeft === 0 ? '（今日）' : '（あと' + x.daysLeft + '日）')),
          h('td', { class: 'sub' }, x.reason),
          h('td', { class: 'no-print' }, h('button', { class: 'btn ' + (x.daysLeft <= 7 ? 'primary' : ''), onclick: () => X.start(x.resident, x.kind) }, '入力する')));
      }))));
    root.appendChild(h('div', { class: 'sub' }, '期限は 設定 → 栄養ケアの期限 で変えられます。中リスクの間隔は通知に数値が無く、施設が計画書に定めます。'));
  });

  // 個人画面の欄
  window.Residents.registerSection({ order: 5, render: async function (r) {
    const m = ms(), recs = await X.ofResident(r.id);
    if (V.ncmCats().indexOf(r.category) < 0 && !recs.length) return null; // 対象外の区分は、記録が無ければ欄を出さない
    const due = N.nextDue(r, recs, m, U.today());
    const left = M.dayNum(due.due) - M.dayNum(U.today());
    const lv = N.LEVELS.find((l) => l.id === (recs[0] && recs[0].level));
    return h('section', { class: 'card' },
      h('div', { class: 'sec-head' }, h('h2', null, '栄養ケア・マネジメント ',
        lv ? h('span', { class: 'badge ' + (lv.id === 'high' ? 'bad' : lv.id === 'mid' ? 'warn' : 'ok') }, lv.label + 'リスク') : null),
        h('button', { class: 'btn primary no-print', onclick: () => X.start(r, due.kind) }, '記録を付ける')),
      h('div', { class: left < 0 ? 'bad-text' : left <= 7 ? 'warn-text' : 'sub' },
        '次の期限: ' + U.fmtDate(due.due, true) + (left < 0 ? '（' + (-left) + '日超過）' : '（あと' + left + '日）') + '　' + due.reason),
      recs.length ? h('table', { class: 'list' },
        h('thead', null, h('tr', null, ['実施日', '種類', 'リスク', '体重', '摂取量', '総合評価', ''].map((t) => h('th', null, t)))),
        h('tbody', null, recs.slice(0, 8).map((x) => h('tr', null,
          h('td', null, U.fmtDate(x.date, true)), h('td', null, label(N.PROCESS, x.process)),
          h('td', null, label(N.LEVELS, x.level)),
          h('td', null, x.body.weightKg ? x.body.weightKg + 'kg' : '—'),
          h('td', null, x.intake.pct != null ? x.intake.pct + '%' : '—'),
          h('td', null, label(N.EVAL, x.evaluation)),
          h('td', { class: 'no-print' }, h('button', { class: 'btn small', onclick: () => X.edit(r, x, {}) }, '開く'))))))
        : h('div', { class: 'empty' }, 'まだ記録がありません。'));
  } });

  // 今日やること
  App.registerTodo(async function (ctx) {
    const m = ms();
    const recs = await X.all();
    const cats = V.ncmCats();
    const list = N.dueList(ctx.residents.filter((r) => cats.indexOf(r.category) >= 0), recs, m, ctx.today, 3);
    const over = list.filter((x) => x.daysLeft < 0);
    const out = [];
    if (over.length) out.push({ level: 'bad', text: '栄養ケアの期限が過ぎています: ' + over.map((x) => x.resident.name).join('、'), href: '#/ncm' });
    const soon = list.filter((x) => x.daysLeft >= 0);
    if (soon.length) out.push({ level: 'warn', text: '栄養ケアの期限が近い人: ' + soon.map((x) => x.resident.name + '（' + (x.daysLeft === 0 ? '今日' : 'あと' + x.daysLeft + '日') + '）').join('、'), href: '#/ncm' });
    return out;
  });

  // 設定
  App.registerSettings({ order: 45, title: '栄養ケアの期限', render: function () {
    const m = ms();
    m.ncm = Object.assign({}, N.DEFAULT_INTERVALS, m.ncm || {});
    const num = (key) => h('input', { class: 'input num', type: 'number', min: '1', value: m.ncm[key],
      onchange: async (e) => { m.ncm[key] = parseInt(e.target.value, 10) || N.DEFAULT_INTERVALS[key]; await window.Master.save(); } });
    return h('div', { class: 'card' },
      h('div', { class: 'sub' }, '厚生労働省の通知にある間隔が入っています。中リスクだけは通知に数値が無く、施設が計画書に定めることになっています。'),
      h('div', { class: 'grid3' },
        U.field('最初のスクリーニング（入所から何日以内）', num('firstWithin')),
        U.field('低リスクのモニタリング（日）', num('low')),
        U.field('中リスクのモニタリング（日）', num('mid')),
        U.field('高リスクのモニタリング（日）', num('high')),
        U.field('再スクリーニング（全員・日）', num('rescreen')),
        U.field('計画書の見直しの目安（日）', num('planReview'), '通知に数値はありません。施設の運用に合わせます')));
  } });

  // やること一覧の列
  if (window.Board) window.Board.registerColumn({
    order: 10, id: 'ncm', feature: 'ncm', label: '栄養ケア',
    prepare: async function (ctx) { ctx.ncmRecs = await X.all(); ctx.ncmCats = V.ncmCats(); },
    cell: function (r, ctx) {
      if (ctx.ncmCats.indexOf(r.category) < 0) return { text: '—', state: 'none' };
      const d = N.nextDue(r, ctx.ncmRecs, ctx.m, ctx.today);
      const left = M.dayNum(d.due) - M.dayNum(ctx.today);
      return {
        text: left < 0 ? (-left) + '日超過' : (left === 0 ? '今日' : 'あと' + left + '日'),
        sub: U.fmtDate(d.due) + (d.lastLevel ? '・' + label(N.LEVELS, d.lastLevel) + 'リスク' : '・初回'),
        state: left < 0 ? 'over' : (left <= 7 ? 'soon' : 'ok'),
        onclick: () => X.start(r, d.kind)
      };
    }
  });

  App.registerNav({ order: 25, feature: 'ncm', label: '栄養ケア', icon: '📝', hash: '#/ncm', match: ['ncm'] });
  window.Ncm = X;
})();
