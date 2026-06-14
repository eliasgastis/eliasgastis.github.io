/* ============================================================
   Space95 — Starfield screensaver
   The classic Win95 "Starfield Simulation": after a stretch of
   inactivity, a full-screen warp through the stars fades in.
   Any input wakes it. Disabled under reduced-motion and on
   touch / coarse-pointer devices. Can be triggered from the
   Start menu ("Screensaver").
   ============================================================ */
(function () {
  "use strict";

  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var coarse = window.matchMedia("(pointer: coarse)").matches;
  var IDLE_MS = 60000;          // inactivity before the screensaver starts
  var GRACE_MS = 700;           // ignore wake events briefly after starting

  /* ---------- Overlay + canvas (built lazily) ---------- */
  var overlay, canvas, ctx, hint;
  function build() {
    overlay = document.createElement("div");
    overlay.className = "screensaver";
    overlay.hidden = true;
    canvas = document.createElement("canvas");
    hint = document.createElement("p");
    hint.className = "screensaver__hint";
    hint.textContent = "Space95 — move to wake";
    overlay.appendChild(canvas);
    overlay.appendChild(hint);
    document.body.appendChild(overlay);
    ctx = canvas.getContext("2d");
  }

  var w, h, cx, cy, dpr, stars = [], rafId = 0, active = false, startedAt = 0;
  var SPEED = 0.0024;           // fraction of depth per ms

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    w = canvas.width = Math.floor(innerWidth * dpr);
    h = canvas.height = Math.floor(innerHeight * dpr);
    canvas.style.width = innerWidth + "px";
    canvas.style.height = innerHeight + "px";
    cx = w / 2; cy = h / 2;
  }
  function makeStar(z) {
    return {
      x: Math.random() * 2 - 1,             // normalised −1..1
      y: Math.random() * 2 - 1,
      z: z != null ? z : Math.random()      // depth 0..1 (0 = at viewer)
    };
  }
  function seed() {
    resize();
    stars = [];
    var n = Math.min(700, Math.floor((innerWidth * innerHeight) / 2200));
    for (var i = 0; i < n; i++) stars.push(makeStar());
  }

  var last = 0;
  function frame(now) {
    rafId = requestAnimationFrame(frame);
    var dt = Math.min(now - last || 16, 50);
    last = now;
    ctx.fillStyle = "rgba(0,0,0,0.35)";     // trails fade for a warp streak
    ctx.fillRect(0, 0, w, h);
    for (var i = 0; i < stars.length; i++) {
      var s = stars[i];
      var pz = s.z;
      s.z -= SPEED * dt;
      if (s.z <= 0.02) { stars[i] = makeStar(1); continue; }
      var sx = cx + (s.x / s.z) * cx;
      var sy = cy + (s.y / s.z) * cy;
      var px = cx + (s.x / pz) * cx;
      var py = cy + (s.y / pz) * cy;
      if (sx < 0 || sx > w || sy < 0 || sy > h) continue;
      var b = Math.min(1, (1 - s.z) * 1.2);
      var size = Math.max(dpr, (1 - s.z) * 3 * dpr);
      ctx.strokeStyle = "rgba(255,255,255," + b.toFixed(3) + ")";
      ctx.lineWidth = size;
      ctx.beginPath();
      ctx.moveTo(px, py);
      ctx.lineTo(sx, sy);
      ctx.stroke();
    }
  }

  function activate() {
    if (active || reduceMotion) return;
    if (!overlay) build();
    active = true;
    startedAt = performance.now();
    overlay.hidden = false;
    document.body.style.cursor = "none";
    seed();
    ctx.fillStyle = "#000"; ctx.fillRect(0, 0, w, h);
    last = performance.now();
    rafId = requestAnimationFrame(frame);
  }
  function deactivate() {
    if (!active) return;
    active = false;
    if (rafId) cancelAnimationFrame(rafId);
    rafId = 0;
    overlay.hidden = true;
    document.body.style.cursor = "";
    schedule();
  }

  /* ---------- Idle detection ---------- */
  var idleTimer = 0;
  function schedule() {
    clearTimeout(idleTimer);
    idleTimer = setTimeout(activate, IDLE_MS);
  }
  function onActivity(e) {
    if (active) {
      if (performance.now() - startedAt < GRACE_MS) return;   // ignore the stray event that starts it
      if (e) { e.preventDefault(); e.stopPropagation(); }
      deactivate();
    } else {
      schedule();
    }
  }

  if (!reduceMotion && !coarse) {
    ["mousemove", "mousedown", "keydown", "wheel", "touchstart", "scroll"]
      .forEach(function (ev) { window.addEventListener(ev, onActivity, { passive: false, capture: true }); });
    window.addEventListener("resize", function () { if (active) resize(); });
    schedule();
  }

  /* Manual trigger from the Start menu (works even under reduced motion off-guard) */
  var startLi = document.getElementById("startSaver");
  if (startLi) startLi.addEventListener("click", function (e) {
    e.preventDefault();
    if (reduceMotion) { reduceMotion = false; activate(); reduceMotion = true; }
    else activate();
  });
})();
