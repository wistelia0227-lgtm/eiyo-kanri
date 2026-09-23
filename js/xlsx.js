// Excel のファイル（.xlsx）を外部の部品なしで書く。window.Xlsx で公開。DOM にも DB にも触れない。
// なぜ CSV では足りないか: 市販ソフトはほぼ全部の帳票を Excel で出す。現場が自施設の様式に直して使うため（調査 01）。
//   CSV は 1 枚しか入らず、書式も列幅も持てない。帳票は「食品構成表」「栄養出納表」のように複数の表が 1 組になる。
// 作り: .xlsx は ZIP の中に XML が入っているだけ。圧縮しない（stored）で詰めれば ZIP は自分で書ける。
//   文字列は inlineStr で埋めるので sharedStrings.xml は要らない。
(function (root) {
  'use strict';
  const X = {};

  // ---- CRC32（ZIP に要る）----
  let TABLE = null;
  function crcTable() {
    if (TABLE) return TABLE;
    TABLE = new Uint32Array(256);
    for (let i = 0; i < 256; i++) {
      let c = i;
      for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
      TABLE[i] = c >>> 0;
    }
    return TABLE;
  }
  X.crc32 = function (bytes) {
    const t = crcTable();
    let c = 0xFFFFFFFF;
    for (let i = 0; i < bytes.length; i++) c = t[(c ^ bytes[i]) & 0xFF] ^ (c >>> 8);
    return (c ^ 0xFFFFFFFF) >>> 0;
  };

  function utf8(s) {
    if (typeof TextEncoder !== 'undefined') return new TextEncoder().encode(s);
    const out = [];
    for (let i = 0; i < s.length; i++) {
      let c = s.charCodeAt(i);
      if (c < 0x80) out.push(c);
      else if (c < 0x800) { out.push(0xC0 | (c >> 6), 0x80 | (c & 63)); }
      else if (c >= 0xD800 && c < 0xDC00) {
        const c2 = s.charCodeAt(++i);
        c = 0x10000 + ((c - 0xD800) << 10) + (c2 - 0xDC00);
        out.push(0xF0 | (c >> 18), 0x80 | ((c >> 12) & 63), 0x80 | ((c >> 6) & 63), 0x80 | (c & 63));
      } else { out.push(0xE0 | (c >> 12), 0x80 | ((c >> 6) & 63), 0x80 | (c & 63)); }
    }
    return new Uint8Array(out);
  }
  X.utf8 = utf8;

  // ---- 圧縮しない ZIP ----
  X.zip = function (files) {   // files = [{name, data:Uint8Array}]
    const parts = [], central = [];
    let offset = 0;
    files.forEach((f) => {
      const name = utf8(f.name);
      const crc = X.crc32(f.data);
      const local = new Uint8Array(30 + name.length);
      const dv = new DataView(local.buffer);
      dv.setUint32(0, 0x04034b50, true);
      dv.setUint16(4, 20, true);        // 展開に要る版
      dv.setUint16(6, 0x0800, true);    // 名前は UTF-8
      dv.setUint16(8, 0, true);         // 方式 0 = 無圧縮
      dv.setUint16(10, 0, true); dv.setUint16(12, 0x21, true); // 時刻・日付（1980-01-01）
      dv.setUint32(14, crc, true);
      dv.setUint32(18, f.data.length, true);
      dv.setUint32(22, f.data.length, true);
      dv.setUint16(26, name.length, true);
      dv.setUint16(28, 0, true);
      local.set(name, 30);
      parts.push(local, f.data);
      const cd = new Uint8Array(46 + name.length);
      const cv = new DataView(cd.buffer);
      cv.setUint32(0, 0x02014b50, true);
      cv.setUint16(4, 20, true); cv.setUint16(6, 20, true);
      cv.setUint16(8, 0x0800, true); cv.setUint16(10, 0, true);
      cv.setUint16(12, 0, true); cv.setUint16(14, 0x21, true);
      cv.setUint32(16, crc, true);
      cv.setUint32(20, f.data.length, true);
      cv.setUint32(24, f.data.length, true);
      cv.setUint16(28, name.length, true);
      cv.setUint32(42, offset, true);
      cd.set(name, 46);
      central.push(cd);
      offset += local.length + f.data.length;
    });
    let cdSize = 0;
    central.forEach((c) => { cdSize += c.length; });
    const end = new Uint8Array(22);
    const ev = new DataView(end.buffer);
    ev.setUint32(0, 0x06054b50, true);
    ev.setUint16(8, files.length, true);
    ev.setUint16(10, files.length, true);
    ev.setUint32(12, cdSize, true);
    ev.setUint32(16, offset, true);
    let total = offset + cdSize + 22;
    const out = new Uint8Array(total);
    let p = 0;
    parts.forEach((b) => { out.set(b, p); p += b.length; });
    central.forEach((b) => { out.set(b, p); p += b.length; });
    out.set(end, p);
    return out;
  };

  // ---- Excel の中身 ----
  function esc(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' }[c]))
      // Excel が読めない制御文字を落とす
      .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '');
  }
  X.colName = function (i) {   // 0 → A, 25 → Z, 26 → AA
    let s = '';
    i = i + 1;
    while (i > 0) { const r = (i - 1) % 26; s = String.fromCharCode(65 + r) + s; i = Math.floor((i - 1) / 26); }
    return s;
  };
  // シート名に使えない字を直す（Excel の決まり: / \ ? * [ ] : は使えない、31 字まで、空は不可）
  X.sheetName = function (s, i) {
    let n = String(s || '').replace(/[/\\?*[\]:]/g, '_').slice(0, 31).trim();
    return n || ('シート' + (i + 1));
  };

  function sheetXml(rows) {
    const lines = [];
    (rows || []).forEach((row, r) => {
      const cells = [];
      (row || []).forEach((v, c) => {
        if (v == null || v === '') return;
        const ref = X.colName(c) + (r + 1);
        if (typeof v === 'number' && isFinite(v)) cells.push('<c r="' + ref + '"><v>' + v + '</v></c>');
        else cells.push('<c r="' + ref + '" t="inlineStr"><is><t xml:space="preserve">' + esc(v) + '</t></is></c>');
      });
      lines.push('<row r="' + (r + 1) + '">' + cells.join('') + '</row>');
    });
    return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
      '<sheetData>' + lines.join('') + '</sheetData></worksheet>';
  }

  // sheets = [{ name, rows: [[値, 値, ...], ...] }]。数値は数値のまま、それ以外は文字として入る
  X.build = function (sheets) {
    const list = (sheets && sheets.length) ? sheets : [{ name: 'シート1', rows: [] }];
    const names = list.map((s, i) => X.sheetName(s.name, i));
    // 同じ名前があると Excel が開けないので後ろに番号を足す
    const seen = {};
    names.forEach((n, i) => {
      if (seen[n] == null) { seen[n] = 1; return; }
      seen[n]++;
      names[i] = (n.slice(0, 28) + '(' + seen[n] + ')');
    });
    const files = [];
    const add = (name, text) => files.push({ name: name, data: utf8(text) });

    add('[Content_Types].xml', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
      '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
      '<Default Extension="xml" ContentType="application/xml"/>' +
      '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>' +
      list.map((s, i) => '<Override PartName="/xl/worksheets/sheet' + (i + 1) + '.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>').join('') +
      '</Types>');
    add('_rels/.rels', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
      '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>' +
      '</Relationships>');
    add('xl/workbook.xml', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" ' +
      'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>' +
      names.map((n, i) => '<sheet name="' + esc(n) + '" sheetId="' + (i + 1) + '" r:id="rId' + (i + 1) + '"/>').join('') +
      '</sheets></workbook>');
    add('xl/_rels/workbook.xml.rels', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
      list.map((s, i) => '<Relationship Id="rId' + (i + 1) + '" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet' + (i + 1) + '.xml"/>').join('') +
      '</Relationships>');
    list.forEach((s, i) => add('xl/worksheets/sheet' + (i + 1) + '.xml', sheetXml(s.rows)));
    return X.zip(files);
  };

  X.MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

  if (typeof module !== 'undefined' && module.exports) module.exports = X;
  root.Xlsx = X;
})(typeof window !== 'undefined' ? window : globalThis);
