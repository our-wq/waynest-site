// =========================================================
// 物件検索
//   [data-finder]  検索フォーム（トップ・検索結果ページ共通）。選択肢を入れ、条件に合う件数をその場で出す
//   [data-results] 検索結果ページだけにある一覧。URL（?q=...&ward=...）の条件で絞り込み、変更のたびに描き直す
// =========================================================
import { ROOMS, WARDS, LINES, LAYOUTS, FEATURES, describe } from "./rooms.js";

const RENTS = [4, 5, 6, 7, 8, 10, 12, 15]; // 上限（万円）
const WALKS = [5, 10, 15]; // 上限（分）

const el = (tag, props = {}, text = "") => Object.assign(document.createElement(tag), props, text ? { textContent: text } : {});

// ---------- 選択肢を入れる ----------
const chip = (name, value, label) => {
  const wrap = el("label", { className: "lp-finder__chip" });
  wrap.append(el("input", { type: "checkbox", name, value }), el("span", {}, label));
  return wrap;
};
const FILLERS = {
  ward: (box) => WARDS.forEach((w) => box.append(el("option", { value: w }, w))),
  line: (box) => LINES.forEach((l) => box.append(el("option", { value: l }, `地下鉄${l}`))),
  rent: (box) => RENTS.forEach((r) => box.append(el("option", { value: r }, `${r}万円以下`))),
  walk: (box) => WALKS.forEach((m) => box.append(el("option", { value: m }, `${m}分以内`))),
  layout: (box) => LAYOUTS.forEach((l) => box.append(chip("layout", l.value, l.label))),
  feature: (box) => FEATURES.forEach((f) => box.append(chip("feature", f, f))),
};

// ---------- 条件 ----------
const readConditions = (data) => ({
  q: (data.get("q") || "").trim(),
  ward: data.get("ward") || "",
  line: data.get("line") || "",
  rent: Number(data.get("rent")) || 0,
  walk: Number(data.get("walk")) || 0,
  layout: data.getAll("layout"),
  feature: data.getAll("feature"),
  sort: data.get("sort") || "",
});

const matches = (room, c) => {
  if (c.ward && room.ward !== c.ward) return false;
  if (c.line && room.line !== c.line) return false;
  if (c.rent && room.rent > c.rent * 10000) return false;
  if (c.walk && room.walk > c.walk) return false;
  if (c.layout.length && !LAYOUTS.some((l) => c.layout.includes(l.value) && l.match.includes(room.layout))) return false;
  if (!c.feature.every((f) => room.features.includes(f))) return false;
  // キーワードは空白区切りのすべてを含むもの（駅名・区・物件名・間取り・こだわり）
  const haystack = [room.name, room.ward, room.line, room.station, `${room.station}駅`, room.layout, ...room.features].join(" ");
  return c.q.split(/[\s　]+/).filter(Boolean).every((word) => haystack.includes(word));
};

const SORTS = {
  rent: (a, b) => a.rent - b.rent,
  new: (a, b) => a.age - b.age,
  walk: (a, b) => a.walk - b.walk,
};
const search = (c) => {
  const found = ROOMS.filter((room) => matches(room, c));
  return SORTS[c.sort] ? found.sort(SORTS[c.sort]) : found;
};

// ---------- 一覧のカード（トップの「おすすめ物件」と同じ見た目） ----------
const STATUS_CLASS = { 申込あり: "is-full", 内見可: "is-soon" };
const card = (room) => {
  const d = describe(room);
  const item = el("li", { className: "lp-card" });
  item.append(
    el("div", { className: "lp-card__image ph ph--plan", ariaHidden: "true" }),
    el("p", { className: "lp-card__area" }, d.area),
    el("p", { className: "lp-card__title" }, d.name),
    el("p", { className: "lp-card__text" }, d.spec),
  );
  const rent = el("p", { className: "lp-card__rent" }, `${d.rent} `);
  rent.append(el("small", {}, d.sub));
  const tags = el("ul", { className: "lp-card__tags" });
  room.features.forEach((f) => tags.append(el("li", {}, f)));
  item.append(rent, tags);
  if (room.status) item.append(el("span", { className: `lp-card__status ${STATUS_CLASS[room.status] || ""}`.trim() }, room.status));

  const actions = el("div", { className: "lp-card__actions" });
  const full = room.status === "申込あり";
  const ask = el("a", { className: "wn-btn wn-btn--light wn-btn--sm wn-btn--jp wn-btn--block", href: `./entry.html?type=detail&id=${room.id}` });
  ask.append(el("span", { className: "wn-btn__label" }, full ? "空き予定を問い合わせる" : "詳細を問い合わせる"));
  actions.append(ask);
  if (!full) {
    const visit = el("a", { className: "wn-btn wn-btn--sm wn-btn--jp wn-btn--block", href: `./entry.html?type=visit&id=${room.id}` });
    visit.append(el("span", { className: "wn-btn__label" }, "内見を予約"));
    visit.insertAdjacentHTML("beforeend", '<span class="wn-btn__icon wn-btn__icon--arrow" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M5 12h14M13 6l6 6-6 6"/></svg></span>');
    actions.append(visit);
  }
  item.append(actions);
  return item;
};

// ---------- フォームごとに動かす ----------
document.querySelectorAll("[data-finder]").forEach((form) => {
  form.querySelectorAll("[data-fill]").forEach((box) => FILLERS[box.dataset.fill](box));
  const results = document.querySelector("[data-results]");
  const counts = form.querySelectorAll("[data-finder-count]");

  // 検索結果ページ：URL の条件をフォームに戻す
  if (results) {
    const params = new URLSearchParams(location.search);
    [...form.elements].forEach((input) => {
      if (!input.name || !params.has(input.name)) return;
      if (input.type === "checkbox") input.checked = params.getAll(input.name).includes(input.value);
      else input.value = params.get(input.name);
    });
  }

  const update = () => {
    const data = new FormData(form);
    const found = search(readConditions(data));
    counts.forEach((count) => { count.textContent = found.length; });
    if (!results) return;
    results.replaceChildren(...found.map(card));
    document.querySelector("[data-results-empty]").hidden = found.length > 0;
    // 条件を URL に残す（リロードや共有でも同じ結果になる）
    const query = new URLSearchParams([...data].filter(([, v]) => v !== "")).toString();
    history.replaceState(null, "", query ? `?${query}` : location.pathname);
  };
  form.addEventListener("input", update);
  form.addEventListener("reset", () => setTimeout(update, 0));
  // 検索結果ページでは送信してもページを移動せず、一覧へスクロールするだけ
  if (results) {
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      update();
      results.closest("[data-results-area]").scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }
  update();
});
