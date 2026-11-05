// =========================================================
// Firebase / LINE の接続設定
// 承認済みドメインでだけ本物の Firebase につなぐ。それ以外（共有中の Artifact など）は「擬似動作モード」で動く。
// localhost からの送信も本番の Firestore に保存される点に注意。
// =========================================================
const FIREBASE_HOSTS = ["localhost", "waynest-e3f4a.web.app", "waynest-e3f4a.firebaseapp.com"];

export const CONFIG = {
  useFirebase: FIREBASE_HOSTS.includes(location.hostname),

  // Firebase コンソール > プロジェクトの設定 > マイアプリ（waynest-web）の firebaseConfig
  // ウェブページに公開する前提の値（秘密ではない）。データの保護は firestore.rules と承認済みドメインで行う
  firebase: {
    apiKey: "AIzaSyDV4BcKuxJW8xQuDfAR6L57Dar5yV5s-QI",
    authDomain: "waynest-e3f4a.firebaseapp.com",
    projectId: "waynest-e3f4a",
    storageBucket: "waynest-e3f4a.firebasestorage.app",
    messagingSenderId: "778808897407",
    appId: "1:778808897407:web:ed6269fd6baaaea735b44a",
  },

  // Cloud Functions のリージョン（functions/index.js と合わせる）
  functionsRegion: "asia-northeast1",

  // LINE Developers > LINE ログインチャネル > チャネルID（公開して問題ない値）
  lineChannelId: "",

  // LINE ログイン時に、公式アカウントの友だち追加も案内する（受付完了を LINE で送るため）
  lineBotPrompt: "aggressive",
};
