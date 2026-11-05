// =========================================================
// ログインと送信の窓口。entry.js はここだけを使う。
//   - CONFIG.useFirebase が false → 擬似動作（ブラウザ内だけで完結）
//   - true → Firebase Authentication（Google / LINE / ゲスト）＋ Firestore に保存
//   - false で ADMIN_TOOL_URL があるとき → 相談管理ツール（Apps Script）に直接送る（ログインなし）
// どちらも同じ形の user を返す: { provider: "google" | "line", name, email } / ゲストは null
// =========================================================
import { CONFIG } from "./firebase-config.js";

const SDK = "https://www.gstatic.com/firebasejs/12.0.0";

// 相談管理ツールのウェブアプリURL（…/exec）。Firebase で公開していないページ（claude.ai の複製など）は、ここに直接送る
const ADMIN_TOOL_URL = "https://script.google.com/macros/s/AKfycbyoZuCaBO3R4PJxJSCezcL2yIJqfjI4v8kPTaK59PfRbhblVFvdB-UfsxM3anqFs80L/exec";

export async function createBackend() {
  if (CONFIG.useFirebase && CONFIG.firebase) return createFirebaseBackend();
  return ADMIN_TOOL_URL ? createAdminToolBackend() : createMockBackend();
}

// ---------- 擬似動作 ----------
function createMockBackend() {
  const KEY = "waynest-user";
  const USERS = {
    google: { provider: "google", name: "ウェイネスト 太郎", email: "taro.waynest@example.com" },
    line: { provider: "line", name: "ウェイネスト 太郎", email: "" }, // LINE はメールが取れないこともある
  };
  const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  const load = () => {
    try { return JSON.parse(localStorage.getItem(KEY)); } catch { return null; }
  };
  const save = (user) => {
    try { user ? localStorage.setItem(KEY, JSON.stringify(user)) : localStorage.removeItem(KEY); } catch { /* 保存できなくても進める */ }
  };

  return {
    mode: "mock",
    lineEnabled: true,
    async init() {
      const saved = load();
      return saved && USERS[saved.provider] ? saved : null;
    },
    async signIn(provider) {
      await wait(900);
      save(USERS[provider]);
      return USERS[provider];
    },
    async signInGuest() { return null; },
    async signOut() { save(null); },
    async submit() { await wait(900); },
  };
}

// ---------- 相談管理ツールに直接送る ----------
function createAdminToolBackend() {
  return {
    mode: "admin-tool",
    lineEnabled: false,
    async init() { return null; },
    async signIn() { return null; },
    async signInGuest() { return null; },
    async signOut() {},
    async submit(data) {
      // text/plain で送ると、ブラウザの事前確認（CORS）なしで届く
      const res = await fetch(ADMIN_TOOL_URL, {
        method: "POST",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify({ kind: "form", ...data }),
      });
      const out = await res.json().catch(() => ({ ok: false }));
      if (!out.ok) throw new Error(out.error || "送信できませんでした。時間をおいて、もう一度お試しください。");
    },
  };
}

// ---------- Firebase ----------
async function createFirebaseBackend() {
  const [{ initializeApp }, authMod, fsMod, fnMod] = await Promise.all([
    import(`${SDK}/firebase-app.js`),
    import(`${SDK}/firebase-auth.js`),
    import(`${SDK}/firebase-firestore.js`),
    import(`${SDK}/firebase-functions.js`),
  ]);
  const {
    getAuth, GoogleAuthProvider, signInWithPopup, signInWithRedirect, getRedirectResult,
    signInWithCustomToken, signInAnonymously, signOut, onAuthStateChanged,
  } = authMod;
  const { getFirestore, collection, addDoc, serverTimestamp } = fsMod;
  const { getFunctions, httpsCallable } = fnMod;

  const app = initializeApp(CONFIG.firebase);
  const auth = getAuth(app);
  auth.languageCode = "ja";
  const db = getFirestore(app);
  const functions = getFunctions(app, CONFIG.functionsRegion);

  // LINE のコールバック先：このページ自身（クエリなし）。LINE Developers にも同じ URL を登録する
  const redirectUri = `${location.origin}${location.pathname}`;
  const LINE_KEY = "waynest-line-login";

  const toUser = async (fbUser) => {
    if (!fbUser || fbUser.isAnonymous) return null;
    const { claims } = await fbUser.getIdTokenResult();
    const provider = claims.provider === "line" ? "line" : "google";
    // LINE のメールは Auth に入れず claims（lineEmail）で受け取る（functions/index.js 参照）
    return { provider, name: fbUser.displayName || "", email: fbUser.email || claims.lineEmail || "" };
  };

  const randomString = () => [...crypto.getRandomValues(new Uint8Array(16))].map((b) => b.toString(16).padStart(2, "0")).join("");

  // LINE ログインから戻ってきたとき：code を Cloud Functions に渡して Firebase にログイン
  const finishLineLogin = async () => {
    const params = new URLSearchParams(location.search);
    if (!params.has("state") || !(params.has("code") || params.has("error"))) return;
    let saved = null;
    try { saved = JSON.parse(sessionStorage.getItem(LINE_KEY)); sessionStorage.removeItem(LINE_KEY); } catch { /* なし */ }
    // 元の ?type=...&id=... に戻す（entry.js はこのあと URL を読む）
    history.replaceState(null, "", `${location.pathname}${saved?.returnSearch || ""}`);
    if (params.has("error")) return; // キャンセルされた
    if (!saved || saved.state !== params.get("state")) throw new Error("LINE ログインの確認に失敗しました。もう一度お試しください。");
    const lineLogin = httpsCallable(functions, "lineLogin");
    const { data } = await lineLogin({ code: params.get("code"), redirectUri, nonce: saved.nonce });
    await signInWithCustomToken(auth, data.token);
  };

  return {
    mode: "firebase",
    lineEnabled: Boolean(CONFIG.lineChannelId), // LINE のチャネルが未設定のあいだはボタンを出さない
    async init() {
      await finishLineLogin();
      await getRedirectResult(auth).catch(() => null); // Google をリダイレクトでログインした場合
      const fbUser = await new Promise((resolve) => {
        const stop = onAuthStateChanged(auth, (u) => { stop(); resolve(u); });
      });
      return toUser(fbUser);
    },
    async signIn(provider) {
      if (provider === "google") {
        const google = new GoogleAuthProvider();
        google.setCustomParameters({ prompt: "select_account" });
        try {
          const { user } = await signInWithPopup(auth, google);
          return toUser(user);
        } catch (e) {
          // ポップアップが使えない環境はリダイレクトで
          if (e.code === "auth/popup-blocked" || e.code === "auth/operation-not-supported-in-this-environment") {
            await signInWithRedirect(auth, google);
            return new Promise(() => {}); // ページ移動するので戻らない
          }
          throw e;
        }
      }
      // LINE：LINE の認可画面へ移動（戻り先は finishLineLogin）
      const state = randomString();
      const nonce = randomString();
      sessionStorage.setItem(LINE_KEY, JSON.stringify({ state, nonce, returnSearch: location.search }));
      const url = new URL("https://access.line.me/oauth2/v2.1/authorize");
      url.search = new URLSearchParams({
        response_type: "code",
        client_id: CONFIG.lineChannelId,
        redirect_uri: redirectUri,
        state,
        nonce,
        scope: "profile openid email",
        bot_prompt: CONFIG.lineBotPrompt,
        ui_locales: "ja-JP",
      }).toString();
      location.assign(url);
      return new Promise(() => {}); // ページ移動するので戻らない
    },
    async signInGuest() {
      // ゲストも匿名ログインさせ、Firestore のルールで「ログイン済みだけ書ける」にそろえる
      if (!auth.currentUser) await signInAnonymously(auth);
      return null;
    },
    async signOut() { await signOut(auth); },
    async submit(data) {
      if (!auth.currentUser) await signInAnonymously(auth);
      const fbUser = auth.currentUser;
      const user = await toUser(fbUser);
      await addDoc(collection(db, "inquiries"), {
        ...data,
        uid: fbUser.uid,
        provider: user ? user.provider : "guest",
        status: "new",
        createdAt: serverTimestamp(),
      });
    },
  };
}
