// 食品を調べる（削除可能）＋ 栄養価の表示部品。成分表は js/foods_data.js を読み込んだときだけ動く。
(function () {
  'use strict';
  const U = window.U, h = U.h, N = window.Nutri, App = window.App;
  const ms = () => window.Master.current;
  const F = {};
  let q = '', group = '';

  // 画面に出す栄養素の並び（設定で変えられる）
  F.SETS = {
    basic: ['kcal', 'prot', 'fat', 'cho', 'fib', 'nacl'],
    main: ['kcal', 'prot', 'fat', 'cho', 'fib', 'nacl', 'ca', 'fe', 'vita', 'vitb1', 'b1', 'b2', 'vitc'],
    all: null
  };
  F.shownKeys = function () {
    const m = ms();
    const k = (m.nutrientKeys && m.nutrientKeys.length) ? m.nutrientKeys : F.SETS.basic;
    return k.filter((x) => N.key[x] != null);
  };
  F.nutrient = (key) => N.nutrients[N.key[key]] || { key: key, name: key, unit: '' };

  // 一覧に出す短い食品名。分類の括り（＜魚類＞ ［水稲めし］ （さけ・ます類））を落とす
  F.shortName = function (name) {
    const parts = String(name || '').replace(/　/g, ' ').split(/\s+/).filter(Boolean)
      .filter((w) => !/^[＜(（[［].*[＞)）\]］]$/.test(w));
    return parts.join(' ') || String(name || '');
  };

  // 成分の値を 1 つ表示（未測定・微量・推定を記号で示す）
  F.cell = function (food, key) {
    const v = N.val(food, key), fl = N.flag(food, key);
    if (v == null) return h('span', { class: 'sub', title: '未測定' }, '−');
    const t = N.fmt(key, v);
    if (fl === 't' || fl === 'T') return h('span', { title: '微量（Tr）' }, 'Tr');
    if (fl === 'e') return h('span', { class: 'est', title: '推定値・計算値' }, '(' + t + ')');
    return h('span', null, t);
  };

  // 合計（料理・献立）の 1 行表示。target があれば下限未満は青、上限超えは赤（市販ソフトの見せ方に合わせた）
  F.sumRow = function (sum, keys, target) {
    return h('div', { class: 'nutri-row' }, keys.map((k) => {
      const nu = F.nutrient(k), v = sum.values[k];
      const j = target ? N.judge(target, k, v) : null;
      const miss = sum.missing && sum.missing[k] && sum.missing[k].length;
      return h('span', { class: 'nutri-chip' + (j ? ' j-' + j : ''), title: (nu.name + (miss ? '（未測定の食品が ' + miss + ' 件あるので、実際はもう少し多い可能性があります）' : '')) },
        h('span', { class: 'nk' }, nu.name), h('b', null, N.fmt(k, v)), h('span', { class: 'nu' }, nu.unit), miss ? h('span', { class: 'warn-text' }, '＊') : null);
    }));
  };
  // 目標と見比べる表
  F.targetTable = function (sum, target, keys) {
    return h('table', { class: 'list bordered' },
      h('thead', null, h('tr', null, ['栄養素', '提供量', '目標', ''].map((t) => h('th', null, t)))),
      h('tbody', null, keys.map((k) => {
        const nu = F.nutrient(k), v = sum.values[k], r = target && target[k], j = N.judge(target, k, v);
        const range = !r ? '—' : (r[0] != null ? r[0] : '') + ' 〜 ' + (r[1] != null ? r[1] : '');
        return h('tr', null, h('td', null, nu.name), h('td', { class: j ? 'j-' + j : '' }, N.fmt(k, v) + ' ' + nu.unit),
          h('td', { class: 'sub' }, range), h('td', null, j === 'low' ? h('span', { class: 'tag' }, '下限より少ない') : j === 'high' ? h('span', { class: 'tag bad' }, '上限より多い') : ''));
      })));
  };

  // 食品を選ぶ（料理の材料を足すときに使う）→ Promise<{no, name} | null>
  F.pick = function () {
    return new Promise((resolve) => {
      let close;
      const input = h('input', { class: 'input', type: 'search', placeholder: '食品の名前（例: にんじん、鶏 むね、こめ めし）', value: '' });
      const list = h('div', { class: 'picklist' });
      const draw = () => {
        const rows = N.search(input.value, { limit: 80 });
        list.innerHTML = '';
        if (!input.value.trim()) { list.appendChild(h('div', { class: 'sub' }, '名前の一部を入れてください。ひらがなでも探せます。')); return; }
        if (!rows.length) { list.appendChild(h('div', { class: 'empty' }, '見つかりません。成分表の名前は「こめ／[水稲めし]／精白米」のように分かれています。語を短くしてみてください。')); return; }
        rows.forEach((f) => list.appendChild(h('button', { class: 'pickitem', onclick: () => { close(); resolve({ no: f.no, name: f.name }); } },
          h('span', { class: 'pi-name' }, f.name), h('span', { class: 'sub' }, f.groupName + '　' + N.fmt('kcal', N.val(f, 'kcal')) + 'kcal / ' + N.fmt('prot', N.val(f, 'prot')) + 'g たんぱく質 / ' + N.fmt('nacl', N.val(f, 'nacl')) + 'g 食塩'))));
      };
      input.addEventListener('input', draw);
      setTimeout(() => input.focus(), 0);
      close = U.modal(h('div', null, h('h2', null, '食品をえらぶ'), input, list,
        h('div', { class: 'modal-btns' }, h('button', { class: 'btn', onclick: () => { close(); resolve(null); } }, 'やめる'))), { wide: true });
      draw();
    });
  };

  App.registerScreen('foods', async function (params, root) {
    root.appendChild(h('header', { class: 'topbar' }, h('h1', null, '食品を調べる'),
      h('span', { class: 'sub' }, N.meta.title + '（' + N.count() + ' 食品）')));
    const input = h('input', { class: 'input', type: 'search', value: q, placeholder: '食品の名前（例: にんじん、さけ、こめ めし）' });
    const gsel = U.select(Object.keys(N.groups).map((g) => ({ id: g, label: g + ' ' + N.groups[g] })), group, { emptyLabel: '全部の食品群' });
    const box = h('div');
    const keys = F.shownKeys();
    const draw = () => {
      q = input.value; group = gsel.value;
      const rows = N.search(q, { group: group, limit: 200 });
      box.innerHTML = '';
      if (!q.trim() && !group) { box.appendChild(h('div', { class: 'sub' }, '名前の一部を入れるか、食品群をえらんでください。')); return; }
      box.appendChild(h('div', { class: 'sub' }, rows.length + ' 件' + (rows.length >= 200 ? '（多いので 200 件まで）' : '') + '　数値は可食部 100g 当たり'));
      box.appendChild(h('div', { class: 'scroll-x' }, h('table', { class: 'grid foods' },
        h('thead', null, h('tr', null, h('th', null, '食品番号'), h('th', null, '食品名'), keys.map((k) => h('th', null, F.nutrient(k).name, h('div', { class: 'wd' }, F.nutrient(k).unit))))),
        h('tbody', null, rows.map((f) => h('tr', null, h('td', { class: 'sub' }, f.no), h('th', null, f.name, f.remark ? h('div', { class: 'sub' }, f.remark) : null),
          keys.map((k) => h('td', null, F.cell(f, k)))))))));
    };
    input.addEventListener('input', draw);
    gsel.addEventListener('change', draw);
    root.appendChild(h('div', { class: 'toolrow no-print' }, input, gsel));
    root.appendChild(box);
    draw();
    root.appendChild(h('div', { class: 'sub credit' }, '−＝未測定（含まれている可能性があります）　Tr＝微量　( )＝推定値・計算値　／　' + N.meta.citation));
  });

  // 表示のプリセット（献ダテマン・メニューリンクが「ID ごとに表示設定を持つ」としている所。
  // 1 台・1 人で使う前提なので、名前を付けて切り替える形にした）
  F.presets = () => (ms().nutrientPresets || []);
  F.applyPreset = async function (name) {
    const p = F.presets().find((x) => x.name === name);
    if (!p) return;
    ms().nutrientKeys = p.keys.slice();
    ms().nutrientPresetNow = name;
    await window.Master.save();
    App.refresh();
  };
  F.savePreset = async function (name) {
    const m = ms();
    m.nutrientPresets = m.nutrientPresets || [];
    const cur = F.shownKeys();
    const found = m.nutrientPresets.find((x) => x.name === name);
    if (found) found.keys = cur.slice(); else m.nutrientPresets.push({ name: name, keys: cur.slice() });
    m.nutrientPresetNow = name;
    await window.Master.save();
  };

  App.registerSettings({ order: 35, title: '栄養価の表示', render: function () {
    const m = ms();
    const cur = F.shownKeys();
    const box = h('div', { class: 'pickgrid' }, N.nutrients.filter((x) => x.key !== 'refuse').map((x) => h('label', { class: 'check' },
      h('input', { type: 'checkbox', checked: cur.indexOf(x.key) >= 0, onchange: async (e) => {
        const l = (m.nutrientKeys && m.nutrientKeys.length ? m.nutrientKeys : F.SETS.basic).slice();
        const i = l.indexOf(x.key);
        if (e.target.checked && i < 0) l.push(x.key); else if (!e.target.checked && i >= 0) l.splice(i, 1);
        m.nutrientKeys = l; await window.Master.save();
      } }), ' ' + x.name + '（' + x.unit + '）')));
    const presetBox = h('div', { class: 'toolrow' });
    const drawPresets = () => {
      presetBox.innerHTML = '';
      presetBox.appendChild(h('span', { class: 'sub' }, '見せ方'));
      F.presets().forEach((p) => presetBox.appendChild(h('button', {
        class: 'btn seg small' + (m.nutrientPresetNow === p.name ? ' on' : ''),
        onclick: () => F.applyPreset(p.name) }, p.name + '（' + p.keys.length + '）')));
      const nameIn = h('input', { class: 'input', type: 'text', placeholder: '今の選び方に名前を付ける' });
      const add = async () => {
        const v = nameIn.value.trim();
        if (!v) return;
        await F.savePreset(v); U.toast('「' + v + '」として覚えました'); App.refresh();
      };
      nameIn.addEventListener('keydown', (e) => { if (e.key === 'Enter') add(); });
      presetBox.appendChild(nameIn);
      presetBox.appendChild(h('button', { class: 'btn small', onclick: add }, '覚える'));
      if (F.presets().length) presetBox.appendChild(h('button', { class: 'btn small', onclick: async () => {
        const cur = m.nutrientPresetNow;
        if (!cur) { U.toast('切り替えてから消してください', true); return; }
        if (!await U.confirm('「' + cur + '」を消します。', { okLabel: '消す', danger: true })) return;
        m.nutrientPresets = m.nutrientPresets.filter((x) => x.name !== cur);
        m.nutrientPresetNow = '';
        await window.Master.save(); App.refresh();
      } }, '今の見せ方を消す'));
    };
    drawPresets();
    return h('div', { class: 'card' }, h('div', { class: 'sub' }, '料理・献立・食品の画面に出す栄養素をえらびます。並びはこの一覧の順です。'),
      presetBox,
      h('div', { class: 'toolrow' },
        h('button', { class: 'btn', onclick: async () => { m.nutrientKeys = F.SETS.basic.slice(); await window.Master.save(); App.refresh(); } }, '基本の 6 つに戻す'),
        h('button', { class: 'btn', onclick: async () => { m.nutrientKeys = N.nutrients.filter((x) => x.key !== 'refuse').map((x) => x.key); await window.Master.save(); App.refresh(); } }, '全部出す')),
      box);
  } });

  App.registerNav({ order: 44, group: '献立と食材', feature: 'menu', label: '食品', icon: '🥕', hash: '#/foods', match: ['foods'] });
  window.Foods = F;
})();
