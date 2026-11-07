/* EntroMorphic — the nervous system.
   One shared "consciousness" state (window.EM) with a slow-decaying mood,
   idle breathing, cursor anticipation, cross-visit memory, and tab awareness.
   It drives the Blob Core and propagates mood into CSS variables read across
   every page, so the whole site behaves like a single entity.

   Cost discipline: the loop keeps its maths in JS and only touches the DOM when
   the quantised mood actually changes (a root custom-property write restyles
   the whole document). Storage is written once, when the page is hidden. */
(function () {
  const root = document.documentElement;
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  let store = null;
  try { store = window.localStorage; } catch (e) {}

  const EM = (window.EM = {
    arousal: 0,      // 0 calm .. 1 excited  (decays slowly — an attention span)
    entropy: 0,      // 0 ordered .. 1 chaotic
    breath: 0,       // slow life oscillation, -1..1 (read by the orb)
    gx: 0, gy: 0,    // smoothed gaze heading (with velocity lead — anticipation)
    vx: 0, vy: 0,    // cursor velocity
    preset: null,    // active Blob Core character (set by the page)
    focused: !document.hidden,
    baseA: 0.07,     // idle baseline arousal — never fully "dead"
    _aT: 0.07, _eT: 0, _hold: false, _motion: 0,
    excite(a, e, preset) {
      this._aT = a;
      if (e != null) this._eT = e;
      if (preset !== undefined) this.preset = preset;
      this._hold = true;
    },
    release() { this._hold = false; },
  });

  // Memory: a returning/continuing visitor is greeted a little "warm".
  try {
    const last = parseFloat(store && store.getItem("em-arousal"));
    if (!isNaN(last)) EM.arousal = Math.min(0.4, last * 0.5);
  } catch (e) {}
  function save() { try { store && store.setItem("em-arousal", EM.arousal.toFixed(3)); } catch (e) {} }

  // Cursor: track velocity + heading for gaze and anticipation.
  let lx = null, ly = null, lastMove = performance.now();
  window.addEventListener("pointermove", (e) => {
    if (lx != null) { EM.vx = e.clientX - lx; EM.vy = e.clientY - ly; }
    lx = e.clientX; ly = e.clientY; lastMove = performance.now();
    EM._motion = Math.min(1, EM._motion + 0.14); // ambient movement stirs it a little
  }, { passive: true });

  // Tab awareness: look away on blur, re-engage on focus/return.
  document.addEventListener("visibilitychange", () => {
    EM.focused = !document.hidden;
    if (!EM.focused) { EM._hold = false; save(); }
  });
  window.addEventListener("pagehide", save);
  window.addEventListener("focus", () => { EM.excite(0.34, 0.18); setTimeout(() => EM.release(), 420); });

  let glance = 0, nextGlance = performance.now() + 4000 + Math.random() * 6000, prev = performance.now();
  let shownMood = -1;
  function loop(now) {
    const dt = Math.min(0.05, (now - prev) / 1000); prev = now;
    const idleFor = now - lastMove;

    // Breathing — slow when calm, quicker when aroused.
    const bRate = 0.16 + EM.arousal * 0.28;
    EM.breath = reduce ? 0 : Math.sin(now * 0.001 * bRate * Math.PI * 2);

    // Rare idle "glance": a brief self-driven flicker of attention when left alone.
    if (idleFor > 2500 && now > nextGlance) { glance = 1; nextGlance = now + 5000 + Math.random() * 9000; }
    glance *= Math.pow(0.03, dt);
    EM._motion *= Math.pow(0.04, dt); // motion energy fades fast

    // Targets: held while hovering; otherwise decay toward baseline (or 0 when unfocused).
    let aTarget, eTarget;
    if (EM._hold) { aTarget = EM._aT; eTarget = EM._eT; }
    else if (!EM.focused) { aTarget = 0; eTarget = 0; }
    else { aTarget = EM.baseA + glance * 0.24 + EM._motion * 0.16; eTarget = 0; }

    // Fast to excite, slow to forget — the attention span.
    const ease = EM._hold ? 1 - Math.pow(0.02, dt) : 1 - Math.pow(0.78, dt);
    EM.arousal += (aTarget - EM.arousal) * ease;
    EM.entropy += (eTarget - EM.entropy) * ease;

    // Gaze heading toward the cursor + a velocity lead (anticipation).
    if (lx != null) {
      const hx = (lx / innerWidth) * 2 - 1, hy = -((ly / innerHeight) * 2 - 1);
      const lead = 0.018, g = 1 - Math.pow(0.0015, dt);
      EM.gx += (Math.max(-1.4, Math.min(1.4, hx + EM.vx * lead)) - EM.gx) * g;
      EM.gy += (Math.max(-1.4, Math.min(1.4, hy - EM.vy * lead)) - EM.gy) * g;
    }
    EM.vx *= 0.9; EM.vy *= 0.9;

    // Propagate the single mood into CSS — but only when it visibly changes.
    const q = Math.round(EM.arousal * 50) / 50; // 0.02 steps
    if (q !== shownMood) {
      shownMood = q;
      root.style.setProperty("--mood", q.toFixed(2));
      root.style.setProperty("--mood-hue", (210 - q * 182).toFixed(0)); // blue when calm → orange when hot
    }
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);
})();
