/* ============================================================
   Space95 — galaxy3d.exe
   A Win95-windowed 3D spiral galaxy (Three.js + WebGL).

   Geometry follows the method in "Create 3-D Galactic Art with
   Matplotlib" (Towards Data Science):
     • 4-armed LOGARITHMIC spiral  r = a·e^(b·θ), each arm drawn as a
       leading + trailing edge, with positional "fuzz" ∝ radius;
     • a normally-distributed (Gaussian) spherical CORE, flattened in
       the vertical axis, in two density tiers;
     • a uniform √n disc HAZE (bright inner + faint light-grey outer).
   https://towardsdatascience.com/create-3-d-galactic-art-with-matplotlib-a7534148a319/

   MONOCHROME for now — every component is white/grey; colour (yellow
   bulge, blue star-forming arms, gas & dust) is layered on later.

   Rendering keeps the look from the first pass: soft additive glowing
   points, rigid rotation, UnrealBloom, OrbitControls. The scene is
   built lazily on first open and the loop pauses while hidden.
   ============================================================ */
import * as THREE from "three";
import { OrbitControls }    from "three/addons/controls/OrbitControls.js";
import { EffectComposer }   from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass }       from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass }  from "three/addons/postprocessing/UnrealBloomPass.js";
import { OutputPass }       from "three/addons/postprocessing/OutputPass.js";

/* ---------- DOM handles ---------- */
const app     = document.getElementById("galaxyApp");
const bar     = document.getElementById("galaxyBar");
const tab     = document.getElementById("galaxyTab");
const canvas  = document.getElementById("galaxyCanvas");
const loading = document.getElementById("galaxyLoading");
const icon    = document.getElementById("galaxyIcon");
const startLi = document.getElementById("startGalaxy");
const heroLnk = document.getElementById("heroGalaxy");
const rotBtn  = document.getElementById("galaxyRotate");
const resetBtn= document.getElementById("galaxyReset");

const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/* ============================================================
   1. Window management (open / close / minimize / maximize / drag)
   ============================================================ */
let maxed = false, drag = null;

function openApp() {
  app.hidden = false;
  tab.hidden = false;
  tab.classList.add("active");
  ensureInit();
  start();
}
function closeApp() {                 // the X — fully closes the app
  app.hidden = true;
  tab.hidden = true;
  tab.classList.remove("active");
  stop();
}
function minimizeApp() {              // collapse to the taskbar
  app.hidden = true;
  tab.classList.remove("active");
  stop();
}
function toggleFromTab() {            // taskbar button restores / minimizes
  if (app.hidden) { app.hidden = false; tab.classList.add("active"); start(); }
  else minimizeApp();
}
function toggleMax() {
  maxed = !maxed;
  app.classList.toggle("appwin--max", maxed);
  app.style.left = app.style.top = app.style.transform = "";   // back to CSS placement
  resize();
}

icon.addEventListener("click", (e) => { e.preventDefault(); openApp(); });
if (startLi) startLi.addEventListener("click", (e) => { e.preventDefault(); openApp(); });
if (heroLnk) heroLnk.addEventListener("click", (e) => { e.preventDefault(); openApp(); });
tab.addEventListener("click", toggleFromTab);

/* Deep-link: open straight from the URL hash (e.g. …/#galaxy) */
function openFromHash() { if (location.hash === "#galaxy") openApp(); }
window.addEventListener("hashchange", openFromHash);
openFromHash();
app.querySelectorAll(".appbtn").forEach((b) => {
  b.addEventListener("click", () => {
    const act = b.dataset.act;
    if (act === "close") closeApp();
    else if (act === "min") minimizeApp();
    else if (act === "max") toggleMax();
  });
});
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && !app.hidden) closeApp();
});

/* Drag the window by its title bar */
bar.addEventListener("pointerdown", (e) => {
  if (maxed || e.target.closest(".appbtn")) return;
  const r = app.getBoundingClientRect();
  drag = { dx: e.clientX - r.left, dy: e.clientY - r.top };
  app.style.transform = "none";
  app.style.left = r.left + "px";
  app.style.top  = r.top  + "px";
  bar.setPointerCapture(e.pointerId);
});
bar.addEventListener("pointermove", (e) => {
  if (!drag) return;
  const w = app.offsetWidth;
  let x = e.clientX - drag.dx, y = e.clientY - drag.dy;
  x = Math.max(120 - w, Math.min(window.innerWidth - 120, x));
  y = Math.max(0, Math.min(window.innerHeight - 60, y));
  app.style.left = x + "px";
  app.style.top  = y + "px";
});
bar.addEventListener("pointerup",     () => { drag = null; });
bar.addEventListener("pointercancel", () => { drag = null; });

/* ============================================================
   2. Three.js scene
   ============================================================ */
let renderer, scene, camera, controls, composer;
let galaxy, bgStars, core;
let inited = false, running = false, rafId = 0, autoRotate = true;
let simTime = 0;
const sizeMats = [];      // shader materials needing uScale on resize
const timeMats = [];      // shader materials needing uTime each frame

/* Galaxy parameters (article-style log-spiral) */
const G = {
  arms:     4,        // four-armed spiral
  b:       -0.30,     // logarithmic growth/pitch (−0.3…−0.5; tighter as it grows)
  scale:    13,       // outer disc radius (sim units)
  perEdge:  9000,     // stars per spiral edge  (×2 edges × arms)
  armScale: 3.2,      // arm radial density scale: peaks then declines outward
  diskH:    4.0,      // disc-haze exponential scale length (Σ ∝ e^(−r/diskH))
};

/* Rotation curve — arctan form  V(r) = Vflat·(2/π)·arctan(r/rt)  (Courteau
   1997, AJ 114, 2402): solid-body rise in the core, flat dark-matter-
   dominated outer curve. Drives each star's angular speed Ω(r)=V(r)/r.
   The 4-arm spiral is treated as a DENSITY WAVE — arm stars share one
   constant PATTERN speed Ω_p so the log-spiral shape is preserved, while
   disc / haze / core stars rotate DIFFERENTIALLY at the true Ω(r). */
const RC    = { vflat: 1.0, rt: 0.18 * G.scale };       // rt ≈ turnover radius
const SPEED = 0.5;                                       // visual time-scale (rad/s per unit Ω)
const vCirc = (r) => RC.vflat * (2 / Math.PI) * Math.atan(r / RC.rt);
const omega = (r) => (r > 1e-3 ? vCirc(r) / r : RC.vflat * (2 / Math.PI) / RC.rt);
const omegaP = omega(0.5 * G.scale);                     // arm pattern speed (corotation at 0.5 R)

/* Box–Muller standard normal, for the Gaussian core */
function gaussian() {
  let u = 0, v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

/* Soft radial sprite for the glowing nucleus */
function radialTexture() {
  const s = 128, cv = document.createElement("canvas");
  cv.width = cv.height = s;
  const g = cv.getContext("2d");
  const grd = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
  grd.addColorStop(0.0, "rgba(255,255,255,1)");
  grd.addColorStop(0.3, "rgba(255,255,255,0.55)");
  grd.addColorStop(0.6, "rgba(255,255,255,0.16)");
  grd.addColorStop(1.0, "rgba(255,255,255,0)");
  g.fillStyle = grd;
  g.fillRect(0, 0, s, s);
  return new THREE.CanvasTexture(cv);
}

/* Per-star point shader: round soft glow + perspective size attenuation */
const VERT = /* glsl */ `
  uniform float uSize, uScale, uTime;
  attribute float aSize, aOmega;
  attribute vec3 aColor;
  varying vec3 vColor;
  void main() {
    vColor = aColor;
    float ang = aOmega * uTime;                  // rotation about the galactic (y) axis
    float c = cos(ang), s = sin(ang);
    vec3 p = vec3(position.x * c - position.z * s, position.y, position.x * s + position.z * c);
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * mv;
    gl_PointSize = clamp(uSize * aSize * uScale / -mv.z, 0.8, 36.0);
  }
`;
const FRAG = /* glsl */ `
  varying vec3 vColor;
  void main() {
    float d = distance(gl_PointCoord, vec2(0.5));
    float a = pow(1.0 - smoothstep(0.0, 0.5, d), 1.5);
    if (a < 0.02) discard;
    gl_FragColor = vec4(vColor, a);
  }
`;
function starMaterial(uSize) {
  const m = new THREE.ShaderMaterial({
    uniforms: { uSize: { value: uSize }, uScale: { value: 600 }, uTime: { value: 0 } },
    vertexShader: VERT,
    fragmentShader: FRAG,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  sizeMats.push(m);
  timeMats.push(m);
  return m;
}
function points(pos, col, siz, omg, mat) {
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  g.setAttribute("aColor",   new THREE.BufferAttribute(col, 3));
  g.setAttribute("aSize",    new THREE.BufferAttribute(siz, 1));
  g.setAttribute("aOmega",   new THREE.BufferAttribute(omg, 1));
  return new THREE.Points(g, mat);
}

/* ---- Spiral arms: 4 thick, fuzzy logarithmic arms ----
   Each arm star samples a radius whose density peaks then DECLINES outward
   (∝ e^(−r/armScale)), takes the matching spiral angle θ = ln(r/scale)/b,
   then a wide Cartesian scatter that broadens with radius → THICK arms that
   thin and fade toward the edge.  Drawn in x–z; y is the thin disc height. */
function buildArms() {
  const edges = [
    { rotOff: 0.00, sizeMul: 1.20, bright: 1.00, widthMul: 1.0 },   // leading edge
    { rotOff: 0.12, sizeMul: 0.85, bright: 0.75, widthMul: 1.5 },   // trailing edge (broader, fainter)
  ];
  const n = G.arms * edges.length * G.perEdge;
  const pos = new Float32Array(n * 3), col = new Float32Array(n * 3), siz = new Float32Array(n), omg = new Float32Array(n);
  let k = 0;

  for (let a = 0; a < G.arms; a++) {
    const rotBase = a * (2 / G.arms);              // π·rot → arms evenly spaced
    for (const e of edges) {
      const rot = rotBase + e.rotOff;
      for (let i = 0; i < G.perEdge; i++) {
        let r; do { r = -G.armScale * Math.log(Math.random() * Math.random()); } while (r > G.scale * 1.1);
        const theta = Math.log(Math.max(r, 0.05) / G.scale) / G.b;     // spiral angle for this radius
        const phi   = theta - Math.PI * rot;
        const width = (0.7 + 0.075 * r) * e.widthMul;                  // THICK arm, widening outward
        const i3 = k * 3;
        pos[i3]     = Math.cos(phi) * r + (Math.random() * 2 - 1) * width;
        pos[i3 + 1] = (Math.random() * 2 - 1) * (0.15 + 0.35 * Math.exp(-r * 0.15));
        pos[i3 + 2] = Math.sin(phi) * r + (Math.random() * 2 - 1) * width;
        const fade  = 0.45 + 0.55 * Math.exp(-r / 9.0);                // fainter further out
        const v = Math.min(1, e.bright * (0.7 + Math.random() * 0.3) * fade);
        col[i3] = v; col[i3 + 1] = v; col[i3 + 2] = v;
        siz[k] = e.sizeMul * (0.7 + Math.random() * 0.6);
        omg[k] = omegaP * SPEED;                   // arms rotate as a rigid density-wave pattern
        k++;
      }
    }
  }
  return points(pos, col, siz, omg, starMaterial(0.10));
}

/* ---- Core/bulge: normally-distributed sphere, flattened in y, two tiers ---- */
function buildCore() {
  const tiers = [
    { n: 46000, sig: 2.55, v: 0.78 },   // big diffuse bulge
    { n: 17000, sig: 1.25, v: 1.00 },   // dense bright nucleus
  ];
  const n = tiers.reduce((s, t) => s + t.n, 0);
  const pos = new Float32Array(n * 3), col = new Float32Array(n * 3), siz = new Float32Array(n), omg = new Float32Array(n);
  let k = 0;
  for (const t of tiers) {
    for (let i = 0; i < t.n; i++) {
      const i3 = k * 3;
      const x = gaussian() * t.sig, z = gaussian() * t.sig;
      pos[i3]     = x;
      pos[i3 + 1] = gaussian() * t.sig * 0.12;     // vertical flattening (oblate)
      pos[i3 + 2] = z;
      const v = Math.min(1, t.v * (0.9 + Math.random() * 0.1));
      col[i3] = v; col[i3 + 1] = v; col[i3 + 2] = v;
      siz[k] = 0.8 + Math.random() * 0.6;
      omg[k] = omega(Math.hypot(x, z)) * SPEED;    // differential (≈ solid-body in the core)
      k++;
    }
  }
  return points(pos, col, siz, omg, starMaterial(0.11));
}

/* ---- Disc haze: ONE smooth exponential disc, Σ(r) ∝ e^(−r/diskH).
        Radius sampled as Gamma(2) = −diskH·ln(u₁·u₂), giving an exponential
        surface density — brightest at the centre, fading smoothly outward,
        with no inner/outer split and no flat equal-density outer ring. ---- */
function buildHaze() {
  const n = 30000, h = G.diskH;
  const pos = new Float32Array(n * 3), col = new Float32Array(n * 3), siz = new Float32Array(n), omg = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    let r; do { r = -h * Math.log(Math.random() * Math.random()); } while (r > G.scale * 1.25);
    const phi = Math.random() * Math.PI * 2;
    const i3 = i * 3;
    pos[i3]     = Math.cos(phi) * r;
    pos[i3 + 1] = (Math.random() * 2 - 1) * (0.18 + 0.30 * Math.exp(-r / h));   // thin, slight central puff
    pos[i3 + 2] = Math.sin(phi) * r;
    const v = 0.40 + Math.random() * 0.30;                                       // soft grey
    col[i3] = v; col[i3 + 1] = v; col[i3 + 2] = v;
    siz[i] = 0.5 + Math.random() * 0.5;
    omg[i] = omega(r) * SPEED;                                                    // differential rotation
  }
  return points(pos, col, siz, omg, starMaterial(0.085));
}

/* ---- Distant background stars (depth behind the galaxy) ---- */
function buildBackground() {
  const n = 10000;
  const pos = new Float32Array(n * 3), col = new Float32Array(n * 3), siz = new Float32Array(n), omg = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const i3 = i * 3;
    const r = 45 + Math.random() * 45, u = Math.random() * 2 - 1, phi = Math.random() * Math.PI * 2, s2 = Math.sqrt(1 - u * u);
    pos[i3] = r * s2 * Math.cos(phi); pos[i3 + 1] = r * u; pos[i3 + 2] = r * s2 * Math.sin(phi);
    const v = 0.5 + Math.random() * 0.5;
    col[i3] = v; col[i3 + 1] = v; col[i3 + 2] = v;
    siz[i] = 0.4 + Math.random() * 0.6;
  }
  bgStars = points(pos, col, siz, omg, starMaterial(0.06));   // ω=0; drifts via object rotation
  return bgStars;
}

function buildScene() {
  scene = new THREE.Scene();

  galaxy = new THREE.Group();
  galaxy.add(buildArms());
  galaxy.add(buildCore());
  galaxy.add(buildHaze());
  galaxy.rotation.x = 0.18;            // slight tilt for a 3/4 view
  scene.add(galaxy);

  // White glowing nucleus
  core = new THREE.Sprite(new THREE.SpriteMaterial({
    map: radialTexture(), color: 0xffffff, opacity: 0.85,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  }));
  core.scale.set(5.5, 5.5, 1);
  galaxy.add(core);

  scene.add(buildBackground());
}

function ensureInit() {
  if (inited) return;
  inited = true;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: "high-performance" });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setClearColor(0x04060f, 1);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.1;

    camera = new THREE.PerspectiveCamera(58, 1, 0.1, 1000);
    camera.position.set(0, 7, 16);

    controls = new OrbitControls(camera, canvas);
    controls.enableDamping = true;
    controls.dampingFactor = 0.06;
    controls.enablePan = false;
    controls.minDistance = 4.5;
    controls.maxDistance = 50;

    buildScene();

    composer = new EffectComposer(renderer);
    composer.addPass(new RenderPass(scene, camera));
    composer.addPass(new UnrealBloomPass(new THREE.Vector2(1, 1), 0.22, 0.4, 0.15));
    composer.addPass(new OutputPass());

    new ResizeObserver(resize).observe(app);
    if (loading) loading.hidden = true;
    resize();
  } catch (err) {
    inited = false;
    if (loading) {
      loading.hidden = false;
      loading.innerHTML =
        "⚠ Could not start the 3D galaxy.<br>" +
        "<span style='font-size:15px;opacity:.8'>This computer/browser may not support WebGL.</span>";
    }
    console.error("galaxy3d.exe:", err);
  }
}

function resize() {
  if (!renderer) return;
  const w = canvas.clientWidth, h = canvas.clientHeight;
  if (!w || !h) return;
  renderer.setSize(w, h, false);
  composer.setSize(w, h);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  const scale = renderer.domElement.height * 0.5;     // device-pixel height / 2
  for (const m of sizeMats) m.uniforms.uScale.value = scale;
}

let last = 0;
function frame(now) {
  rafId = requestAnimationFrame(frame);
  const dt = Math.min((now - last) / 1000 || 0, 0.05);
  last = now;
  if (autoRotate) {
    simTime += dt;                                    // shader rotates each star at its own Ω(r)
    bgStars.rotation.y += dt * 0.005;                 // distant stars: independent slow drift
  }
  for (const m of timeMats) m.uniforms.uTime.value = simTime;
  controls.update();
  if (canvas.clientWidth && canvas.clientHeight) composer.render();
}

function start() {
  if (!inited || running) return;
  running = true;
  last = performance.now();
  requestAnimationFrame(() => resize());
  rafId = requestAnimationFrame(frame);
}
function stop() {
  running = false;
  if (rafId) cancelAnimationFrame(rafId);
  rafId = 0;
}

/* ---------- Toolbar controls ---------- */
if (rotBtn) rotBtn.addEventListener("click", () => {
  autoRotate = !autoRotate;
  rotBtn.textContent = "⟳ Rotation: " + (autoRotate ? "On" : "Off");
});
if (resetBtn) resetBtn.addEventListener("click", () => {
  if (!camera) return;
  camera.position.set(0, 7, 16);
  controls.target.set(0, 0, 0);
  controls.update();
});

window.addEventListener("resize", resize);
if (reduceMotion) autoRotate = false;
