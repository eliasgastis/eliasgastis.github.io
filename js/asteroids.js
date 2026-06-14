/* ============================================================
   Space95 — asteroids.exe
   The arcade classic in a Win95 window: rotate, thrust, fire;
   rocks split when shot and wrap around the screen. Vector look
   to match the terminal aesthetic. Loop pauses while hidden.
   Controls: ← → rotate · ↑ thrust · Space fire · Esc closes.
   ============================================================ */
(function () {
  "use strict";

  var app     = document.getElementById("asteroidsApp");
  if (!app) return;
  var bar     = document.getElementById("asteroidsBar");
  var tab     = document.getElementById("asteroidsTab");
  var icon    = document.getElementById("asteroidsIcon");
  var startLi = document.getElementById("startAsteroids");
  var canvas  = document.getElementById("asteroidsCanvas");
  var newBtn  = document.getElementById("asteroidsNew");
  var scoreEl = document.getElementById("asteroidsScore");
  var livesEl = document.getElementById("asteroidsLives");
  var ctx     = canvas.getContext("2d");

  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ============================================================
     Window management (open / close / minimize / maximize / drag)
     ============================================================ */
  var maxed = false, drag = null;

  function raise(el) {
    document.querySelectorAll(".appwin").forEach(function (w) { w.style.zIndex = (w === el) ? 91 : 90; });
  }
  function openApp() {
    app.hidden = false; tab.hidden = false; tab.classList.add("active"); raise(app);
    resize(); start();
  }
  function closeApp()    { app.hidden = true; tab.hidden = true; tab.classList.remove("active"); stop(); }
  function minimizeApp() { app.hidden = true; tab.classList.remove("active"); stop(); }
  function toggleFromTab() {
    if (app.hidden) { app.hidden = false; tab.classList.add("active"); raise(app); resize(); start(); }
    else minimizeApp();
  }
  function toggleMax() {
    maxed = !maxed;
    app.classList.toggle("appwin--max", maxed);
    app.style.left = app.style.top = app.style.transform = "";
    resize();
  }

  icon.addEventListener("click", function (e) { e.preventDefault(); openApp(); });
  if (startLi) startLi.addEventListener("click", function (e) { e.preventDefault(); openApp(); });
  tab.addEventListener("click", toggleFromTab);
  app.querySelectorAll(".appbtn").forEach(function (b) {
    b.addEventListener("click", function () {
      var act = b.dataset.act;
      if (act === "close") closeApp();
      else if (act === "min") minimizeApp();
      else if (act === "max") toggleMax();
    });
  });

  bar.addEventListener("pointerdown", function (e) {
    if (maxed || e.target.closest(".appbtn")) return;
    var r = app.getBoundingClientRect();
    drag = { dx: e.clientX - r.left, dy: e.clientY - r.top };
    app.style.transform = "none"; app.style.left = r.left + "px"; app.style.top = r.top + "px";
    bar.setPointerCapture(e.pointerId);
  });
  bar.addEventListener("pointermove", function (e) {
    if (!drag) return;
    var x = e.clientX - drag.dx, y = e.clientY - drag.dy, ww = app.offsetWidth;
    x = Math.max(120 - ww, Math.min(window.innerWidth - 120, x));
    y = Math.max(0, Math.min(window.innerHeight - 60, y));
    app.style.left = x + "px"; app.style.top = y + "px";
  });
  bar.addEventListener("pointerup",     function () { drag = null; });
  bar.addEventListener("pointercancel", function () { drag = null; });

  if (newBtn) newBtn.addEventListener("click", function () { newGame(); });

  /* ============================================================
     Canvas sizing (CSS-pixel coordinate space, scaled by DPR)
     ============================================================ */
  var W = 0, H = 0, dpr = 1;
  function resize() {
    var cw = canvas.clientWidth, ch = canvas.clientHeight;
    if (!cw || !ch) return;
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.floor(cw * dpr);
    canvas.height = Math.floor(ch * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    W = cw; H = ch;
  }
  window.addEventListener("resize", function () { if (!app.hidden) resize(); });

  /* ============================================================
     Game state
     ============================================================ */
  var ship, rocks = [], bullets = [], score = 0, lives = 3, level = 1;
  var mode = "start";          // "start" | "play" | "over"
  var invuln = 0, fireLock = 0;

  function reset(full) {
    if (full) { score = 0; lives = 3; level = 1; }
    ship = { x: W / 2, y: H / 2, a: -Math.PI / 2, vx: 0, vy: 0, thrust: false };
    bullets = [];
    invuln = full ? 90 : 120;
    updateHud();
  }
  function newGame() { mode = "play"; reset(true); spawnLevel(); }

  function spawnLevel() {
    rocks = [];
    var n = 3 + level;
    for (var i = 0; i < n; i++) rocks.push(makeRock(null, null, 3));
  }

  function makeRock(x, y, size) {
    if (x == null) {                        // spawn at an edge, away from ship
      if (Math.random() < 0.5) { x = Math.random() < 0.5 ? 0 : W; y = Math.random() * H; }
      else { x = Math.random() * W; y = Math.random() < 0.5 ? 0 : H; }
    }
    var r = size === 3 ? 42 : size === 2 ? 24 : 13;
    var verts = [], n = 9 + Math.floor(Math.random() * 4);
    for (var i = 0; i < n; i++) verts.push(0.72 + Math.random() * 0.5);
    var sp = (4 - size) * 0.35 + 0.3 + level * 0.05;
    var ang = Math.random() * Math.PI * 2;
    return {
      x: x, y: y, r: r, size: size, verts: verts,
      vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp,
      rot: (Math.random() - 0.5) * 0.04, spin: Math.random() * Math.PI * 2
    };
  }

  function wrap(o) {
    if (o.x < 0) o.x += W; else if (o.x > W) o.x -= W;
    if (o.y < 0) o.y += H; else if (o.y > H) o.y -= H;
  }

  function fire() {
    if (fireLock > 0 || bullets.length >= 5) return;
    bullets.push({
      x: ship.x + Math.cos(ship.a) * 14,
      y: ship.y + Math.sin(ship.a) * 14,
      vx: ship.vx + Math.cos(ship.a) * 6.4,
      vy: ship.vy + Math.sin(ship.a) * 6.4,
      life: 64
    });
    fireLock = 9;
  }

  function die() {
    lives--;
    updateHud();
    if (lives <= 0) { mode = "over"; }
    else reset(false);
  }

  function updateHud() {
    if (scoreEl) scoreEl.textContent = "Score: " + score;
    if (livesEl) livesEl.textContent = "Ships: " + Math.max(0, lives);
  }

  /* ============================================================
     Input
     ============================================================ */
  var keys = {};
  window.addEventListener("keydown", function (e) {
    if (app.hidden) return;
    var k = e.key;
    if (k === "ArrowLeft" || k === "ArrowRight" || k === "ArrowUp" || k === "ArrowDown" || k === " " ||
        k === "a" || k === "d" || k === "w") {
      e.preventDefault();
      keys[k] = true;
      if (k === " ") {
        if (mode === "play") fire();
        else newGame();
      }
    } else if (k === "Escape" && !document.querySelector(".msgbox")) {
      closeApp();
    }
  });
  window.addEventListener("keyup", function (e) { keys[e.key] = false; });

  /* ============================================================
     Update + render
     ============================================================ */
  function update() {
    if (mode !== "play") return;
    if (invuln > 0) invuln--;
    if (fireLock > 0) fireLock--;

    var left  = keys.ArrowLeft  || keys.a;
    var right = keys.ArrowRight || keys.d;
    var up    = keys.ArrowUp    || keys.w;
    if (left)  ship.a -= 0.071;
    if (right) ship.a += 0.071;
    ship.thrust = !!up;
    if (up) { ship.vx += Math.cos(ship.a) * 0.13; ship.vy += Math.sin(ship.a) * 0.13; }
    ship.vx *= 0.991; ship.vy *= 0.991;
    var sp = Math.hypot(ship.vx, ship.vy);
    if (sp > 7) { ship.vx *= 7 / sp; ship.vy *= 7 / sp; }
    ship.x += ship.vx; ship.y += ship.vy; wrap(ship);

    for (var b = bullets.length - 1; b >= 0; b--) {
      var bl = bullets[b];
      bl.x += bl.vx; bl.y += bl.vy; wrap(bl);
      if (--bl.life <= 0) bullets.splice(b, 1);
    }

    for (var i = rocks.length - 1; i >= 0; i--) {
      var rk = rocks[i];
      rk.x += rk.vx; rk.y += rk.vy; rk.spin += rk.rot; wrap(rk);

      // bullet hits
      for (var j = bullets.length - 1; j >= 0; j--) {
        var bu = bullets[j];
        if (Math.hypot(bu.x - rk.x, bu.y - rk.y) < rk.r) {
          bullets.splice(j, 1);
          rocks.splice(i, 1);
          score += rk.size === 3 ? 20 : rk.size === 2 ? 50 : 100;
          if (rk.size > 1) { rocks.push(makeRock(rk.x, rk.y, rk.size - 1)); rocks.push(makeRock(rk.x, rk.y, rk.size - 1)); }
          updateHud();
          break;
        }
      }
      // ship hit
      if (invuln <= 0 && rocks[i] === rk &&
          Math.hypot(ship.x - rk.x, ship.y - rk.y) < rk.r + 9) {
        die();
        break;
      }
    }

    if (rocks.length === 0 && mode === "play") { level++; reset(false); spawnLevel(); }
  }

  function poly(pts) {
    ctx.beginPath();
    ctx.moveTo(pts[0][0], pts[0][1]);
    for (var i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
    ctx.closePath();
    ctx.stroke();
  }

  function drawShip() {
    if (invuln > 0 && Math.floor(invuln / 6) % 2 === 0) return;   // blink while invulnerable
    ctx.save();
    ctx.translate(ship.x, ship.y);
    ctx.rotate(ship.a);
    ctx.strokeStyle = "#b9ffe0"; ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(15, 0); ctx.lineTo(-11, -9); ctx.lineTo(-6, 0); ctx.lineTo(-11, 9);
    ctx.closePath(); ctx.stroke();
    if (ship.thrust && Math.floor(performance.now() / 60) % 2 === 0) {
      ctx.strokeStyle = "#ffcf4d";
      ctx.beginPath(); ctx.moveTo(-6, -4); ctx.lineTo(-15, 0); ctx.lineTo(-6, 4); ctx.stroke();
    }
    ctx.restore();
  }

  function drawRock(rk) {
    ctx.save();
    ctx.translate(rk.x, rk.y);
    ctx.rotate(rk.spin);
    ctx.strokeStyle = "#9ad7ff"; ctx.lineWidth = 1.6;
    var pts = [];
    for (var i = 0; i < rk.verts.length; i++) {
      var th = (i / rk.verts.length) * Math.PI * 2;
      pts.push([Math.cos(th) * rk.r * rk.verts[i], Math.sin(th) * rk.r * rk.verts[i]]);
    }
    poly(pts);
    ctx.restore();
  }

  function centerText(lines, sizes, colors) {
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    var y = H / 2 - (lines.length - 1) * 16;
    for (var i = 0; i < lines.length; i++) {
      ctx.fillStyle = colors[i];
      ctx.font = sizes[i] + "px 'Press Start 2P', monospace";
      ctx.fillText(lines[i], W / 2, y);
      y += sizes[i] + 16;
    }
  }

  function render() {
    ctx.fillStyle = "#04060f";
    ctx.fillRect(0, 0, W, H);

    for (var i = 0; i < rocks.length; i++) drawRock(rocks[i]);
    ctx.fillStyle = "#fff";
    for (var b = 0; b < bullets.length; b++) ctx.fillRect(bullets[b].x - 1.5, bullets[b].y - 1.5, 3, 3);
    if (mode === "play") drawShip();

    if (mode === "start") {
      centerText(["ASTEROIDS", "Press SPACE to start", "← → turn  ↑ thrust  SPACE fire"],
                 [22, 11, 9], ["#fff", "#38e0e6", "#7fae9e"]);
    } else if (mode === "over") {
      centerText(["GAME OVER", "Score: " + score, "Press SPACE to play again"],
                 [22, 12, 10], ["#ec4899", "#fff", "#38e0e6"]);
    }
  }

  /* ============================================================
     Loop
     ============================================================ */
  var rafId = 0, running = false;
  function frame() {
    rafId = requestAnimationFrame(frame);
    if (!W || !H) resize();          // size once the window has laid out
    update();
    if (W && H) render();
  }
  function start() {
    if (running) return;
    running = true;
    rafId = requestAnimationFrame(frame);
  }
  function stop() {
    running = false;
    if (rafId) cancelAnimationFrame(rafId);
    rafId = 0;
  }

  // initial title screen state
  reset(true);
  mode = "start";
})();
