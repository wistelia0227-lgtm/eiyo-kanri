// 保健所に出す栄養（管理）報告書の様式。DOM にも DB にも触れない（Node で試験できる）。window.HoukokuForms で公開。
// 様式は自治体ごとに違う。ここに入れてあるのは 2 つ:
//   fukuoka5   福岡県 様式第5号（第6条関係）「特定給食施設栄養報告書」（病院・老健・介護医療院・老人福祉施設・社会福祉施設）
//              毎年 2 月・7 月に実施した給食について、翌月 10 日までに管轄の保健福祉（環境）事務所へ。
//              大牟田市は福岡県の管轄（北九州市・福岡市・久留米市だけが別）。
//              https://www.pref.fukuoka.lg.jp/contents/kyushoku.html
//   kumamoto6  熊本県 別記第6号様式（第5条関係）その1「栄養管理状況報告書」（病院・老健・介護医療院・老人福祉施設・児童福祉施設・社会福祉施設）
//              荒尾市は熊本県の管轄（熊本市だけが別）。
//              https://www.pref.kumamoto.jp/soshiki/44/5084.html
// 項目名と選択肢の文言は、県が配っている Excel の中身のとおりにしてある（直さずに持つ）。
//
// 欄の種類:
//   text  1 行 / note 何行か / num 数 / choice 1 つ選ぶ（番号つき）/ multi いくつでも選ぶ
//   yesno 有無 / grid 行×列の表 / list 行を足していく表
// auto: その欄に、アプリが持っている数字を入れられる時の合図（modules/houkoku.js が計算する）。
(function (root) {
  'use strict';
  const HK = {};

  // ---- 食品群の対応表 ----
  // 様式の食品群の欄に、アプリの食品群（js/foodgroup.js）のどれを足し込むか。
  // 成分表の分類だけでは分けられない欄（大豆製品とみそ類の別など）は ids を空にして、手で書く欄として出す。
  HK.FG_FUKUOKA = [
    { g: '動物性食品', label: '魚介類', ids: ['fish'] },
    { g: '動物性食品', label: '肉類', ids: ['meat'] },
    { g: '動物性食品', label: '乳類', ids: ['milk'] },
    { g: '動物性食品', label: '卵類', ids: ['egg'] },
    { g: '野菜、果実類', label: '緑黄色野菜類', ids: ['gvege'] },
    { g: '野菜、果実類', label: '淡色野菜類', ids: ['ovege', 'pickle'], note: '野菜漬物類を含めた' },
    { g: '野菜、果実類', label: '海草類', ids: ['alga'] },
    { g: '野菜、果実類', label: 'いも類', ids: ['potato'] },
    { g: '野菜、果実類', label: '果実類', ids: ['fruit'] },
    { g: '穀類', label: '米', ids: ['rice'] },
    { g: '穀類', label: 'パン類', ids: ['bread'] },
    { g: '穀類', label: 'めん類', ids: ['noodle'] },
    { g: '豆類', label: '大豆製品', ids: ['bean'], note: '成分表の豆類をまとめて入れた（大豆製品と豆類は分けられない）' },
    { g: '豆類', label: '豆類', ids: [], note: '大豆製品と分けられないので、まとめて大豆製品に入れた' },
    { g: '豆類', label: 'みそ類', ids: [], note: 'みそは成分表では調味料。自動では出せない' },
    { g: '油脂類調味料', label: '油脂類', ids: ['oil'] },
    { g: '油脂類調味料', label: '砂糖類', ids: ['sugar'] },
    { g: '油脂類調味料', label: '菓子類', ids: ['sweets'] },
    { g: '', label: 'その他', ids: ['grain', 'seed', 'mushroom', 'drink', 'season', 'ready'],
      note: '穀類（その他）・種実類・きのこ類・し好飲料類・調味料類・調理済み流通食品をまとめた' }
  ];

  // ---- 福岡県 様式第5号 ----
  const FUKUOKA = {
    id: 'fukuoka5', pref: '福岡県', city: '大牟田市ほか（北九州市・福岡市・久留米市を除く）',
    formNo: '様式第5号（第6条関係）', title: '特定給食施設栄養報告書',
    subtitle: '（　　年 2 ・ 7 月分）',
    who: '病院・介護老人保健施設・介護医療院・老人福祉施設・社会福祉施設',
    to: '福岡県　　　　保健福祉（環境）事務所長　殿',
    when: '毎年 2 月・7 月に実施した給食について、実施月の翌月 10 日まで',
    law: '福岡県健康増進法施行細則第6条',
    url: 'https://www.pref.fukuoka.lg.jp/contents/kyushoku.html',
    attach: ['食品構成表', '食品使用量日計表'],
    head: [
      { k: 'text', id: 'shisetsu', label: '施設名', auto: true },
      { k: 'text', id: 'kanrisha', label: '管理者名' },
      { k: 'text', id: 'sakusei', label: '作成者名' }
    ],
    pages: [
      { id: 'omote', label: '（表）', blocks: [
        { no: '⒈', title: '施設の種類', fields: [
          { k: 'choice', id: 'kind', label: '', opts: ['病院', '介護老人保健施設', '介護医療院', '老人福祉施設', '社会福祉施設'], auto: true }
        ] },
        { no: '⒉', title: '所在地', fields: [
          { k: 'text', id: 'zip', label: '〒' },
          { k: 'text', id: 'addr', label: '住所', wide: true, auto: true }
        ] },
        { no: '⒊', title: '連絡先', fields: [
          { k: 'text', id: 'tel', label: '電話' }, { k: 'text', id: 'fax', label: 'FAX' },
          { k: 'text', id: 'mail', label: 'E-mail', wide: true }
        ] },
        { no: '⒋', title: '運営方法', fields: [
          { k: 'choice', id: 'unei', label: '', opts: ['直営', '委託', '一部委託'] },
          { k: 'text', id: 'itakuNaiyo', label: '一部委託の委託内容', wide: true },
          { k: 'text', id: 'itakuName', label: '委託先名称', wide: true }
        ] },
        { no: '⒌', title: '対象者別給食数', fields: [
          { k: 'grid', id: 'kyushoku', label: '', auto: true,
            rows: [{ id: 'nyusho', label: '患者・入所者等' }, { id: 'staff', label: '職員' },
              { id: 'other1', label: 'その他' }, { id: 'other2', label: '' }, { id: 'other3', label: '' }],
            cols: [{ id: 'teiin', label: '定員' }, { id: 'b', label: '朝食' }, { id: 'l', label: '昼食' },
              { id: 'd', label: '夕食' }, { id: 'o', label: 'その他' }, { id: 'sum', label: '合計', total: true }],
            totalRow: '合計' }
        ] },
        { no: '⒍', title: '食事提供時間', fields: [
          { k: 'text', id: 'timeB', label: '朝食' }, { k: 'text', id: 'timeL', label: '昼食' },
          { k: 'text', id: 'timeD', label: '夕食' }, { k: 'text', id: 'timeO', label: 'その他' }
        ] },
        { no: '⒎', title: '食種別給食数', fields: [
          { k: 'list', id: 'shokushu', label: '', auto: true,
            cols: [{ id: 'name', label: '食種名' }, { id: 'n', label: '１日食数', num: true }], min: 8, totalCol: 'n' }
        ] },
        { no: '⒏', title: '従事者数', fields: [
          { k: 'grid', id: 'staff', label: '',
            rows: [{ id: 'kanri', label: '管理栄養士' }, { id: 'ei', label: '栄養士' },
              { id: 'chori', label: '調理師' }, { id: 'in', label: '調理員' }],
            cols: [{ id: 'sj', label: '施設側 常勤' }, { id: 'sh', label: '施設側 常勤以外' },
              { id: 'ij', label: '委託側 常勤' }, { id: 'ih', label: '委託側 常勤以外' }] }
        ] },
        { no: '⒐', title: '栄養アセスメント', fields: [
          { k: 'grid', id: 'assess', label: '',
            rows: [{ id: 'height', label: '・身長' }, { id: 'weight', label: '・体重' }, { id: 'alb', label: '・アルブミン値' }],
            cols: [{ id: 'freq', label: '頻　度' }], text: true },
          { k: 'note', id: 'assessNote', label: '評価方法・対策等', rows: 4 }
        ] },
        { no: '⒑', title: 'その他', fields: [
          { k: 'num', id: 'kaigi', label: '・栄養管理会議', unit: '回／年', auto: true },
          { k: 'note', id: 'kaigiMember', label: '　　･構成メンバー', rows: 2 },
          { k: 'note', id: 'kaigiGidai', label: '　　・議題等', rows: 3, auto: true },
          { k: 'num', id: 'shiko', label: '・嗜好調査', unit: '回／年', auto: true },
          { k: 'choice', id: 'zanshokuHow', label: '・喫食（残食）調査', opts: ['個別', '一括'] },
          { k: 'text', id: 'zanshoku', label: '　　（毎食 ・　　回／月）', auto: true },
          { k: 'num', id: 'kenshuIn', label: '・給食に関する職員研修（所内）', unit: '回／年' },
          { k: 'num', id: 'kenshuOut', label: '・給食に関する職員研修（所外）', unit: '回／年' },
          { k: 'choice', id: 'tekion', label: '・適温給食の方法', opts: ['保温食器', '温冷配膳車', 'その他'] },
          { k: 'text', id: 'tekionOther', label: '　　その他（　　）' },
          { k: 'yesno', id: 'fukusu', label: '・複数献立', yes: '有', no: '無' },
          { k: 'text', id: 'fukusuN', label: '　　有（　日／月（　回／日））' },
          { k: 'yesno', id: 'sentaku', label: '・選択食（ｶﾌｪﾃﾘｱ方式）', yes: '有', no: '無', auto: true },
          { k: 'text', id: 'sentakuN', label: '　　有（　日／月（　回／日））', auto: true },
          { k: 'yesno', id: 'daycare', label: '・デイケア・デイサービス', yes: '有', no: '無' },
          { k: 'text', id: 'daycareN', label: '　　有（　回／週）' },
          { k: 'yesno', id: 'haishoku', label: '・配食サービス', yes: '有', no: '無' },
          { k: 'text', id: 'haishokuN', label: '　　有（　回／週）' },
          { k: 'note', id: 'etc', label: '・その他', rows: 2 }
        ] }
      ] },
      { id: 'ura', label: '（裏）', blocks: [
        { no: '⒒', title: '栄養給与状況', fields: [
          { k: 'text', id: 'kijunShu', label: '基準となる栄養量（食事の種類）', auto: true },
          { k: 'grid', id: 'nut', label: '', auto: true, text: true,
            rows: [
              { id: 'kcal', label: 'エネルギー', unit: '(kcal)' }, { id: 'prot', label: 'たんぱく質', unit: '(g)' },
              { id: 'fat', label: '脂質', unit: '(g)' }, { id: 'ca', label: 'カルシウム', unit: '(mg)' },
              { id: 'fe', label: '鉄', unit: '(mg)' }, { id: 'va', label: 'ビタミンＡ', unit: '(μgRE)' },
              { id: 'b1', label: 'ビタミンＢ１', unit: '(mg)' }, { id: 'b2', label: 'ビタミンＢ２', unit: '(mg)' },
              { id: 'vc', label: 'ビタミンＣ', unit: '(mg)' }, { id: 'fib', label: '食物繊維', unit: '(g)' },
              { id: 'nacl', label: '塩分（食塩相当量）', unit: '(g)' },
              { id: 'pe', label: 'たんぱく質エネルギー比', unit: '(%)' }, { id: 'fe2', label: '脂質エネルギー比', unit: '(%)' },
              { id: 'ce', label: '炭水化物エネルギー比', unit: '(%)' },
              { id: 'x1', label: '＊' }, { id: 'x2', label: '＊' }],
            cols: [{ id: 'kijun', label: '給与栄養基準量' }, { id: 'jitsu', label: '実給与栄養量' }],
            foot: '＊の欄は、記載されている項目以外で算出している栄養素があれば記入してください。' },
          { k: 'grid', id: 'food', label: '提供食品量', auto: true, text: true, groups: true,
            rows: HK.FG_FUKUOKA.map((x, i) => ({ id: 'f' + i, label: x.label, group: x.g, note: x.note })),
            cols: [{ id: 'comp', label: '食品構成' }, { id: 'given', label: '食品群別給与量' }] },
          { k: 'num', id: 'yen', label: '食材料費（報告月の1人1日あたりの平均、税込み）', unit: '円', auto: true }
        ] },
        { no: '⒓', title: '管理栄養士・栄養士による月間栄養指導件数（加算・非加算に関係なく記入してください。）', fields: [
          { k: 'grid', id: 'shido', label: '',
            rows: [{ id: 'group', label: '集団指導' }, { id: 'one', label: '個別指導' }, { id: 'visit', label: '訪問指導' }],
            cols: [{ id: 'n', label: '回　数', unit: '回' }, { id: 'p', label: '延べ人数', unit: '人' }] },
          { k: 'note', id: 'shidoNaiyo', label: '内　　容', rows: 3 }
        ] },
        { no: '⒔', title: '喫食者に対する情報提供', fields: [
          { k: 'yesno', id: 'kondate', label: '献立表の配布・掲示', yes: '実施', no: '未実施', auto: true },
          { k: 'yesno', id: 'seibun', label: '栄養成分の表示', yes: '実施', no: '未実施', auto: true },
          { k: 'text', id: 'seibunKomoku', label: '　　実施（項目：　　）', wide: true, auto: true }
        ] },
        { no: '⒕', title: '非常災害時の備え', fields: [
          { k: 'yesno', id: 'manual', label: '非常災害時の食事提供マニュアルの作成', yes: '有', no: '無' },
          { k: 'yesno', id: 'bichiku', label: '非常用食糧等の備蓄', yes: '有 → 下の欄も記入', no: '無' },
          { k: 'text', id: 'bichikuRyo', label: '・備蓄量　（　　）人分を（　　）日分備蓄' },
          { k: 'yesno', id: 'bichikuKondate', label: '・献立表の作成', yes: '有', no: '無' },
          { k: 'text', id: 'bichikuBasho', label: '・保管場所', wide: true },
          { k: 'note', id: 'bichikuNaiyo', label: '備蓄内容（食料や水以外の、食器、調理器具等も含む。）', rows: 3 }
        ] }
      ] }
    ]
  };

  // ---- 熊本県 別記第6号様式 その1 ----
  const KUMAMOTO = {
    id: 'kumamoto6', pref: '熊本県', city: '荒尾市ほか（熊本市を除く）',
    formNo: '別記第６号様式（第５条関係）その１', title: '栄養管理状況報告書',
    subtitle: '（病院・介護老人保健施設・介護医療院・老人福祉施設・児童福祉施設（認定こども園及び保育所を除く。）・社会福祉施設）',
    who: '病院・介護老人保健施設・介護医療院・老人福祉施設・児童福祉施設・社会福祉施設',
    to: '熊本県知事　殿',
    when: '県の保健所（荒尾市は有明保健所）へ。提出時期は保健所の案内による',
    law: '熊本県健康増進法施行細則第5条',
    url: 'https://www.pref.kumamoto.jp/soshiki/44/5084.html',
    attach: [],
    head: [
      { k: 'text', id: 'setchiAddr', label: '設置者 住所' },
      { k: 'text', id: 'setchiName', label: '設置者 氏名', hint: '法人にあっては、その名称、主たる事務所の所在地及び代表者の氏名' },
      { k: 'text', id: 'shisetsu', label: '施設名', auto: true }
    ],
    pages: [
      { id: 'kanrisha', label: '【管理者記入用】', blocks: [
        { no: 'A', title: '基本情報', fields: [
          { k: 'text', id: 'addr', label: '所在地', wide: true, auto: true },
          { k: 'text', id: 'tel', label: '電話番号' },
          { k: 'text', id: 'kanrishaName', label: '管理者名' },
          { k: 'choice', id: 'kind', label: '施設種類',
            opts: ['病院', '介護老人保健施設', '介護医療院', '老人福祉施設', '児童福祉施設', '社会福祉施設'], auto: true },
          { k: 'choice', id: 'shitei', label: '健康増進法第21条第1項の指定', opts: ['有', '無'] },
          { k: 'choice', id: 'unei', label: '運営方式', opts: ['直営', '委託'] },
          { k: 'grid', id: 'staff', label: '給食従事者数',
            rows: [{ id: 'kanri', label: '管理栄養士' }, { id: 'ei', label: '栄 養 士' }, { id: 'chori', label: '調 理 師' },
              { id: 'sagyo', label: '調理作業員' }, { id: 'jimu', label: '事務職員等' }],
            cols: [{ id: 'sj', label: '施設側 常勤' }, { id: 'sh', label: '施設側 非常勤' },
              { id: 'ij', label: '委託先 常勤' }, { id: 'ih', label: '委託先 非常勤' }], totalRow: '合　　　　計' },
          { k: 'text', id: 'itakuName', label: '委託先 名称', wide: true },
          { k: 'text', id: 'itakuAddr', label: '委託先 所在地', wide: true },
          { k: 'text', id: 'itakuDaihyo', label: '委託先 代表者氏名' },
          { k: 'text', id: 'itakuTanto', label: '施設担当者氏名' },
          { k: 'multi', id: 'itakuNaiyo', label: '委 託 内 容',
            opts: ['献立作成', '材料購入', '調理', '盛付', '配膳', '下膳', '食器洗浄', '施設外調理', 'その他'] },
          { k: 'grid', id: 'shokusu', label: '食事の種類と食数', auto: true,
            rows: [{ id: 'b', label: '朝　　　食' }, { id: 'l', label: '昼　　　食' }, { id: 'd', label: '夕　　　食' },
              { id: 'o', label: 'そ の 他（夜食、間食等）' }],
            cols: [{ id: 'jo', label: '一般食 常食' }, { id: 'nan', label: '一般食 軟食' }, { id: 'kizami', label: '一般食 刻み食' },
              { id: 'ryudo', label: '一般食 流動食' }, { id: 'ippanOther', label: '一般食 その他' },
              { id: 'jinzo', label: '特別食 腎臓食' }, { id: 'tonyo', label: '特別食 糖尿病食' }, { id: 'tokuOther', label: '特別食 その他' },
              { id: 'daycare', label: '通所等 デイケア' }, { id: 'dayservice', label: '通所等 ﾃﾞｲｻｰﾋﾞｽ' },
              { id: 'haishoku', label: '通所等 配食サービス' }, { id: 'shokuin', label: 'その他（職員食など）' }],
            totalRow: '合　　　計', foot: '通所は一般食・特別食に含めない' }
        ] },
        { no: 'B', title: '体制整備', fields: [
          { k: 'yesno', id: 'buWmon', label: '栄養管理部門の位置付け', yes: '有', no: '無' },
          { k: 'choice', id: 'bumon', label: '　部　門',
            opts: ['栄養部門', '診療部門', '診療協力部門', '看護・リハビリ部門', '事務部門', 'その他'] },
          { k: 'yesno', id: 'rinen', label: '給食の理念・方針・目標', yes: '有', no: '無' },
          { k: 'yesno', id: 'shuchi', label: '　施設内での周知', yes: '有', no: '無' },
          { k: 'multi', id: 'mokuhyo', label: '　内容（目標）＊施設で周知しているもののみ',
            opts: ['QOL（生活の質）の向上', '疾病の改善', '健康の保持増進', '適切な栄養素の摂取',
              '楽しい食事', '安心安全な食事', '安価での提供', 'その他'] },
          { k: 'yesno', id: 'kaigi', label: '栄養管理等に関する会議', yes: '有', no: '無', auto: true },
          { k: 'multi', id: 'kaigiMoku', label: '　目的（複数可）',
            opts: ['有病者の治療', '適正体重者の増加', '食事摂取の適正化', '利用者の満足度の向上',
              '利用者に適した健康・食に関する情報の提供', '品質管理の向上', '衛生管理の徹底', 'その他'] },
          { k: 'multi', id: 'kaigiSei', label: '　構成（施設側）',
            opts: ['管理者', '医師', '看護師', '薬剤師', '管理栄養士／栄養士', '調理師／調理作業員', '患者／入所者',
              '介護担当者', '理学療法士／作業療法士／言語聴覚士', '事務職', 'その他'] },
          { k: 'multi', id: 'kaigiSeiI', label: '　構成（委託先）',
            opts: ['管理栄養士/栄養士', '調理師/調理作業員', '事務職', 'その他'] },
          { k: 'choice', id: 'kaigiKai', label: '　回数',
            opts: ['年１回', '年２〜３回', '年４〜６回', '年７〜１１回', '年１２回以上'], auto: true },
          { k: 'yesno', id: 'renkei', label: '栄養管理等に関する連携体制（施設外）', yes: '有', no: '無' },
          { k: 'multi', id: 'renkeiSaki', label: '　連携先（複数可）',
            opts: ['医療機関', '福祉施設', '学校', '事業所', '医療保険者', '市町村', '保健所', 'その他'] },
          { k: 'multi', id: 'renkeiNaiyo', label: '　内容（複数可）',
            opts: ['退院（退所）後の栄養管理方針検討', '退院（退所）時の情報提供', '入院（入所）前の情報入手', 'その他'] },
          { k: 'yesno', id: 'jinzai', label: '従事者の人材育成', yes: '有', no: '無' },
          { k: 'multi', id: 'jinzaiShoku', label: '　職種（複数可）',
            opts: ['管理栄養士', '栄養士', '調理師/調理作業員', '事務職員', 'その他'] },
          { k: 'multi', id: 'jinzaiHoho', label: '　方法（複数可）',
            opts: ['研修会の参加（施設内）', '研修会の参加（施設外）', '計画的なOJT（現場での教育）の実施', 'その他'] },
          { k: 'yesno', id: 'hijo', label: '非常時（災害等）への備え', yes: '有', no: '無' },
          { k: 'yesno', id: 'hijoManual', label: '　非常時の対応マニュアル', yes: '有', no: '無' },
          { k: 'yesno', id: 'hijoRenkei', label: '　他施設との非常時の連携体制', yes: '有', no: '無' },
          { k: 'text', id: 'hijoBichiku', label: '　食糧等の備蓄（　人分を　日分）' }
        ] },
        { no: 'F', title: '改善（管理者記入用）', fields: [
          { k: 'choice', id: 'tekisetsu', label: '適切な栄養管理の実施', opts: ['有', '一部有', '無'] },
          { k: 'multi', id: 'tekisetsuNaiyo', label: '　内容（複数可）',
            opts: ['有病者の治療', '適正体重者の増加', '食事摂取の適正化', '利用者の満足度の向上',
              '利用者に適した健康・食に関する情報の提供', '品質管理の向上', '衛生管理の徹底', 'その他'] },
          { k: 'yesno', id: 'jikoA', label: '施設の自己評価・今後改善したいことなど', yes: '有', no: '無' },
          { k: 'note', id: 'jikoANaiyo', label: '　内　容', rows: 3 }
        ] }
      ] },
      { id: 'tanto', label: '【業務担当者記入用】', blocks: [
        { no: 'C', title: 'アセスメント・評価', fields: [
          { k: 'yesno', id: 'haaku', label: '給食対象者の把握', yes: '有', no: '無' },
          { k: 'grid', id: 'age', label: '　年齢階級別（一般食のみ。階級は日本人の食事摂取基準に準じる）', auto: true,
            rows: [{ id: 'm', label: '男' }, { id: 'f', label: '女' }],
            // 様式の年齢階級は空欄。日本人の食事摂取基準（2025年版）の区分を入れてある
            cols: [{ id: 'a1', label: '〜17歳' }, { id: 'a2', label: '18〜29歳' }, { id: 'a3', label: '30〜49歳' },
              { id: 'a4', label: '50〜64歳' }, { id: 'a5', label: '65〜74歳' }, { id: 'a6', label: '75〜84歳' },
              { id: 'a7', label: '85歳〜' }, { id: 'a8', label: '' }, { id: 'a9', label: '' },
              { id: 'sum', label: '合　計', total: true }], totalRow: '合　　　計' },
          { k: 'yesno', id: 'kajo', label: 'エネルギー摂取の過不足の評価', yes: '有', no: '無' },
          { k: 'grid', id: 'bmi', label: '', auto: true, text: true,
            rows: [{ id: 'y3', label: '3〜17歳', a: 'や　せ', b: '肥　満' },
              { id: 'y18', label: '18〜49歳', a: 'BMI18.5未満', b: 'BMI25.0以上' },
              { id: 'y50', label: '50〜64歳', a: 'BMI20.0未満', b: 'BMI25.0以上' },
              { id: 'y65', label: '65歳以上', a: 'BMI21.5未満', b: 'BMI25.0以上' }],
            cols: [{ id: 'low', label: 'やせ・低体重（％）' }, { id: 'high', label: '肥満（％）' }] },
          { k: 'yesno', id: 'ijikaizen', label: '疾病状況等の維持・改善把握', yes: '有', no: '無' },
          { k: 'text', id: 'kaizenritsu', label: '　年間改善率（改善者/該当者×100）', wide: true,
            hint: '1糖尿病 2高血圧症 3脂質異常症 4貧血 5低栄養 6その他' },
          { k: 'yesno', id: 'hyoka', label: '提供した食事の評価（一般食について）', yes: '有', no: '無' },
          { k: 'yesno', id: 'sesshu', label: '　摂取状況の把握', yes: '有', no: '無', auto: true },
          { k: 'choice', id: 'sesshuHoho', label: '　方法',
            opts: ['摂取量調査', '残食調査（個別：主食、副食別）', '残食調査（個別：一括）',
              '残食調査（集団：主食、副食別）', '残食調査（集団：一括）', 'その他'], auto: true },
          { k: 'yesno', id: 'anketo', label: '　利用者による食事サービスの評価（アンケート調査等）', yes: '有', no: '無', auto: true },
          { k: 'yesno', id: 'sesshuryo', label: '栄養素摂取量の評価（一般食について）', yes: '有', no: '無' },
          { k: 'text', id: 'sesshuCond', label: '　対象の条件', wide: true,
            hint: '食事の種類／年齢／性別／対象者数／対象食事／摂取日数（連続・非連続）' },
          { k: 'grid', id: 'sesshuTable', label: '', text: true,
            rows: [{ id: 'ear', label: '推定平均必要量(EAR)以下の者の割合(%)' },
              { id: 'ul', label: '耐容上限量(UL)を超える者の割合(%)' },
              { id: 'dg', label: '目標量（DG）の範囲を逸脱する者の割合(%)' }],
            cols: [{ id: 'prot', label: 'たんぱく質' }, { id: 'va', label: 'ビタミンA' }, { id: 'b1', label: 'B1' },
              { id: 'b2', label: 'B2' }, { id: 'vc', label: 'C' }, { id: 'ca', label: 'ｶﾙｼｳﾑ' }, { id: 'fe', label: '鉄' },
              { id: 'nacl', label: '食塩相当量' }, { id: 'fib', label: '食物繊維' }, { id: 'k', label: 'カリウム' },
              { id: 'fat', label: '脂質' }, { id: 'sfa', label: '飽和脂肪酸' }] },
          { k: 'yesno', id: 'feedback', label: '評価結果のフィードバック', yes: '有', no: '無' },
          { k: 'multi', id: 'fbNaiyo', label: '　内容',
            opts: ['摂取状況', '提供栄養量', '利用者による食事評価', '体重変化量、BMI', '栄養素摂取状況',
              '疾病改善状況', '生活習慣改善状況', 'その他'] },
          { k: 'multi', id: 'fbKatsuyo', label: '　結果の活用方法',
            opts: ['給与栄養目標量の見直し', '献立の見直し', '食事の種類の見直し', '栄養教育の見直し',
              '食事形態や食器等の見直し', '食環境の見直し', 'その他'] },
          { k: 'multi', id: 'fbItaku', label: '　委託の場合',
            opts: ['契約の見直し', '委託先との協議', 'その他'] }
        ] },
        { no: 'D', title: '計画', fields: [
          { k: 'yesno', id: 'keikaku', label: '対象者に合わせた食事計画（一般食について）', yes: '有', no: '無' },
          { k: 'yesno', id: 'mokuhyoryo', label: '　給与栄養目標量の設定', yes: '有', no: '無' },
          { k: 'choice', id: 'settei', label: '　設定の種類', opts: ['１種類のみ', '（　）種類', '個別に作成'], auto: true },
          { k: 'multi', id: 'setteiKomoku', label: '　設定に使用する項目（複数可）',
            opts: ['性', '年齢', '身体活動レベル', '身長・体重・BMI', '臨床症状・臨床検査', '疾病状況',
              '摂取量調査（全員）', '摂取量調査（一部）', 'その他'], auto: true },
          { k: 'choice', id: 'kijun', label: '　活用の基準', opts: ['日本人の食事摂取基準', 'その他'], auto: true },
          { k: 'yesno', id: 'minaoshi', label: '　設定の見直し', yes: '有', no: '無' },
          { k: 'choice', id: 'minaoshiKai', label: '　見直しの頻度',
            opts: ['年１回', '年２〜３回', '年４〜６回', '年７〜１１回', '年１２回以上'] }
        ] },
        { no: 'E', title: '実施', fields: [
          { k: 'yesno', id: 'sanshutsu', label: '給与栄養量の算出（一般食について）', yes: '有', no: '無' },
          { k: 'text', id: 'sanshutsuCond', label: '　算出期間・食種・平均喫食者数', wide: true, auto: true },
          { k: 'grid', id: 'kyuyo', label: '　給与栄養量', auto: true, text: true,
            rows: [{ id: 'avg', label: '平均値' }, { id: 'min', label: '最小値' }, { id: 'max', label: '最大値' }],
            cols: [{ id: 'kcal', label: 'ｴﾈﾙｷﾞｰ(kcal)' }, { id: 'prot', label: 'たんぱく質(g)' }, { id: 'protE', label: 'たんぱく質(%ｴﾈﾙｷﾞｰ)' },
              { id: 'va', label: 'A(μgRAE)' }, { id: 'b1', label: 'B1(mg)' }, { id: 'b2', label: 'B2(mg)' }, { id: 'vc', label: 'C(mg)' },
              { id: 'ca', label: 'ｶﾙｼｳﾑ(mg)' }, { id: 'fe', label: '鉄(mg)' }, { id: 'nacl', label: '食塩相当量(g)' },
              { id: 'fib', label: '食物繊維(g)' }, { id: 'k', label: 'カリウム(mg)' }, { id: 'fatE', label: '脂質(%ｴﾈﾙｷﾞｰ)' },
              { id: 'sfaE', label: '飽和脂肪酸(%ｴﾈﾙｷﾞｰ)' }] },
          { k: 'yesno', id: 'kufu', label: '食事提供の方法の工夫', yes: '有', no: '無' },
          { k: 'yesno', id: 'chosei', label: '　給食量の調整', yes: '有', no: '無' },
          { k: 'text', id: 'shushoku', label: '　主食の量（　）種類・副食の量（　）種類', wide: true, auto: true },
          { k: 'text', id: 'hokyu', label: '　栄養補給法（経口のみ／経腸のみ／併用／静脈栄養／その他　各　人）', wide: true },
          { k: 'yesno', id: 'manage', label: '　栄養マネジメント加算', yes: '有', no: '無' },
          { k: 'choice', id: 'manageWho', label: '　　対象', opts: ['全員', '一部（　　）人'] },
          { k: 'yesno', id: 'keiko', label: '　経口維持・移行加算', yes: '有', no: '無' },
          { k: 'text', id: 'keikoN', label: '　　実施人数（　）人/年' },
          { k: 'yesno', id: 'gyoji', label: '　行事食の提供', yes: '有', no: '無', auto: true },
          { k: 'yesno', id: 'hinshitsu', label: '品質管理の実施', yes: '有', no: '無' },
          { k: 'yesno', id: 'tekion', label: '　適温給食の実施', yes: '有', no: '無' },
          { k: 'yesno', id: 'morituke', label: '　盛り付け量の把握', yes: '有', no: '無' },
          { k: 'yesno', id: 'moritukeSan', label: '　1人分の盛り付け量の算出', yes: '有', no: '無' },
          { k: 'yesno', id: 'eisei', label: '　衛生管理の実施', yes: '有', no: '無', auto: true },
          { k: 'yesno', id: 'joho', label: '対象者への健康・栄養情報の提供', yes: '有', no: '無' },
          { k: 'multi', id: 'johoNaiyo', label: '　内容（複数可）',
            opts: ['疾病・ﾒﾀﾎﾞﾘｯｸｼﾝﾄﾞﾛｰﾑ', 'BMI・体重', '自己の適切な食事量', '野菜・果物摂取量', '間食',
              '欠食・食事リズム', '調理法', '塩分摂取', '身体活動', '飲酒・たばこ', 'その他'] },
          { k: 'yesno', id: 'keiji', label: '　献立表の掲示', yes: '有', no: '無', auto: true },
          { k: 'yesno', id: 'seibun', label: '　メニューの栄養成分表示', yes: '有', no: '無', auto: true },
          { k: 'yesno', id: 'model', label: '　モデル的な料理の組合せ提示', yes: '有', no: '無' },
          { k: 'yesno', id: 'guide', label: '　メニューの食事ﾊﾞﾗﾝｽガイド表示', yes: '有', no: '無' },
          { k: 'yesno', id: 'kyoiku', label: '栄養教育（年間）', yes: '有', no: '無' },
          { k: 'grid', id: 'kyoikuTable', label: '',
            rows: [{ id: 'nyuin', label: '個別　入院（入所）' }, { id: 'gairai', label: '個別　外来（通所）' },
              { id: 'homon', label: '個別　訪問' }, { id: 'shudan', label: '集団' }],
            cols: [{ id: 'n', label: '回　数' }, { id: 'p', label: '延人数' }] }
        ] },
        { no: 'F', title: '改善（業務担当者記入用）', fields: [
          { k: 'yesno', id: 'jikoB', label: '施設の自己評価・今後改善したいことなど', yes: '有', no: '無' },
          { k: 'note', id: 'jikoBNaiyo', label: '　内　容', rows: 3 },
          { k: 'text', id: 'tanto', label: '報告書担当者（職種・氏名）', wide: true }
        ] }
      ] }
    ]
  };

  HK.FORMS = [FUKUOKA, KUMAMOTO];
  HK.form = (id) => HK.FORMS.find((f) => f.id === id) || null;
  HK.blocks = function (form) {
    const out = [];
    form.pages.forEach((p) => p.blocks.forEach((b) => out.push(Object.assign({ page: p.id }, b))));
    return out;
  };
  HK.fields = function (form) {
    const out = [];
    HK.blocks(form).forEach((b) => b.fields.forEach((f) => out.push(Object.assign({ block: b.no, page: b.page }, f))));
    return form.head.concat(out);
  };
  HK.field = function (form, id) { return HK.fields(form).find((f) => f.id === id) || null; };
  // 保存の鍵。様式ごと・年度（期間）ごとに 1 つ
  HK.key = (formId, period) => 'houkoku_' + formId + '_' + period;
  // アプリが埋められる欄の一覧
  HK.autoFields = (form) => HK.fields(form).filter((f) => f.auto);

  // 欄が空かどうか（書き残しを数えるため）。grid と list は中身が 1 つでもあれば書いたことにする
  HK.filled = function (f, v) {
    if (v == null) return false;
    if (f.k === 'grid' || f.k === 'list') {
      if (typeof v !== 'object') return false;
      return HK.anyValue(v);
    }
    if (f.k === 'multi') return Array.isArray(v) && v.length > 0;
    return String(v).trim() !== '';
  };
  // 入れ子のオブジェクト・配列のどこかに中身があるか（表の欄が空かどうかを見るのに使う）
  HK.anyValue = function (v) {
    if (v == null) return false;
    if (Array.isArray(v)) return v.some(HK.anyValue);
    if (typeof v === 'object') return Object.keys(v).some((k) => HK.anyValue(v[k]));
    return String(v).trim() !== '';
  };
  HK.progress = function (form, values) {
    const list = HK.fields(form);
    const done = list.filter((f) => HK.filled(f, (values || {})[f.id])).length;
    return { done: done, all: list.length };
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = HK;
  root.HoukokuForms = HK;
})(typeof window !== 'undefined' ? window : globalThis);
