// 札幌市の区ごとの地域情報（area.html が読み込む）
// 取材した施設は、各区の posts に SNS の投稿のように1件ずつ足していく。
//   {
//     cat:     "medical",                         … カテゴリー（下の CATEGORIES の id）
//     name:    "○○クリニック",                    … 施設名（必須）
//     text:    "土曜の午前も診療。…",              … 取材メモ・紹介文
//     image:   "./images/area/minami-01.webp",     … 写真（なければ省略すると仮の画像になる）
//     address: "札幌市南区…",                      … 住所
//     url:     "https://…",                        … 公式サイトや Google マップ（なければ省略）
//   }
// 投稿がまだないカテゴリーは「取材準備中」の仮の投稿が並ぶ。

// icon は 24×24 の線画（SVG の path）
export const CATEGORIES = [
  { id: "medical", en: "MEDICAL", jp: "病院・クリニック", short: "病院", icon: "M12 5v14M5 12h14" },
  { id: "shopping", en: "SHOPPING", jp: "スーパー・買い物", short: "買い物", icon: "M5 8h14l-1.2 12H6.2L5 8zM9 8a3 3 0 0 1 6 0" },
  { id: "food", en: "FOOD", jp: "飲食店", short: "飲食店", icon: "M7 3v7a2 2 0 0 0 4 0V3M9 12v9M16 3c-2 1.5-2 7 0 8v10" },
  { id: "park", en: "PARK & KIDS", jp: "公園・子育て", short: "公園", icon: "M12 3 6.5 12h11L12 3zM12 12v9M8 21h8" },
  { id: "public", en: "PUBLIC", jp: "役所・公共施設", short: "役所", icon: "M4 20h16M6 20V10l6-5 6 5v10M10 20v-5h4v5" },
];

export const AREAS = [
  {
    id: "chuo",
    jp: "中央区",
    en: "CHUO",
    text: "大通公園やすすきの、円山エリアを含む札幌の中心部。地下鉄3路線が集まり、通勤・通学に便利です。",
    posts: [],
  },
  {
    id: "kita",
    jp: "北区",
    en: "KITA",
    text: "札幌駅の北側から北海道大学、麻生エリアまで広がる区。地下鉄南北線沿いに住宅地が続きます。",
    posts: [],
  },
  {
    id: "higashi",
    jp: "東区",
    en: "HIGASHI",
    text: "モエレ沼公園やサッポロビール博物館がある区。地下鉄東豊線沿いに住宅地が広がります。",
    posts: [],
  },
  {
    id: "shiroishi",
    jp: "白石区",
    en: "SHIROISHI",
    text: "地下鉄東西線と JR が通り、都心へのアクセスが良い区。駅の近くに商業施設が集まっています。",
    posts: [],
  },
  {
    id: "atsubetsu",
    jp: "厚別区",
    en: "ATSUBETSU",
    text: "新札幌駅の周辺に商業施設が集まる区。緑の多い、落ち着いた住宅地が広がります。",
    posts: [],
  },
  {
    id: "toyohira",
    jp: "豊平区",
    en: "TOYOHIRA",
    text: "地下鉄南北線・東豊線が通り、豊平川沿いに住宅地が広がる区。都心にも近く暮らしやすいエリアです。",
    posts: [],
  },
  {
    id: "kiyota",
    jp: "清田区",
    en: "KIYOTA",
    text: "緑の多い、落ち着いた住宅地の区。地下鉄は通っておらず、バスや車での移動が中心です。",
    posts: [],
  },
  {
    id: "minami",
    jp: "南区",
    en: "MINAMI",
    text: "真駒内公園や定山渓温泉がある、自然豊かな区。WAYNEST の店舗（川沿）があります。",
    shop: true,
    posts: [],
  },
  {
    id: "nishi",
    jp: "西区",
    en: "NISHI",
    text: "琴似や宮の沢を中心に、地下鉄東西線沿いに住宅地が広がる区。商店街も身近です。",
    posts: [],
  },
  {
    id: "teine",
    jp: "手稲区",
    en: "TEINE",
    text: "手稲山のふもとに広がる区。JR 函館本線が通り、小樽方面へのアクセスも便利です。",
    posts: [],
  },
];
