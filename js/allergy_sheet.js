// 献立のアレルギー表（厨房向けの 1 枚）の中身を作る。DOM にも DB にも触れない（Node で試験できる）。window.AllergySheet で公開。
// 画面は modules/allergysheet.js。外すときは両方のファイルと index.html の 2 行・menu.js のボタン 1 行を消す。
// 考え方:
//   - その枠（日付＋食事）に食べる人だけ（在籍・曜日・欠食は Model.presence）。食事情報はその枠で有効な版（Model.dietAt）
//   - 人ごとに、自分の食種の献立のマスの料理と突き合わせる。照合は Model.matchRestrictions（言いかえ表を通す）
//   - 自分の食種のマスが空なら、料理の入っている最初の食種のマスで判定し、その旨を残す
//   - 料理にアレルギーの印も材料も無い料理は判定できないので「確認できない料理」として必ず出す（漏れを隠さない）
(function (root) {
  'use strict';
  const M = root.Model || (typeof require !== 'undefined' ? require('./model.js') : null);
  const AS = {};
  const cellOf = (rec, mealId, sId) => (rec && rec.cells && rec.cells[mealId + '/' + sId]) || [];

  // residents: 利用者 / dishMap: {id: 料理} / rec: その日の献立 { cells } / slot: {d, m} / masters
  // 返り: { rows: [{key, name, shokushu:[], hits:[{r, kind, word, foods, sub}]}], unknown: [{name, shokushu:[]}],
  //         eaters, fallback: [{r, used}], noDiet: [r] }
  AS.build = function (residents, dishMap, rec, slot, masters) {
    const out = { rows: [], unknown: [], eaters: 0, fallback: [], noDiet: [] };
    const rowMap = Object.create(null), unkMap = Object.create(null);
    const label = (sId) => M.label(masters.shokushu, sId) || sId;
    const keyOf = (c) => c.dishId ? 'd:' + c.dishId : 'n:' + (c.name || '');
    (residents || []).forEach((r) => {
      if (r.archived) return;
      if (M.presence(r, slot, masters.meals).state !== 'in') return;
      out.eaters++;
      const diet = M.dietAt(r, slot, masters.meals);
      if (!diet) { out.noDiet.push(r); return; }
      let sId = diet.shokushu, list = cellOf(rec, slot.m, sId);
      if (!list.length) {
        const alt = (masters.shokushu || []).find((s) => cellOf(rec, slot.m, s.id).length);
        if (alt) { out.fallback.push({ r: r, own: sId, used: alt.id }); sId = alt.id; list = cellOf(rec, slot.m, sId); }
      }
      list.forEach((c) => {
        const d = c.dishId ? dishMap[c.dishId] : null;
        const name = d ? d.name : (c.name || '（名前の無い料理）');
        const k = keyOf(c);
        const known = d && (((d.allergy || []).length) || ((d.items || []).length));
        if (!known) {
          const u = unkMap[k] || (unkMap[k] = { key: k, name: name, shokushu: [] });
          if (u.shokushu.indexOf(label(sId)) < 0) u.shokushu.push(label(sId));
          return;
        }
        const row = rowMap[k] || (rowMap[k] = { key: k, name: name, shokushu: [], hits: [] });
        if (row.shokushu.indexOf(label(sId)) < 0) row.shokushu.push(label(sId));
        const words = [d.name].concat((d.items || []).map((it) => it.name)).concat(d.allergy || []);
        M.matchRestrictions(diet, words).forEach((hh) => {
          row.hits.push({ r: r, kind: hh.kind, word: hh.word, foods: hh.where, sub: hh.sub || '' });
        });
      });
    });
    // 献立に並んだ順（最初に出てきた順）を保つ
    out.rows = Object.keys(rowMap).map((k) => rowMap[k]);
    out.unknown = Object.keys(unkMap).map((k) => unkMap[k]);
    out.rows.forEach((row) => row.hits.sort((a, b) => ((a.r.unit || '') + (a.r.room || '')).localeCompare((b.r.unit || '') + (b.r.room || ''), 'ja') || a.r.name.localeCompare(b.r.name, 'ja')));
    return out;
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = AS;
  root.AllergySheet = AS;
})(typeof window !== 'undefined' ? window : globalThis);
