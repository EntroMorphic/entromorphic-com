/* EntroMorphic — client-side view router (loaded on every page).
   Same-site .html links fetch the target page, take its <main id="view">, and
   slide it in over the persistent background + Blob Core instead of a full
   page load. Every page is built from the same shell and shares one
   stylesheet, so swapping <main> is the whole difference between pages.
   Progressive enhancement: any failure falls back to normal navigation. */
(function () {
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const wait = (ms) => new Promise((r) => setTimeout(r, reduce ? 0 : ms));
  let busy = false, pending = null;
  let shown = decodeURIComponent(location.pathname.split("/").pop() || "index.html"); // page now in #view

  function scrollToHash(hash) {
    const el = hash && document.getElementById(hash);
    // Instant, not smooth: the content was just swapped in, so it should simply be in place.
    if (el) el.scrollIntoView({ block: "start", behavior: "instant" });
    else window.scrollTo({ top: 0, behavior: "instant" });
  }

  async function navigate(url, push) {
    const view = document.getElementById("view");
    if (!view) { location.href = url; return; }
    // A click during a transition is queued (latest wins), never turned into a hard reload.
    if (busy) { pending = [url, push]; return; }
    const hi = url.indexOf("#");
    const path = hi >= 0 ? url.slice(0, hi) : url;
    const hash = hi >= 0 ? url.slice(hi + 1) : "";
    busy = true;
    try {
      const res = await fetch(path, { cache: "no-cache" });
      if (!res.ok) throw new Error("status " + res.status);
      const doc = new DOMParser().parseFromString(await res.text(), "text/html");
      const nv = doc.getElementById("view");
      if (!nv) throw new Error("no view");
      view.classList.add("vout");
      await wait(300);
      view.innerHTML = nv.innerHTML;
      view.setAttribute("data-view", nv.getAttribute("data-view") || "");
      if (doc.title) document.title = doc.title;
      shown = decodeURIComponent(path.split("/").pop());
      if (push) history.pushState({ url: path + (hash ? "#" + hash : "") }, "", path + (hash ? "#" + hash : ""));
      view.classList.remove("vout");
      view.classList.add("vin");
      if (window.EMEnhance) window.EMEnhance(view);
      if (window.EMOnView) window.EMOnView(view);
      if (window.EMRefadeOrb) window.EMRefadeOrb();
      scrollToHash(hash);
      // Move focus to the new content so keyboard and screen-reader users land on it.
      view.focus({ preventScroll: true });
      await wait(440);
      view.classList.remove("vin");
    } catch (e) {
      location.href = url;
    } finally {
      busy = false;
      if (pending) { const [u, p] = pending; pending = null; navigate(u, p); }
    }
  }

  document.addEventListener("click", (e) => {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    const a = e.target.closest && e.target.closest("a");
    if (!a) return;
    const href = a.getAttribute("href");
    if (!href || href.charAt(0) === "#") return;
    if (a.target === "_blank" || a.hasAttribute("download")) return;
    if (/^[a-z][a-z0-9+.-]*:/i.test(href)) return; // any scheme: http, mailto, tel…
    if (!/\.html$/i.test(href.split("#")[0])) return;
    e.preventDefault();
    navigate(href, true);
  });

  history.replaceState({ url: (location.pathname.split("/").pop() || "index.html") + location.hash }, "");
  window.addEventListener("popstate", (e) => {
    const file = decodeURIComponent(location.pathname.split("/").pop() || "index.html");
    const hash = location.hash.slice(1);
    // Same page (an in-page #anchor entry): just scroll, don't refetch.
    if (file === shown) { scrollToHash(hash); return; }
    navigate((e.state && e.state.url) || file + location.hash, false);
  });
})();
