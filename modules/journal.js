// 検食簿・給食日誌（削除可能）: 毎日つける 2 つの帳票。daily ストア（日付が鍵）に相乗りする。
// 検食簿の項目（実施年月日・朝昼夕別・検食時間・所見・検食者名・施設長決裁）と
// 給食日誌の項目（食数・職員出勤状況・特記事項）は、横浜市の手引きの帳票一覧に合わせた（調査 02 の 5.2）。
// 施設ごとに見る観点が違うので、欄の名前と並びは 設定 → 検食簿・給食日誌の欄 で直せるようにしてある。
// 検食は調理従事者以外が行い、施設長の決裁欄を置くのが通例（調査 03）。検印欄は印刷にだけ出る。
(function () {
  'use strict';
  const U = window.U, h = U.h, DB = window.DB, M = window.Model, V = window.View, App = window.App;
  const ms = () => window.Master.current;
  const J = {};

  // 欄立ての初期値。kind: 'scale'=5段階 / 'text'=自由記入
  J.DEFAULT_FORM = {
    kenshoku: [
      { id: 'amount', label: '量', kind: 'scale' },
      { id: 'taste', label: '味付け', kind: 'scale' },
      { id: 'temp', label: '温度', kind: 'scale' },
      { id: 'look', label: '彩り・盛り付け', kind: 'scale' },
      { id: 'hard', label: 'かたさ・飲み込みやすさ', kind: 'scale' },
      { id: 'hygiene', label: '衛生面（異物・におい）', kind: 'scale' },
      { id: 'note', label: '所見', kind: 'text' }
    ],
    scale: ['良い', 'やや良い', '普通', 'やや悪い', '悪い'],
    nisshi: [
      { id: 'weather', label: '天候', kind: 'text' },
      { id: 'staff', label: '職員の出勤状況', kind: 'text' },
      { id: 'delivery', label: '納品・検収', kind: 'text' },
      { id: 'leftover', label: '残食の状況', kind: 'text' },
      { id: 'special', label: '特記事項（事故・苦情・行事）', kind: 'text' }
    ],
    stamps: ['作成者', '栄養士', '施設長']  // 印刷に出る検印欄
  };
  J.form = function () {
    const m = ms();
    const f = m.journalForm || {};
    return {
      kenshoku: (f.kenshoku && f.kenshoku.length) ? f.kenshoku : J.DEFAULT_FORM.kenshoku,
      scale: (f.scale && f.scale.length) ? f.scale : J.DEFAULT_FORM.scale,
      nisshi: (f.nisshi && f.nisshi.length) ? f.nisshi : J.DEFAULT_FORM.nisshi,
      stamps: (f.stamps && f.stamps.length) ? f.stamps : J.DEFAULT_FORM.stamps
    };
  };

  J.get = async function (date) {
    const rec = (await DB.get('daily', date)) || { date: date, extra: {} };
    rec.kenshoku = rec.kenshoku || {};   // 食事ID → { at, by, values:{欄ID:値} }
    rec.nisshi = rec.nisshi || {};       // 欄ID → 文字列
    return rec;
  };
  J.save = (rec) => DB.put('daily', rec);
  J.done = function (rec, mealId) {
    const k = rec.kenshoku && rec.kenshoku[mealId];
    if (!k) return false;
    return !!(k.by || k.at || Object.keys(k.values || {}).some((x) => k.values[x]));
  };

  // ---- 画面 ----
  App.registerScreen('journal', async function (params, root) {
    const date = params[0] || U.today();
    const m = ms(), meals = M.activeMeals(m), form = J.form();
    const rec = await J.get(date);
    const residents = await DB.residents();
    const cens = meals.map((ml) => ({ ml: ml, c: M.census(residents, { d: date, m: ml.id }, m) }));

    root.appendChild(h('header', { class: 'topbar' }, h('h1', null, '検食簿・給食日誌　' + U.fmtDate(date, true)),
      h('div', { class: 'no-print' }, h('button', { class: 'btn', onclick: () => window.print() }, '印刷'), ' ',
        h('a', { class: 'btn', href: '#/journallist/' + date.slice(0, 7) }, '1 か月ぶん'))));
    root.appendChild(V.dateBar(date, (d) => App.go('#/journal/' + d)));

    // ---- 検食簿 ----
    const ken = h('section', { class: 'card' }, h('h2', null, '検食簿'));
    ken.appendChild(h('div', { class: 'sub no-print' }, '検食は調理に関わっていない人が、利用者に出す前に食べて確かめる決まりです。' +
        '欄の名前は 設定 → 検食簿・給食日誌の欄 で直せます。'));
    meals.forEach((ml) => {
      const k = rec.kenshoku[ml.id] = rec.kenshoku[ml.id] || { at: '', by: '', values: {} };
      const put = async () => { await J.save(rec); };
      const at = h('input', { class: 'input', type: 'time', value: k.at || '' });
      at.addEventListener('change', async () => { k.at = at.value; await put(); });
      const by = h('input', { class: 'input', type: 'text', value: k.by || '', placeholder: '検食者名' });
      by.addEventListener('change', async () => { k.by = by.value.trim(); await put(); });
      const rows = form.kenshoku.map((f) => {
        let el;
        if (f.kind === 'scale') {
          el = h('div', { class: 'segrow' }, form.scale.map((s) => {
            const b = h('button', { type: 'button', class: 'btn seg small' + (k.values[f.id] === s ? ' on' : ''),
              onclick: async () => { k.values[f.id] = (k.values[f.id] === s ? '' : s); await put(); App.refresh(); } }, s);
            return b;
          }));
        } else {
          const t = h('textarea', { class: 'input', rows: '2' }, k.values[f.id] || '');
          t.addEventListener('change', async () => { k.values[f.id] = t.value; await put(); });
          el = withPhrase('journal.kenshoku', t);
        }
        return h('tr', null, h('th', null, f.label), h('td', null, el));
      });
      ken.appendChild(h('div', { class: 'card sub-card' },
        h('h3', null, ml.label, J.done(rec, ml.id) ? null : h('span', { class: 'sub' }, '　未記入')),
        h('div', { class: 'grid2' }, U.field('検食時間', at), U.field('検食者名', by)),
        h('table', { class: 'list' }, h('tbody', null, rows))));
    });
    root.appendChild(ken);

    // ---- 給食日誌 ----
    const nis = h('section', { class: 'card' }, h('h2', null, '給食日誌'));
    nis.appendChild(h('div', null, h('b', null, 'この日の食数　'),
      cens.map((x) => h('span', { class: 'tag' }, x.ml.label + ' ' + x.c.total + ' 食')),
      ' ', h('a', { class: 'btn small no-print', href: '#/census/' + date }, '食数の画面')));
    const nrows = form.nisshi.map((f) => {
      const t = h('textarea', { class: 'input', rows: '2' }, rec.nisshi[f.id] || '');
      t.addEventListener('change', async () => { rec.nisshi[f.id] = t.value; await J.save(rec); });
      return h('tr', null, h('th', null, f.label), h('td', null, withPhrase('journal.nisshi', t)));
    });
    nis.appendChild(h('table', { class: 'list' }, h('tbody', null, nrows)));
    root.appendChild(nis);

    // ---- 検印欄（印刷にだけ出る）----
    root.appendChild(h('table', { class: 'stamps print-only' }, h('tbody', null,
      h('tr', null, form.stamps.map((s) => h('th', null, s))),
      h('tr', null, form.stamps.map(() => h('td', null, ' '))))));
  });

  function withPhrase(key, target) {
    try { return U.withPhrases(key, target); } catch (e) { return target; }
  }

  // ---- 1 か月ぶんの一覧（つけ忘れを見つける）----
  App.registerScreen('journallist', async function (params, root) {
    const ym = params[0] || U.today().slice(0, 7);
    const m = ms(), meals = M.activeMeals(m);
    const days = window.Report ? window.Report.daysOf(ym) : [];
    const recs = {};
    (await DB.getAll('daily')).forEach((x) => { if (x.date && x.date.slice(0, 7) === ym) recs[x.date] = x; });
    const prev = window.Report ? window.Report.addMonth(ym, -1) : ym, next = window.Report ? window.Report.addMonth(ym, 1) : ym;
    root.appendChild(h('header', { class: 'topbar' }, h('h1', null, '検食簿・給食日誌　' + ym.replace('-', '年') + '月'),
      h('div', { class: 'no-print' }, h('button', { class: 'btn', onclick: () => window.print() }, '印刷'))));
    root.appendChild(h('div', { class: 'toolrow no-print' },
      h('a', { class: 'btn', href: '#/journallist/' + prev }, '◀ 前月'),
      h('a', { class: 'btn', href: '#/journallist/' + U.today().slice(0, 7) }, '今月'),
      h('a', { class: 'btn', href: '#/journallist/' + next }, '次月 ▶')));
    let miss = 0;
    const body = days.map((d) => {
      const rec = recs[d];
      const r = rec ? { kenshoku: rec.kenshoku || {}, nisshi: rec.nisshi || {} } : { kenshoku: {}, nisshi: {} };
      const nisshiFilled = Object.keys(r.nisshi).some((k) => r.nisshi[k]);
      const past = d <= U.today();
      return h('tr', { class: [0, 6].indexOf(M.weekday(d)) >= 0 ? 'weekend' : '' },
        h('th', null, h('a', { href: '#/journal/' + d }, U.fmtDate(d, true))),
        meals.map((ml) => {
          const ok = J.done(r, ml.id);
          if (!ok && past) miss++;
          return h('td', { class: ok ? 'j-done' : (past ? 'j-high' : '') }, ok ? '○' : (past ? '未' : ''));
        }),
        h('td', { class: nisshiFilled ? 'j-done' : (past ? 'j-high' : '') }, nisshiFilled ? '○' : (past ? '未' : '')));
    });
    root.appendChild(h('div', { class: 'scroll-x' }, h('table', { class: 'list bordered' },
      h('thead', null, h('tr', null, [h('th', null, '日')].concat(meals.map((ml) => h('th', null, ml.label + 'の検食'))).concat([h('th', null, '給食日誌')]))),
      h('tbody', null, body))));
    root.appendChild(h('div', { class: 'sub' }, miss ? ('今日までで ' + miss + ' 件つけていません。') : '今日までのぶんは全部つけてあります。'));
  });

  // 今日やること
  App.registerTodo(async function (ctx) {
    const m = ms(), meals = M.activeMeals(m);
    const rec = await J.get(ctx.today);
    const yet = meals.filter((ml) => !J.done(rec, ml.id));
    if (!yet.length) return [];
    return [{ level: 'info', text: '検食簿がまだ: ' + yet.map((x) => x.label).join('・'), href: '#/journal/' + ctx.today }];
  });

  // ---- 設定: 欄の名前と並び ----
  App.registerSettings({ order: 46, title: '検食簿・給食日誌の欄', render: function () {
    const m = ms();
    m.journalForm = m.journalForm || JSON.parse(JSON.stringify(J.DEFAULT_FORM));
    const f = m.journalForm;
    ['kenshoku', 'nisshi', 'scale', 'stamps'].forEach((k) => { if (!f[k] || !f[k].length) f[k] = JSON.parse(JSON.stringify(J.DEFAULT_FORM[k])); });
    const box = h('div');
    function listEditor(key, title, hint) {
      const wrap = h('div', { class: 'card sub-card' }, h('h3', null, title), hint ? h('div', { class: 'sub' }, hint) : null);
      const tb = h('tbody');
      const draw = () => {
        tb.innerHTML = '';
        f[key].forEach((it, i) => {
          const label = h('input', { class: 'input', type: 'text', value: it.label });
          label.addEventListener('change', async () => { it.label = label.value.trim() || it.label; await window.Master.save(); });
          const kind = U.select([{ id: 'scale', label: '5 段階' }, { id: 'text', label: '自由記入' }], it.kind || 'text',
            { noEmpty: true, onchange: async (e) => { it.kind = e.target.value; await window.Master.save(); } });
          tb.appendChild(h('tr', null, h('td', null, label), h('td', null, kind),
            h('td', null,
              h('button', { class: 'btn small', disabled: i === 0, onclick: async () => { const x = f[key].splice(i, 1)[0]; f[key].splice(i - 1, 0, x); await window.Master.save(); draw(); } }, '▲'),
              h('button', { class: 'btn small', disabled: i === f[key].length - 1, onclick: async () => { const x = f[key].splice(i, 1)[0]; f[key].splice(i + 1, 0, x); await window.Master.save(); draw(); } }, '▼'),
              h('button', { class: 'btn small', onclick: async () => {
                if (!await U.confirm('「' + it.label + '」の欄を消します。入力済みの記録は残りますが、画面に出なくなります。', { okLabel: '消す', danger: true })) return;
                f[key].splice(i, 1); await window.Master.save(); draw();
              } }, '消す'))));
        });
      };
      draw();
      const add = h('input', { class: 'input', type: 'text', placeholder: '新しい欄の名前' });
      const doAdd = async () => {
        const v = add.value.trim(); if (!v) return;
        f[key].push({ id: U.uid('jf'), label: v, kind: 'text' });
        add.value = ''; await window.Master.save(); draw();
      };
      add.addEventListener('keydown', (e) => { if (e.key === 'Enter') doAdd(); });
      wrap.appendChild(h('table', { class: 'list edit' }, h('thead', null, h('tr', null, ['欄の名前', '入れ方', ''].map((t) => h('th', null, t)))), tb));
      wrap.appendChild(h('div', { class: 'toolrow' }, add, h('button', { class: 'btn', onclick: doAdd }, '足す')));
      return wrap;
    }
    function wordsEditor(key, title, hint) {
      const editor = U.chipList(f[key], [], '入力して Enter');
      const wrap = h('div', { class: 'card sub-card' }, h('h3', null, title), h('div', { class: 'sub' }, hint), editor,
        h('button', { class: 'btn', onclick: async () => { f[key] = editor.get(); await window.Master.save(); U.toast('保存しました'); } }, '保存'));
      return wrap;
    }
    box.appendChild(listEditor('kenshoku', '検食簿の欄', '「5 段階」を選ぶと、下の言葉のボタンで押して選べます。'));
    box.appendChild(wordsEditor('scale', '5 段階の言葉', '検食簿で押して選ぶ言葉。良い順に並べてください。'));
    box.appendChild(listEditor('nisshi', '給食日誌の欄'));
    box.appendChild(wordsEditor('stamps', '検印欄', '印刷したときに用紙の下に出る欄。押印や署名をもらう人を並べます。'));
    return h('div', null, h('div', { class: 'sub' }, '帳票の言葉を施設の様式に合わせられます。'), box,
      h('button', { class: 'btn danger-outline', onclick: async () => {
        if (!await U.confirm('欄の名前と並びを最初の状態に戻します。', { okLabel: '戻す', danger: true })) return;
        m.journalForm = JSON.parse(JSON.stringify(J.DEFAULT_FORM)); await window.Master.save(); App.refresh();
      } }, '最初の状態に戻す'));
  } });

  App.registerNav({ order: 77, feature: 'reports', label: '検食', icon: '🍽', hash: '#/journal', match: ['journal', 'journallist'] });
  window.Journal = J;
})();
