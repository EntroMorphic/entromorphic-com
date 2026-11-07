/* EntroMorphic — the Blob Core orb (WebGL), shared by every page.
   Visual only: all interaction wiring lives in em-site.js, so if three.js or
   WebGL is unavailable the page keeps working and the orb falls back to its
   CSS glow (html.no-webgl). */
import * as THREE from "three";
import { createBlobCore } from "./src/effects/blobcore.js";

const root = document.documentElement;
const canvas = document.getElementById("c1");
const orbEl = document.querySelector(".orb");
const vigEl = document.querySelector(".vignette");
const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;

function start() {
  if (!canvas || !orbEl) return;
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: "high-performance" });
  } catch (e) {
    root.classList.add("no-webgl");
    return;
  }
  renderer.setClearColor(0x000000, 0);
  canvas.addEventListener("webglcontextlost", (e) => { e.preventDefault(); root.classList.add("no-webgl"); });

  const eff = createBlobCore();
  const pointer = { x: 0.5, y: 0.5, nx: 0, ny: 0, tx: 0, ty: 0, vx: 0, vy: 0, down: false, active: true };
  function measure() {
    const r = canvas.parentElement.getBoundingClientRect();
    const w = Math.max(1, Math.round(r.width)), h = Math.max(1, Math.round(r.height));
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.6));
    renderer.setSize(w, h, false);
    return { w, h };
  }
  const size = measure();
  eff.init({ renderer, THREE, width: size.w, height: size.h, pointer, quality: 0.5 });
  eff.resize(size.w, size.h);

  // ---- layout reads happen on scroll/resize only, never inside the frame loop ----
  let baseCX = innerWidth, baseCY = 0, footerTop = Infinity;
  function measureOrbBase() {
    const prev = orbEl.style.transform;
    orbEl.style.transform = "none";
    const b = orbEl.getBoundingClientRect();
    baseCX = b.left + b.width / 2; baseCY = b.top + b.height / 2;
    orbEl.style.transform = prev;
  }
  function measureFooter() {
    const f = document.querySelector("footer.site");
    footerTop = f ? f.getBoundingClientRect().top : Infinity;
  }
  measureOrbBase(); measureFooter();
  addEventListener("scroll", measureFooter, { passive: true });
  addEventListener("resize", () => { measureOrbBase(); measureFooter(); });
  new ResizeObserver(() => {
    const s = measure(); eff.resize(s.w, s.h); measureFooter();
    if (reduceMotion) drawStill();
  }).observe(canvas.parentElement);
  // the router swaps <main>; page height changes, so re-measure the footer then
  new MutationObserver(measureFooter).observe(document.getElementById("view") || document.body, { childList: true });

  const ground = { amplitude: 0.42, frequency: 1.5, rim: 0.42, spin: 0.0, strength: 0.3 };
  const presets = window.EMPresets || {};
  const curPreset = { ...(presets.excited || ground) };
  const clock = new THREE.Clock();
  let smx = 0, smy = 0, lastScroll = scrollY, scrollV = 0;
  let lastT = "", lastF = "", lastV = "";

  function drawStill() {
    eff.update(0, 0, pointer);
    eff.render();
  }
  if (reduceMotion) { drawStill(); return; }

  function frame() {
    const dt = Math.min(clock.getDelta(), 0.05);
    const t = clock.elapsedTime;
    const M = window.EM;
    // Gaze comes from the nervous system (heading + anticipation).
    smx += ((M ? M.gx : 0) - smx) * 0.12;
    smy += ((M ? M.gy : 0) - smy) * 0.12;
    const cur = scrollY;
    scrollV += ((cur - lastScroll) - scrollV) * 0.15; lastScroll = cur;
    const sTerm = Math.max(-1, Math.min(1, scrollV * 0.03));
    const nx = smx + sTerm * 0.5, ny = smy - sTerm * 0.45;
    pointer.vx = nx - pointer.nx; pointer.vy = ny - pointer.ny;
    pointer.nx = nx; pointer.ny = ny;

    // Blend ground → active character by shared arousal, plus idle breath for life.
    const mix = M ? M.arousal : 0;
    const breath = M ? M.breath : 0;
    const tgt = (M && M.preset) || presets.excited || ground;
    const k = 1 - Math.pow(0.015, dt);
    for (const key of ["amplitude", "frequency", "rim", "spin", "strength"]) curPreset[key] += (tgt[key] - curPreset[key]) * k;
    const P = eff.params;
    P.amplitude.value = ground.amplitude + (curPreset.amplitude - ground.amplitude) * mix + breath * 0.015;
    P.frequency.value = ground.frequency + (curPreset.frequency - ground.frequency) * mix;
    P.rim.value = ground.rim + (curPreset.rim - ground.rim) * mix + breath * 0.05 * (0.4 + mix);
    P.spin.value = ground.spin + (curPreset.spin - ground.spin) * mix;
    P.strength.value = ground.strength + (curPreset.strength - ground.strength) * mix;
    eff.update(t, dt, pointer);
    eff.render();

    // Glide the orb toward screen-centre as the page scrolls; blur it in as the footer arrives.
    const pRaw = cur / (innerHeight * 1.2);
    const p = Math.min(1, pRaw);
    const tx = (innerWidth / 2 - baseCX) * p;
    const ty = (innerHeight / 2 - baseCY) * p;
    window.__orb = { x: baseCX + tx, y: baseCY + ty }; // live orb centre for the proof-bar blastwave
    const T = `translate(${tx.toFixed(1)}px,${ty.toFixed(1)}px) scale(${(1 + pRaw * 1.1).toFixed(3)})`;
    const blurPx = footerTop < innerHeight ? Math.min(1, (innerHeight - footerTop) / innerHeight) * 14 : 0;
    const F = `blur(${blurPx.toFixed(1)}px)`;
    const V = (p * 0.9).toFixed(2);
    if (T !== lastT) { orbEl.style.transform = T; lastT = T; }
    if (F !== lastF) { orbEl.style.filter = F; lastF = F; }
    if (vigEl && V !== lastV) { vigEl.style.opacity = V; lastV = V; }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}

start();
