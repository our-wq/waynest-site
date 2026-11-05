// =========================================================
// 物件データ（サンプル）。物件検索（search.js）とお問い合わせ（entry.js）が使う
// 物件名・賃料などはすべて仮。本番は物件管理システムや CSV から書き出したデータに差し替える
//   rent / fee: 円、size: m²、age: 築年数（0 = 新築）、walk: 駅徒歩（分）
// =========================================================
export const ROOMS = [
  { id: "r01", name: "サンプル物件 A", ward: "中央区", line: "南北線", station: "中島公園", walk: 4, layout: "1LDK", size: 38.5, age: 3, rent: 78000, fee: 6000, deposit: 1, key: 0, features: ["バストイレ別", "オートロック", "新築・築浅"], status: "新着" },
  { id: "r02", name: "サンプル物件 B", ward: "南区", line: "南北線", station: "真駒内", walk: 7, layout: "2LDK", size: 55.2, age: 12, rent: 68000, fee: 4000, deposit: 1, key: 0, features: ["ペット可", "駐車場あり", "バストイレ別"], status: "新着" },
  { id: "r03", name: "サンプル物件 C", ward: "豊平区", line: "南北線", station: "平岸", walk: 5, layout: "1K", size: 24.0, age: 8, rent: 45000, fee: 3000, deposit: 0, key: 0, features: ["バストイレ別", "初期費用おさえめ"], status: "" },
  { id: "r04", name: "サンプル物件 D", ward: "北区", line: "南北線", station: "北18条", walk: 3, layout: "1R", size: 20.3, age: 15, rent: 36000, fee: 2000, deposit: 0, key: 0, features: ["家具家電付き", "初期費用おさえめ"], status: "" },
  { id: "r05", name: "サンプル物件 E", ward: "中央区", line: "東西線", station: "円山公園", walk: 6, layout: "1LDK", size: 42.8, age: 0, rent: 98000, fee: 8000, deposit: 1, key: 1, features: ["新築・築浅", "オートロック", "デザイナーズ"], status: "新着" },
  { id: "r06", name: "サンプル物件 F", ward: "白石区", line: "東西線", station: "南郷7丁目", walk: 9, layout: "2LDK", size: 58.0, age: 20, rent: 62000, fee: 3000, deposit: 1, key: 0, features: ["駐車場あり", "ペット可"], status: "内見可" },
  { id: "r07", name: "サンプル物件 G", ward: "西区", line: "東西線", station: "琴似", walk: 4, layout: "1DK", size: 30.1, age: 10, rent: 52000, fee: 3000, deposit: 0, key: 0, features: ["バストイレ別", "オートロック"], status: "" },
  { id: "r08", name: "サンプル物件 H", ward: "東区", line: "東豊線", station: "環状通東", walk: 2, layout: "1K", size: 25.5, age: 5, rent: 49000, fee: 3000, deposit: 0, key: 0, features: ["新築・築浅", "バストイレ別", "初期費用おさえめ"], status: "新着" },
  { id: "r09", name: "サンプル物件 I", ward: "豊平区", line: "東豊線", station: "福住", walk: 11, layout: "3LDK", size: 72.4, age: 18, rent: 85000, fee: 5000, deposit: 1, key: 0, features: ["ペット可", "駐車場あり"], status: "" },
  { id: "r10", name: "サンプル物件 J", ward: "厚別区", line: "東西線", station: "新さっぽろ", walk: 8, layout: "2DK", size: 44.0, age: 25, rent: 48000, fee: 2000, deposit: 0, key: 0, features: ["駐車場あり", "初期費用おさえめ"], status: "" },
  { id: "r11", name: "サンプル物件 K", ward: "中央区", line: "東豊線", station: "豊水すすきの", walk: 3, layout: "1R", size: 22.7, age: 2, rent: 58000, fee: 5000, deposit: 0, key: 0, features: ["デザイナーズ", "オートロック", "家具家電付き", "新築・築浅"], status: "申込あり" },
  { id: "r12", name: "サンプル物件 L", ward: "南区", line: "南北線", station: "澄川", walk: 6, layout: "1LDK", size: 40.0, age: 9, rent: 59000, fee: 4000, deposit: 1, key: 0, features: ["ペット可", "バストイレ別", "駐車場あり"], status: "内見可" },
];

// 検索の選択肢（トップの検索フォームと検索結果ページで共通）
export const WARDS = ["中央区", "北区", "東区", "白石区", "豊平区", "南区", "西区", "厚別区", "手稲区", "清田区"];
export const LINES = ["南北線", "東西線", "東豊線"];
export const LAYOUTS = [
  { value: "1r", label: "1R・1K", match: ["1R", "1K"] },
  { value: "1l", label: "1DK・1LDK", match: ["1DK", "1LDK"] },
  { value: "2", label: "2K〜2LDK", match: ["2K", "2DK", "2LDK"] },
  { value: "3", label: "3K以上", match: ["3K", "3DK", "3LDK", "4LDK"] },
];
export const FEATURES = ["ペット可", "バストイレ別", "オートロック", "駐車場あり", "新築・築浅", "家具家電付き", "初期費用おさえめ", "デザイナーズ"];

// 表示用の文字列
const yen = (n) => n.toLocaleString("ja-JP");
export const describe = (room) => ({
  name: room.name,
  area: `${room.ward}｜${room.line}「${room.station}」駅 徒歩${room.walk}分`,
  spec: `${room.layout} ／ ${room.size.toFixed(2)} m² ／ ${room.age === 0 ? "新築" : `築${room.age}年`}`,
  rent: `賃料 ${yen(room.rent)}円`,
  sub: `管理費 ${yen(room.fee)}円 ／ 敷金${room.deposit || "なし"}・礼金${room.key || "なし"}`,
});
