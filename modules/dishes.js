// 料理マスタ（削除可能）: 材料と重量から 1 人分の栄養価を出す。献立はこの料理を並べて作る。
// dishes ストア: { id, name, kana, kind:'主食'等, servings, items:[{no,name,g}], allergy:[], memo, cost }
(function () {
  'use strict';
  const U = window.U, h = U.h, DB = window.DB, N = window.Nutri, Foods = window.Foods, App = window.App;
  const ms = () => window.Master.current;
  const D = {};
  let q = '', kind = '';

  D.sumOf = function (dish) {
    const s = N.sum(dish.items || []);
    const per = Math.max(1, Number(dish.servings) || 1);
    return N.scale(s, 1 / per); // 1 人分
  };
  D.normalize = function (d) {
    d.kana = d.kana || ''; d.kind = d.kind || ''; d.servings = d.servings || 1;
    d.items = d.items || []; d.allergy = d.allergy || []; d.memo = d.memo || '';
    return d;
  };
  D.all = async function () { return (await DB.getAll('dishes')).map(D.normalize); };

  // 材料に含まれるアレルギー品目を、名前の一致で拾って候補にする（判定は人が確かめる）
  D.suggestAllergy = function (items) {
    const words = ms().allergens;
    const hit = [];
    (items || []).forEach((it) => { words.forEach((w) => { if (it.name && it.name.indexOf(w) >= 0 && hit.indexOf(w) < 0) hit.push(w); }); });
    return hit;
  };

  D.edit = function (dish) {
    const isNew = !dish;
    const d = D.normalize(dish ? JSON.parse(JSON.stringify(dish)) : { id: U.uid('d'), name: '', items: [], servings: 1 });
    const m = ms();
    const name = h('input', { class: 'input', type: 'text', value: d.name, placeholder: '例: 肉じゃが' });
    const kana = h('input', { class: 'input', type: 'text', value: d.kana, placeholder: 'にくじゃが' });
    const kindIn = h('input', { class: 'input', type: 'text', value: d.kind, list: 'dl-kind', placeholder: '主食・主菜・副菜・汁物・デザート' });
    const servings = h('input', { class: 'input num', type: 'number', min: '1', value: d.servings });
    const memo = h('textarea', { class: 'input', rows: '2' }, d.memo);
    const itemBox = h('div'), sumBox = h('div');
    let allergyEditor = U.chipList(d.allergy, m.allergens, 'アレルギーの品目');

    function redraw() {
      itemBox.innerHTML = '';
      itemBox.appendChild(h('table', { class: 'list edit' },
        h('thead', null, h('tr', null, ['食品', '重量 (g)', 'エネルギー', 'たんぱく質', '食塩', ''].map((t) => h('th', null, t)))),
        h('tbody', null, d.items.map((it, i) => {
          const f = N.get(it.no);
          const one = f ? N.sum([{ no: it.no, g: it.g }]) : null;
          return h('tr', null,
            h('td', null, f ? f.name : h('span', { class: 'bad-text' }, '見つからない食品番号 ' + it.no), h('div', { class: 'sub' }, it.no)),
            h('td', null, h('input', { class: 'input num', type: 'number', step: '0.1', min: '0', value: it.g,
              onchange: (e) => { it.g = parseFloat(e.target.value) || 0; redraw(); } })),
            h('td', null, one ? N.fmt('kcal', one.values.kcal) : '—'),
            h('td', null, one ? N.fmt('prot', one.values.prot) : '—'),
            h('td', null, one ? N.fmt('nacl', one.values.nacl) : '—'),
            h('td', null, h('button', { class: 'btn small', onclick: () => { d.items.splice(i, 1); redraw(); } }, '外す')));
        }))));
      itemBox.appendChild(h('button', { class: 'btn', onclick: async () => {
        const f = await Foods.pick();
        if (!f) return;
        d.items.push({ no: f.no, name: f.name, g: 0 });
        redraw();
        const rows = itemBox.querySelectorAll('input.num');
        if (rows.length) rows[rows.length - 1].focus();
      } }, '＋ 材料を足す'));
      // 栄養価（1 人分）
      const per = D.sumOf(d);
      sumBox.innerHTML = '';
      sumBox.appendChild(h('div', null, h('b', null, '1 人分'), Foods.sumRow(per, Foods.shownKeys())));
      const missing = Object.keys(per.missing || {}).length;
      if (missing) sumBox.appendChild(h('div', { class: 'sub' }, '＊が付いた成分は、未測定（−）の食品が混じっています。実際はもう少し多い可能性があります。'));
      const sug = D.suggestAllergy(d.items).filter((x) => allergyEditor.peek().indexOf(x) < 0);
      if (sug.length) sumBox.appendChild(h('div', { class: 'card warn' }, '材料の名前から見つけた品目: ',
        sug.map((w) => h('button', { class: 'btn small', onclick: () => { allergyEditor.push(w); redraw(); } }, '＋ ' + w)),
        h('div', { class: 'sub' }, '名前だけで拾っているので、加工品などは漏れます。必ず原材料を確かめてください。')));
    }
    redraw();

    let close;
    const save = async () => {
      d.name = name.value.trim();
      if (!d.name) { U.toast('料理の名前を入れてください', true); return; }
      d.kana = kana.value.trim(); d.kind = kindIn.value.trim();
      d.servings = Math.max(1, parseInt(servings.value, 10) || 1);
      d.memo = memo.value.trim(); d.allergy = allergyEditor.get();
      d.updatedAt = Date.now();
      await DB.put('dishes', d);
      if (d.kind && (m.dishKinds || []).indexOf(d.kind) < 0) { m.dishKinds = (m.dishKinds || []).concat(d.kind); await window.Master.save(); }
      close(); U.toast('保存しました'); App.refresh();
    };
    close = U.modal(h('div', null, h('h2', null, isNew ? '料理を登録' : '料理を直す'),
      h('div', { class: 'grid3' }, U.field('料理名', name), U.field('ふりがな', kana), U.field('区分', kindIn)),
      h('datalist', { id: 'dl-kind' }, (m.dishKinds || []).map((k) => h('option', { value: k }))),
      U.field('この分量で何人分か', servings, '材料をまとめて入れた時は人数を入れると 1 人分に割ります'),
      h('h3', null, '材料'), itemBox,
      h('h3', null, '栄養価'), sumBox,
      U.field('アレルギー（食札と一覧に出ます）', allergyEditor), U.field('メモ・作り方', memo),
      h('div', { class: 'modal-btns' },
        isNew ? null : h('button', { class: 'btn danger-outline', onclick: async () => {
          if (!await U.confirm('「' + d.name + '」を消します。献立に使われていても消えます。', { okLabel: '消す', danger: true })) return;
          await DB.del('dishes', d.id); close(); App.refresh();
        } }, '消す'),
        h('button', { class: 'btn', onclick: () => close() }, 'やめる'), h('button', { class: 'btn primary', onclick: save }, '保存'))), { wide: true });
  };

  // 料理をえらぶ → Promise<dish|null>
  D.pick = async function () {
    const all = (await D.all()).sort((a, b) => (a.kana || a.name).localeCompare(b.kana || b.name, 'ja'));
    return new Promise((resolve) => {
      let close;
      const input = h('input', { class: 'input', type: 'search', placeholder: '料理の名前' });
      const list = h('div', { class: 'picklist' });
      const draw = () => {
        const s = input.value.trim();
        const rows = all.filter((d) => !s || (d.name + d.kana + d.kind).indexOf(s) >= 0);
        list.innerHTML = '';
        if (!rows.length) list.appendChild(h('div', { class: 'empty' }, all.length ? '見つかりません。' : 'まだ料理が登録されていません。'));
        rows.slice(0, 100).forEach((d) => {
          const per = D.sumOf(d);
          list.appendChild(h('button', { class: 'pickitem', onclick: () => { close(); resolve(d); } },
            h('span', { class: 'pi-name' }, d.name), h('span', { class: 'sub' }, (d.kind ? d.kind + '　' : '') + N.fmt('kcal', per.values.kcal) + 'kcal / 食塩 ' + N.fmt('nacl', per.values.nacl) + 'g' + (d.allergy.length ? '　アレルギー: ' + d.allergy.join('・') : ''))));
        });
      };
      input.addEventListener('input', draw);
      setTimeout(() => input.focus(), 0);
      close = U.modal(h('div', null, h('h2', null, '料理をえらぶ'), input, list,
        h('div', { class: 'modal-btns' },
          h('button', { class: 'btn', onclick: () => { close(); resolve(null); D.edit(null); } }, '新しく登録する'),
          h('button', { class: 'btn', onclick: () => { close(); resolve(null); } }, 'やめる'))), { wide: true });
      draw();
    });
  };

  App.registerScreen('dishes', async function (params, root) {
    const all = await D.all();
    const kinds = Array.from(new Set(all.map((d) => d.kind).filter(Boolean)));
    root.appendChild(h('header', { class: 'topbar' }, h('h1', null, '料理マスタ'),
      h('button', { class: 'btn primary', onclick: () => D.edit(null) }, '＋ 料理を登録')));
    const input = h('input', { class: 'input', type: 'search', value: q, placeholder: '料理名でさがす' });
    const box = h('div');
    const keys = Foods.shownKeys();
    const draw = () => {
      q = input.value;
      const rows = all.filter((d) => (!kind || d.kind === kind) && (!q.trim() || (d.name + d.kana).indexOf(q.trim()) >= 0))
        .sort((a, b) => (a.kind || '').localeCompare(b.kind || '', 'ja') || (a.kana || a.name).localeCompare(b.kana || b.name, 'ja'));
      box.innerHTML = '';
      if (!rows.length) { box.appendChild(h('div', { class: 'empty' }, all.length ? '見つかりません。' : 'まだ料理がありません。右上から登録します。材料と重量を入れると栄養価が出ます。')); return; }
      box.appendChild(h('div', { class: 'scroll-x' }, h('table', { class: 'grid foods' },
        h('thead', null, h('tr', null, h('th', null, '区分'), h('th', null, '料理名'), h('th', null, '材料'), keys.map((k) => h('th', null, Foods.nutrient(k).name, h('div', { class: 'wd' }, Foods.nutrient(k).unit))), h('th', { class: 'no-print' }))),
        h('tbody', null, rows.map((d) => {
          const per = D.sumOf(d);
          return h('tr', null, h('td', { class: 'sub' }, d.kind), h('th', null, d.name, d.allergy.length ? h('div', { class: 'tag bad' }, d.allergy.join('・')) : null),
            h('td', { class: 'sub' }, d.items.map((it) => it.name + (it.g ? ' ' + it.g + 'g' : '')).join('、')),
            keys.map((k) => h('td', { class: per.missing[k] ? 'est' : '' }, N.fmt(k, per.values[k]))),
            h('td', { class: 'no-print' }, h('button', { class: 'btn small', onclick: () => D.edit(d) }, '直す')));
        })))));
    };
    input.addEventListener('input', draw);
    root.appendChild(h('div', { class: 'toolrow no-print' }, input,
      h('button', { class: 'btn seg' + (kind === '' ? ' on' : ''), onclick: () => { kind = ''; App.refresh(); } }, '全部 ' + all.length),
      kinds.map((k) => h('button', { class: 'btn seg' + (kind === k ? ' on' : ''), onclick: () => { kind = k; App.refresh(); } }, k))));
    root.appendChild(box);
    draw();
  });

  App.registerNav({ order: 72, feature: 'menu', label: '料理', icon: '🍲', hash: '#/dishes', match: ['dishes'] });
  window.Dishes = D;
})();
