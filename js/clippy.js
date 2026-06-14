/* ============================================================
   Space95 — Clippy
   The traditional Office Assistant paperclip, rendered as inline
   SVG. Pops a Win95 speech bubble with rotating, on-brand tips.
   Dismissable; can be re-summoned from the Start menu.
   ============================================================ */
(function () {
  "use strict";

  var root   = document.getElementById("clippy");
  if (!root) return;
  var bubble = document.getElementById("clippyBubble");
  var textEl = document.getElementById("clippyText");
  var charEl = document.getElementById("clippyChar");
  var nextBtn= document.getElementById("clippyNext");
  var byeBtn = document.getElementById("clippyBye");
  var closeBtn = document.getElementById("clippyClose");
  var startLi  = document.getElementById("startClippy");

  var INTRO = "Hi! I'm Clippy. It looks like you're visiting an astronomer's " +
              "website. Would you like some help getting around?";
  var TIPS = [
    "It looks like you're trying to learn about molecular gas. The Research window has you covered — just scroll down.",
    "Psst… there's a real 3-D galaxy hiding in your Start menu. Go on, give it a spin.",
    "I'd steer clear of the Recycle Bin if I were you. There's a file in there you're absolutely not supposed to open.",
    "It looks like you're writing a thesis. Would you like me to name it FINAL_v12 and misplace the real one?",
    "Fun fact: the wallpaper is a genuine JWST deep field. Almost every speck is an entire galaxy.",
    "Bored? There's a game of Asteroids on the desktop. Strictly for research, of course.",
    "It looks like you're hiring. What a coincidence — Elias is looking!",
    "Stand still long enough and the stars come out. (Try not touching anything for a minute.)"
  ];

  var idx = -1;          // -1 = intro not shown yet
  var SS_KEY = "space95_clippy_gone";

  function showBubble(msg) {
    textEl.textContent = msg;
    bubble.hidden = false;
  }
  function hideBubble() { bubble.hidden = true; }

  function summon(intro) {
    try { sessionStorage.removeItem(SS_KEY); } catch (e) {}
    root.hidden = false;
    if (intro) { idx = -1; showBubble(INTRO); }
    else nextTip();
  }
  function dismiss() {
    root.hidden = true;
    try { sessionStorage.setItem(SS_KEY, "1"); } catch (e) {}
  }
  function nextTip() {
    idx = (idx + 1) % TIPS.length;
    showBubble(TIPS[idx]);
  }

  /* Clicking Clippy himself: open the bubble, or advance to the next tip */
  charEl.addEventListener("click", function () {
    if (bubble.hidden) { if (idx < 0) showBubble(INTRO); else showBubble(TIPS[idx]); }
    else nextTip();
  });
  nextBtn.addEventListener("click", nextTip);
  byeBtn.addEventListener("click", dismiss);
  closeBtn.addEventListener("click", hideBubble);
  if (startLi) startLi.addEventListener("click", function (e) { e.preventDefault(); summon(true); });

  /* First appearance: a short beat after load, unless dismissed this session */
  var gone = false;
  try { gone = sessionStorage.getItem(SS_KEY) === "1"; } catch (e) {}
  if (!gone) {
    setTimeout(function () { root.hidden = false; idx = -1; showBubble(INTRO); }, 2600);
  }
})();
