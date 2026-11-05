// 公開前の入口：Firestore の editors に登録された Google アカウントでログインした人にだけ、ページの中身を見せる。
// 一般公開するときは PRELAUNCH を false にし、firebase.json の X-Robots-Tag を外してデプロイする。
//
// 注意：画面を隠しているだけで、HTML・CSS・JS のファイルそのものは URL を指定すれば取得できる。
// 他人に絶対に見せられない情報（本物の個人情報、未公開の契約条件など）はページに書かないこと。
(() => {
  const PRELAUNCH = true;
  const HOSTS = ["localhost", "waynest-e3f4a.web.app", "waynest-e3f4a.firebaseapp.com"];
  if (!PRELAUNCH || !HOSTS.includes(location.hostname)) return;

  // 中身が一瞬でも見えないように、ページを読み込む前に隠す。レイアウトの計算が狂わないよう display:none は使わない
  const root = document.documentElement;
  root.classList.add("wn-gated");
  const style = document.createElement("style");
  style.textContent = `
    html.wn-gated, html.wn-gated body { overflow: hidden !important; background: #fff !important; }
    html.wn-gated body *:not(.wn-gate, .wn-gate *) { visibility: hidden !important; }
    .wn-gate { position: fixed; inset: 0; z-index: 2147483647; display: grid; place-items: center; padding: 24px; box-sizing: border-box; background: #fff; color: #222; font: 16px/1.7 -apple-system, BlinkMacSystemFont, "Hiragino Sans", "Yu Gothic", sans-serif; text-align: center; }
    .wn-gate__title { margin: 0 0 8px; font-size: 20px; font-weight: 600; }
    .wn-gate__text { margin: 0 0 20px; font-size: 14px; color: #555; }
    .wn-gate__text.is-error { color: #b3261e; }
    .wn-gate__button { min-height: 44px; padding: 0 20px; border: 1px solid #222; border-radius: 4px; background: #222; color: #fff; font: inherit; font-size: 14px; cursor: pointer; }
    .wn-gate__button:disabled { opacity: 0.5; cursor: default; }
  `;
  document.head.append(style);

  const LOGIN_HINT = "関係者の方は、登録済みの Google アカウントでログインしてください。";
  const panel = document.createElement("div");
  panel.className = "wn-gate";
  panel.innerHTML = `
    <div>
      <p class="wn-gate__title">WAYNEST は公開準備中です</p>
      <p class="wn-gate__text" role="status" data-message>確認しています…</p>
      <button class="wn-gate__button" type="button" data-login hidden>Google でログイン</button>
    </div>`;
  const message = panel.querySelector("[data-message]");
  const button = panel.querySelector("[data-login]");
  const say = (text, isError) => {
    message.textContent = text;
    message.classList.toggle("is-error", !!isError);
  };
  // head の中で動くので、body ができてから入口を出す
  const showPanel = () => document.body.append(panel);
  if (document.body) showPanel();
  else document.addEventListener("DOMContentLoaded", showPanel, { once: true });

  const open = () => {
    root.classList.remove("wn-gated");
    style.remove();
    panel.remove();
  };

  (async () => {
    const SDK = "https://www.gstatic.com/firebasejs/12.0.0";
    const [{ CONFIG }, { initializeApp }, authMod, { getFirestore, doc, getDoc }] = await Promise.all([
      import("./firebase-config.js"),
      import(`${SDK}/firebase-app.js`),
      import(`${SDK}/firebase-auth.js`),
      import(`${SDK}/firebase-firestore.js`),
    ]);
    const { getAuth, GoogleAuthProvider, signInWithPopup, onAuthStateChanged } = authMod;
    const app = initializeApp(CONFIG.firebase);
    const auth = getAuth(app);
    auth.languageCode = "ja";
    const db = getFirestore(app);
    // 読み取りに失敗したときは例外にして、中身を見せないまま止める
    const isEditor = async (user) => Boolean(user?.email) && (await getDoc(doc(db, "editors", user.email))).exists();

    button.addEventListener("click", async () => {
      button.disabled = true;
      say("確認しています…");
      try {
        const provider = new GoogleAuthProvider();
        provider.setCustomParameters({ prompt: "select_account" });
        const { user } = await signInWithPopup(auth, provider);
        if (await isEditor(user)) {
          // 編集モードもログイン済みの状態で始められるよう、読み込み直す
          location.reload();
          return;
        }
        say("このアカウントは登録されていません。別のアカウントでお試しください。", true);
      } catch (error) {
        const closed = error.code === "auth/popup-closed-by-user" || error.code === "auth/cancelled-popup-request";
        say(closed ? LOGIN_HINT : "ログインできませんでした。もう一度お試しください。", !closed);
      }
      button.disabled = false;
    });

    const user = await new Promise((resolve) => {
      const stop = onAuthStateChanged(auth, (u) => { stop(); resolve(u); });
    });
    if (await isEditor(user).catch(() => false)) {
      open();
      return;
    }
    say(LOGIN_HINT);
    button.hidden = false;
  })().catch(() => say("読み込めませんでした。ページを読み込み直してください。", true));
})();
