// マスタの初期値。設定画面で全部書き換えられる（コードに名前を埋め込まない）。window.Master で公開。
// code = 日本摂食嚥下リハビリテーション学会 嚥下調整食分類2021 のコード。施設ごとの呼び方とコードの対応表を兼ねる。
(function () {
  'use strict';
  const DEFAULTS = {
    facility: { name: '', recorder: '' },
    profile: null, // 事業所プロファイル（js/profile.js）。null なら初回の登録案内を出す
    meals: [
      { id: 'b', label: '朝', on: true }, { id: 'l', label: '昼', on: true },
      { id: 's', label: 'おやつ', on: false }, { id: 'd', label: '夕', on: true }],
    categories: [ // stayIn = 泊まる人（ミールラウンドの対象）／ncm = 栄養ケア・マネジメントの対象
      { id: 'long', label: '入所', stayIn: true, ncm: true },
      { id: 'short', label: 'ショート', stayIn: true, ncm: false },
      { id: 'day', label: 'デイ', stayIn: false, ncm: false }],
    units: [],
    shokushu: [
      { id: 'jo', label: '常食', color: '#e5e7eb' },
      { id: 'dm', label: '糖尿病食', color: '#fde68a', ryoyo: true },
      { id: 'salt', label: '減塩食', color: '#bfdbfe', ryoyo: true },
      { id: 'ckd', label: '腎臓病食', color: '#ddd6fe', ryoyo: true },
      { id: 'liver', label: '肝臓病食', color: '#fbcfe8', ryoyo: true },
      { id: 'lipid', label: '脂質異常症食', color: '#fed7aa', ryoyo: true },
      { id: 'tube', label: '経管栄養', color: '#d1d5db' }],
    staple: [
      { id: 'rice', label: '米飯', code: '' }, { id: 'soft', label: '軟飯', code: '4' },
      { id: 'kayu', label: '全粥', code: '4' }, { id: 'kayu_m', label: 'ミキサー粥', code: '2-1' },
      { id: 'kayu_j', label: 'ゼリー粥', code: '1j' }, { id: 'bread', label: 'パン', code: '' },
      { id: 'none', label: '主食なし', code: '' }],
    side: [
      { id: 'jo', label: '常菜', code: '', color: '#e5e7eb' }, { id: 'hito', label: '一口大', code: '', color: '#bbf7d0' },
      { id: 'kizami', label: 'きざみ', code: '', color: '#fde68a' }, { id: 'soft', label: 'ソフト食', code: '3', color: '#fed7aa' },
      { id: 'mixer', label: 'ミキサー', code: '2-1', color: '#fbcfe8' }, { id: 'jelly', label: 'ゼリー', code: '1j', color: '#ddd6fe' }],
    thick: [
      { id: 'thin', label: '薄いとろみ' }, { id: 'mid', label: '中間のとろみ' }, { id: 'thickk', label: '濃いとろみ' }],
    portion: [{ id: 'half', label: '1/2量' }, { id: 'q3', label: '3/4量' }, { id: 'large', label: '大盛' }],
    assist: [{ id: 'self', label: '自立' }, { id: 'watch', label: '見守り' }, { id: 'part', label: '一部介助' }, { id: 'full', label: '全介助' }],
    cond: [{ id: 'bread', label: 'パンの日' }, { id: 'noodle', label: '麺の日' }, { id: 'fish', label: '魚の日' }, { id: 'event', label: '行事食' }],
    tools: ['箸', 'スプーン', '大スプーン', '柄の太いスプーン', 'フォーク', 'ストロー付きコップ', '吸い飲み', 'すべり止めマット', '仕切り皿', 'エプロン'],
    // 消費者庁の特定原材料等（令和8年4月1日時点）。先頭 9 つが表示義務、残り 19 が表示推奨
    allergens: ['えび', 'かに', 'くるみ', 'カシューナッツ', '小麦', 'そば', '卵', '乳', '落花生',
      'アーモンド', 'あわび', 'いか', 'いくら', 'オレンジ', 'キウイフルーツ', '牛肉', 'ごま', 'さけ', 'さば',
      '大豆', '鶏肉', 'バナナ', '豚肉', 'マカダミアナッツ', 'もも', 'やまいも', 'りんご', 'ゼラチン'],
    sources: ['医師', '看護師', '管理栄養士', 'ケアマネジャー', '介護職', '家族', '本人'],
    absenceReasons: ['外出', '外泊', '入院', '受診', '絶食', '体調不良'],
    // 食数表に手で足す行（利用者ではない食事）
    extraRows: [{ id: 'staff', label: '職員' }, { id: 'kenshoku', label: '検食' }, { id: 'hozon', label: '保存食' }, { id: 'yobi', label: '予備' }],
    deadline: { daysBefore: 1, time: '15:00' },
    cardColorBy: 'side',
    // 低栄養リスクの判定値（厚生労働省 様式例の基準。変わったらここを直す）
    risk: { bmiMid: 18.5, loss: { m1: { mid: 3, high: 5 }, m3: { mid: 3, high: 7.5 }, m6: { mid: 3, high: 10 } }, albMid: 3.5, albHigh: 3.0, intakeMid: 75 },
    weightAlertKg: 2,
    phrases: null,            // 欄ごとの文例（js/phrases.js）
    life: null,               // LIFE の事業所情報（modules/life.js）
    ncm: null,                // 栄養ケアの期限（js/ncm.js の DEFAULT_INTERVALS）
    nutrientKeys: null,      // 画面に出す栄養素（null = 基本の6つ）
    dishKinds: ['主食', '主菜', '副菜', '汁物', 'デザート', '飲み物'],
    dishMains: ['米・パン・めん', '魚', '肉', '卵', '豆・豆腐', '野菜', 'いも', '海藻・きのこ', '乳', '果物'],
    dishMethods: ['煮る', '焼く', '揚げる', '炒める', '蒸す', '和える', '汁', 'そのまま'],
    targets: {},             // 食種ID → { energy, age, sex, setAt } 給与栄養目標量
    // 情報リンク。設定で足す・消す・並べ替えができる
    links: null, // null = 既定のリンク集（LINKS）を使う
    // 使っているデータの版と、最新かどうかを人が確かめた日
    dataSources: null, // null = 既定（SOURCES）
    // 食札の面付け（mm）。A4 縦。設定画面で数字を直せる
    cardLayouts: [
      { id: 'meishi10', label: '名刺サイズ 10面（91×55mm）', cols: 2, rows: 5, w: 91, h: 55, mt: 11, ml: 14, gx: 0, gy: 0 },
      { id: 'big8', label: '大きめ 8面（99×68mm）', cols: 2, rows: 4, w: 99, h: 68, mt: 12, ml: 6, gx: 0, gy: 0 },
      { id: 'wide4', label: '横長 4面（190×65mm・トレー用）', cols: 1, rows: 4, w: 190, h: 65, mt: 12, ml: 10, gx: 0, gy: 3 }]
  };

  // 既定の情報リンク。外部サイトは新しいタブで開く
  const LINKS = [
    { c: '公的機関', n: '厚生労働省 社会保障審議会 介護給付費分科会', u: 'https://www.mhlw.go.jp/stf/shingi/shingi-hosho_126698_00022.html', d: '介護報酬改定の審議資料。令和9年度改定の論点・データはここに全部出る。新しい回には NEW が付く' },
    { c: '公的機関', n: '厚生労働省 介護保険最新情報 掲載ページ', u: 'https://www.mhlw.go.jp/stf/seisakunitsuite/bunya/hukushi_kaigo/kaigo_koureisha/index_00010.html', d: '通知（介護保険最新情報 Vol.〇〇）の一次配布。加算・様式の変更はまずここ' },
    { c: '公的機関', n: 'WAM NET 介護保険最新情報', u: 'https://www.wam.go.jp/gyoseiShiryou/detail-list?bun=020060090', d: '同じ通知を新しい順に一覧で読める。厚労省サイトより探しやすい' },
    { c: '公的機関', n: 'WAM NET 行政資料（高齢・介護）', u: 'https://www.wam.go.jp/gyoseiShiryou/bun-list?bun1=020', d: '通知・審議会資料・Q&A をまとめて追える' },
    { c: '公的機関', n: '厚生労働省 令和6年度介護報酬改定について', u: 'https://www.mhlw.go.jp/stf/seisakunitsuite/bunya/0000202214_00009.html', d: '現行改定の告示・解釈通知・Q&A・様式の配布元' },
    { c: '公的機関', n: '厚生労働省 科学的介護情報システム（LIFE）', u: 'https://www.mhlw.go.jp/stf/shingi2/0000198094_00037.html', d: 'CSV連携仕様書と外部インターフェース項目一覧。版と更新日がページに直接書いてある' },
    { c: '公的機関', n: '厚生労働省 LIFE説明会', u: 'https://www.mhlw.go.jp/stf/life_session.html', d: 'LIFE の操作・フィードバックの見方の動画と資料' },
    { c: '公的機関', n: '厚生労働省 日本人の食事摂取基準（2025年版）報告書', u: 'https://www.mhlw.go.jp/stf/newpage_44138.html', d: '報告書本体PDF。令和7〜11年度に使用。正誤反映済みファイルに差し替わる形で更新される' },
    { c: '公的機関', n: '文部科学省 日本食品標準成分表（八訂）増補2023年', u: 'https://www.mext.go.jp/a_menu/syokuhinseibun/mext_00001.html', d: '成分表 Excel と正誤表の配布元。ファイル名の日付で差し替えが分かる' },
    { c: '公的機関', n: '文部科学省 成分表 公表履歴・今後の収載予定', u: 'https://www.mext.go.jp/a_menu/syokuhinseibun/mext_02092.html', d: '次の版の「収載値（案）」が本公表より先に出る。更新検知はここが本命' },
    { c: '公的機関', n: '文部科学省 日本食品標準成分表・資源に関する取組', u: 'https://www.mext.go.jp/a_menu/syokuhinseibun/index.htm', d: '成分表トップ。利用条件（出典明記で自由に利用可）の記載もここ' },
    { c: '公的機関', n: '食品成分データベース（文科省）', u: 'https://fooddb.mext.go.jp/', d: '成分表をブラウザで検索。単位換算や比較ができる。オフライン不可のため参照用' },
    { c: '公的機関', n: '消費者庁 食物アレルギー表示に関する情報', u: 'https://www.caa.go.jp/policies/policy/food_labeling/food_sanitation/allergy/', d: '特定原材料等の最新一覧と事務連絡。令和8年4月1日にカシューナッツが義務表示へ' },
    { c: '公的機関', n: '消費者庁 食品表示法等（法令及び一元化情報）', u: 'https://www.caa.go.jp/policies/policy/food_labeling/food_labeling_act/', d: '食品表示基準とQ&Aの原文' },
    { c: '公的機関', n: '消費者庁 特別用途食品について', u: 'https://www.caa.go.jp/policies/policy/food_labeling/foods_for_special_dietary_uses/', d: 'えん下困難者用食品・とろみ調整用食品の許可基準と許可品目一覧' },
    { c: '公的機関', n: '厚生労働省 大量調理施設衛生管理マニュアル（本文PDF）', u: 'https://www.mhlw.go.jp/file/06-Seisakujouhou-11130500-Shokuhinanzenbu/0000168026.pdf', d: '平成9年3月24日 衛食第85号別添、最終改正 平成29年6月16日。別紙様式9種を含む' },
    { c: '公的機関', n: '農林水産省 スマイルケア食', u: 'https://www.maff.go.jp/j/shokusan/seizo/kaigo.html', d: '青・黄・赤マークの区分と対応商品。UDF・学会分類との対応表もここ' },
    { c: '公的機関', n: '農林水産省 家庭備蓄ポータル', u: 'https://www.maff.go.jp/j/zyukyu/foodstock/', d: '非常食の考え方・ローリングストック。BCP の食料備蓄の根拠に使える' },
    { c: '公的機関', n: '厚生労働省 介護施設・事業所における業務継続計画（BCP）', u: 'https://www.mhlw.go.jp/stf/seisakunitsuite/bunya/hukushi_kaigo/kaigo_koureisha/douga_00002.html', d: 'BCP ガイドライン・ひな形・研修動画。給食部門の記載もここから' },
    { c: '公的機関', n: '国立健康・栄養研究所（医薬基盤・健康・栄養研究所）', u: 'https://www.nibn.go.jp/eiken/', d: '国民健康・栄養調査、身体活動・エネルギー関連の一次情報' },
    { c: '公的機関', n: '「健康食品」の安全性・有効性情報（HFNet）', u: 'https://hfnet.nibn.go.jp/', d: '健康食品・サプリの安全性、医薬品との相互作用。入所者の持参サプリの判断に使える' },
    { c: '公的機関', n: '素材情報データベース（HFNet）', u: 'https://hfnet.nibn.go.jp/material-infodb/', d: '素材ごとの有効性・健康被害・相互作用' },
    { c: '公的機関', n: 'e-Gov 法令検索', u: 'https://laws.e-gov.go.jp/', d: '介護保険法、健康増進法、食品衛生法の条文' },
    { c: '公的機関', n: '介護サービス情報公表システム', u: 'https://www.kaigokensaku.mhlw.go.jp/', d: '近隣施設の加算算定状況・定員などを調べられる' },
    { c: '公的機関', n: '国民健康保険中央会 介護保険システム', u: 'https://www.kokuho.or.jp/system/care/', d: '2026年5月から LIFE の運営主体。ケアプランデータ連携システムもここ' },
    { c: '公的機関', n: '介護情報基盤ポータルサイト', u: 'https://www.kaigo-kiban-portal.jp/', d: '国保中央会の介護情報基盤。LIFE の新しい入口はここ経由とみられる（JSサイトのため要ブラウザ確認）（無料 / 一部要アカウント）' },
    { c: '自治体', n: '横浜市 特定給食施設・給食施設における栄養管理', u: 'https://www.city.yokohama.lg.jp/kenko-iryo-fukushi/kenko-iryo/kenkozukuri/kankyodukuri/kyusyokueiyoukanri.html', d: '栄養管理報告書（社会福祉・介護保険施設用）Excel、栄養管理の手引き、食札・献立の様式例' },
    { c: '自治体', n: '東京都 多摩・島しょ地区の特定給食施設の方へ', u: 'https://www.hokeniryo.metro.tokyo.lg.jp/kenkou/kenko_zukuri/ei_syo/tokutei', d: '栄養管理報告書の様式と記入例、給食施設向けの手引き' },
    { c: '自治体', n: '神奈川県 給食施設栄養管理報告書の提出について', u: 'https://www.pref.kanagawa.jp/docs/cz6/cnt/f4182/index.html', d: '報告書様式と根拠法令の整理が丁寧' },
    { c: '自治体', n: '名古屋市 食物アレルギーと食品表示', u: 'https://www.city.nagoya.jp/kenkofukushi/eisei/1014927/1014928/1014961/1014962.html', d: '特定原材料9品目・準ずるもの20品目の一覧が読みやすい形で出ている' },
    { c: '自治体', n: '東京都福祉局 令和6年度介護報酬改定等について', u: 'https://www.fukushi.metro.tokyo.lg.jp/kourei/hoken/kaigo_lib/reiwa6_hoshukaitei', d: '改定資料を自治体が整理したもの。厚労省より探しやすい' },
    { c: '自治体', n: '千葉県 高齢者のための季節の献立集', u: 'https://www.pref.chiba.lg.jp/kenzu/eiyou/koureisha-recipi2.html', d: '春夏秋冬 各4週間分の献立とレシピ。行事食の下敷きに使える' },
    { c: '自治体', n: '岐阜県 給食施設における災害時給食提供マニュアル策定の手引き（第2版）', u: 'https://www.pref.gifu.lg.jp/uploaded/attachment/395851.pdf', d: '災害時の給食提供マニュアルを作るときの型。令和6年3月' },
    { c: '職能団体・学会', n: '日本栄養士会', u: 'https://www.dietitian.or.jp/', d: '制度改正の解説、研修、生涯教育。介護給付費分科会にも意見を出している（一部会員制）' },
    { c: '職能団体・学会', n: '日本栄養士会 栄養業界ニュース', u: 'https://www.dietitian.or.jp/trends/', d: '制度・学会・製品の動きを短くまとめている。更新の気づきに使える（無料（一部会員制））' },
    { c: '職能団体・学会', n: '日本栄養士会 お知らせ', u: 'https://www.dietitian.or.jp/news/', d: '会告・研修案内・災害支援（JDA-DAT）' },
    { c: '職能団体・学会', n: '全国の栄養士会（都道府県一覧）', u: 'https://www.dietitian.or.jp/about/region/', d: '都道府県栄養士会のサイト一覧。地域の研修・様式はここから' },
    { c: '職能団体・学会', n: '日本摂食嚥下リハビリテーション学会', u: 'https://www.jsdr.or.jp/', d: '嚥下調整食分類の発行元。新着情報ページで改訂に気づける（無料（一部会員制））' },
    { c: '職能団体・学会', n: '学会分類2021（嚥下調整食分類）', u: 'https://www.jsdr.or.jp/doc/classification2021.html', d: 'コード0j〜4、とろみ段階1〜3の原本PDF。現行は2021年9月17日差し替え版' },
    { c: '職能団体・学会', n: '日本摂食嚥下リハ学会 医療検討委員会作成マニュアル', u: 'https://www.jsdr.or.jp/doc/doc_manual1.html', d: '嚥下スクリーニング法（RSST・改訂水飲みテスト等）の手順書' },
    { c: '職能団体・学会', n: '日本栄養治療学会（JSPEN）', u: 'https://www.jspen.or.jp/', d: '静脈経腸栄養のガイドライン、GLIM基準の日本語解説（一部会員制）' },
    { c: '職能団体・学会', n: '日本健康・栄養システム学会', u: 'https://www.j-ncm.com/', d: '栄養ケア・マネジメントの様式と研修の本家。介護施設の栄養ケアの解説が多い（一部会員制）' },
    { c: '職能団体・学会', n: '日本病態栄養学会', u: 'https://www.eiyou.or.jp/', d: '病態別の栄養管理、療養食の根拠（一部会員制）' },
    { c: '職能団体・学会', n: '日本老年医学会', u: 'https://www.jpn-geriat-soc.or.jp/', d: '高齢者診療ガイドライン、フレイル・サルコペニアの定義（無料（ガイドラインは公開））' },
    { c: '職能団体・学会', n: '日本サルコペニア・フレイル学会', u: 'https://jssf.umin.jp/', d: 'AWGS 基準など。下腿周囲長・握力のカットオフの出所（一部会員制）' },
    { c: '職能団体・学会', n: '日本老年歯科医学会', u: 'https://www.gerodontology.jp/', d: '口腔機能低下症、口腔・栄養の一体的取組の根拠（一部会員制）' },
    { c: '職能団体・学会', n: '全国老人福祉施設協議会', u: 'https://www.roushikyo.or.jp/', d: '特養の団体。改定要望や現場調査（一部会員制）' },
    { c: '職能団体・学会', n: '全国老人保健施設協会', u: 'https://www.roken.or.jp/', d: '老健の団体。介護保険最新情報のアーカイブが見やすい（無料（一部会員制））' },
    { c: '職能団体・学会', n: '日本介護食品協議会（UDF）', u: 'https://www.udf.jp/', d: 'ユニバーサルデザインフードの自主規格と登録商品検索' },
    { c: '職能団体・学会', n: '全国栄養士養成施設協会', u: 'https://www.eiyo.or.jp/', d: '国家試験情報、養成施設。実務よりは教育寄り' },
    { c: '実務情報', n: 'エイチエ', u: 'https://eichie.jp/', d: '国内最大級の栄養士コミュニティ。Q&A・献立レポ・求人（閲覧は一部無料／投稿は無料会員登録）' },
    { c: '実務情報', n: 'Eatreat（イートリート）', u: 'https://eat-treat.jp/', d: '管理栄養士向けコラム・セミナー。制度解説記事もある（無料（一部会員制））' },
    { c: '実務情報', n: '栄養士のお仕事Magazine', u: 'https://eiyoushi-shigoto.com/magazine/', d: '働き方・実務の読み物。現場の温度感が分かる' },
    { c: '実務情報', n: '栄養指導Navi', u: 'https://healthy-food-navi.jp/', d: '栄養指導の教材・媒体、食事摂取基準の解説（無料（一部有料））' },
    { c: '実務情報', n: '日本医療企画', u: 'https://www.jmp.co.jp/', d: '『ヘルスケア・レストラン』など給食・栄養管理の実務誌の版元（書籍・雑誌は有料）' },
    { c: '実務情報', n: 'ヘルスケア・マネジメント.com', u: 'https://healthcare-mgt.com/', d: '栄養部門の運営・BCP・原価管理の実務記事（無料（一部会員制））' },
    { c: '実務情報', n: '老施協デジタル', u: 'https://roushikyo-digital.com/', d: '全国老施協のウェブメディア。制度改正の速報が早い' },
    { c: '実務情報', n: 'スポーツ栄養Web（SNDJ）', u: 'https://sndj-web.jp/', d: '食事摂取基準や論文の解説が丁寧。高齢者向けの記事もある' },
    { c: '実務情報', n: '食品表示ブログ（ラベルバンク）', u: 'https://www.label-bank.co.jp/blog/', d: 'アレルギー表示・食品表示基準の改正を早く詳しく解説' },
    { c: '実務情報', n: '健康メディア.com', u: 'https://www.kenko-media.com/', d: '『食品と開発』等。制度改正と製品動向（無料（一部有料））' },
    { c: '実務情報', n: 'メディカルオンライン', u: 'https://www.medicalonline.jp/', d: '医学文献の検索・全文。栄養関連の原著を当たるとき（有料（機関契約））' },
    { c: '実務情報', n: 'J-STAGE', u: 'https://www.jstage.jst.go.jp/', d: '日本栄養士会雑誌・栄養学雑誌などの無料全文が多い' },
    { c: '実務情報', n: 'CiNii Research', u: 'https://cir.nii.ac.jp/', d: '論文・書籍の横断検索' },
    { c: '掲示板・Q&A', n: 'エイチエ みんなのQ&A（新着の質問）', u: 'https://eichie.jp/hear', d: '同業に直接聞ける板。2026-09-20時点で数時間前の投稿があり回答も20〜150件付いている。加算・様式の実務質問が多い（閲覧は登録なしで可／投稿・回答は無料会員登録）' },
    { c: '掲示板・Q&A', n: 'エイチエ 献立レポ', u: 'https://eichie.jp/meals', d: '他施設の実際の献立写真。行事食のネタ（無料会員登録）' },
    { c: '掲示板・Q&A', n: 'Yahoo!知恵袋（管理栄養士タグ）', u: 'https://chiebukuro.yahoo.co.jp/tag/tags.php?tag=%E7%AE%A1%E7%90%86%E6%A0%84%E9%A4%8A%E5%A3%AB', d: '就職・国家試験の質問が中心。施設実務の込み入った質問には向かない（閲覧無料／投稿はYahoo! ID）' },
    { c: '掲示板・Q&A', n: 'note「管理栄養士」タグ', u: 'https://note.com/hashtag/%E7%AE%A1%E7%90%86%E6%A0%84%E9%A4%8A%E5%A3%AB', d: '約39,600記事。個人の実務記録・独立系が多く、施設栄養士の記事もある（閲覧無料）' },
    { c: '掲示板・Q&A', n: 'X エイチエ公式', u: 'https://x.com/eichie_jp', d: 'Q&Aの新着や制度ニュースが流れてくる（閲覧は一部要ログイン）' },
    { c: '掲示板・Q&A', n: 'X 日本栄養士会公式', u: 'https://x.com/jda_dietitian', d: '会からの告知（閲覧は一部要ログイン）' },
    { c: '掲示板・Q&A', n: 'LINEオープンチャット（アプリ内検索）', u: 'https://openchat-jp.line.me/', d: '栄養士向けルームの有無はアプリ内検索でしか確認できない。外部からは未確認（要LINEアプリ／未確認）' },
    { c: '食材・製品', n: 'ニュートリー', u: 'https://www.nutri.co.jp/', d: 'とろみ調整（トロメリン等）、ゼリー。学会分類の解説が業界で一番詳しい' },
    { c: '食材・製品', n: 'ニュートリー 学会分類の解説', u: 'https://www.nutri.co.jp/nutrition/society_classification/index.html', d: '学会分類2021・UDF・スマイルケア食の対応表' },
    { c: '食材・製品', n: 'ニュートリー 嚥下食レシピ', u: 'https://www.nutri.co.jp/nutrition/recipe/index.html', d: '製品を使った嚥下食レシピ' },
    { c: '食材・製品', n: '森永乳業クリニコ', u: 'https://www.clinico.co.jp/', d: 'つるりんこ、エンジョイシリーズ。栄養補助食品と流動食（無料（一部医療関係者向け））' },
    { c: '食材・製品', n: 'クリニコ お役立ち栄養コラム', u: 'https://www.clinico.co.jp/columns/', d: '嚥下調整食・低栄養の解説記事' },
    { c: '食材・製品', n: '明治 医療・介護関係者向け情報サイト', u: 'https://www.meiji.co.jp/meiji-nutrition-info/', d: 'メイバランス等の栄養成分、症例情報（一部会員登録（医療関係者確認））' },
    { c: '食材・製品', n: 'ネスレ ヘルスサイエンス', u: 'https://www.nestlehealthscience.jp/', d: 'アイソカル、リゾース。製品情報' },
    { c: '食材・製品', n: 'ネスレ栄養ネット', u: 'https://www.eiyounet.nestlehealthscience.jp/', d: '医療・介護従事者向けの栄養情報。MNA-SF の資料もここ（会員登録（医療・介護従事者））' },
    { c: '食材・製品', n: 'キユーピー やさしい献立', u: 'https://www.kewpie.co.jp/udfood/', d: 'UDF区分別のレトルト介護食。栄養成分表示あり' },
    { c: '食材・製品', n: 'マルハニチロ メディケア食品', u: 'https://www.medicare.maruha-nichiro.co.jp/', d: 'やさしいおかず等。カタログ・栄養成分のダウンロードあり' },
    { c: '食材・製品', n: 'ヘルシーフード', u: 'https://www.healthy-food.co.jp/', d: 'トロミパワースマイル、治療食・介護食の総合。施設向け販売（無料（購入は事業者向け））' },
    { c: '食材・製品', n: 'フードケア', u: 'https://www.food-care.co.jp/', d: 'ネオハイトロミール等。とろみ剤の比較資料が充実' },
    { c: '食材・製品', n: '大塚製薬工場', u: 'https://www.otsukakj.jp/', d: '経腸栄養剤、輸液。医療寄り（一部医療関係者向け）' },
    { c: '食材・製品', n: '日清オイリオ メディカルサポートサイト', u: 'https://www.oillio-medicalsupport.info/', d: 'MCTオイル、嚥下調整食の実務コラム（無料（一部会員登録））' },
    { c: '食材・製品', n: '学会分類2021対応商品検索（日本メディカルニュートリション協議会）', u: 'https://category.medicalnutrition.jp/', d: 'メーカー横断で学会分類コード別に商品を探せる。献立の食形態を決めるとき便利' },
    { c: '食材・製品', n: 'UDF 登録商品検索（日本介護食品協議会）', u: 'https://www.udf.jp/products/list.php', d: 'UDF区分別の登録商品一覧' },
    { c: '献立・レシピ', n: 'おいしい健康', u: 'https://oishi-kenko.com/', d: '管理栄養士監修のレシピ・献立。シニア向け、嚥下・低栄養予防のカテゴリあり（無料（一部有料））' },
    { c: '献立・レシピ', n: '味の素KK業務用 病院・高齢者施設向けお役立ち情報', u: 'https://foodservice.ajinomoto.co.jp/nutritionist/', d: '大量調理向けレシピ、行事食、減塩の工夫（無料（一部会員登録））' },
    { c: '献立・レシピ', n: 'MY介護の広場 しにあレシピ', u: 'https://www.my-kaigo.com/pub/individual/recipe/', d: '高齢者向けレシピ。家庭寄りだが行事食の発想に使える' },
    { c: '献立・レシピ', n: 'クックパッド', u: 'https://cookpad.com/', d: '量は多いが栄養価の担保はない。アイデア出し用（無料（一部有料））' },
    { c: '更新検知', n: '厚生労働省 RSS（新着情報）', u: 'https://www.mhlw.go.jp/stf/news.rdf', d: '厚労省サイト全体の新着。介護・食品を含む。RSS1.0形式（無料／再配布は禁止）' },
    { c: '更新検知', n: '厚生労働省 RSSの案内ページ', u: 'https://www.mhlw.go.jp/rss/index.html', d: '配信の種類と利用条件。メール配信サービスの案内もある' },
    { c: '更新検知', n: '文部科学省 RSS（新着情報）', u: 'https://www.mext.go.jp/b_menu/news/index.rdf', d: '成分表の更新もここに流れる' },
    { c: '更新検知', n: '消費者庁 RSS（新着情報）', u: 'https://www.caa.go.jp/news.rss', d: 'アレルギー表示の改正告知が流れる' },
    { c: '更新検知', n: '消費者庁 RSSの案内ページ', u: 'https://www.caa.go.jp/rss/', d: '配信の説明' },
    { c: '更新検知', n: '厚生労働省 報道発表資料', u: 'https://www.mhlw.go.jp/stf/houdou/index.html', d: 'RSSを使わない場合の代替。日付順に並ぶ' }
  ];
  // 使っているデータの版。how = 何を見れば更新に気づけるか（調査 06_最新情報とリンク.md）
  const SOURCES = [
    { id: 'foods', label: '日本食品標準成分表', version: '八訂 増補2023年（Excel 2026-03-27 版）',
      url: 'https://www.mext.go.jp/a_menu/syokuhinseibun/mext_00001.html',
      how: 'RSS は無い。配布ページの Excel のファイル名に日付が入る（20260327-…）ので、そこが変わったら差し替え。版名が同じままファイルだけ差し替わることがある。先に「公表履歴、今後の収載予定」ページに収載値（案）が出るので 2 か月ほど前に気づける',
      url2: 'https://www.mext.go.jp/a_menu/syokuhinseibun/mext_02092.html',
      note: '九訂の作業は行っていないと公式 Q&A（令和8年3月版）に明記', checkedAt: '' },
    { id: 'dri', label: '日本人の食事摂取基準', version: '2025年版（令和7〜11年度）',
      url: 'https://www.mhlw.go.jp/stf/newpage_44138.html',
      how: '5 年ごと。次は 2030 年版で、策定検討会は使用開始の約 1 年半前に立ち上がる。正誤表は版名を変えずに PDF が差し替わるので、ページの最終更新日を見る（現在 令和7年3月25日）',
      note: '', checkedAt: '' },
    { id: 'kaigo', label: '介護報酬改定・様式', version: '令和6年度改定',
      url: 'https://www.mhlw.go.jp/stf/shingi/shingi-hosho_126698_00022.html',
      how: '社会保障審議会 介護給付費分科会の一覧ページに開催回が増え、新しい回に NEW が付く。次の改定は令和9年度（2027年4月）。このページ 1 枚を見れば足りる',
      note: '様式は改定のたびに差し替わる', checkedAt: '' },
    { id: 'risk', label: '低栄養リスクの判定基準', version: '令和6年度（様式例）',
      url: 'https://www.mhlw.go.jp/stf/shingi/shingi-hosho_126698_00022.html',
      how: '平成17年以来見直されていない。2026-09-03 の第264回分科会で見直しが論点に上がったので、令和9年度改定で変わる見込み。変わったら 設定 → 低栄養リスクの判定値 を直す',
      note: '', checkedAt: '' },
    { id: 'engeshoku', label: '嚥下調整食分類', version: '学会分類2021',
      url: 'https://www.jsdr.or.jp/doc/classification2021.html',
      how: '2013 → 2021 で 8 年。次の予告は無い。学会サイトの新着情報を見る',
      note: '主食・副食マスタのコード欄', checkedAt: '' },
    { id: 'allergen', label: 'アレルギー表示の品目', version: '令和8年4月1日時点（義務 9・推奨 19）',
      url: 'https://www.caa.go.jp/policies/policy/food_labeling/food_sanitation/allergy/',
      how: '改正は 4 月 1 日施行が定番。「準ずるもの（推奨）→ 特定原材料（義務）」への昇格と、調査に基づく推奨品目の入れ替えが改正パターン。ページ上部の更新日を見る',
      note: '2026-04-01 カシューナッツが義務に昇格／2024-03-28 マカダミアナッツ追加・まつたけ削除／2023-03-09 くるみ義務化', checkedAt: '' },
    { id: 'life', label: 'LIFE CSV連携仕様', version: '3.10版（2026年5月11日更新）',
      url: 'https://www.mhlw.go.jp/stf/shingi2/0000198094_00037.html',
      how: '掲載ページのファイル名に【2026年5月11日更新】のように更新日が直接書いてある。同じ 0310 でも中身が違うことがあるので、版番号でなく更新日を見る',
      note: '2026 年 5 月に運営が国保中央会へ移管。CSV 出力は未実装', checkedAt: '' },
    { id: 'eisei', label: '大量調理施設衛生管理マニュアル', version: '最終改正 平成29年6月16日',
      url: 'https://www.mhlw.go.jp/stf/seisakunitsuite/bunya/kenkou_iryou/shokuhin/syokuchu/02.html',
      how: '9 年以上改正されていない。優先度は低い', note: '', checkedAt: '' }
  ];

  // リンク集・出典の作り直した回数。ここを上げると、手を入れていない人のぶんだけ新しい内容に入れ替わる
  const LINKS_VERSION = 2;
  const Master = { DEFAULTS: DEFAULTS, LINKS: LINKS, SOURCES: SOURCES, LINKS_VERSION: LINKS_VERSION, current: null };
  // 保存済みのマスタに、後から増えた項目だけを初期値で補う（既存の値は触らない）
  Master.merge = function (saved) {
    const out = JSON.parse(JSON.stringify(DEFAULTS));
    Object.keys(saved || {}).forEach((k) => { out[k] = saved[k]; });
    // 保存済みの一覧（食事・区分・食種など）に、後から足した項目を補う。
    // 既に入っている値は触らず、その id の既定に「あって保存側に無いキー」だけを足す
    Object.keys(DEFAULTS).forEach((k) => {
      const def = DEFAULTS[k], cur = out[k];
      if (!Array.isArray(def) || !Array.isArray(cur) || !def.length || typeof def[0] !== 'object') return;
      cur.forEach((item) => {
        if (!item || typeof item !== 'object') return;
        const d = def.find((x) => x.id === item.id);
        if (!d) return;
        Object.keys(d).forEach((key) => { if (!(key in item)) item[key] = JSON.parse(JSON.stringify(d[key])); });
      });
    });
    out.profile = (typeof Profile !== 'undefined' ? Profile : require('./profile.js')).normalize(out.profile);
    out.phrases = (typeof Phrases !== 'undefined' ? Phrases : require('./phrases.js')).merge(out.phrases);
    // リンク集: 自分で足したり消したりしていなければ、新しい既定に入れ替える
    if (!out.links || (!out.linksEdited && out.linksVersion !== LINKS_VERSION)) {
      out.links = JSON.parse(JSON.stringify(LINKS));
      out.linksVersion = LINKS_VERSION;
    }
    // 出典: 使う人が持つのは「確かめた日」と自分で直した版だけ。手がかり・URL は既定から取り直す
    if (!out.dataSources) out.dataSources = [];
    const keep = {};
    out.dataSources.forEach((x) => { keep[x.id] = x; });
    out.dataSources = SOURCES.map((s2) => {
      const old = keep[s2.id] || {};
      const rec = JSON.parse(JSON.stringify(s2));
      rec.checkedAt = old.checkedAt || '';
      if (old.versionEdited) { rec.version = old.version; rec.versionEdited = true; }
      if (old.noteEdited) { rec.note = old.note; rec.noteEdited = true; }
      return rec;
    }).concat(out.dataSources.filter((x) => !SOURCES.some((s2) => s2.id === x.id)));
    return out;
  };
  Master.load = async function () { Master.current = Master.merge(await window.DB.getMeta('masters', null)); return Master.current; };
  Master.save = async function () { await window.DB.setMeta('masters', Master.current); };
  if (typeof module !== 'undefined' && module.exports) module.exports = Master;
  (typeof window !== 'undefined' ? window : globalThis).Master = Master;
})();
