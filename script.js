(() => {
  const header = document.querySelector("[data-header]");
  const drawer = document.querySelector("[data-drawer]");
  const menu = document.querySelector("[data-menu]");
  const aside = document.querySelector("[data-aside]");
  const hero = document.querySelector(".lp-hero");

  // ヘッダー：少しスクロールしたら地色の帯にする
  // 固定CTA：ヒーローに自前のボタンがあるので、ヒーローを半分過ぎてから出す
  const onScroll = () => {
    header.classList.toggle("is-scrolled", window.scrollY > 40);
    aside.classList.toggle("is-visible", window.scrollY > hero.offsetHeight * 0.5);
  };
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();

  // ヒーロー：写真が2枚以上ならスライドショーにしてドットを出す
  const slides = [...document.querySelectorAll("[data-hero-slides] > *")];
  const heroDots = document.querySelector("[data-hero-dots]");
  if (slides.length > 1) {
    let current = 0;
    let timer;
    const dots = slides.map((_, i) => {
      const dot = document.createElement("button");
      dot.type = "button";
      dot.setAttribute("aria-label", `${i + 1} 枚目の写真`);
      dot.addEventListener("click", () => { show(i); restart(); });
      heroDots.append(dot);
      return dot;
    });
    const show = (index) => {
      slides[current].classList.remove("is-active");
      current = index;
      slides[current].classList.add("is-active");
      dots.forEach((dot, i) => dot.classList.toggle("is-active", i === current));
    };
    const restart = () => {
      clearInterval(timer);
      timer = setInterval(() => show((current + 1) % slides.length), 6000);
    };
    heroDots.hidden = false;
    show(0);
    restart();
  }

  // グローバルナビ：いま見ているセクションに点をつける
  const gnavLinks = [...document.querySelectorAll("[data-gnav] a")];
  const spy = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      gnavLinks.forEach((a) => a.classList.toggle("is-current", a.hash === `#${entry.target.id}`));
    });
  }, { rootMargin: "-45% 0px -50% 0px" });
  gnavLinks.forEach((a) => {
    const target = document.querySelector(a.hash);
    if (target) spy.observe(target);
  });
  spy.observe(hero); // ヒーローに戻ったら点を消す（id が無いのでどのリンクにも一致しない）

  // メニュー開閉
  const setMenu = (open) => {
    drawer.setAttribute("aria-expanded", String(open));
    drawer.setAttribute("aria-label", open ? "メニューを閉じる" : "メニューを開く");
    menu.classList.toggle("is-open", open);
    menu.setAttribute("aria-hidden", String(!open));
    header.classList.toggle("is-menu-open", open);
    document.body.classList.toggle("is-locked", open);
  };
  drawer.addEventListener("click", () => setMenu(drawer.getAttribute("aria-expanded") !== "true"));
  menu.querySelectorAll("a").forEach((a) => a.addEventListener("click", () => setMenu(false)));

  // READ MORE（アコーディオン）：ボタンは READ MORE ⇔ CLOSE に幅ごと伸び縮みし、＋ が × に回る
  document.querySelectorAll("[data-toggle]").forEach((button) => {
    const target = document.getElementById(button.getAttribute("aria-controls"));
    button.addEventListener("click", () => {
      const open = button.getAttribute("aria-expanded") !== "true";
      window.wnButton.morph(button, () => {
        button.setAttribute("aria-expanded", String(open));
        button.querySelector(".wn-btn__label").textContent = open ? "CLOSE" : "READ MORE";
      });
      target.hidden = !open;
      if (open && !matchMedia("(prefers-reduced-motion: reduce)").matches) {
        target.animate([{ opacity: 0, transform: "translateY(-10px)" }, { opacity: 1, transform: "none" }], { duration: 500, easing: "cubic-bezier(.2, .8, .2, 1)" });
      }
    });
  });

  // ラインナップ スライダー（scroll-snap + ドット + ドラッグ）
  document.querySelectorAll("[data-slider]").forEach((slider) => {
    const track = slider.querySelector("[data-slider-track]");
    const dotsWrap = slider.querySelector("[data-slider-dots]");
    const cards = [...track.children];
    // カードを真ん中に置くときのスクロール位置と、いま真ん中にいちばん近いカード
    const centerLeft = (card) => card.offsetLeft - track.offsetLeft - (track.clientWidth - card.offsetWidth) / 2;
    const nearestIndex = () => cards.reduce((best, card, i) =>
      Math.abs(centerLeft(card) - track.scrollLeft) < Math.abs(centerLeft(cards[best]) - track.scrollLeft) ? i : best, 0);
    const dots = cards.map((_, i) => {
      const dot = document.createElement("button");
      dot.type = "button";
      dot.setAttribute("aria-label", `${i + 1} 枚目へ`);
      dot.addEventListener("click", () => track.scrollTo({ left: centerLeft(cards[i]), behavior: "smooth" }));
      dotsWrap.append(dot);
      return dot;
    });
    const update = () => {
      const index = nearestIndex();
      dots.forEach((dot, i) => dot.classList.toggle("is-active", i === index));
    };
    track.addEventListener("scroll", update, { passive: true });
    update();

    // PC はドラッグでも送れるように（6px 以上動かしたときだけドラッグ扱いにして、カード内のボタンは普通に押せるようにする）
    let startX = 0;
    let startLeft = 0;
    let pressed = false;
    let dragging = false;
    let justDragged = false;
    track.addEventListener("pointerdown", (e) => {
      if (e.pointerType !== "mouse" || e.button !== 0) return;
      if (document.body.classList.contains("wn-editing")) return; // 編集中は文字を選べるようにする（wn-edit.js）
      pressed = true;
      startX = e.clientX;
      startLeft = track.scrollLeft;
    });
    track.addEventListener("pointermove", (e) => {
      if (!pressed) return;
      if (!dragging && Math.abs(e.clientX - startX) > 6) {
        dragging = true;
        track.classList.add("is-dragging");
        track.setPointerCapture(e.pointerId);
      }
      if (dragging) track.scrollLeft = startLeft - (e.clientX - startX);
    });
    // ドラッグ直後のクリックでリンクに飛ばないように
    track.addEventListener("click", (e) => {
      if (!justDragged) return;
      e.preventDefault();
      e.stopPropagation();
      justDragged = false;
    }, true);
    track.addEventListener("dragstart", (e) => e.preventDefault());
    const end = () => {
      pressed = false;
      if (!dragging) return;
      dragging = false;
      justDragged = true;
      setTimeout(() => { justDragged = false; }, 0);
      track.classList.remove("is-dragging");
      // 真ん中に一番近いカードを真ん中に合わせる
      track.scrollTo({ left: centerLeft(cards[nearestIndex()]), behavior: "smooth" });
    };
    track.addEventListener("pointerup", end);
    track.addEventListener("pointercancel", end);
  });

  // 最新情報モーダル
  const modal = document.querySelector("[data-modal]");
  const setModal = (open) => {
    modal.classList.toggle("is-open", open);
    modal.setAttribute("aria-hidden", String(!open));
    document.body.classList.toggle("is-locked", open);
  };
  document.querySelector("[data-modal-open]").addEventListener("click", () => setModal(true));
  modal.querySelector("[data-modal-close]").addEventListener("click", () => setModal(false));
  modal.addEventListener("click", (e) => { if (e.target === modal) setModal(false); });
  modal.querySelectorAll("a").forEach((a) => a.addEventListener("click", () => setModal(false)));
  document.addEventListener("keydown", (e) => {
    if (e.key !== "Escape") return;
    setModal(false);
    setMenu(false);
  });

  // コンセプトの画像：5秒ごとに次の画像へ。入れ替えのフェードは style.css（.lp-photo__image）
  const photo = document.querySelector("[data-photo-slides]");
  if (photo) {
    const images = [...photo.querySelectorAll(".lp-photo__image")];
    const photoDots = photo.querySelector("[data-photo-dots]");
    let current = 0;
    let timer;
    const show = (index) => {
      current = index;
      images.forEach((img, i) => img.classList.toggle("is-active", i === current));
      dots.forEach((dot, i) => dot.classList.toggle("is-active", i === current));
    };
    const restart = () => {
      clearInterval(timer);
      timer = setInterval(() => show((current + 1) % images.length), 5000);
    };
    const dots = images.map((_, i) => {
      const dot = document.createElement("button");
      dot.type = "button";
      dot.setAttribute("aria-label", `${i + 1} 枚目の画像`);
      dot.addEventListener("click", () => { show(i); restart(); });
      photoDots.append(dot);
      return dot;
    });
    photoDots.hidden = images.length < 2;
    show(0);
    if (images.length > 1) restart();
  }

  // スクロールでフェードイン
  const fadeTargets = document.querySelectorAll(".lp-headline, .lp-news, .lp-article, .lp-finder, .lp-slider, .lp-snsgrid, .lp-areagrid, .lp-limited, .lp-cover .wn-btn");
  const io = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      entry.target.classList.add("is-inview");
      io.unobserve(entry.target);
    });
  }, { rootMargin: "0px 0px -10% 0px" });
  fadeTargets.forEach((el) => {
    el.classList.add("js-fade");
    io.observe(el);
  });
})();
