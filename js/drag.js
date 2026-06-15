/* ============================================================
   Space95 — pick up the in-page content windows (.win) by their
   title bar and fling them around. Let go and each one springs
   back to where it lives in the page layout, with a little bounce.

   These windows sit in normal document flow, so we drag them with
   a temporary `transform` offset (which never disturbs layout) and
   animate that offset back to none on release. Purely a toy — the
   feature is all motion, so it stays off for prefers-reduced-motion
   users (whose reveal rule also pins transform to none anyway).
   ============================================================ */
(function () {
  "use strict";

  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  /* Springy return: a cubic-bezier that overshoots past 1 = the "boing". */
  var SPRING = "transform .6s cubic-bezier(.34,1.56,.64,1)";

  /* Flips on the grab cursor (see styles.css). Mirrors the js-reveal pattern
     so no-JS / reduced-motion visitors never see a draggable affordance. */
  document.documentElement.classList.add("drag-windows");

  document.querySelectorAll(".win > .win__bar").forEach(function (bar) {
    var win = bar.parentElement;
    var drag = null; /* { x, y, moved } while held, else null */

    bar.addEventListener("pointerdown", function (e) {
      if (e.pointerType === "mouse" && e.button !== 0) return; /* left button only */
      if (e.target.closest(".win__btns")) return;             /* let the _ □ ✕ be buttons */

      drag = { x: e.clientX, y: e.clientY, moved: false };
      win.style.transition = "none";       /* follow the pointer 1:1 */
      win.style.willChange = "transform";
      win.style.zIndex = "50";             /* lift above sibling windows */
      win.classList.add("win--dragging");
      bar.setPointerCapture(e.pointerId);
      e.preventDefault();
    });

    bar.addEventListener("pointermove", function (e) {
      if (!drag) return;
      drag.moved = true;
      var dx = e.clientX - drag.x;
      var dy = e.clientY - drag.y;
      /* A small tilt toward the drag direction = "lifted off the desktop" feel. */
      var tilt = Math.max(-5, Math.min(5, dx * 0.035));
      win.style.transform =
        "translate(" + dx + "px," + dy + "px) rotate(" + tilt + "deg)";
    });

    function release(e) {
      if (!drag) return;
      var moved = drag.moved;
      drag = null;
      win.classList.remove("win--dragging");
      win.style.willChange = "";
      try { bar.releasePointerCapture(e.pointerId); } catch (_) {}

      if (!moved) {                         /* a plain click — nothing to spring */
        win.style.transition = "";
        win.style.transform = "";
        win.style.zIndex = "";
        return;
      }
      win.style.transition = SPRING;
      win.style.transform = "";             /* animate the offset back to none = home */
    }

    bar.addEventListener("pointerup", release);
    bar.addEventListener("pointercancel", release);

    /* Once the spring settles (and we're not holding it again), drop the
       inline transition + raised z-index so the window is back to its CSS
       baseline. One listener, so nothing accumulates on rapid grabs. */
    win.addEventListener("transitionend", function (ev) {
      if (ev.propertyName !== "transform" || drag) return;
      win.style.transition = "";
      win.style.zIndex = "";
    });
  });
})();
