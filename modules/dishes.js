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
    d.main = d.main || ''; d.method = d.method || '';
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
    const mainIn = U.select((m.dishMains || []).map((x) => ({ id: x, label: x })), d.main, { emptyLabel: '（未設定）' });
    const methodIn = U.select((m.dishMethods || []).map((x) => ({ id: x, label: x })), d.method, { emptyLabel: '（未設定）' });
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
              onchange: (e) => { it.g = parseFloat(e.target.value) || 0; redraw(); } }),
              // 常用量（「卵 1個」「しょうゆ 大さじ1」）。押すと g が入る
              h('div', { class: 'segrow' }, window.Amounts.forFood(ms().amounts, it.no).map((a) => h('button', {
                type: 'button', class: 'btn seg tiny', title: a.unit + ' = ' + a.g + 'g' + (a.note ? '　' + a.note : ''),
                onclick: () => { it.g = (Number(it.g) || 0) + a.g; redraw(); } }, a.unit)))),
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
      d.kana = kana.value.trim(); d.kind = kindIn.value.trim(); d.main = mainIn.value; d.method = methodIn.value;
      d.servings = Math.max(1, parseInt(servings.value, 10) || 1);
      d.memo = memo.value.trim(); d.allergy = allergyEditor.get();
      d.updatedAt = Date.now();
      await DB.put('dishes', d);
      if (d.kind && (m.dishKinds || []).indexOf(d.kind) < 0) { m.dishKinds = (m.dishKinds || []).concat(d.kind); await window.Master.save(); }
      close(); U.toast('保存しました'); App.refresh();
    };
    close = U.modal(h('div', null, h('h2', null, isNew ? '料理を登録' : '料理を直す'),
      h('div', { class: 'grid3' }, U.field('料理名', name), U.field('ふりがな', kana), U.field('区分', kindIn),
        U.field('主材料', mainIn, '料理をさがす時と、期間の偏りを見る時に使います'), U.field('調理法', methodIn), h('span')),
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
  // 区分（主食・主菜…）で分け、主材料・調理法でも絞れる。前に見ていた区分を覚える
  let pickKind = null;
  D.pick = async function (opts) {
    opts = opts || {};
    const m = ms();
    const all = (await D.all()).sort((a, b) => (a.kana || a.name).localeCompare(b.kana || b.name, 'ja'));
    return new Promise((resolve) => {
      let close, draw;
      let kind = opts.kind || pickKind, main = '', method = '', q = '';
      const picked = [];
      const input = h('input', { class: 'input', type: 'search', placeholder: '料理の名前でさがす' });
      const tabs = h('div', { class: 'toolrow no-wrap-scroll' });
      const filters = h('div', { class: 'toolrow' });
      const list = h('div', { class: 'picklist tall' });
      const foot = h('div', { class: 'sub' });

      const match = (d, ignore) => (ignore === 'kind' || !kind || d.kind === kind)
        && (ignore === 'main' || !main || d.main === main)
        && (ignore === 'method' || !method || d.method === method)
        && (!q || (d.name + d.kana).indexOf(q) >= 0);

      draw = function () {
        // 区分のタブ（その区分に何件あるか。0 件は出さない）
        const kinds = (m.dishKinds || []).filter((k) => all.some((d) => d.kind === k));
        const others = all.filter((d) => !d.kind || kinds.indexOf(d.kind) < 0).length;
        tabs.innerHTML = '';
        tabs.appendChild(h('button', { class: 'btn seg' + (kind ? '' : ' on'), onclick: () => { kind = null; draw(); } }, 'すべて ' + all.filter((d) => match(d, 'kind')).length));
        kinds.forEach((k) => tabs.appendChild(h('button', { class: 'btn seg' + (kind === k ? ' on' : ''), onclick: () => { kind = (kind === k ? null : k); draw(); } },
          k + ' ' + all.filter((d) => d.kind === k && match(d, 'kind')).length)));
        if (others) tabs.appendChild(h('button', { class: 'btn seg' + (kind === '__other' ? ' on' : ''), onclick: () => { kind = (kind === '__other' ? null : '__other'); draw(); } }, '区分なし ' + others));
        // 主材料・調理法
        filters.innerHTML = '';
        const chipRow = (label, values, cur, set) => {
          const used = values.filter((v) => all.some((d) => match(d, label === '主材料' ? 'main' : 'method') && (label === '主材料' ? d.main : d.method) === v));
          if (!used.length) return;
          filters.appendChild(h('span', { class: 'sub' }, label));
          used.forEach((v) => filters.appendChild(h('button', { class: 'btn seg small' + (cur === v ? ' on' : ''), onclick: () => { set(cur === v ? '' : v); draw(); } }, v)));
        };
        chipRow('主材料', m.dishMains || [], main, (v) => { main = v; });
        chipRow('調理法', m.dishMethods || [], method, (v) => { method = v; });

        const rows = all.filter((d) => (kind === '__other' ? (!d.kind || (m.dishKinds || []).indexOf(d.kind) < 0) : true) && match(d));
        list.innerHTML = '';
        if (!rows.length) list.appendChild(h('div', { class: 'empty' }, all.length ? 'この条件に当てはまる料理はありません。' : 'まだ料理が登録されていません。'));
        // 区分ごとにまとめて出す（すべてを選んでいる時）
        const groups = kind ? [{ label: '', rows: rows }] : (m.dishKinds || []).map((k) => ({ label: k, rows: rows.filter((d) => d.kind === k) }))
          .concat([{ label: '区分なし', rows: rows.filter((d) => !d.kind || (m.dishKinds || []).indexOf(d.kind) < 0) }]).filter((g) => g.rows.length);
        groups.forEach((g) => {
          if (g.label) list.appendChild(h('div', { class: 'pickgroup-h' }, g.label + '（' + g.rows.length + '）'));
          g.rows.forEach((d) => {
            const per = D.sumOf(d);
            const on = picked.indexOf(d) >= 0;
            list.appendChild(h('button', { class: 'pickitem' + (on ? ' on' : ''), onclick: () => {
              if (opts.multi) { const i = picked.indexOf(d); if (i >= 0) picked.splice(i, 1); else picked.push(d); draw(); }
              else { pickKind = kind; close(); resolve(d); }
            } },
              h('span', { class: 'pi-name' }, (opts.multi ? (on ? '☑ ' : '☐ ') : '') + d.name),
              h('span', { class: 'sub' }, [d.kind, d.main, d.method].filter(Boolean).join('・') + '　' +
                N.fmt('kcal', per.values.kcal) + 'kcal / 食塩 ' + N.fmt('nacl', per.values.nacl) + 'g' +
                (d.allergy.length ? '　アレルギー: ' + d.allergy.join('・') : ''))));
          });
        });
        foot.textContent = rows.length + ' 件' + (opts.multi ? '　選んだ料理 ' + picked.length + ' 件' : '');
      };
      input.addEventListener('input', () => { q = input.value.trim(); draw(); });
      setTimeout(() => input.focus(), 0);
      close = U.modal(h('div', null, h('h2', null, '料理をえらぶ'),
        input, tabs, filters, list, foot,
        h('div', { class: 'modal-btns' },
          h('button', { class: 'btn', onclick: () => { close(); resolve(null); D.edit(null); } }, '新しく登録する'),
          h('button', { class: 'btn', onclick: () => { close(); resolve(null); } }, 'やめる'),
          opts.multi ? h('button', { class: 'btn primary', onclick: () => { pickKind = kind; close(); resolve(picked.slice()); } }, '選んだ料理を入れる') : null)), { wide: true });
      draw();
    });
  };

  let listMain = '', listMethod = '';
  App.registerScreen('dishes', async function (params, root) {
    const all = await D.all();
    const m = ms();
    const kinds = (m.dishKinds || []).filter((k) => all.some((d) => d.kind === k));
    root.appendChild(h('header', { class: 'topbar' }, h('h1', null, '料理マスタ'),
      h('button', { class: 'btn primary', onclick: () => D.edit(null) }, '＋ 料理を登録')));
    const input = h('input', { class: 'input', type: 'search', value: q, placeholder: '料理名でさがす' });
    const box = h('div');
    const keys = Foods.shownKeys();
    const draw = () => {
      q = input.value;
      const rows = all.filter((d) => (!kind || d.kind === kind) && (!listMain || d.main === listMain) && (!listMethod || d.method === listMethod)
        && (!q.trim() || (d.name + d.kana).indexOf(q.trim()) >= 0))
        .sort((a, b) => (a.kind || '').localeCompare(b.kind || '', 'ja') || (a.kana || a.name).localeCompare(b.kana || b.name, 'ja'));
      box.innerHTML = '';
      if (!rows.length) {
        box.appendChild(h('div', { class: 'empty' }, all.length ? '見つかりません。' : 'まだ料理がありません。'));
        if (!all.length && window.Seed && window.Seed.available()) box.appendChild(h('div', { class: 'card info' },
          h('h3', null, 'まず初期データを入れますか'),
          h('p', null, '高齢者施設でよく出る料理 ' + window.Seed.count() + ' 件と、' + window.Seed.cycleDays() + ' 日分のサイクル献立が入っています。材料は成分表の食品番号なので、入れた時点で栄養価が出ます。'),
          h('button', { class: 'btn primary big', onclick: () => window.Seed.dialog() }, '初期データを入れる'),
          h('div', { class: 'sub' }, 'あとから 設定 → 初期データ でも入れられます。右上の「＋ 料理を登録」で自分で作ることもできます。')));
        return;
      }
      box.appendChild(h('div', { class: 'scroll-x' }, h('table', { class: 'grid foods' },
        h('thead', null, h('tr', null, h('th', null, '区分'), h('th', null, '料理名'), h('th', null, '材料'), keys.map((k) => h('th', null, Foods.nutrient(k).name, h('div', { class: 'wd' }, Foods.nutrient(k).unit))), h('th', { class: 'no-print' }))),
        h('tbody', null, rows.map((d) => {
          const per = D.sumOf(d);
          return h('tr', null, h('td', { class: 'sub' }, d.kind), h('th', null, d.name, d.allergy.length ? h('div', { class: 'tag bad' }, d.allergy.join('・')) : null),
            h('td', { class: 'sub ing' }, d.items.map((it) => Foods.shortName(it.name) + (it.g ? ' ' + it.g + 'g' : '')).join('、')),
            keys.map((k) => h('td', { class: per.missing[k] ? 'est' : '' }, N.fmt(k, per.values[k]))),
            h('td', { class: 'no-print' }, h('button', { class: 'btn small', onclick: () => D.edit(d) }, '直す')));
        })))));
    };
    input.addEventListener('input', draw);
    root.appendChild(h('div', { class: 'toolrow no-print' }, input,
      h('button', { class: 'btn seg' + (kind === '' ? ' on' : ''), onclick: () => { kind = ''; App.refresh(); } }, '全部 ' + all.length),
      kinds.map((k) => h('button', { class: 'btn seg' + (kind === k ? ' on' : ''), onclick: () => { kind = k; App.refresh(); } },
        k + ' ' + all.filter((d) => d.kind === k).length))));
    const chipRow = (label, values, cur, set) => {
      const used = (values || []).filter((v) => all.some((d) => (label === '主材料' ? d.main : d.method) === v));
      if (!used.length) return null;
      return h('div', { class: 'toolrow no-print' }, h('span', { class: 'sub' }, label),
        h('button', { class: 'btn seg small' + (cur ? '' : ' on'), onclick: () => { set(''); App.refresh(); } }, 'すべて'),
        used.map((v) => h('button', { class: 'btn seg small' + (cur === v ? ' on' : ''), onclick: () => { set(cur === v ? '' : v); App.refresh(); } },
          v + ' ' + all.filter((d) => (label === '主材料' ? d.main : d.method) === v).length)));
    };
    U.add(root, chipRow('主材料', m.dishMains, listMain, (v) => { listMain = v; }));
    U.add(root, chipRow('調理法', m.dishMethods, listMethod, (v) => { listMethod = v; }));
    root.appendChild(box);
    draw();
  });

  // ---- 設定: 常用量（目安量）----
  // 「卵 1個」「しょうゆ 大さじ1」のような言い方から g を入れるための表。材料の欄の下にボタンで出る。
  App.registerSettings({ order: 47, title: '常用量（目安量）', render: function () {
    const m = ms();
    const A = window.Amounts;
    if (!m.amounts) m.amounts = JSON.parse(JSON.stringify(A.DEFAULTS));
    const box = h('div');
    function draw() {
      box.innerHTML = '';
      const byFood = {};
      m.amounts.forEach((x, i) => { (byFood[x.no] = byFood[x.no] || []).push({ x: x, i: i }); });
      const order = Object.keys(byFood).sort();
      box.appendChild(h('div', { class: 'scroll-x' }, h('table', { class: 'list edit' },
        h('thead', null, h('tr', null, ['食品', '言い方', 'グラム（可食部）', '補足', ''].map((t) => h('th', null, t)))),
        h('tbody', null, order.map((no) => byFood[no].map((e, j) => {
          const x = e.x;
          const f = N.get(no);
          const inp = (key, type) => {
            const el = h('input', { class: 'input' + (type === 'number' ? ' num' : ''), type: type || 'text',
              step: 'any', value: x[key] == null ? '' : x[key] });
            el.addEventListener('change', async () => {
              const v = el.value.trim();
              x[key] = (type === 'number') ? (v === '' ? null : parseFloat(v)) : v;
              await window.Master.save();
            });
            return el;
          };
          return h('tr', null,
            j === 0 ? h('th', { rowspan: String(byFood[no].length) }, f ? Foods.shortName(f.name) : no,
              h('div', { class: 'sub' }, no + (f && N.val(f, 'refuse') ? '　廃棄率 ' + N.val(f, 'refuse') + '%' : ''))) : null,
            h('td', null, inp('unit')), h('td', null, inp('g', 'number')), h('td', null, inp('note')),
            h('td', null, h('button', { class: 'btn small', onclick: async () => {
              m.amounts.splice(e.i, 1); await window.Master.save(); draw();
            } }, '消す')));
        }))))));
      box.appendChild(h('div', { class: 'toolrow' },
        h('button', { class: 'btn primary', onclick: async () => {
          const f = await Foods.pick();
          if (!f) return;
          m.amounts.push({ no: f.no, unit: '1個', g: 100, note: '' });
          await window.Master.save(); draw();
        } }, '＋ 食品を足す'),
        h('button', { class: 'btn danger-outline', onclick: async () => {
          if (!await U.confirm('常用量を最初の状態に戻します。足した分・直した分は消えます。', { okLabel: '戻す', danger: true })) return;
          m.amounts = JSON.parse(JSON.stringify(A.DEFAULTS)); await window.Master.save(); draw();
        } }, '最初の状態に戻す')));
    }
    draw();
    return h('div', null, h('div', { class: 'sub' },
      'グラムは可食部（皮や殻を除いた重さ）です。商品や産地で変わるので、施設の実物に合わせて直してください。' +
      '計量スプーンは 小さじ5mL・大さじ15mL・カップ200mL を前提にしています。' +
      '購入する重さは、この値と成分表の廃棄率から発注書が計算します。'), box);
  } });

  App.registerNav({ order: 72, feature: 'menu', label: '料理', icon: '🍲', hash: '#/dishes', match: ['dishes'] });
  window.Dishes = D;
})();
