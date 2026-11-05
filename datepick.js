// =========================================================
// 内見の希望日カレンダー（entry.html）
//   <input type="hidden" name="date1"> の直後の [data-datepick] ボタンを押すとカレンダーが開き、
//   日付を選ぶと hidden に "2026-10-30" の形で入る（送信・確認画面は今までの date 入力と同じ値を使う）
//   選べるのは明日から DAYS_AHEAD 日後まで。CLOSED（月-日）は定休日として選べない
// =========================================================
// ===== 予約の設定（仮。決まったらここだけ直す）=====
const DAYS_AHEAD = 60;
const CLOSED = ["12-29", "12-30", "12-31", "01-01", "01-02", "01-03"]; // 年末年始（GW・夏期は決まったら追加）
const CLOSED_WEEKDAYS = []; // 毎週の定休日（0=日 1=月 … 6=土）。例：水曜休みなら [3]
export const TIME_SLOTS = ["10:00〜12:00", "12:00〜14:00", "14:00〜16:00", "16:00〜18:00"];
const WEEK = "日月火水木金土";

const pad = (n) => String(n).padStart(2, "0");
const toISO = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const fromISO = (iso) => { const [y, m, d] = iso.split("-").map(Number); return new Date(y, m - 1, d); };
const label = (d) => `${d.getMonth() + 1}月${d.getDate()}日（${WEEK[d.getDay()]}）`;
const isClosed = (d) => CLOSED_WEEKDAYS.includes(d.getDay()) || CLOSED.includes(`${pad(d.getMonth() + 1)}-${pad(d.getDate())}`);

const el = (tag, props = {}, text = "") => Object.assign(document.createElement(tag), props, text ? { textContent: text } : {});

export function setupDatePickers(form) {
  // 時間帯のプルダウンを TIME_SLOTS で作り直す
  ["time1", "time2"].forEach((n) => {
    const sel = form.elements[n];
    if (!sel) return;
    sel.replaceChildren(el("option", { value: "" }, "時間帯"), ...TIME_SLOTS.map((t) => el("option", {}, t)));
  });
  const today = new Date();
  const first = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);
  const last = new Date(today.getFullYear(), today.getMonth(), today.getDate() + DAYS_AHEAD);
  // 最初に開く月：今月の選べる日が1週間を切っていたら翌月から
  const daysLeft = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate() - first.getDate() + 1;
  const startMonth = new Date(first.getFullYear(), first.getMonth() + (daysLeft < 7 ? 1 : 0), 1);
  const pickers = [];

  form.querySelectorAll("[data-datepick]").forEach((button) => {
    const input = form.elements[button.dataset.datepick];
    const text = button.querySelector("[data-datepick-text]");
    const placeholder = text.textContent;
    const panel = el("div", { className: "en-cal", hidden: true, role: "dialog", ariaLabel: `${button.getAttribute("aria-label")}を選ぶ` });
    button.after(panel);
    let month = startMonth;

    const set = (iso) => {
      input.value = iso;
      text.textContent = iso ? label(fromISO(iso)) : placeholder;
      button.classList.toggle("is-filled", Boolean(iso));
      input.dispatchEvent(new Event("change", { bubbles: true }));
    };

    const render = () => {
      const head = el("div", { className: "en-cal__head" });
      const prev = el("button", { type: "button", className: "en-cal__nav", ariaLabel: "前の月" }, "‹");
      const next = el("button", { type: "button", className: "en-cal__nav", ariaLabel: "次の月" }, "›");
      prev.disabled = month <= new Date(first.getFullYear(), first.getMonth(), 1);
      next.disabled = new Date(month.getFullYear(), month.getMonth() + 1, 1) > last;
      // 月を送ったら、描き直した同じ側のボタンにフォーカスを戻す（キーボードで続けて送れるように）
      const go = (step, index) => {
        month = new Date(month.getFullYear(), month.getMonth() + step, 1);
        render();
        const nav = panel.querySelectorAll(".en-cal__nav")[index];
        (nav.disabled ? panel.querySelector(".en-cal__day:not(:disabled)") : nav)?.focus();
      };
      prev.addEventListener("click", () => go(-1, 0));
      next.addEventListener("click", () => go(1, 1));
      head.append(prev, el("p", { className: "en-cal__title" }, `${month.getFullYear()}年${month.getMonth() + 1}月`), next);

      const grid = el("div", { className: "en-cal__grid", role: "grid" });
      [...WEEK].forEach((w, i) => grid.append(el("span", { className: `en-cal__week${i === 0 ? " is-sun" : i === 6 ? " is-sat" : ""}` }, w)));
      for (let i = 0; i < month.getDay(); i++) grid.append(el("span"));
      const days = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
      for (let d = 1; d <= days; d++) {
        const date = new Date(month.getFullYear(), month.getMonth(), d);
        const iso = toISO(date);
        const closed = isClosed(date);
        const day = el("button", { type: "button", className: "en-cal__day", ariaLabel: `${label(date)}${closed ? "（定休日）" : ""}` }, String(d));
        if (date.getDay() === 0) day.classList.add("is-sun");
        if (date.getDay() === 6) day.classList.add("is-sat");
        if (closed) day.classList.add("is-closed");
        day.disabled = date < first || date > last || closed;
        if (iso === input.value) { day.classList.add("is-selected"); day.ariaPressed = "true"; }
        day.addEventListener("click", () => { set(iso); close(); button.focus(); });
        grid.append(day);
      }
      const note = el("p", { className: "en-cal__note" }, `明日から${DAYS_AHEAD}日後まで選べます。定休日：年末年始`);
      panel.replaceChildren(head, grid, note);
    };

    const open = () => {
      pickers.forEach((p) => p !== picker && p.close());
      const picked = input.value && fromISO(input.value);
      month = picked ? new Date(picked.getFullYear(), picked.getMonth(), 1) : startMonth;
      render();
      panel.hidden = false;
      button.setAttribute("aria-expanded", "true");
      (panel.querySelector(".is-selected") || panel.querySelector(".en-cal__day:not(:disabled)"))?.focus();
    };
    const close = () => {
      panel.hidden = true;
      button.setAttribute("aria-expanded", "false");
    };
    const picker = { close, set, panel, button };
    pickers.push(picker);

    button.setAttribute("aria-haspopup", "dialog");
    button.setAttribute("aria-expanded", "false");
    button.addEventListener("click", () => (panel.hidden ? open() : close()));
    panel.addEventListener("keydown", (e) => {
      if (e.key !== "Escape") return;
      e.stopPropagation();
      close();
      button.focus();
    });
  });

  // 外側を押したら閉じる／フォームのリセットで表示も戻す（hidden は reset で空にならないため）
  // （月を送ると押したボタンが描き直しで消えるので、contains ではなくクリック時の経路で判定する）
  document.addEventListener("click", (e) => {
    const path = e.composedPath();
    pickers.forEach((p) => { if (!path.includes(p.panel) && !path.includes(p.button)) p.close(); });
  });
  form.addEventListener("reset", () => pickers.forEach((p) => { p.set(""); p.close(); }));
}
