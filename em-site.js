/* EntroMorphic — shared behaviour for every page.
   Nothing here depends on WebGL: if the orb fails to load, the site still works.
     window.EMEnhance(scope)  — progressive enhancements for a (re)rendered view
     window.EMOnView(scope)   — view-specific interactions (hero, spinout link)
     window.EMRefadeOrb()     — re-materialise the orb
   The router calls the first two after every view swap. */
(function () {
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const excite = (a, e, p) => window.EM && window.EM.excite(a, e, p);
  const release = () => window.EM && window.EM.release();

  /* ---------- orb helpers ---------- */
  window.EMRefadeOrb = function () {
    const o = document.querySelector(".orb");
    if (!o || reduce) return;
    o.classList.remove("refade"); void o.offsetWidth; o.classList.add("refade");
  };

  /* ---------- spinning-border buttons ---------- */
  function injectFilters() {
    if (document.getElementById("em-btn-filters")) return;
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.id = "em-btn-filters";
    svg.setAttribute("width", "0");
    svg.setAttribute("height", "0");
    svg.setAttribute("aria-hidden", "true");
    svg.style.position = "absolute";
    svg.innerHTML =
      "<defs>" +
      '<filter id="unopaq" x="0" y="0" width="1" height="1"><feColorMatrix values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 3 0"/></filter>' +
      '<filter id="unopaq2" x="0" y="0" width="1" height="1"><feColorMatrix values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 5 0"/></filter>' +
      '<filter id="unopaq3" x="0" y="0" width="1" height="1"><feColorMatrix values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 2 0"/></filter>' +
      "</defs>";
    document.body.appendChild(svg);
  }
  function el(tag, cls) { const n = document.createElement(tag); if (cls) n.className = cls; return n; }
  // Convert .btn anchors/buttons into spinning-gradient-border buttons.
  // Built with DOM APIs (no string HTML), and the link keeps target/rel.
  function convertButtons(scope) {
    scope.querySelectorAll("a.btn, button.btn").forEach((btn) => {
      const label = btn.textContent.trim();
      const href = btn.getAttribute("href");
      const c = el("span", "button-container");
      const real = href ? el("a", "real-button") : el("button", "real-button");
      if (href) {
        real.setAttribute("href", href);
        ["target", "rel"].forEach((k) => { if (btn.hasAttribute(k)) real.setAttribute(k, btn.getAttribute(k)); });
      } else real.type = "button";
      real.setAttribute("aria-label", btn.getAttribute("aria-label") || label);
      const shell = el("div");
      shell.setAttribute("aria-hidden", "true");
      const clip = el("div", "glow-clip");
      clip.append(el("div", "backdrop"), el("div", "spin spin-blur"), el("div", "spin spin-intense"));
      const border = el("div", "button-border");
      const face = el("div", "button");
      face.textContent = label;
      border.append(el("div", "spin spin-inside"), face);
      shell.append(clip, border);
      c.append(real, shell);
      btn.replaceWith(c);
    });
  }

  /* ---------- nav ---------- */
  function currentFile() {
    const f = decodeURIComponent(location.pathname.split("/").pop() || "").toLowerCase();
    return f === "" ? "index.html" : f;
  }
  function setActiveNav() {
    const here = currentFile();
    document.querySelectorAll("nav.site .links a").forEach((a) => {
      const t = (a.getAttribute("href") || "").split("#")[0].toLowerCase();
      const on = t === here;
      a.classList.toggle("active", on);
      if (on) a.setAttribute("aria-current", "page"); else a.removeAttribute("aria-current");
    });
  }
  function bindMenu() {
    const nav = document.querySelector("nav.site");
    const toggle = nav && nav.querySelector(".menu-toggle");
    if (!toggle || toggle.__em) return;
    toggle.__em = 1;
    const set = (open) => {
      nav.classList.toggle("open", open);
      toggle.setAttribute("aria-expanded", String(open));
      toggle.setAttribute("aria-label", open ? "Close menu" : "Open menu");
    };
    toggle.addEventListener("click", () => set(!nav.classList.contains("open")));
    nav.querySelectorAll(".links a").forEach((a) => a.addEventListener("click", () => set(false)));
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && nav.classList.contains("open")) { set(false); toggle.focus(); }
    });
    matchMedia("(min-width: 981px)").addEventListener("change", (m) => { if (m.matches) set(false); });
  }

  /* ---------- hero preview (home) + orb characters ---------- */
  const heroPreviews = {
    Research: { h: "The thesis, and the method.", s: "Why the work exists, and how a project earns its way out of the lab." },
    Projects: { h: "Active work, in the lab.", s: "Every project carries its place in the lifecycle." },
    Companies: { h: "What graduates from the lab.", s: "When a validated artifact meets real demand, it becomes a company." },
    Writing: { h: "One publication, three collections.", s: "Essays, lab notes and reports." },
    About: { h: "The people, and the model.", s: "Who runs the lab, and how it is funded." },
  };
  let heroOrig = null, heroSwapT = null;
  function swapHero(h, s, isHTML) {
    const h1 = document.querySelector(".hero h1");
    const sub = document.querySelector(".hero .hero-subhead");
    if (!h1 || !sub) return;
    clearTimeout(heroSwapT);
    const apply = () => {
      if (isHTML) { h1.innerHTML = h; sub.innerHTML = s; } else { h1.textContent = h; sub.textContent = s; }
    };
    const heroEl = h1.closest(".hero");
    if (reduce) { apply(); return; }
    heroEl.classList.add("swapping");
    heroSwapT = setTimeout(() => { apply(); heroEl.classList.remove("swapping"); }, 150);
  }
  function previewHero(key) {
    if (!heroOrig) return;
    const p = heroPreviews[key];
    if (p) swapHero(p.h, p.s, false); else swapHero(heroOrig.h, heroOrig.s, true);
  }
  function restoreHero() { if (heroOrig) swapHero(heroOrig.h, heroOrig.s, true); }

  // Blob Core character presets (read by em-orb.js through window.EM.preset).
  const excited = { amplitude: 0.66, frequency: 2.2, rim: 0.95, spin: 0.28, strength: 0.55 };
  const flynnState = { amplitude: 0.38, frequency: 1.3, rim: 1.5, spin: 0.5, strength: 0.7 };
  const navPresets = {
    Home: { amplitude: 0.30, frequency: 1.1, rim: 0.55, spin: 0.10, strength: 0.40 },
    Research: { amplitude: 0.72, frequency: 2.6, rim: 0.70, spin: 0.06, strength: 0.45 },
    Projects: { amplitude: 0.55, frequency: 3.2, rim: 0.50, spin: 0.34, strength: 0.42 },
    Companies: { amplitude: 0.48, frequency: 0.9, rim: 1.30, spin: 0.14, strength: 0.62 },
    Writing: { amplitude: 0.20, frequency: 2.0, rim: 0.85, spin: 0.02, strength: 0.36 },
    About: { amplitude: 0.62, frequency: 1.7, rim: 0.45, spin: 0.46, strength: 0.50 },
  };
  window.EMPresets = { excited, flynnState, navPresets };

  function bindNavPresets() {
    document.querySelectorAll("nav.site .links a[data-key]").forEach((a) => {
      if (a.__em) return; a.__em = 1;
      const key = a.dataset.key;
      const on = () => { window.EMRefadeOrb(); previewHero(key); excite(1, 0.4, navPresets[key]); };
      const off = () => { restoreHero(); release(); };
      a.addEventListener("pointerenter", (e) => { if (e.pointerType === "mouse") on(); });
      a.addEventListener("pointerleave", (e) => { if (e.pointerType === "mouse") off(); });
      a.addEventListener("focus", on);
      a.addEventListener("blur", off);
    });
  }

  window.EMOnView = function (scope) {
    scope = scope || document;
    const headline = scope.querySelector(".hero h1");
    const sub = scope.querySelector(".hero .hero-subhead");
    heroOrig = headline && sub ? { h: headline.innerHTML, s: sub.innerHTML } : null;
    if (headline && !headline.__em) {
      headline.__em = 1;
      ["pointerenter", "pointerdown"].forEach((ev) => headline.addEventListener(ev, () => excite(1, 0.5, excited), { passive: true }));
      ["pointerleave", "pointerup", "pointercancel"].forEach((ev) => headline.addEventListener(ev, release));
    }
    const spin = scope.querySelector(".spinout-link");
    if (spin && !spin.__em) {
      spin.__em = 1;
      ["pointerenter", "focus"].forEach((ev) => spin.addEventListener(ev, () => excite(1, 0.85, flynnState)));
      ["pointerleave", "blur"].forEach((ev) => spin.addEventListener(ev, release));
    }
  };

  /* ---------- view enhancements ---------- */
  function markLoaded(scope) {
    const hero = scope.querySelector(".hero");
    if (hero) requestAnimationFrame(() => requestAnimationFrame(() => hero.classList.add("loaded")));
    const nav = document.querySelector("nav.site");
    if (nav && !nav.classList.contains("loaded")) requestAnimationFrame(() => requestAnimationFrame(() => nav.classList.add("loaded")));
  }

  let io = null;
  function bindReveal(scope) {
    const items = scope.querySelectorAll(".reveal");
    if (!items.length) return;
    if (!("IntersectionObserver" in window)) { items.forEach((e) => e.classList.add("in")); return; }
    if (!io) io = new IntersectionObserver((entries) => {
      entries.forEach((e) => { if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); } });
    }, { rootMargin: "0px 0px -12% 0px", threshold: 0.08 });
    items.forEach((e) => io.observe(e));
  }

  // Proof-bar cells: a ring expands from the orb; each cell reveals its slice.
  // Geometry is measured on enter and on scroll — never inside the frame loop.
  function bindProofbar(scope) {
    scope.querySelectorAll(".proofbar .cell").forEach((cell) => {
      if (cell.__pb) return; cell.__pb = 1;
      let raf = null, t0 = 0, phase = 0, prev = 0, maxR = 0;
      const measure = () => {
        const r = cell.getBoundingClientRect();
        cell.style.setProperty("--cl", r.left.toFixed(1) + "px");
        cell.style.setProperty("--ct", r.top.toFixed(1) + "px");
        const o = window.__orb;
        if (o) { cell.style.setProperty("--ox", o.x.toFixed(1) + "px"); cell.style.setProperty("--oy", o.y.toFixed(1) + "px"); }
        maxR = Math.hypot(innerWidth, innerHeight) * 1.05;
      };
      const tick = (now) => {
        if (!t0) { t0 = now; prev = now; }
        const period = Math.min(2.6, 0.7 + ((now - t0) / 1000) * 0.22);
        phase += (now - prev) / 1000 / period; prev = now;
        const t = phase - Math.floor(phase);
        cell.style.setProperty("--pb-op", (Math.sin(Math.PI * t) * 0.9).toFixed(3));
        cell.style.setProperty("--wr", (t * maxR).toFixed(1) + "px");
        raf = requestAnimationFrame(tick);
      };
      cell.addEventListener("pointerenter", () => {
        cell.classList.remove("pulsing"); void cell.offsetWidth; cell.classList.add("pulsing");
        measure();
        if (reduce) { cell.style.setProperty("--pb-op", "0.5"); return; }
        window.addEventListener("scroll", measure, { passive: true });
        t0 = 0; phase = 0; cancelAnimationFrame(raf); raf = requestAnimationFrame(tick);
      });
      cell.addEventListener("pointerleave", () => {
        cell.classList.remove("pulsing"); cancelAnimationFrame(raf); raf = null;
        window.removeEventListener("scroll", measure);
        cell.style.setProperty("--pb-op", "0");
      });
    });
  }

  function bindChips(scope) {
    const chips = scope.querySelectorAll("[data-filter]");
    chips.forEach((chip) => {
      if (chip.__em) return; chip.__em = 1;
      chip.addEventListener("click", () => {
        chips.forEach((c) => c.setAttribute("aria-pressed", String(c === chip)));
        const f = chip.dataset.filter;
        let shown = 0;
        scope.querySelectorAll(".wrow").forEach((row) => {
          const on = f === "all" || row.dataset.kind === f;
          row.hidden = !on; if (on) shown++;
        });
        const live = scope.querySelector("[data-filter-status]");
        if (live) live.textContent = shown + (shown === 1 ? " entry" : " entries") + " shown";
      });
    });
  }

  // Live preview of a spinout's own site, scaled to fit its card.
  // The stats card underneath is the fallback. The embed is skipped when this
  // page is itself inside a frame (e.g. a design preview), where nested
  // embeds are typically blocked and would show an error box instead.
  function bindPortals(scope) {
    let framed = true;
    try { framed = window.self !== window.top; } catch (e) {}
    scope.querySelectorAll(".spinout .visual[data-live]").forEach((v) => {
      if (v.__em || framed) return; v.__em = 1;
      const f = document.createElement("iframe");
      f.src = v.dataset.live;
      f.title = "Live preview of " + v.dataset.live.replace(/^https?:\/\//, "");
      f.loading = "lazy";
      f.referrerPolicy = "no-referrer";
      f.tabIndex = -1;
      f.setAttribute("aria-hidden", "true");
      f.setAttribute("sandbox", "allow-scripts allow-same-origin"); // no popups, forms or top-level navigation
      f.addEventListener("load", () => v.classList.add("is-live"), { once: true });
      v.insertBefore(f, v.firstChild);
    });
  }

  window.EMEnhance = function (scope) {
    scope = scope || document;
    injectFilters();
    convertButtons(scope);
    setActiveNav();
    markLoaded(scope);
    bindReveal(scope);
    bindProofbar(scope);
    bindChips(scope);
    bindPortals(scope);
  };

  bindMenu();
  bindNavPresets();
  window.EMEnhance(document);
  window.EMOnView(document);
})();
