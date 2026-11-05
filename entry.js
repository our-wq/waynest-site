import { createBackend } from "./backend.js";
// ログイン（LINE / Google）を使うか。今は使わない（公開後に LINE ログインを足すときに true にする）
const USE_LOGIN = false;
import { ROOMS, describe } from "./rooms.js";
import { setupDatePickers } from "./datepick.js";

// ===== 物件データ（仮）。p1〜p5 はトップの「おすすめ物件」カード、r01〜 は物件検索（rooms.js）の id と対応 =====
const PROPERTIES = {
  ...Object.fromEntries(ROOMS.map((room) => {
    const d = describe(room);
    return [room.id, { name: d.name, area: d.area, spec: d.spec, rent: `${d.rent} ＋${d.sub.split(" ／ ")[0]}` }];
  })),
  p1: { name: "○○マンション", area: "○○区｜○○線「○○」駅 徒歩○分", spec: "1K ／ 00.00 m² ／ 築○年", rent: "賃料 00,000円 ＋管理費 0,000円" },
  p2: { name: "△△レジデンス", area: "△△区｜△△線「△△」駅 徒歩○分", spec: "1LDK ／ 00.00 m² ／ 新築", rent: "賃料 00,000円 ＋管理費 0,000円" },
  p3: { name: "□□ハイツ", area: "□□区｜□□線「□□」駅 徒歩○分", spec: "2LDK ／ 00.00 m² ／ 築○年", rent: "賃料 000,000円 ＋管理費 0,000円" },
  p4: { name: "◇◇コート", area: "◇◇区｜◇◇線「◇◇」駅 徒歩○分", spec: "1LDK ／ 00.00 m² ／ 築○年", rent: "賃料 00,000円 ＋管理費 0,000円" },
  p5: { name: "○○テラス", area: "○○区｜○○線「○○」駅 徒歩○分", spec: "1R ／ 00.00 m² ／ 築○年", rent: "賃料 00,000円 ＋管理費 0,000円" },
};

const $ = (s) => document.querySelector(s);
const $$ = (s) => [...document.querySelectorAll(s)];
const form = $("[data-form]");
const loginError = $("[data-login-error]");

// LINE ログインから戻ってきたときは、ここで元の URL（?type=...&id=...）に戻してからログイン状態を確定する
const backend = await createBackend();
let initialUser = null;
try {
  initialUser = await backend.init();
} catch (e) {
  loginError.textContent = e.message || "ログインに失敗しました。もう一度お試しください。";
  loginError.hidden = false;
}
$("[data-proto]").hidden = backend.mode !== "mock";
$('[data-login="line"]').hidden = !backend.lineEnabled;
$("[data-inapp-line]").hidden = !backend.lineEnabled;

// ?type=visit|detail|consult&id=p1
// LINE のボタンから来たとき：type=vacancy|estimate → 物件の問い合わせ、method=visit|onsite|video → 内見予約
const params = new URLSearchParams(location.search);
const rawType = params.get("type");
const type = params.get("method") ? "visit"
  : ["detail", "vacancy", "estimate"].includes(rawType) ? "detail"
  : rawType === "consult" ? "consult" : "visit";
const propertyId = PROPERTIES[params.get("id")] ? params.get("id") : null;
const property = propertyId ? PROPERTIES[propertyId] : null;

// ===== 種類（内見／詳細）と物件の有無で見せる部分を切り替え =====
const TITLES = {
  visit: property ? "内見のご予約" : "来店・内見のご相談",
  detail: "物件の詳細お問い合わせ",
  consult: "お部屋探しのご相談",
};
$("[data-title]").textContent = TITLES[type];
document.title = `WAYNEST｜${TITLES[type]}`;

$$("[data-only]").forEach((el) => {
  const show = el.dataset.only.split(" ").some((only) => (only === "noproperty" ? !property : only === type));
  el.hidden = !show;
});
// 隠した入力は送信・検証の対象から外す（入れ子になっているので、どれか1つでも隠れていれば外す）
$$("[data-form] input, [data-form] select, [data-form] textarea").forEach((input) => { input.disabled = Boolean(input.closest("[data-only][hidden]")); });

const box = $("[data-property]");
if (property) {
  $("[data-p-area]").textContent = property.area;
  $("[data-p-name]").textContent = property.name;
  $("[data-p-spec]").textContent = property.spec;
  $("[data-p-rent]").textContent = property.rent;
} else {
  box.classList.add("is-empty");
  $("[data-p-name]").textContent = "物件はスタッフと相談しながら決められます";
  $("[data-p-spec]").textContent = "ご希望の条件を教えてください。";
}

// 内見の希望日はカレンダーで選ぶ（明日以降・定休日を除く。datepick.js）
setupDatePickers(form);

// ===== ステップ切り替え =====
const goStep = (n) => {
  $$("[data-step]").forEach((panel) => { panel.hidden = Number(panel.dataset.step) !== n; });
  $$("[data-steps] li").forEach((li, i) => {
    const at = i + 1 + (USE_LOGIN ? 0 : 1); // ログインなしのときは「ログイン」の段を数えない
    li.classList.toggle("is-done", at < n);
    li.classList.toggle("is-current", at === n);
  });
  // 完了後は物件カードを出さない
  box.hidden = n === 4;
  window.scrollTo({ top: 0, behavior: "smooth" });
};

// ===== ログイン =====
let user = null;

const enterForm = (nextUser) => {
  user = nextUser;
  const account = $("[data-account]");
  account.hidden = !user;
  if (user) {
    const badge = $("[data-account-provider]");
    badge.textContent = user.provider === "line" ? "LINE" : "Google";
    badge.classList.toggle("is-line", user.provider === "line");
    badge.classList.toggle("is-google", user.provider === "google");
    $("[data-account-label]").textContent = `${user.name}${user.email ? `（${user.email}）` : ""} でログイン中`;
    if (!form.elements.name.value) form.elements.name.value = user.name;
    if (!form.elements.email.value) form.elements.email.value = user.email;
    // 連絡方法の初期値：LINE ログインなら LINE、Google ならメール
    const preferred = user.provider === "line" ? "LINE" : "メール";
    if (!form.querySelector('input[name="contact"]:checked')) form.querySelector(`input[name="contact"][value="${preferred}"]`).checked = true;
  }
  goStep(2);
};

$$("[data-login]").forEach((button) => {
  button.addEventListener("click", async () => {
    loginError.hidden = true;
    button.classList.add("is-loading");
    try {
      enterForm(await backend.signIn(button.dataset.login));
    } catch (e) {
      // ポップアップを閉じただけのときは何も出さない
      if (e.code !== "auth/popup-closed-by-user" && e.code !== "auth/cancelled-popup-request") {
        loginError.textContent = "ログインできませんでした。時間をおいてもう一度お試しください。";
        loginError.hidden = false;
      }
    } finally {
      button.classList.remove("is-loading");
    }
  });
});
$("[data-guest]").addEventListener("click", async () => enterForm(await backend.signInGuest()));
$("[data-logout]").addEventListener("click", async () => {
  await backend.signOut();
  form.reset();
  user = null;
  goStep(1);
});

// アプリ内ブラウザ（Instagram / LINE / TikTok / Facebook）では Google ログインが弾かれやすいので注意書きを出す
if (/Instagram|FBAN|FBAV|Line\/|TikTok|musical_ly|BytedanceWebview/i.test(navigator.userAgent)) {
  $("[data-inapp]").hidden = false;
}

// ===== 入力チェック =====
const showError = (key, on, field) => {
  $(`[data-error="${key}"]`).classList.toggle("is-shown", on);
  if (field) field.classList.toggle("is-invalid", on);
  return on;
};
const validate = () => {
  const { name, email, tel, date1, time1 } = form.elements;
  const contact = form.querySelector('input[name="contact"]:checked')?.value;
  const errors = [
    showError("name", !name.value.trim(), name),
    showError("contact", !contact),
    showError("email", contact === "メール" && (!email.value || !email.checkValidity()), email),
    showError("tel", contact === "電話" && !tel.value.trim(), tel),
  ];
  if (type === "visit") {
    $('[data-datepick="date1"]').classList.toggle("is-invalid", !date1.value);
    time1.classList.toggle("is-invalid", !time1.value);
    errors.push(showError("date1", !date1.value || !time1.value));
  }
  return !errors.some(Boolean);
};

// ===== 確認画面 =====
const val = (name) => form.elements[name]?.disabled ? "" : (form.elements[name]?.value || "").trim();
// 2026-10-30 → 10月30日（金）
const formatDate = (iso) => {
  const [y, m, d] = iso.split("-").map(Number);
  const week = "日月火水木金土"[new Date(y, m - 1, d).getDay()];
  return `${m}月${d}日（${week}）`;
};
const contactValue = () => form.querySelector('input[name="contact"]:checked').value;
// 内見の方法：基本は現地。転勤などの方だけ「オンライン内見」にチェック（送る値は今までと同じ）
const methodValue = () => (form.elements.online.checked ? "オンライン内見（ビデオ通話）" : "現地で内見");
const prefValues = () => $$('input[name="prefs"]:checked').filter((c) => !c.disabled).map((c) => c.value);
const topicValues = () => $$('input[name="topics"]:checked').filter((c) => !c.disabled).map((c) => c.value);

const buildConfirm = () => {
  const rows = [];
  if (property) rows.push(["物件", `${property.name}\n${property.spec}`]);
  else if (val("propertyText")) rows.push(["気になる物件", val("propertyText")]);
  if (type === "consult" && val("when")) rows.push(["お引越しの時期", val("when")]);
  if (type === "visit") {
    rows.push(["内見の方法", methodValue()]);
    rows.push(["第1希望", `${formatDate(val("date1"))} ${val("time1")}`]);
    if (val("date2")) rows.push(["第2希望", `${formatDate(val("date2"))} ${val("time2")}`.trim()]);
    rows.push(["ご来場人数", val("people")]);
  }
  if (!property) {
    const wish = [val("area"), val("budget"), val("layout")].filter(Boolean).join(" ／ ");
    rows.push(["ご希望の条件", wish || "指定なし"]);
  }
  if (type === "consult" && prefValues().length) rows.push(["こだわり", prefValues().join("、")]);
  if (type === "consult") rows.push(["人数", val("people")]);
  if (type === "detail") rows.push(["知りたいこと", topicValues().join("\n") || "指定なし"]);
  rows.push(["お名前", val("name")]);
  if (val("tel")) rows.push(["電話番号", val("tel")]);
  if (val("email")) rows.push(["メール", val("email")]);
  rows.push(["ご連絡の方法", contactValue()]);
  if (val("message")) rows.push(["ご要望・ご質問", val("message")]);

  $("[data-confirm]").replaceChildren(...rows.map(([label, value]) => {
    const row = document.createElement("div");
    const dt = document.createElement("dt");
    const dd = document.createElement("dd");
    dt.textContent = label;
    dd.textContent = value;
    row.append(dt, dd);
    return row;
  }));
};

// 送信するデータ（Firestore の inquiries に保存。項目は firestore.rules と合わせる）
const buildPayload = () => {
  const data = {
    type,
    name: val("name"),
    contact: contactValue(),
    tel: val("tel"),
    email: val("email"),
    message: val("message"),
  };
  if (property) Object.assign(data, { propertyId, propertyName: property.name });
  else if (val("propertyText")) data.propertyName = val("propertyText");
  if (type === "consult") Object.assign(data, { when: val("when"), people: val("people"), prefs: prefValues() });
  if (type === "visit") {
    Object.assign(data, {
      method: methodValue(),
      date1: val("date1"), time1: val("time1"),
      date2: val("date2"), time2: val("time2"),
      people: val("people"),
    });
  }
  if (!property) Object.assign(data, { area: val("area"), budget: val("budget"), layout: val("layout") });
  if (type === "detail") data.topics = topicValues();
  return data;
};

form.addEventListener("submit", (e) => {
  e.preventDefault();
  if (!validate()) {
    form.querySelector(".is-invalid, .en-error.is-shown")?.scrollIntoView({ behavior: "smooth", block: "center" });
    return;
  }
  buildConfirm();
  goStep(3);
});
// 一度エラーを出したあとは、直したらすぐ消す
form.addEventListener("input", () => { if (form.querySelector(".en-error.is-shown")) validate(); });
form.addEventListener("change", () => { if (form.querySelector(".en-error.is-shown")) validate(); });

const agree = $("[data-agree]");
const send = $("[data-send]");
const sendError = $("[data-send-error]");
agree.addEventListener("change", () => { send.disabled = !agree.checked; });
$("[data-edit]").addEventListener("click", () => goStep(2));

// ===== 送信 → 完了 =====
// ボタンが「送信しています（くるくる）」→「送信しました（チェック）」と形を変えてから完了画面へ
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const SEND_IDLE = { label: "この内容で送信する", icon: "arrow", state: null };
send.addEventListener("click", async () => {
  sendError.hidden = true;
  window.wnButton.set(send, { label: "送信しています", icon: "spinner", state: "busy" });
  try {
    await backend.submit(buildPayload());
    window.wnButton.set(send, { label: "送信しました", icon: "check", state: "success" });
    await wait(800);
    $("[data-done-title]").textContent = { visit: "ご予約を受け付けました", detail: "お問い合わせを受け付けました", consult: "ご相談を受け付けました" }[type];
    $("[data-done-lead]").textContent = `${contactValue()}で、担当スタッフからご連絡します。`;
    goStep(4);
    window.wnButton.set(send, SEND_IDLE);
  } catch (e) {
    console.error(e);
    window.wnButton.set(send, { label: "送信できませんでした", icon: "alert", state: "error" });
    sendError.hidden = false;
    await wait(1800);
    window.wnButton.set(send, SEND_IDLE);
  }
});

// ===== 初期表示：ログイン済みなら入力から =====
// LINE のボタンから来たときの初期値
if (params.get("method") === "video" && form.elements.online) form.elements.online.checked = true;
if (rawType === "vacancy" || rawType === "estimate") {
  const want = rawType === "vacancy" ? "空室状況・入居可能日" : "初期費用の見積もり";
  $$('input[name="topics"]').forEach((c) => { c.checked = c.value === want; });
}

if (!USE_LOGIN) {
  // ログインの段を出さず、すぐ入力へ
  $("[data-steps] li")?.remove();
  $$("[data-steps] li span").forEach((span, i) => { span.textContent = String(i + 1); });
  enterForm(null);
} else if (initialUser) enterForm(initialUser);
else goStep(1);
