# -*- coding: utf-8 -*-
"""LIFE の外部インターフェース項目一覧（3.10版）から js/life_spec.js を作る。
元データ: eiyo-kanri_research/data/life/life_nutrition_items.json
  （厚生労働省「別紙 外部インターフェース項目一覧」xlsx から機械抽出したもの）
使い方: python tools/make_life_spec.py
"""
import json, os, re

HERE = os.path.dirname(os.path.abspath(__file__))
APP = os.path.dirname(HERE)
SRC = os.path.join(os.path.dirname(APP), 'eiyo-kanri_research', 'data', 'life', 'life_nutrition_items.json')
OUT = os.path.join(APP, 'js', 'life_spec.js')

SHEETS = [
    ('user', '利用者情報', 'SERVICE_USER_INFO'),
    ('nutrition', '栄養・摂食嚥下スクリーニング・アセスメント・モニタリング', 'NUTRITION_FEEDING_SWALLOWING_SCREENING_ASSESSMENT_MONITORING_2024'),
    ('plan', '栄養ケア等計画書', 'NUTRITION_CARE_PLAN_2024'),
]
# 列の位置（シートの見出し行から）
COL = {'no': 1, 'id': 2, 'name': 3, 'type': 6, 'attr': 7, 'len': 8, 'dec': 9, 'req': 10, 'range': 11, 'fmt': 12, 'codes': 13, 'desc': 14, 'note': 15, 'ex': 16}


def clean(s):
    s = str(s or '').replace('　', ' ')
    return re.sub(r'\s+', ' ', s).strip()


def name_of(s):
    # 「実施日 /  /」のような末尾のスラッシュを落とす
    s = clean(s)
    s = re.sub(r'(\s*/\s*)+$', '', s)
    return s


def codes_of(s):
    """「1：低 / 2：中 / 3：高」→ {'1':'低', ...}"""
    out = {}
    for part in clean(s).split('/'):
        m = re.match(r'^\s*([0-9A-Za-z]+)\s*[：:]\s*(.+?)\s*$', part)
        if m:
            out[m.group(1)] = m.group(2)
    return out


def main():
    src = json.load(open(SRC, encoding='utf-8'))
    spec = {'version': '0310', 'source': 'LIFE 外部インターフェース項目一覧 3.10版（厚生労働省）', 'interfaces': {}}
    for key, sheet, phys in SHEETS:
        rows = src[sheet]
        head = None
        for i, r in enumerate(rows):
            if clean(r[COL['id']]) == 'ファイル項目ID':
                head = i
                break
        if head is None:
            raise SystemExit('見出し行が見つかりません: ' + sheet)
        fields = []
        for r in rows[head + 1:]:
            fid = clean(r[COL['id']])
            if not fid or not re.match(r'^[a-z][a-z0-9_]*$', fid):
                continue
            f = {'no': clean(r[COL['no']]), 'id': fid, 'name': name_of(r[COL['name']]),
                 'type': clean(r[COL['type']]), 'len': clean(r[COL['len']]), 'dec': clean(r[COL['dec']]),
                 'req': clean(r[COL['req']])}
            cd = codes_of(r[COL['codes']])
            if cd:
                f['codes'] = cd
            fm = clean(r[COL['fmt']])
            if fm:
                f['fmt'] = fm
            cond = clean(r[COL['desc']])
            if cond:
                f['desc'] = cond[:120]
            fields.append(f)
        spec['interfaces'][key] = {'phys': phys, 'label': sheet, 'fields': fields}
        req = [f for f in fields if f['req'] == '◎']
        print('%-10s %s  項目 %d（必須◎ %d）' % (key, sheet, len(fields), len(req)))
    js = '/* LIFE の項目定義（tools/make_life_spec.py で生成）。出典: 厚生労働省 LIFE 外部インターフェース項目一覧 3.10版 */\n'
    js += 'window.LIFE_SPEC=' + json.dumps(spec, ensure_ascii=False, separators=(',', ':')) + ';\n'
    open(OUT, 'w', encoding='utf-8', newline='\n').write(js)
    print('書き出し: %s （%d バイト）' % (OUT, len(js.encode('utf-8'))))


if __name__ == '__main__':
    main()
