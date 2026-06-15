/* ============================================================
   Space95 — starfield, taskbar clock, start menu, scrollspy
   ============================================================ */
(function () {
  "use strict";
  /* Enable the hide-then-reveal animation only now that JS is actually running.
     Without this class, .reveal sections stay visible (no-JS / load failure). */
  document.documentElement.classList.add("js-reveal");
  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ---------- Starfield (the desktop wallpaper) ---------- */
  var canvas = document.getElementById("starfield");
  var ctx = canvas.getContext("2d");
  var stars = [], shooting = [], w, h, dpr;

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    w = canvas.width = Math.floor(innerWidth * dpr);
    h = canvas.height = Math.floor(innerHeight * dpr);
    canvas.style.width = innerWidth + "px";
    canvas.style.height = innerHeight + "px";
    var n = Math.min(240, Math.floor((innerWidth * innerHeight) / 7000));
    stars = [];
    for (var i = 0; i < n; i++) {
      stars.push({
        x: Math.random() * w, y: Math.random() * h,
        r: (Math.random() * 1.3 + 0.3) * dpr,
        a: Math.random() * 0.6 + 0.3,
        tw: Math.random() * 0.02 + 0.004,
        dir: Math.random() < 0.5 ? 1 : -1,
        depth: Math.random() * 0.6 + 0.2,
        hue: Math.random() < 0.85 ? "#ffffff" : (Math.random() < 0.5 ? "#9ad7ff" : "#e3b8ff")
      });
    }
  }
  function spawn() {
    shooting.push({ x: Math.random() * w * 0.6, y: Math.random() * h * 0.4,
      len: (Math.random() * 120 + 80) * dpr, speed: (Math.random() * 6 + 6) * dpr, life: 0, max: 60 });
  }
  var sy = 0;
  addEventListener("scroll", function () { sy = scrollY; }, { passive: true });

  function draw() {
    ctx.clearRect(0, 0, w, h);
    for (var i = 0; i < stars.length; i++) {
      var s = stars[i];
      s.a += s.tw * s.dir;
      if (s.a > 0.95 || s.a < 0.2) s.dir *= -1;
      var py = (s.y - sy * s.depth * dpr * 0.12) % h; if (py < 0) py += h;
      ctx.globalAlpha = s.a; ctx.fillStyle = s.hue;
      ctx.fillRect(s.x, py, s.r, s.r);     /* square stars = pixel feel */
    }
    ctx.globalAlpha = 1;
    for (var j = shooting.length - 1; j >= 0; j--) {
      var sh = shooting[j];
      sh.x += sh.speed; sh.y += sh.speed * 0.5; sh.life++;
      var g = ctx.createLinearGradient(sh.x, sh.y, sh.x - sh.len, sh.y - sh.len * 0.5);
      g.addColorStop(0, "rgba(255,255,255,0.9)"); g.addColorStop(1, "rgba(255,255,255,0)");
      ctx.strokeStyle = g; ctx.lineWidth = 2 * dpr;
      ctx.beginPath(); ctx.moveTo(sh.x, sh.y); ctx.lineTo(sh.x - sh.len, sh.y - sh.len * 0.5); ctx.stroke();
      if (sh.life > sh.max || sh.x > w) shooting.splice(j, 1);
    }
    requestAnimationFrame(draw);
  }
  resize();
  if (!reduceMotion) {
    addEventListener("resize", resize);
    draw();
    setInterval(function () { if (Math.random() < 0.45) spawn(); }, 4000);
  } else {
    for (var k = 0; k < stars.length; k++) {
      var st = stars[k]; ctx.globalAlpha = st.a; ctx.fillStyle = st.hue;
      ctx.fillRect(st.x, st.y, st.r, st.r);
    }
  }

  /* ---------- Taskbar clock ---------- */
  var clock = document.getElementById("clock");
  function tick() {
    var d = new Date(), hr = d.getHours(), m = d.getMinutes();
    var ap = hr >= 12 ? "PM" : "AM"; hr = hr % 12 || 12;
    clock.textContent = hr + ":" + (m < 10 ? "0" + m : m) + " " + ap;
  }
  tick(); setInterval(tick, 10000);

  /* ---------- Start menu ---------- */
  var startBtn = document.getElementById("startBtn");
  var startMenu = document.getElementById("startMenu");
  function setMenu(open) {
    startMenu.hidden = !open;
    startBtn.setAttribute("aria-expanded", open ? "true" : "false");
  }
  startBtn.addEventListener("click", function (e) {
    e.stopPropagation();
    setMenu(startMenu.hidden);
  });
  document.addEventListener("click", function (e) {
    if (!startMenu.hidden && !startMenu.contains(e.target)) setMenu(false);
  });
  startMenu.querySelectorAll("a").forEach(function (a) {
    a.addEventListener("click", function () { setMenu(false); });
  });
  document.addEventListener("keydown", function (e) { if (e.key === "Escape") setMenu(false); });

  /* ---------- Reveal windows ---------- */
  var reveals = document.querySelectorAll(".reveal");
  if ("IntersectionObserver" in window) {
    var io = new IntersectionObserver(function (en) {
      en.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); } });
    }, { threshold: 0.1 });
    reveals.forEach(function (el) { io.observe(el); });
  } else {
    reveals.forEach(function (el) { el.classList.add("in"); });
  }

  /* ---------- Scrollspy -> active taskbar item ---------- */
  var tabs = document.querySelectorAll(".tb");
  var sections = document.querySelectorAll("section[id]");
  if ("IntersectionObserver" in window) {
    var spy = new IntersectionObserver(function (en) {
      en.forEach(function (e) {
        if (e.isIntersecting) {
          var id = e.target.id;
          tabs.forEach(function (t) { t.classList.toggle("active", t.getAttribute("data-target") === id); });
        }
      });
    }, { rootMargin: "-40% 0px -55% 0px" });
    sections.forEach(function (s) { spy.observe(s); });
  }

  /* ---------- a11y: Space activates link-buttons (desktop icons) ---------- */
  document.querySelectorAll('a[role="button"]').forEach(function (a) {
    a.addEventListener("keydown", function (e) {
      if (e.key === " " || e.key === "Spacebar") { e.preventDefault(); a.click(); }
    });
  });

  /* ---------- a11y: focus management for app windows ----------
     Centralised here so the individual app scripts only toggle [hidden].
     On open, move focus into the window; on close, return it to whatever
     opened it (desktop icon / Start-menu item / taskbar button). */
  var lastTrigger = null;
  document.addEventListener("pointerdown", function (e) {
    var t = e.target.closest(".dsk, .startmenu__list a, .tb");
    if (t) lastTrigger = t;
  }, true);
  document.querySelectorAll(".appwin").forEach(function (win) {
    if (!win.hasAttribute("tabindex")) win.setAttribute("tabindex", "-1");
    new MutationObserver(function () {
      if (win.hidden) {
        if (document.activeElement === document.body || win.contains(document.activeElement)) {
          if (lastTrigger && document.contains(lastTrigger)) lastTrigger.focus();
        }
      } else {
        win.focus();
      }
    }).observe(win, { attributes: true, attributeFilter: ["hidden"] });
  });
})();
