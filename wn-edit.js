// 編集モード：編集権限のある人だけに「編集」ボタンを出し、ページの文字・写真・リンク先を画面上で直して公開する。
// 一般の閲覧者には何も出ない。動き方は置き場所で変わる。
//
// Claude の公開ページ（window.claude があるとき）：
//   公開中の index.html を取り直し、変更した箇所だけ書き換えて、丸ごと新しい版として公開する（画面の DOM は書き出さない）。
//   注意：保存すると公開中の index.html のほうが手元のファイルより新しくなる。手元を直す前に公開中の版を取り込むこと。
// Firebase（firebase-config.js の FIREBASE_HOSTS）：
//   変更は Firestore の site/{ページ名} に保存し、開いたときに画面へ反映する（HTML は書き換えない）。写真は siteImages に入れる。
//   ページ名は script タグの data-page（なければ index）。JS が作る部分（rooms.js・areas.js の中身）は対象外。
//   編集するときは ?edit を付けて開き、Firestore の editors に登録された Google アカウントでログインする。同じタブなら他のページでも編集できる。
//   このファイルは script.js より先に読み込むこと（他の script が画面を書き換える前の要素を番号で控えるため）。
(() => {
  const PAGE = document.currentScript?.dataset.page || "index";

  // Artifact が公開時に page を包む外枠。ここを変えると次の公開で外枠が二重になる
  const SKELETON = '<!doctype html><html><head><meta charset=utf8><meta name=viewport content="width=device-width,initial-scale=1,viewport-fit=cover"><style>:root{color-scheme:light;box-sizing:border-box;padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)}html{scroll-padding-top:env(safe-area-inset-top,0px)}body{margin:0;padding:0;font:14px -apple-system,BlinkMacSystemFont,sans-serif;background:#fff;color:#000}img{max-width:100%}[hidden]:not([hidden=until-found i]){display:none!important}</style></head><body>';
  const STASH_KEY = "wn-edit-stash";

  // 編集できる範囲。公開中の画面と取り直した index.html の両方に同じ条件をかけて、順番で対応づける
  const ROOTS = "[data-header], .sb-header, #lp-menu, main, #footer, .sb-footer, [data-aside], [data-modal]";
  const SKIP = "script, style, title, meta, link, noscript, svg, button, select, textarea, input, [hidden], .lp-hero__title, .lp-header__logo, .lp-footer__logo, .wn-logo, .sb-search__count";
  const INLINE = new Set(["BR", "SMALL", "B", "I", "SPAN", "EM", "STRONG"]);
  const SAFE_HREF = /^(https?:\/\/|tel:|mailto:|#|\.\/|\/)/i;

  // 地の文字を持ち、中身がインライン要素だけの要素を、いちばん外側でひとまとまりとして拾う
  const textTargets = (doc) => {
    const found = [];
    const walk = (el) => {
      if (el.matches(SKIP)) return;
      const hasText = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim());
      const inlineOnly = [...el.querySelectorAll("*")].every((c) => INLINE.has(c.tagName));
      if (hasText && inlineOnly) found.push(el);
      else [...el.children].forEach(walk);
    };
    doc.querySelectorAll(ROOTS).forEach(walk);
    return found;
  };
  const imageTargets = (doc) => [...doc.querySelectorAll(ROOTS)].flatMap((root) => [...root.querySelectorAll("img")]);
  const linkTargets = (doc) => [...doc.querySelectorAll(ROOTS)].flatMap((root) => [...root.querySelectorAll("a[href]")]);

  const squeeze = (s) => s.replace(/\s+/g, " ").trim();
  // 文末に残る改行は保存しない。インデントや改行の揺れで「変更あり」にならないように比べる
  const cleanHtml = (el) => el.innerHTML.replace(/(<br\s*\/?>\s*)+$/i, "");
  const sameHtml = (a, b) => squeeze(a).replace(/<br\s*\/?>/gi, "<br>") === squeeze(b).replace(/<br\s*\/?>/gi, "<br>");
  const syncTime = (el) => {
    if (el.tagName !== "TIME") return;
    const m = el.textContent.match(/(\d{4})[.\-/](\d{1,2})[.\-/](\d{1,2})/);
    if (m) el.setAttribute("datetime", `${m[1]}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}`);
  };

  const stash = {
    read() { try { return JSON.parse(sessionStorage.getItem(STASH_KEY)); } catch { return null; } },
    write(value) { try { sessionStorage.setItem(STASH_KEY, JSON.stringify(value)); } catch { /* 保存できなくても編集は続けられる */ } },
    clear() { try { sessionStorage.removeItem(STASH_KEY); } catch { /* 同上 */ } },
  };

  const loadCss = () => {
    if (document.querySelector('link[href="./wn-edit.css"]')) return;
    const css = document.createElement("link");
    css.rel = "stylesheet";
    css.href = "./wn-edit.css";
    document.head.append(css);
  };

  // 長辺 maxSide に縮めて WebP（非対応のブラウザは JPEG）にする
  const shrink = async (file, maxSide = 2000, quality = 0.82) => {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext("2d").drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    const encode = (type) => new Promise((resolve) => canvas.toBlob(resolve, type, quality));
    let blob = await encode("image/webp");
    if (blob?.type !== "image/webp") blob = await encode("image/jpeg");
    return { blob, width: canvas.width, height: canvas.height };
  };

  // store：置き場所ごとの違い。targets()＝編集できる要素、upload(file)＝写真の保存、publish()＝公開
  const start = (store) => {
    loadCss();

    const ui = document.createElement("div");
    ui.className = "wn-edit";
    ui.innerHTML = `
      <button class="wn-edit__open" type="button" data-open>編集</button>
      <div class="wn-edit__chips" data-chips></div>
      <div class="wn-edit__bar" data-bar hidden>
        <div class="wn-edit__field" data-link-row hidden>
          <label>リンク先<input type="text" inputmode="url" spellcheck="false" placeholder="https://" data-link /></label>
        </div>
        <div class="wn-edit__field" data-alt-row hidden>
          <label>写真の説明<input type="text" placeholder="例：南向きの明るいリビング" data-alt /></label>
        </div>
        <div class="wn-edit__row">
          <p class="wn-edit__message" role="status" data-message></p>
          <div class="wn-edit__actions">
            <button class="wn-edit__button" type="button" data-cancel>やめる</button>
            <button class="wn-edit__button wn-edit__button--primary" type="button" data-save>保存して公開</button>
          </div>
        </div>
      </div>
      <input type="file" accept="image/jpeg,image/png,image/webp" hidden data-file />`;
    document.body.append(ui);
    const $ = (name) => ui.querySelector(`[data-${name}]`);
    const bar = $("bar");
    const HINT = "文字はクリックして直接入力。写真は「写真を変更」から。";
    const say = (text, isError) => {
      $("message").textContent = text;
      $("message").classList.toggle("is-error", !!isError);
    };

    let editing = false;
    let saving = false;
    let texts = [];
    let images = [];
    let links = [];
    let currentLink = null;
    let currentImage = null;
    let chipTimer;
    let cancelArmed = false;

    const changes = () => {
      const text = texts.filter((t) => !sameHtml(t.original, cleanHtml(t.el)));
      const image = images.filter((m) => m.assetId || m.el.alt !== m.alt);
      const link = links.filter((l) => l.el.getAttribute("href") !== l.href);
      return { text, image, link, count: text.length + image.length + link.length };
    };
    const refresh = () => {
      const { count } = changes();
      $("save").disabled = saving || count === 0;
      if (!saving) say(count ? `変更 ${count} か所（まだ公開されていません）` : HINT);
    };

    // 写真の「写真を変更」ボタン。スライダーや重なりの中でも押せるよう、画面の上に別の層として置く
    const placeChips = () => {
      const headerBottom = document.querySelector("[data-header], .sb-header").getBoundingClientRect().bottom;
      images.forEach(({ el, chip }) => {
        const r = el.getBoundingClientRect();
        const track = el.closest("[data-slider-track]")?.getBoundingClientRect();
        const left = Math.max(r.left + 8, 8);
        const top = Math.max(r.top + 8, headerBottom + 8); // ヘッダーの裏に隠れた写真でも、見えている部分に出す
        const visible = r.width > 0 && top + 32 < r.bottom && top + 32 < innerHeight && parseFloat(getComputedStyle(el).opacity) > 0.01
          && (!track || (left > track.left && left + 110 < track.right));
        chip.hidden = !visible;
        if (visible) chip.style.transform = `translate(${left}px, ${top}px)`;
      });
    };

    const pickImage = (image) => {
      currentImage = image;
      $("file").value = "";
      $("file").click();
    };
    const showAlt = (image) => {
      currentImage = image;
      $("alt").value = image.el.alt;
      $("alt-row").hidden = false;
    };

    const setEditing = (on) => {
      editing = on;
      document.body.classList.toggle("wn-editing", on);
      $("open").hidden = on;
      bar.hidden = !on;
      $("link-row").hidden = true;
      $("alt-row").hidden = true;
      if (on) {
        const targets = store.targets();
        texts = targets.text.map((el, key) => ({ el, key, original: el.innerHTML })).filter((t) => t.el.isConnected);
        texts.forEach(({ el }) => { el.contentEditable = "true"; el.classList.add("wn-edit-target"); });
        links = targets.link.map((el, key) => ({ el, key, href: el.getAttribute("href") })).filter((l) => l.el.isConnected);
        images = targets.image.filter((el) => el.isConnected).map((el) => {
          const chip = document.createElement("button");
          chip.type = "button";
          chip.className = "wn-edit__chip";
          chip.textContent = "写真を変更";
          const image = { el, chip, key: targets.image.indexOf(el), src: el.getAttribute("src"), alt: el.alt, width: el.getAttribute("width"), height: el.getAttribute("height"), assetId: null };
          chip.addEventListener("click", () => pickImage(image));
          $("chips").append(chip);
          return image;
        });
        placeChips();
        chipTimer = setInterval(placeChips, 300);
        addEventListener("scroll", placeChips, { capture: true, passive: true });
        addEventListener("resize", placeChips);
      } else {
        clearInterval(chipTimer);
        removeEventListener("scroll", placeChips, { capture: true });
        removeEventListener("resize", placeChips);
        texts.forEach(({ el }) => { el.removeAttribute("contenteditable"); el.classList.remove("wn-edit-target"); });
        $("chips").replaceChildren();
      }
      refresh();
    };

    const discard = () => {
      texts.forEach(({ el, original }) => { el.innerHTML = original; });
      images.forEach((m) => {
        m.el.setAttribute("src", m.src);
        m.el.alt = m.alt;
        m.assetId = null;
        if (m.width) m.el.setAttribute("width", m.width);
        if (m.height) m.el.setAttribute("height", m.height);
      });
      links.forEach(({ el, href }) => el.setAttribute("href", href));
      stash.clear();
      setEditing(false);
    };

    $("file").addEventListener("change", async () => {
      const file = $("file").files[0];
      const image = currentImage;
      if (!file || !image) return;
      say("写真をアップロードしています…");
      $("save").disabled = true;
      try {
        const { id, url, width, height } = await store.upload(file);
        image.assetId = id;
        image.el.src = url;
        image.el.setAttribute("width", width);
        image.el.setAttribute("height", height);
        refresh();
        showAlt(image);
      } catch (error) {
        refresh();
        say(error?.code === "too_large" ? "写真が大きすぎます。小さくしてからお試しください。" : "写真を読み込めませんでした。JPEG・PNG・WebP でお試しください。", true);
      }
    });

    // 編集中はリンクで移動しない。文字に入ったときは、そのリンク先を入力欄に出す
    document.addEventListener("click", (e) => {
      if (!editing || e.target.closest(".wn-edit")) return;
      const link = e.target.closest("a[href]");
      if (!link) return;
      e.preventDefault();
      e.stopPropagation();
    }, true);
    document.addEventListener("focusin", (e) => {
      if (!editing || !e.target.closest?.(".wn-edit-target")) return;
      const link = e.target.closest("a[href]");
      currentLink = link;
      $("link-row").hidden = !link;
      $("alt-row").hidden = true;
      if (link) $("link").value = link.getAttribute("href");
    });
    $("link").addEventListener("input", () => {
      const value = $("link").value.trim();
      const ok = SAFE_HREF.test(value);
      $("link").classList.toggle("is-error", !ok);
      if (ok && currentLink) currentLink.setAttribute("href", value);
      refresh();
    });
    $("alt").addEventListener("input", () => {
      if (currentImage) currentImage.el.alt = $("alt").value;
      refresh();
    });

    // 貼り付けは書式なしの文字だけ。Enter は改行（段落を増やさない）
    document.addEventListener("paste", (e) => {
      if (!editing || !e.target.closest?.(".wn-edit-target")) return;
      e.preventDefault();
      document.execCommand("insertText", false, e.clipboardData.getData("text/plain"));
    });
    document.addEventListener("keydown", (e) => {
      if (!editing || !e.target.closest?.(".wn-edit-target")) return;
      if (e.key === "Enter") {
        e.preventDefault();
        document.execCommand("insertLineBreak");
      } else if (e.key === "Escape") {
        e.stopPropagation();
        e.target.blur();
      }
    }, true);
    document.addEventListener("dragstart", (e) => { if (editing) e.preventDefault(); });
    document.addEventListener("drop", (e) => { if (editing) e.preventDefault(); });
    document.addEventListener("input", (e) => {
      if (editing && e.target.closest?.(".wn-edit-target")) refresh();
    });

    const buildPage = async () => {
      const res = await fetch("./index.html", { cache: "no-store" });
      if (!res.ok) throw new Error("source");
      const source = await res.text();
      const from = source.indexOf("<!DOCTYPE html>");
      const to = source.indexOf("</html>", from);
      if (from < 0 || to < 0) throw new Error("source");
      const doc = new DOMParser().parseFromString(source.slice(from, to + "</html>".length), "text/html");

      const docTexts = textTargets(doc);
      const docImages = imageTargets(doc);
      const docLinks = linkTargets(doc);
      const matches = docTexts.length === texts.length && docImages.length === images.length && docLinks.length === links.length
        && texts.every((t, i) => squeeze(docTexts[i].textContent) === squeeze(new DOMParser().parseFromString(t.original, "text/html").body.textContent));
      if (!matches) throw new Error("mismatch");

      const { text, image, link } = changes();
      text.forEach((t) => {
        const el = docTexts[texts.indexOf(t)];
        el.innerHTML = cleanHtml(t.el);
        syncTime(el);
      });
      image.forEach((m) => {
        const el = docImages[images.indexOf(m)];
        el.alt = m.el.alt;
        if (!m.assetId) return;
        el.setAttribute("src", `/_blob/${m.assetId}`);
        el.setAttribute("width", m.el.getAttribute("width"));
        el.setAttribute("height", m.el.getAttribute("height"));
      });
      link.forEach((l) => docLinks[links.indexOf(l)].setAttribute("href", l.el.getAttribute("href")));
      // このページの script はすべて ./ の外部ファイル。配信時に足されたものが版に積み重ならないよう、それ以外は保存しない
      doc.querySelectorAll('script:not([src^="./"])').forEach((s) => s.remove());
      return `${SKELETON}<!DOCTYPE html>\n${doc.documentElement.outerHTML}</body></html>`;
    };

    $("save").addEventListener("click", async () => {
      if (saving) return;
      saving = true;
      $("save").disabled = true;
      $("cancel").disabled = true;
      say("公開しています…");
      // 他の人の更新と重なると画面が読み込み直されるので、変更を控えておく
      stash.write(texts.map((t, i) => ({ i, html: cleanHtml(t.el), original: t.original })).filter((t) => !sameHtml(t.original, t.html)));
      try {
        await store.publish({ buildPage, changes: changes() });
        stash.clear();
        say("公開しました。ページを読み込み直します…");
        store.afterPublish?.();
      } catch (error) {
        saving = false;
        $("cancel").disabled = false;
        if (error?.code === "conflict") {
          say("ほかの更新と重なりました。読み込み直したあと、変更を戻します。", true);
          return;
        }
        stash.clear();
        refresh();
        const messages = {
          not_writer: "このアカウントには編集権限がありません。",
          "permission-denied": "このアカウントには編集権限がありません。",
          not_granted: "このアカウントには編集権限がありません。",
          rate_limited: "保存が続いています。少し待ってからもう一度お試しください。",
          too_large: "ページが大きすぎて保存できません。",
        };
        say(messages[error?.code] ?? (error?.message === "mismatch" ? "公開中のページが更新されています。読み込み直してから、もう一度お試しください。" : "保存できませんでした。変更は残っています。もう一度お試しください。"), true);
      }
    });

    $("cancel").addEventListener("click", () => {
      if (changes().count === 0 || cancelArmed) {
        cancelArmed = false;
        $("cancel").textContent = "やめる";
        discard();
        return;
      }
      cancelArmed = true;
      $("cancel").textContent = "変更を捨てる";
      say("もう一度押すと、変更を捨てて元に戻します。", true);
      setTimeout(() => {
        cancelArmed = false;
        $("cancel").textContent = "やめる";
        if (editing) refresh();
      }, 3000);
    });

    $("open").addEventListener("click", () => setEditing(true));

    // 重なって保存できなかった文字の変更を戻す（保存に成功していれば差がないので何もしない）
    const saved = stash.read();
    stash.clear();
    if (Array.isArray(saved) && saved.length) {
      const targets = store.targets().text;
      const lost = saved.filter(({ i, html }) => targets[i] && !sameHtml(targets[i].innerHTML, html));
      if (lost.length) {
        setEditing(true);
        lost.forEach(({ i, html }) => { targets[i].innerHTML = html; });
        refresh();
        say("ほかの更新と重なったため、まだ公開されていません。内容を確認して、もう一度保存してください。", true);
      }
    }
  };

  // ---------- Claude の公開ページ ----------
  if (window.claude?.use) {
    if (PAGE !== "index") return; // buildPage は index.html を作り直すので、トップページ以外では動かさない
    Promise.all([claude.use("user"), claude.use("artifact"), claude.use("assets")]).then(async ([user, artifact, assets]) => {
      if (!artifact || !assets || !(await user?.canEdit())) return;
      start({
        targets: () => ({ text: textTargets(document), image: imageTargets(document), link: linkTargets(document) }),
        async upload(file) {
          const { blob, width, height } = await shrink(file);
          const { id, url } = await assets.upload(blob);
          return { id, url, width, height };
        },
        publish: async ({ buildPage }) => artifact.publish(await buildPage()),
      });
    });
    return;
  }

  // ---------- Firebase ----------
  // 他の script が動く前の要素を控える。この番号と「元の内容」（from）を保存データの鍵にする
  const base = { text: textTargets(document), image: imageTargets(document), link: linkTargets(document) };
  const from = {
    text: base.text.map((el) => squeeze(el.textContent)),
    image: base.image.map((el) => el.getAttribute("src")),
    link: base.link.map((el) => el.getAttribute("href")),
  };
  const SAFE_IMAGE = /^data:image\/(webp|jpeg|png);base64,/;
  const MAX_IMAGE_CHARS = 950000; // Firestore の 1 ドキュメント上限（1MiB）に収める

  // ?edit で開いたら、同じタブの他のページでも編集できるように覚えておく
  const EDIT_KEY = "wn-edit-on";
  const wantsEdit = (() => {
    const requested = new URLSearchParams(location.search).has("edit");
    try {
      if (requested) sessionStorage.setItem(EDIT_KEY, "1");
      return requested || sessionStorage.getItem(EDIT_KEY) === "1";
    } catch { return requested; }
  })();

  // 保存された文字を入れる。インライン要素と class だけを残す
  const setSafeHtml = (el, html) => {
    const copy = (source, target) => source.childNodes.forEach((node) => {
      if (node.nodeType === 3) target.append(node.textContent);
      else if (node.nodeType === 1 && INLINE.has(node.tagName)) {
        const child = document.createElement(node.tagName);
        if (node.className) child.className = node.className;
        copy(node, child);
        target.append(child);
      } else if (node.nodeType === 1) copy(node, target);
    });
    const fragment = document.createDocumentFragment();
    copy(new DOMParser().parseFromString(html, "text/html").body, fragment);
    el.replaceChildren(fragment);
  };

  const setUpFirebase = async (CONFIG) => {
    // 閲覧者には Firebase の SDK を読み込ませず、REST で読むだけにする
    const readField = async (path, field) => {
      const res = await fetch(`https://firestore.googleapis.com/v1/projects/${CONFIG.firebase.projectId}/databases/(default)/documents/${path}?key=${CONFIG.firebase.apiKey}`, { cache: "no-cache" });
      if (!res.ok) return null;
      return (await res.json()).fields?.[field]?.stringValue ?? null;
    };

    let patch = { text: {}, image: {}, link: {} };
    try {
      patch = { ...patch, ...JSON.parse(await readField(`site/${PAGE}`, "patch") ?? "{}") };
    } catch { /* 読めなければ元のページのまま見せる */ }

    Object.entries(patch.text).forEach(([key, { from: was, html }]) => {
      if (base.text[key] && from.text[key] === was) setSafeHtml(base.text[key], html);
    });
    Object.entries(patch.link).forEach(([key, { from: was, href }]) => {
      if (base.link[key] && from.link[key] === was && SAFE_HREF.test(href)) base.link[key].setAttribute("href", href);
    });
    await Promise.all(Object.entries(patch.image).map(async ([key, { from: was, id, alt, width, height }]) => {
      const el = base.image[key];
      if (!el || from.image[key] !== was) return;
      el.alt = alt ?? el.alt;
      if (!id) return;
      const data = await readField(`siteImages/${id}`, "data").catch(() => null);
      if (!data || !SAFE_IMAGE.test(data)) return;
      el.src = data;
      if (width) el.setAttribute("width", width);
      if (height) el.setAttribute("height", height);
    }));

    if (wantsEdit) setUpEditor(CONFIG, patch);
  };

  const setUpEditor = async (CONFIG, patch) => {
    const SDK = "https://www.gstatic.com/firebasejs/12.0.0";
    const [{ initializeApp }, authMod, fsMod] = await Promise.all([
      import(`${SDK}/firebase-app.js`), import(`${SDK}/firebase-auth.js`), import(`${SDK}/firebase-firestore.js`),
    ]);
    const { getAuth, GoogleAuthProvider, signInWithPopup, onAuthStateChanged } = authMod;
    const { getFirestore, doc, collection, getDoc, setDoc, addDoc, serverTimestamp } = fsMod;
    const app = initializeApp(CONFIG.firebase);
    const auth = getAuth(app);
    auth.languageCode = "ja";
    const db = getFirestore(app);

    const isEditor = async (user) => {
      if (!user?.email) return false;
      try { return (await getDoc(doc(db, "editors", user.email))).exists(); } catch { return false; }
    };

    const blobToDataUrl = (blob) => new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });

    const store = {
      targets: () => base,
      async upload(file) {
        for (const [side, quality] of [[1600, 0.8], [1280, 0.75], [1024, 0.7], [800, 0.6]]) {
          const { blob, width, height } = await shrink(file, side, quality);
          const url = await blobToDataUrl(blob);
          if (url.length > MAX_IMAGE_CHARS) continue;
          const ref = await addDoc(collection(db, "siteImages"), { data: url, createdAt: serverTimestamp() });
          return { id: ref.id, url, width, height };
        }
        throw Object.assign(new Error("too large"), { code: "too_large" });
      },
      async publish({ changes }) {
        const next = { text: { ...patch.text }, image: { ...patch.image }, link: { ...patch.link } };
        changes.text.forEach((t) => { next.text[t.key] = { from: from.text[t.key], html: cleanHtml(t.el) }; });
        changes.link.forEach((l) => { next.link[l.key] = { from: from.link[l.key], href: l.el.getAttribute("href") }; });
        changes.image.forEach((m) => {
          next.image[m.key] = {
            from: from.image[m.key],
            id: m.assetId ?? patch.image[m.key]?.id ?? null,
            alt: m.el.alt,
            width: m.el.getAttribute("width"),
            height: m.el.getAttribute("height"),
          };
        });
        await setDoc(doc(db, "site", PAGE), { patch: JSON.stringify(next), updatedAt: serverTimestamp(), updatedBy: auth.currentUser.email });
      },
      afterPublish() { setTimeout(() => location.reload(), 600); },
    };

    const user = await new Promise((resolve) => {
      const stop = onAuthStateChanged(auth, (u) => { stop(); resolve(u); });
    });
    if (await isEditor(user)) {
      start(store);
      return;
    }

    loadCss();
    const login = document.createElement("button");
    login.type = "button";
    login.className = "wn-edit__open";
    login.textContent = "編集者ログイン";
    login.addEventListener("click", async () => {
      login.disabled = true;
      try {
        const { user: signedIn } = await signInWithPopup(auth, new GoogleAuthProvider());
        if (await isEditor(signedIn)) {
          login.remove();
          start(store);
          return;
        }
        login.textContent = "このアカウントには編集権限がありません";
      } catch (error) {
        if (error.code !== "auth/popup-closed-by-user" && error.code !== "auth/cancelled-popup-request") login.textContent = "ログインできませんでした";
      }
      login.disabled = false;
    });
    document.body.append(login);
  };

  import("./firebase-config.js").then(({ CONFIG }) => {
    if (CONFIG.useFirebase) setUpFirebase(CONFIG);
  });
})();
