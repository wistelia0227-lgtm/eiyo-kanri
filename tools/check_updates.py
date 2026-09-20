# -*- coding: utf-8 -*-
"""公式ページを見て、アプリが使っているデータに新しい版が出ていないかを調べる。

使い方（インターネットにつながっているパソコンで）:
    python tools/check_updates.py            結果を画面に出す
    python tools/check_updates.py --save     今の状態を「確認済み」として覚える（次回からの差分の基準になる）

ブラウザからは他所のサイトを読めない（file:// からの取得は断られる）ので、確認はこの道具で行う。
覚えた状態は tools/update_state.json。結果は tools/update_report.txt にも書く。
"""
import json, os, re, ssl, sys, urllib.request, datetime

HERE = os.path.dirname(os.path.abspath(__file__))
STATE = os.path.join(HERE, 'update_state.json')
REPORT = os.path.join(HERE, 'update_report.txt')
UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) eiyo-kanri-update-check'


def fetch(url, timeout=30):
    req = urllib.request.Request(url, headers={'User-Agent': UA})
    ctx = ssl.create_default_context()
    with urllib.request.urlopen(req, timeout=timeout, context=ctx) as r:
        raw = r.read()
    for enc in ('utf-8', 'cp932', 'euc-jp'):
        try:
            return raw.decode(enc)
        except UnicodeDecodeError:
            continue
    return raw.decode('utf-8', 'replace')


def latest_date(text):
    """ページに出てくる日付のうち、いちばん新しいものを YYYY-MM-DD で返す。和暦も西暦も拾う"""
    best = None
    for y, m, d in re.findall(r'令和(\d+)年\s*(\d+)月\s*(\d+)日', to_ascii(text)):
        best = max(best or (0, 0, 0), (2018 + int(y), int(m), int(d)))
    for y, m, d in re.findall(r'(20\d\d)年\s*(\d+)月\s*(\d+)日', to_ascii(text)):
        best = max(best or (0, 0, 0), (int(y), int(m), int(d)))
    return '%04d-%02d-%02d' % best if best else ''


ZEN = {ord('０') + i: ord('0') + i for i in range(10)}


def to_ascii(s):
    return s.translate(ZEN)


def first(pattern, text, default=''):
    m = re.search(pattern, text)
    return m.group(1) if m else default


def all_of(pattern, text):
    return sorted(set(re.findall(pattern, text)))


# 調べ先。fn は「今の版を表す短い文字列」を返す
def c_foods(t):
    # Excel のファイル名に日付が入る（例 20260327-mxt_kagsei-mext-000029402_02.xlsx）
    dates = all_of(r'/content/(\d{8})-mxt_kagsei-mext-', t)
    return ('成分表 Excel の日付: ' + (max(dates) if dates else '見つからない'))


def c_foods_plan(t):
    if '更新予定の収載値' in t and 'ありません' in t:
        return '次の収載値（案）の予告: なし'
    return '次の収載値（案）の予告: あり（ページのいちばん新しい日付 ' + (latest_date(t) or '?') + '）'


def c_dri(t):
    return '報告書ページのいちばん新しい日付: ' + (latest_date(t) or '見つからない')


def c_bunkakai(t):
    nums = [int(x) for x in all_of(r'第(\d+)回社会保障審議会介護給付費分科会', t) or all_of(r'第(\d+)回', t)]
    return '分科会の最新回: 第' + (str(max(nums)) if nums else '?') + '回'


def c_life(t):
    ups = all_of(r'CSV連携仕様書[^【]*【([^】]+)】', t)
    return 'LIFE CSV連携仕様書の更新日: ' + ('/'.join(ups) if ups else '見つからない')


def c_allergy(t):
    return 'アレルギー表示ページのいちばん新しい日付: ' + (latest_date(t) or '見つからない')


def c_engeshoku(t):
    y = all_of(r'分類(20\d\d)', t)
    return '嚥下調整食分類: ' + ('/'.join(y) if y else '?') + '　ページのいちばん新しい日付: ' + (latest_date(t) or '見つからない')


TARGETS = [
    ('foods', '日本食品標準成分表', 'https://www.mext.go.jp/a_menu/syokuhinseibun/mext_00001.html', c_foods),
    ('foods_plan', '成分表 公表履歴・今後の収載予定', 'https://www.mext.go.jp/a_menu/syokuhinseibun/mext_02092.html', c_foods_plan),
    ('dri', '日本人の食事摂取基準', 'https://www.mhlw.go.jp/stf/newpage_44138.html', c_dri),
    ('kaigo', '介護給付費分科会（介護報酬改定）', 'https://www.mhlw.go.jp/stf/shingi/shingi-hosho_126698_00022.html', c_bunkakai),
    ('life', 'LIFE CSV連携仕様', 'https://www.mhlw.go.jp/stf/shingi2/0000198094_00037.html', c_life),
    ('allergen', 'アレルギー表示の品目（消費者庁）', 'https://www.caa.go.jp/policies/policy/food_labeling/food_sanitation/allergy/', c_allergy),
    ('engeshoku', '嚥下調整食分類（日本摂食嚥下リハ学会）', 'https://www.jsdr.or.jp/doc/classification2021.html', c_engeshoku),
]


def main():
    save = '--save' in sys.argv
    state = {}
    if os.path.exists(STATE):
        state = json.load(open(STATE, encoding='utf-8'))
    now = datetime.datetime.now().strftime('%Y-%m-%d %H:%M')
    lines = ['栄養・食事管理 — データの更新しらべ　' + now, '']
    changed, failed = [], []
    for key, label, url, fn in TARGETS:
        try:
            text = fetch(url)
            cur = fn(text)
        except Exception as e:
            failed.append(label)
            lines.append('△ ' + label + ' … 見に行けませんでした（' + type(e).__name__ + ': ' + str(e)[:80] + '）')
            lines.append('   ' + url)
            continue
        old = (state.get(key) or {}).get('value')
        if old is None:
            lines.append('・ ' + label + ' … ' + cur + '（初回）')
        elif old != cur:
            changed.append(label)
            lines.append('★ ' + label + ' … 変わりました')
            lines.append('   前: ' + old)
            lines.append('   今: ' + cur)
            lines.append('   ' + url)
        else:
            lines.append('・ ' + label + ' … 変わりなし（' + cur + '）')
        state[key] = {'value': cur, 'url': url, 'checkedAt': now}
    lines.append('')
    if changed:
        lines.append('変わったもの: ' + '、'.join(changed))
        lines.append('→ アプリの 設定 → データの出典と版 で、版と「確かめた日」を直してください。')
        lines.append('　 成分表が差し替わったときは、新しい Excel を取って convert_foods.py で js/foods_data.js を作り直します。')
    else:
        lines.append('変わったものはありません。' if not failed else '見に行けたものに変わりはありません。')
    if failed:
        lines.append('見に行けなかったもの: ' + '、'.join(failed) + '（回線・サイト側の都合。時間をおいて試してください）')
    if save:
        json.dump(state, open(STATE, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
        lines.append('今の状態を覚えました（' + os.path.basename(STATE) + '）。次回はここからの差分を出します。')
    else:
        lines.append('※ --save を付けて実行すると、今の状態を覚えて次回から差分だけ出します。')
    out = '\n'.join(lines)
    print(out)
    open(REPORT, 'w', encoding='utf-8').write(out + '\n')


if __name__ == '__main__':
    main()
