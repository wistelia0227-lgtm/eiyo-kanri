// 設定: 施設・締切・マスタ（呼び方は全部ここで変えられる）・食札の面付け・バックアップ・外した利用者。
(function () {
  'use strict';
  const U = window.U, h = U.h, DB = window.DB, M = window.Model, App = window.App;
  const ms = () => window.Master.current;
  const save = async (msg) => { await window.Master.save(); U.toast(msg || '保存しました'); };

  // マスタの項目が、利用者の食事情報で何件使われているか
  async function usage(key, id) {
    const field = { shokushu: ['shokushu'], staple: ['staple'], side: ['side'], thick: ['soupThick', 'drinkThick'], portion: ['portion'], assist: ['assist'] }[key];
    let n = 0;
    (await DB.residents()).forEach((r) => r.diet.forEach((v) => {
      const d = M.normalizeDiet(v.data);
      if (field && field.some((f) => d[f] === id || Object.values(d.byMeal).some((o) => o[f] === id))) n++;
      if (key === 'cond' && d.cond.some((c) => c.when === id)) n++;
      if (key === 'categories' && r.category === id) n++;
    }));
    return n;
  }

  // [{id,label,...}] の編集表。cols = 追加の列 [{key,label,type}]
  function listEditor(key, title, cols, hint) {
    const box = h('div');
    function draw() {
      const list = ms()[key];
      box.innerHTML = '';
      box.appendChild(h('table', { class: 'list edit' },
        h('thead', null, h('tr', null, h('th', null, '呼び方'), cols.map((c) => h('th', null, c.label)), h('th'))),
        h('tbody', null, list.map((it, i) => h('tr', null,
          h('td', null, h('input', { class: 'input', type: 'text', value: it.label, onchange: async (e) => { it.label = e.target.value.trim() || it.label; await save(); } })),
          cols.map((c) => h('td', null, c.type === 'check'
            ? h('input', { type: 'checkbox', checked: c.get ? c.get(it) : !!it[c.key], onchange: async (e) => { if (c.set) c.set(it, e.target.checked); else it[c.key] = e.target.checked; await save(); } })
            : h('input', { class: 'input' + (c.type === 'color' ? ' color' : c.type === 'number' ? ' num' : ''), type: c.type || 'text', value: (c.get ? c.get(it) : it[c.key]) == null ? '' : (c.get ? c.get(it) : it[c.key]),
              onchange: async (e) => { const v = c.type === 'number' ? (parseFloat(e.target.value) || 0) : e.target.value.trim(); if (c.set) c.set(it, v); else it[c.key] = v; await save(); } }))),
          h('td', { class: 'nowrap' },
            h('button', { class: 'btn small', disabled: i === 0, onclick: async () => { list.splice(i - 1, 0, list.splice(i, 1)[0]); await save(); draw(); } }, '↑'), ' ',
            h('button', { class: 'btn small', onclick: async () => {
              const n = await usage(key, it.id);
              if (!await U.confirm('「' + it.label + '」を消します。' + (n ? '今 ' + n + ' 件の記録で使われています。消すと、その記録では記号のまま表示されます。' : ''), { okLabel: '消す', danger: true })) return;
              list.splice(i, 1); await save(); draw();
            } }, '消す')))))));
      const add = h('input', { class: 'input', type: 'text', placeholder: '新しい呼び方を足す' });
      const doAdd = async () => { const v = add.value.trim(); if (!v) return; list.push({ id: U.uid('m'), label: v }); await save(); draw(); };
      add.addEventListener('keydown', (e) => { if (e.key === 'Enter') doAdd(); });
      box.appendChild(h('div', { class: 'toolrow' }, add, h('button', { class: 'btn', onclick: doAdd }, '足す')));
    }
    draw();
    return h('details', { class: 'card' }, h('summary', null, title), hint ? h('div', { class: 'sub' }, hint) : null, box);
  }
  function textListEditor(key, title) {
    const ta = h('textarea', { class: 'input', rows: '5' }, ms()[key].join('\n'));
    return h('details', { class: 'card' }, h('summary', null, title), h('div', { class: 'sub' }, '1 行に 1 つ。入力の候補に出ます。'), ta,
      h('button', { class: 'btn', onclick: async () => { ms()[key] = ta.value.split('\n').map((x) => x.trim()).filter(Boolean); await save(); } }, '保存'));
  }
  const CODE = { key: 'code', label: '学会分類2021 のコード' }, COLOR = { key: 'color', label: '食札の色', type: 'color' };

  App.registerSettings({ order: 10, title: '施設', render: function () {
    const m = ms();
    const name = h('input', { class: 'input', type: 'text', value: m.facility.name }), rec = h('input', { class: 'input', type: 'text', value: m.facility.recorder });
    const days = h('input', { class: 'input num', type: 'number', min: '0', value: m.deadline.daysBefore }), time = h('input', { class: 'input', type: 'time', value: m.deadline.time });
    const alert = h('input', { class: 'input num', type: 'number', step: '0.5', value: m.weightAlertKg });
    return h('div', { class: 'card' }, h('div', { class: 'grid2' }, U.field('施設名', name), U.field('いつも記録する人', rec),
      U.field('食数の締切（食事の何日前）', days), U.field('締切の時刻', time, '委託先・厨房への連絡の締切。過ぎてから入った変更を一覧にします'),
      U.field('体重の差を赤くする幅 (kg)', alert)),
      h('button', { class: 'btn primary', onclick: async () => {
        m.facility = { name: name.value.trim(), recorder: rec.value.trim() }; m.deadline = { daysBefore: parseInt(days.value, 10) || 0, time: time.value || '15:00' };
        m.weightAlertKg = parseFloat(alert.value) || 2; await save(); App.refresh();
      } }, '保存'));
  } });

  App.registerSettings({ order: 20, title: '呼び方（マスタ）', render: function () {
    const m = ms();
    return h('div', null,
      h('div', { class: 'sub' }, '施設の呼び方に合わせて直せます。呼び方を変えても、登録済みの利用者の記録はそのまま付いてきます。'),
      listEditor('meals', '食事の区分', [{ key: 'on', label: '使う', type: 'check', get: (it) => it.on !== false }], 'おやつの数も数える時は「使う」に印を付けます。'),
      listEditor('categories', '利用者の区分', []),
      listEditor('shokushu', '食種', [COLOR, { key: 'ryoyo', label: '療養食', type: 'check' }]),
      listEditor('staple', '主食', [CODE]), listEditor('side', '副食の形態', [CODE, COLOR]),
      listEditor('thick', 'とろみ', []), listEditor('portion', '量', []), listEditor('assist', '介助', []), listEditor('cond', '条件つきの指示の「条件」', []),
      listEditor('extraRows', '利用者以外の食事（食数表に足す行）', M.activeMeals(m).map((ml) => ({ key: ml.id, label: ml.label + 'の既定数', type: 'number',
        get: (it) => (it.def && it.def[ml.id]) || 0, set: (it, v) => { it.def = it.def || {}; it.def[ml.id] = v; } })), '毎日ほぼ同じ数なら既定数を入れておきます。日ごとの数は「今日」や食数の日別画面で直せます。'),
      textListEditor('units', 'ユニット・フロア'), textListEditor('tools', '食器・自助具'), textListEditor('allergens', 'アレルギーの候補'),
      textListEditor('sources', '指示・依頼した人'), textListEditor('absenceReasons', '欠食の理由'));
  } });

  App.registerSettings({ order: 30, title: '食札', render: function () {
    const m = ms();
    const by = U.select([{ id: 'side', label: '副食の形態で色分け' }, { id: 'shokushu', label: '食種で色分け' }], m.cardColorBy, { noEmpty: true, onchange: async (e) => { m.cardColorBy = e.target.value; await save(); } });
    const F = [['cols', '列'], ['rows', '段'], ['w', '幅mm'], ['h', '高さmm'], ['mt', '上の余白mm'], ['ml', '左の余白mm'], ['gx', '横のすき間mm'], ['gy', '縦のすき間mm']];
    return h('div', { class: 'card' }, U.field('色分け', by),
      h('div', { class: 'sub' }, '面付け（A4 縦）。印刷がずれる時は上・左の余白を 0.5mm ずつ直してください。'),
      h('div', { class: 'scroll-x' }, h('table', { class: 'list edit' }, h('thead', null, h('tr', null, h('th', null, '名前'), F.map((f) => h('th', null, f[1])))),
        h('tbody', null, m.cardLayouts.map((l) => h('tr', null, h('td', null, l.label),
          F.map((f) => h('td', null, h('input', { class: 'input num', type: 'number', step: '0.5', value: l[f[0]], onchange: async (e) => { l[f[0]] = parseFloat(e.target.value) || 0; await save(); } })))))))));
  } });

  App.registerSettings({ order: 40, title: '低栄養リスクの判定値', render: function () {
    const t = ms().risk;
    const num = (obj, key) => h('input', { class: 'input num', type: 'number', step: '0.1', value: obj[key], onchange: async (e) => { obj[key] = parseFloat(e.target.value); await save(); } });
    return h('div', { class: 'card' }, h('div', { class: 'sub' }, '厚生労働省の様式例（令和6年度）の基準が入っています。基準が変わったらここを直します。画面のリスクは目安で、最終の判断は人が行います。'),
      h('table', { class: 'list edit' }, h('thead', null, h('tr', null, ['項目', '中リスク', '高リスク'].map((x) => h('th', null, x)))), h('tbody', null,
        h('tr', null, h('td', null, 'BMI（未満）'), h('td', null, num(t, 'bmiMid')), h('td', null, '—')),
        [['m1', '1か月'], ['m3', '3か月'], ['m6', '6か月']].map((k) => h('tr', null, h('td', null, '体重減少率 ' + k[1] + '（% 以上）'), h('td', null, num(t.loss[k[0]], 'mid')), h('td', null, num(t.loss[k[0]], 'high')))),
        h('tr', null, h('td', null, '血清アルブミン（g/dl）'), h('td', null, num(t, 'albMid'), ' 以下'), h('td', null, num(t, 'albHigh'), ' 未満')),
        h('tr', null, h('td', null, '食事摂取量（% 以下）'), h('td', null, num(t, 'intakeMid')), h('td', null, '—')))));
  } });

  App.registerSettings({ order: 80, title: 'バックアップ', render: function () {
    return h('div', { class: 'card' }, h('div', { class: 'sub' }, 'データはこのパソコンのこのブラウザの中にあります。閲覧データを消すと一緒に消えるので、定期的にファイルへ保存してください。'),
      h('div', { class: 'toolrow' },
        h('button', { class: 'btn primary', onclick: async () => { U.download('栄養食事管理_バックアップ_' + U.today() + '.json', JSON.stringify(await DB.exportAll())); await DB.setMeta('lastBackup', Date.now()); App.refresh(); } }, 'ファイルに保存する'),
        h('button', { class: 'btn', onclick: async () => {
          const text = await U.pickFile('.json'); if (!text) return;
          let data; try { data = JSON.parse(text); } catch (e) { U.toast('ファイルを読めませんでした', true); return; }
          if (!await U.confirm('今のデータを、選んだファイルの内容（' + (data.exportedAt || '').slice(0, 10) + ' 保存、利用者 ' + ((data.stores && data.stores.residents) || []).length + ' 人）で置き換えます。', { okLabel: '置き換える', danger: true })) return;
          try { await DB.importAll(data); await window.Master.load(); U.toast('読み込みました'); App.go('#/home'); } catch (e) { U.toast(e.message, true); }
        } }, 'ファイルから戻す')));
  } });

  App.registerSettings({ order: 90, title: '一覧から外した利用者', render: async function () {
    const list = (await DB.residents()).filter((r) => r.archived);
    return h('div', { class: 'card' }, list.length ? list.map((r) => h('div', { class: 'rowline' }, h('span', null, r.name), h('button', { class: 'btn small', onclick: async () => { r.archived = false; await DB.put('residents', r); App.refresh(); } }, '一覧に戻す'))) : h('div', { class: 'empty' }, 'いません。'));
  } });

  App.registerScreen('settings', async function (params, root) {
    root.appendChild(h('header', { class: 'topbar' }, h('h1', null, '設定')));
    const last = await DB.getMeta('lastBackup', 0);
    if (!last || Date.now() - last > 14 * 86400000) root.appendChild(h('div', { class: 'card warn' }, last ? '最後のバックアップから 2 週間以上たっています（' + U.fmtDateTime(last) + '）。' : 'まだ一度もバックアップしていません。'));
    for (const sec of App.settings) { root.appendChild(h('h2', { class: 'sec' }, sec.title)); root.appendChild(await sec.render()); }
  });
  App.registerNav({ order: 90, label: '設定', icon: '⚙️', hash: '#/settings', match: ['settings'] });
})();
