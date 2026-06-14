/* ============================================================
   Space95 — Recycle Bin
   A draggable Win95 explorer window full of "deleted" files:
   four downloadable joke PDFs (old/rejected drafts) plus a few
   easter-egg files that pop witty message boxes.

   Self-contained plain script. Reuses the .appwin / .appbtn /
   .file95 / .btn95 styles and mirrors galaxy3d.exe's window
   management (open / close / minimize / maximize / drag / tab).
   ============================================================ */
(function () {
  "use strict";

  /* ---------- DOM handles ---------- */
  var app     = document.getElementById("binApp");
  if (!app) return;
  var bar     = document.getElementById("binBar");
  var tab     = document.getElementById("binTab");
  var icon    = document.getElementById("binIcon");
  var startLi = document.getElementById("startBin");

  /* ============================================================
     1. Window stacking — clicking any app window raises it.
        Both windows stay below the modal layer (msgbox = 200).
     ============================================================ */
  function raise(el) {
    document.querySelectorAll(".appwin").forEach(function (w) {
      w.style.zIndex = (w === el) ? 91 : 90;
    });
  }
  document.querySelectorAll(".appwin").forEach(function (w) {
    w.addEventListener("pointerdown", function () { raise(w); });
  });

  /* ============================================================
     2. Window management (open / close / minimize / maximize / drag)
     ============================================================ */
  var maxed = false, drag = null;

  function openApp() {
    app.hidden = false;
    tab.hidden = false;
    tab.classList.add("active");
    raise(app);
  }
  function closeApp() {
    app.hidden = true;
    tab.hidden = true;
    tab.classList.remove("active");
  }
  function minimizeApp() {
    app.hidden = true;
    tab.classList.remove("active");
  }
  function toggleFromTab() {
    if (app.hidden) { app.hidden = false; tab.classList.add("active"); raise(app); }
    else minimizeApp();
  }
  function toggleMax() {
    maxed = !maxed;
    app.classList.toggle("appwin--max", maxed);
    app.style.left = app.style.top = app.style.transform = "";   // back to CSS placement
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
    if (e.key !== "Escape") return;
    if (document.querySelector(".msgbox")) return;   // an open dialog handles its own Escape
    if (!app.hidden) closeApp();
  });

  /* Drag the window by its title bar (mirrors galaxy3d.exe) */
  bar.addEventListener("pointerdown", function (e) {
    if (maxed || e.target.closest(".appbtn")) return;
    var r = app.getBoundingClientRect();
    drag = { dx: e.clientX - r.left, dy: e.clientY - r.top };
    app.style.transform = "none";
    app.style.left = r.left + "px";
    app.style.top  = r.top  + "px";
    bar.setPointerCapture(e.pointerId);
  });
  bar.addEventListener("pointermove", function (e) {
    if (!drag) return;
    var w = app.offsetWidth;
    var x = e.clientX - drag.dx, y = e.clientY - drag.dy;
    x = Math.max(120 - w, Math.min(window.innerWidth - 120, x));
    y = Math.max(0, Math.min(window.innerHeight - 60, y));
    app.style.left = x + "px";
    app.style.top  = y + "px";
  });
  bar.addEventListener("pointerup",     function () { drag = null; });
  bar.addEventListener("pointercancel", function () { drag = null; });

  /* ============================================================
     3. Win95 message box (modal) — showDialog(opts)
        opts: { title, icon, body (HTML), buttons:[{label,primary,onClick}] }
        An onClick that returns true keeps the box open; otherwise it closes.
     ============================================================ */
  function showDialog(opts) {
    var buttons = (opts.buttons && opts.buttons.length) ? opts.buttons : [{ label: "OK" }];

    var overlay = document.createElement("div");
    overlay.className = "msgbox";

    var win = document.createElement("div");
    win.className = "msgbox__win";
    win.setAttribute("role", "dialog");
    win.setAttribute("aria-modal", "true");

    var barEl = document.createElement("div");
    barEl.className = "msgbox__bar";
    var titleEl = document.createElement("span");
    titleEl.textContent = opts.title || "Message";
    var xBtn = document.createElement("button");
    xBtn.className = "appbtn x";
    xBtn.type = "button";
    xBtn.setAttribute("aria-label", "Close");
    xBtn.textContent = "✕";
    barEl.appendChild(titleEl);
    barEl.appendChild(xBtn);

    var bodyEl = document.createElement("div");
    bodyEl.className = "msgbox__body";
    var iconEl = document.createElement("div");
    iconEl.className = "msgbox__icon";
    iconEl.setAttribute("aria-hidden", "true");
    iconEl.textContent = opts.icon || "ℹ️";
    var textEl = document.createElement("div");
    textEl.className = "msgbox__text";
    textEl.innerHTML = opts.body || "";
    bodyEl.appendChild(iconEl);
    bodyEl.appendChild(textEl);

    var btnRow = document.createElement("div");
    btnRow.className = "msgbox__btns";

    function close() {
      overlay.remove();
      document.removeEventListener("keydown", onKey);
    }
    function onKey(e) {
      if (e.key === "Escape") { e.stopPropagation(); close(); }
    }

    var primaryBtn = null, firstBtn = null;
    buttons.forEach(function (b, i) {
      var btn = document.createElement("button");
      btn.className = "btn95";
      btn.type = "button";
      btn.textContent = b.label;
      btn.addEventListener("click", function () {
        var keepOpen = false;
        if (typeof b.onClick === "function") keepOpen = (b.onClick() === true);
        if (!keepOpen) close();
      });
      if (i === 0) firstBtn = btn;
      if (b.primary) primaryBtn = btn;
      btnRow.appendChild(btn);
    });

    xBtn.addEventListener("click", close);

    win.appendChild(barEl);
    win.appendChild(bodyEl);
    win.appendChild(btnRow);
    overlay.appendChild(win);
    document.body.appendChild(overlay);
    document.addEventListener("keydown", onKey);
    (primaryBtn || firstBtn).focus();
    return close;
  }

  /* ============================================================
     4. Easter-egg files — clicking opens a witty dialog
     ============================================================ */
  var EGGS = {
    donotopen: function () {
      showDialog({
        title: "Warning",
        icon: "⚠️",
        body: "<p>This file is literally named <b>DO_NOT_OPEN.txt</b>.</p>" +
              "<p>You are about to open it anyway. A bold scientific choice.</p>",
        buttons: [
          { label: "Open anyway", primary: true, onClick: function () {
              showDialog({
                title: "DO_NOT_OPEN.txt — Notepad",
                icon: "📄",
                body: "<p>Congratulations — you've discovered absolutely nothing.</p>" +
                      "<p>This file contains only my hopes, dreams, and an alarming number of " +
                      "<i>unsaved Jupyter notebooks</i>.</p>" +
                      "<p>You'd think an astronomer would know better than to leave things uncommitted.</p>"
              });
            } },
          { label: "Respect the boundary" }
        ]
      });
    },
    passwords: function () {
      showDialog({
        title: "Access Denied",
        icon: "🔒",
        body: "<p>Nice try.</p>" +
              "<p>The password is obviously <code>hunter2</code> — though all you'll ever see is <code>*******</code>.</p>"
      });
    },
    grant: function () {
      showDialog({
        title: "grant_funding.xls",
        icon: "📊",
        body: "<p><b>Error:</b> this file is empty.</p><p>So, coincidentally, is the account.</p>"
      });
    },
    motivation: function () {
      showDialog({
        title: "System Error",
        icon: "❌",
        body: "<p>A required component <code>motivation.dll</code> is missing or corrupt.</p>" +
              "<p>Please reinstall <b>coffee</b> and try again.</p>"
      });
    }
  };

  app.querySelectorAll("[data-egg]").forEach(function (el) {
    el.addEventListener("click", function () {
      var fn = EGGS[el.dataset.egg];
      if (fn) fn();
    });
  });

  /* ============================================================
     5. Toolbar gags — "Empty Recycle Bin" / "Restore"
     ============================================================ */
  var emptyBtn   = document.getElementById("binEmpty");
  var restoreBtn = document.getElementById("binRestore");

  if (emptyBtn) emptyBtn.addEventListener("click", function () {
    showDialog({
      title: "Confirm File Delete",
      icon: "⚠️",
      body: "<p>Permanently delete all 8 items?</p>" +
            "<p>These rejected drafts are, frankly, all I have left.</p>",
      buttons: [
        { label: "Yes", onClick: function () {
            showDialog({
              title: "Recycle Bin",
              icon: "🗑️",
              body: "<p>…</p><p>Just kidding. I could never. They're staying exactly where they are.</p>"
            });
          } },
        { label: "No", primary: true }
      ]
    });
  });

  if (restoreBtn) restoreBtn.addEventListener("click", function () {
    showDialog({
      title: "Restore",
      icon: "ℹ️",
      body: "<p>Restore these files to <i>where</i>, exactly?</p>" +
            "<p>They were deleted for very good reasons.</p>"
    });
  });
})();
