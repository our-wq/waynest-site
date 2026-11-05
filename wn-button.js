// =========================================================
// wn-btn の状態切り替え（style.css の「Buttons（wn-btn）」と対）
//   wnButton.set(btn, { label, icon, state })
//     label … 表示する文字
//     icon  … "arrow" | "plus" | "external" | "spinner" | "check" | "alert"
//     state … "busy" | "success" | "error" | null
//   ラベルが変わると、ボタンの幅が弾むように伸び縮みし、文字は下からふわっと入れ替わる
// =========================================================
(() => {
  const ICONS = {
    arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    external: '<path d="M8 16 16 8M9.5 8H16v6.5"/>',
    spinner: '<path d="M12 4a8 8 0 1 0 8 8" />',
    check: '<path d="m5.5 12.5 4 4 9-9"/>',
    alert: '<path d="M12 7v6M12 16.5v.5"/>',
  };
  const STATES = ["busy", "success", "error"];
  const reduced = () => matchMedia("(prefers-reduced-motion: reduce)").matches;

  const setIcon = (btn, name) => {
    const icon = btn.querySelector(".wn-btn__icon");
    if (!icon || !ICONS[name]) return;
    icon.className = `wn-btn__icon wn-btn__icon--${name}`;
    icon.innerHTML = `<svg viewBox="0 0 24 24">${ICONS[name]}</svg>`;
  };

  // 中身を変える前後の幅を測って、そのあいだをアニメーションでつなぐ
  const morph = (btn, update) => {
    const from = btn.getBoundingClientRect().width;
    update();
    if (reduced()) return;
    const to = btn.getBoundingClientRect().width;
    if (Math.abs(to - from) > 1) {
      btn.animate([{ width: `${from}px` }, { width: `${to}px` }], { duration: 560, easing: "cubic-bezier(.3, 1.35, .5, 1)" });
    }
    btn.querySelector(".wn-btn__label")?.animate(
      [{ opacity: 0, transform: "translateY(70%)", filter: "blur(4px)" }, { opacity: 1, transform: "none", filter: "blur(0)" }],
      { duration: 380, easing: "cubic-bezier(.2, .8, .2, 1)" },
    );
    btn.querySelector(".wn-btn__icon svg")?.animate(
      [{ opacity: 0, transform: "scale(.4)" }, { opacity: 1, transform: "none" }],
      { duration: 320, easing: "cubic-bezier(.3, 1.4, .5, 1)" },
    );
  };

  const set = (btn, { label, icon, state = null } = {}) => {
    morph(btn, () => {
      if (label != null) btn.querySelector(".wn-btn__label").textContent = label;
      if (icon) setIcon(btn, icon);
      STATES.forEach((s) => btn.classList.toggle(`is-${s}`, s === state));
    });
  };

  window.wnButton = { set, morph };
})();
