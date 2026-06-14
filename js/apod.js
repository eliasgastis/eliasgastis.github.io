/* ============================================================
   Space95 — Today in Space (NASA APOD)
   A Win95 window that fetches NASA's Astronomy Picture of the Day
   and shows the image/video with its title, credit and blurb.
   Result is cached in localStorage (3 h) to spare the API.

   Uses NASA's DEMO_KEY (rate-limited). For a published site, grab
   a free key at https://api.nasa.gov and swap it in below.
   ============================================================ */
(function () {
  "use strict";

  var API_KEY = "DEMO_KEY";
  var ENDPOINT = "https://api.nasa.gov/planetary/apod?api_key=" + API_KEY;
  var CACHE_KEY = "space95_apod";
  var CACHE_TTL = 3 * 60 * 60 * 1000;     // 3 hours

  /* ---------- DOM ---------- */
  var app     = document.getElementById("apodApp");
  if (!app) return;
  var bar     = document.getElementById("apodBar");
  var tab     = document.getElementById("apodTab");
  var icon    = document.getElementById("apodIcon");
  var startLi = document.getElementById("startApod");
  var content = document.getElementById("apodContent");
  var dateEl  = document.getElementById("apodDate");
  var reload  = document.getElementById("apodReload");

  /* ============================================================
     Window management (open / close / minimize / maximize / drag)
     ============================================================ */
  var maxed = false, drag = null, loaded = false;

  function raise(el) {
    document.querySelectorAll(".appwin").forEach(function (w) { w.style.zIndex = (w === el) ? 91 : 90; });
  }
  function openApp() {
    app.hidden = false; tab.hidden = false; tab.classList.add("active"); raise(app);
    if (!loaded) load(false);
  }
  function closeApp()   { app.hidden = true; tab.hidden = true; tab.classList.remove("active"); }
  function minimizeApp(){ app.hidden = true; tab.classList.remove("active"); }
  function toggleFromTab() {
    if (app.hidden) { app.hidden = false; tab.classList.add("active"); raise(app); }
    else minimizeApp();
  }
  function toggleMax() {
    maxed = !maxed;
    app.classList.toggle("appwin--max", maxed);
    app.style.left = app.style.top = app.style.transform = "";
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
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && !app.hidden && !document.querySelector(".msgbox")) closeApp();
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

  if (reload) reload.addEventListener("click", function () { load(true); });

  /* ============================================================
     Fetch + render
     ============================================================ */
  function status(msg) { content.innerHTML = ""; var d = el("div", "apod__loading", msg); content.appendChild(d); }

  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }

  function readCache() {
    try {
      var raw = localStorage.getItem(CACHE_KEY);
      if (!raw) return null;
      var c = JSON.parse(raw);
      if (Date.now() - c.ts > CACHE_TTL) return null;
      return c.data;
    } catch (e) { return null; }
  }
  function writeCache(data) {
    try { localStorage.setItem(CACHE_KEY, JSON.stringify({ ts: Date.now(), data: data })); } catch (e) {}
  }

  function load(force) {
    if (!force) {
      var cached = readCache();
      if (cached) { render(cached); return; }
    }
    status("Contacting NASA…");
    fetch(ENDPOINT)
      .then(function (r) { if (!r.ok) throw new Error("HTTP " + r.status); return r.json(); })
      .then(function (data) { writeCache(data); render(data); })
      .catch(function (err) { showError(err); });
  }

  function showError() {
    content.innerHTML = "";
    var box = el("div", "apod__loading");
    box.appendChild(el("p", null, "⚠ Could not reach NASA right now."));
    var retry = el("button", "btn95", "↻ Try again");
    retry.type = "button";
    retry.style.marginTop = "14px";
    retry.addEventListener("click", function () { load(true); });
    box.appendChild(retry);
    content.appendChild(box);
  }

  function render(data) {
    loaded = true;
    content.innerHTML = "";
    dateEl.textContent = data.date || "—";

    var media = el("div", "apod__media");
    if (data.media_type === "video") {
      var frame = document.createElement("iframe");
      frame.src = data.url;
      frame.setAttribute("allowfullscreen", "");
      frame.setAttribute("title", data.title || "NASA video");
      frame.loading = "lazy";
      media.appendChild(frame);
    } else {
      var img = document.createElement("img");
      img.src = data.url;
      img.alt = data.title || "NASA Astronomy Picture of the Day";
      img.loading = "lazy";
      var link = document.createElement("a");
      link.href = data.hdurl || data.url;
      link.target = "_blank";
      link.rel = "noopener";
      link.title = "Open full resolution";
      link.appendChild(img);
      media.appendChild(link);
    }
    content.appendChild(media);

    content.appendChild(el("h3", "apod__title", data.title || "Astronomy Picture of the Day"));
    if (data.copyright) content.appendChild(el("p", "apod__credit", "© " + data.copyright.replace(/\s+/g, " ").trim()));
    content.appendChild(el("p", "apod__text", data.explanation || ""));

    var src = el("p", "apod__source");
    var a = document.createElement("a");
    a.href = "https://apod.nasa.gov/apod/astropix.html";
    a.target = "_blank"; a.rel = "noopener";
    a.textContent = "View on NASA APOD →";
    src.appendChild(a);
    content.appendChild(src);

    content.scrollTop = 0;
  }
})();
