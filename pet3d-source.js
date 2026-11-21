/* Pip Pals 3D pet renderer (Three.js, MIT). Original procedural models — no external assets.
   API on window.Pet3D: init(container) -> bool, build(p), setMood(mood, look), play(name), ok */
import {
  WebGLRenderer, Scene, PerspectiveCamera, HemisphereLight, DirectionalLight, AmbientLight, Group, Mesh,
  SphereGeometry, CapsuleGeometry, ConeGeometry, CylinderGeometry, TorusGeometry, BoxGeometry, LatheGeometry,
  TubeGeometry, ExtrudeGeometry, CircleGeometry, OctahedronGeometry, Shape, CatmullRomCurve3, Vector2, Vector3,
  MeshToonMaterial, MeshBasicMaterial, DataTexture, RedFormat, NearestFilter, BackSide, Color, CanvasTexture,
  SRGBColorSpace, MathUtils, Euler, Box3, Sphere
} from 'three';

const PAL = {
  mochi: { base: '#ff9ec7', dark: '#c84b84', belly: '#fff2f8', inner: '#ffc4df', eggc: '#ffe3f0', spot: '#ff6eb0' },
  bloop: { base: '#6cc4ff', dark: '#2573bd', belly: '#ebfbff', inner: '#b3e5ff', eggc: '#daf3ff', spot: '#3ca8f5' },
  sunny: { base: '#ffd447', dark: '#c78200', belly: '#fffbe3', inner: '#ffe585', eggc: '#fff5c7', spot: '#ffae19' },
  puff:  { base: '#b994ff', dark: '#6f41c7', belly: '#f8f3ff', inner: '#dfd0ff', eggc: '#efe7ff', spot: '#9669f2' },
  glitter: { base: '#81C8F0', dark: '#405789', belly: '#F3F2FF', inner: '#F7B7D8', eggc: '#cfd6ff', spot: '#FFE282', glow: '#FFE282' },
  pony:    { base: '#F8E5F0', dark: '#766487', belly: '#FFF9F1', inner: '#B594DD', eggc: '#ffd3e6', spot: '#FFD76E', glow: '#FFD76E' },
  pup:     { base: '#F2F0F9', dark: '#334273', belly: '#FFF9EF', inner: '#6A7AD0', eggc: '#3d4f9a', spot: '#c9b8ff', glow: '#FFD471' },
  kitty:   { base: '#D4BCEB', dark: '#5F527F', belly: '#FFF7F4', inner: '#9279D7', eggc: '#e3d2f7', spot: '#ffd9b8', glow: '#FFE3A0' },
  phoenix: { base: '#FFD979', dark: '#955B70', belly: '#FFF2DA', inner: '#FF9EAC', eggc: '#ffd0b0', spot: '#ffe14d', glow: '#FFE877' },
  otter:   { base: '#88D6E9', dark: '#347497', belly: '#EEFFF6', inner: '#AEADE6', eggc: '#9fe6ee', spot: '#ffc7d8', glow: '#FFE8B3' },
  turtle:  { base: '#9FD98A', dark: '#4C7350', belly: '#F6E5AE', inner: '#F5A1BD', eggc: '#d4f0c0', spot: '#7cc36a', glow: '#F4DC78' },
  fox:     { base: '#E9D3F5', dark: '#66558B', belly: '#FFF8FF', inner: '#8ED7EC', eggc: '#e6d0f7', spot: '#8ED7EC', glow: '#F2B6F5' }
};
const NEWSP = new Set(['glitter', 'pony', 'pup', 'kitty', 'phoenix', 'otter', 'turtle', 'fox']);
const SIZE = { baby: [0.62, 0.55], kid: [0.78, 0.71], teen: [0.84, 0.9], adult: [0.97, 1.0] };
const CAM = { egg: [5.3, 1.12], baby: [3.9, 0.72], kid: [4.5, 0.95], teen: [5.0, 1.18], adult: [5.6, 1.35] };
const INK = '#3a2230';

let renderer, scene, camera, root, pet, face, parts = {}, container, ok = false;
let cur = null, mood = 'normal', look = 0, structKey = '';
let action = null, actT = 0, blinkAt = 0, blinkT = -1, yaw = 0, lastFrame = 0, visible = true, sparkles = [];
let gradientMap;

function toonGradient() {
  const d = new Uint8Array([120, 165, 205, 238, 255]);
  const t = new DataTexture(d, 5, 1, RedFormat);
  t.minFilter = t.magFilter = NearestFilter; t.needsUpdate = true; return t;
}
const matCache = new Map();
function toon(color, opts = {}) {
  const k = color + JSON.stringify(opts);
  if (!matCache.has(k)) { const m = new MeshToonMaterial({ color: new Color(color), gradientMap, ...opts });
    m.onBeforeCompile = sh => { sh.fragmentShader = sh.fragmentShader.replace('#include <dithering_fragment>',
      `#include <dithering_fragment>
      float rimF = 1.0 - clamp(dot(normalize(vNormal), normalize(vViewPosition)), 0.0, 1.0);
      gl_FragColor.rgb += vec3(1.0, 0.96, 1.0) * smoothstep(0.62, 1.0, rimF) * 0.28;`); };
    matCache.set(k, m); }
  return matCache.get(k);
}
const flat = (color, opts = {}) => new MeshBasicMaterial({ color: new Color(color), ...opts });
const outlineMat = (c) => new MeshBasicMaterial({ color: new Color(c), side: BackSide });

/* a mesh + optional ink outline (inverted hull) */
function part(geo, color, { outline = true, ol = 0.035, oc = null, mat = null } = {}) {
  const g = new Group();
  const m = new Mesh(geo, mat || toon(color)); g.add(m);
  if (outline) {
    const o = new Mesh(geo, outlineMat(oc || INK));
    geo.computeBoundingSphere();
    const r = geo.boundingSphere.radius || 1;
    o.scale.setScalar(1 + ol / Math.max(r, 0.05)); o.renderOrder = -1; g.add(o);
  }
  g.userData.mesh = m; return g;
}
const sph = (r = 1, w = 28, h = 20) => new SphereGeometry(r, w, h);

/* ---------- init ---------- */
function init(el) {
  if (renderer) { if (renderer.domElement.parentNode !== el) el.appendChild(renderer.domElement); container = el; resize(); return ok; }
  try {
    const c = document.createElement('canvas');
    const gl = c.getContext('webgl2', { alpha: true, antialias: true }) || c.getContext('webgl', { alpha: true, antialias: true });
    if (!gl) return false;
    renderer = new WebGLRenderer({ canvas: c, context: gl, alpha: true, antialias: true, powerPreference: 'low-power' });
  } catch (e) { return false; }
  container = el;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.outputColorSpace = SRGBColorSpace;
  renderer.domElement.style.cssText = 'width:100%;height:100%;display:block;touch-action:none';
  el.appendChild(renderer.domElement);
  setupScene();
  ok = true;
  new ResizeObserver(resize).observe(el);
  document.addEventListener('visibilitychange', () => { visible = !document.hidden; });
  resize();
  renderer.setAnimationLoop(loop);
  return true;
}
function setupScene() {
  if (scene) return;
  gradientMap = toonGradient();
  scene = new Scene();
  camera = new PerspectiveCamera(30, 1, 0.1, 50);
  scene.add(new HemisphereLight(0xfffaf5, 0xf3c9e0, 1.15));
  scene.add(new AmbientLight(0xffffff, 0.3));
  const sun = new DirectionalLight(0xfff4e8, 1.75); sun.position.set(-3, 5.5, 6); scene.add(sun);
  const fill = new DirectionalLight(0xdfe8ff, 0.45); fill.position.set(4, 2, 3); scene.add(fill);
  const back = new DirectionalLight(0xffffff, 0.9); back.position.set(0, 4, -6); scene.add(back);
  root = new Group(); scene.add(root);
  // soft ground shadow
  const cv = document.createElement('canvas'); cv.width = cv.height = 64;
  const x = cv.getContext('2d'), gr = x.createRadialGradient(32, 32, 2, 32, 32, 32);
  gr.addColorStop(0, 'rgba(60,20,50,.32)'); gr.addColorStop(1, 'rgba(60,20,50,0)'); x.fillStyle = gr; x.fillRect(0, 0, 64, 64);
  const shadow = new Mesh(new CircleGeometry(1, 32), new MeshBasicMaterial({ map: new CanvasTexture(cv), transparent: true, depthWrite: false }));
  shadow.rotation.x = -Math.PI / 2; shadow.position.y = 0.005; parts.shadow = shadow; scene.add(shadow);
}
function resize() {
  if (!renderer || !container) return;
  const w = container.clientWidth || 200, h = container.clientHeight || 200;
  renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix();
}

/* ---------- geometry helpers on the body ellipsoid ---------- */
let A = 1, B = 1, C = 1, CY = 1, CZ = 0, MOUTH_OUT = 0.004; // face-surface radii + centre
function surf(x, y, out = 0) { // point on front surface + normal
  const dx = x / A, dy = (y - CY) / B; const k = Math.max(0, 1 - dx * dx - dy * dy);
  const z = C * Math.sqrt(k);
  const n = new Vector3(x / (A * A), (y - CY) / (B * B), z / (C * C)).normalize();
  return { p: new Vector3(x, y, z + CZ).addScaledVector(n, out), n };
}
function onSurface(obj, x, y, out = 0) { const s = surf(x, y, out); obj.position.copy(s.p); obj.lookAt(s.p.clone().add(s.n)); return obj; }

/* ---------- egg ---------- */
function buildEgg(sp, crack) {
  const c = PAL[sp]; const g = new Group();
  const pts = []; for (let i = 0; i <= 24; i++) { const th = (i / 24) * Math.PI; const r = 0.88 * Math.sin(th) * (1 + 0.13 * Math.cos(th)); pts.push(new Vector2(Math.max(r, 0.0001), 1.15 - Math.cos(th) * 1.15)); }
  const geo = new LatheGeometry(pts, 40);
  const shell = part(geo, c.eggc, { ol: 0.04 }); g.add(shell);
  const eggR = (y) => { const th = Math.acos(MathUtils.clamp(1 - y / 1.15, -1, 1)); return 0.88 * Math.sin(th) * (1 + 0.13 * Math.cos(th)); };
  const spots = [[-0.45, 1.3, 0.15], [0.35, 0.8, 0.2], [-0.2, 0.45, 0.12], [0.3, 1.65, 0.1], [-0.6, 0.85, 0.11], [0.05, 1.95, 0.08]];
  for (const [ang, y, r] of spots) { const R = eggR(y); const s = new Mesh(sph(1, 16, 12), toon(c.spot)); s.scale.set(r, r, r * 0.35); s.position.set(Math.sin(ang) * R, y, Math.cos(ang) * R); s.lookAt(s.position.clone().multiplyScalar(2).setY(y)); g.add(s); }
  const cracks = [
    [[-0.5, 1.25], [-0.32, 1.1], [-0.15, 1.28], [0.05, 1.1], [0.22, 1.27]],
    [[0.25, 1.62], [0.4, 1.45], [0.27, 1.32], [0.48, 1.18]],
    [[-0.35, 0.7], [-0.15, 0.82], [0.02, 0.66], [0.2, 0.8], [0.4, 0.68]]];
  if (NEWSP.has(sp)) { const em = part(new OctahedronGeometry(0.16), c.glow || c.spot, { ol: 0.015 }); em.position.set(0, 1.15, eggR(1.15) + 0.03); em.scale.set(1, 1, 0.35); g.add(em); }
  for (let i = 0; i < Math.min(crack, 3); i++) {
    const v = cracks[i].map(([ang, y]) => { const R = eggR(y) + 0.015; return new Vector3(Math.sin(ang) * R, y, Math.cos(ang) * R); });
    g.add(new Mesh(new TubeGeometry(new CatmullRomCurve3(v, false, 'catmullrom', 0.01), 30, 0.028, 6), flat('#5a3a2a')));
  }
  return g;
}

/* ---------- pet ---------- */
function buildPet(p) {
  if (NEWSP.has(p.species)) return buildCreature(p);
  CZ = 0; MOUTH_OUT = 0.004;
  const c = PAL[p.species] || PAL.mochi, st = p.stage, v = p.variant, adult = st === 'adult';
  let [a, b] = SIZE[st] || SIZE.kid; if (adult && v === 'bouncy') { a = 1.07; b = 0.92; }
  A = a; B = b; C = a * 0.9; CY = b + 0.02;
  const s = a; const top = CY + B; const g = new Group(); const lim = st !== 'baby', arms = st === 'teen' || adult;
  parts = { shadow: parts.shadow };
  // body
  const body = part(sph(1, 40, 30), c.base, { ol: 0.04 }); body.scale.set(A, B, C); body.position.y = CY; g.add(body); parts.body = body;
  const hl = new Mesh(sph(1, 16, 12), new MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.45 }));
  onSurface(hl, -0.42 * A, CY + 0.55 * B, 0.005); hl.scale.set(0.16 * s, 0.09 * s, 0.02); hl.rotateZ(0.5); g.add(hl);
  if (lim) {
    if (p.species === 'puff') { for (const [x, y, r] of [[-0.22, -0.35, 0.3], [0.22, -0.35, 0.3], [0, -0.22, 0.34], [0, -0.52, 0.3]]) { const m = new Mesh(sph(1, 20, 14), toon(c.belly)); const sp = surf(x * A, CY + y * B, -0.12 * s); m.position.copy(sp.p); m.scale.set(r * s, r * s * 0.9, r * s * 0.55); g.add(m); } }
    else { const belly = new Mesh(sph(1, 28, 20), toon(c.belly)); belly.scale.set(0.6 * A, 0.5 * B, 0.42 * C); belly.position.set(0, CY - 0.32 * B, 0.56 * C); g.add(belly); }
  }
  // feet
  if (lim) for (const d of [-1, 1]) { const f = part(sph(1, 18, 12), p.species === 'sunny' ? '#ff9f1c' : c.dark, { ol: 0.02 }); f.scale.set(0.2 * s, 0.1 * s, 0.26 * s); f.position.set(d * 0.42 * A, 0.07, 0.42 * C); g.add(f); }
  // arms
  if (arms) for (const d of [-1, 1]) { const ar = part(sph(1, 18, 12), c.base, { ol: 0.025 }); ar.scale.set(0.13 * s, 0.22 * s, 0.14 * s); ar.position.set(d * 0.94 * A, CY - 0.1 * B, 0.15 * C); ar.rotation.z = d * 0.45; g.add(ar); parts['arm' + d] = ar; }
  // species features
  const stg = { baby: 0, kid: 1, teen: 2, adult: 3 }[st];
  if (p.species === 'mochi') {
    const L = [0.16, 0.36, 0.5, 0.58][stg] * 1.0, droop = v === 'cozy' ? 0.75 : 0.18;
    for (const d of [-1, 1]) {
      const ear = new Group(); ear.position.set(d * 0.36 * A, top - 0.12 * s, -0.05); ear.rotation.z = -d * droop;
      const e = part(new CapsuleGeometry(0.12 * s, L, 6, 16), c.base, { ol: 0.025 }); e.scale.z = 0.6; e.position.y = L / 2 + 0.06; ear.add(e);
      const inn = new Mesh(new CapsuleGeometry(0.065 * s, L * 0.8, 6, 12), toon(c.inner)); inn.scale.z = 0.4; inn.position.set(0, L / 2 + 0.06, 0.055 * s); ear.add(inn);
      g.add(ear); parts['ear' + d] = ear;
    }
  } else if (p.species === 'bloop') {
    const h = [0.22, 0.34, 0.44, 0.52][stg];
    const crest = part(new ConeGeometry(0.15 * s + 0.03, h, 20), c.base, { ol: 0.025 }); crest.position.set(0, top + h / 2 - 0.08, -0.04); crest.rotation.x = -0.28; g.add(crest); parts.crest = crest;
    if (lim) for (const d of [-1, 1]) { const f = part(sph(1, 18, 12), c.inner, { ol: 0.02 }); f.scale.set(0.24 * s, 0.12 * s, 0.07); f.position.set(d * (A + 0.06), CY, 0.05); f.rotation.z = d * 0.5; g.add(f); parts['fin' + d] = f; }
    if (stg >= 2) { const t = part(new ConeGeometry(0.2 * s, 0.4 * s, 16), c.inner, { ol: 0.02 }); t.position.set(0.15, CY - 0.4 * B, -C - 0.05); t.rotation.set(-1.9, 0, 0.4); t.scale.z = 0.35; g.add(t); }
  } else if (p.species === 'sunny') {
    const L = [0.12, 0.17, 0.22, 0.26][stg];
    [-0.5, 0, 0.5].forEach((r, i) => { const f = part(sph(1, 14, 10), c.spot, { ol: 0.02 }); f.scale.set(0.06 * s + 0.02, L, 0.05); f.position.set(Math.sin(r) * L * 0.9, top + L * 0.75 - 0.04, -0.02); f.rotation.z = -r; g.add(f); if (i === 1) parts.tuft = f; });
    if (lim) for (const d of [-1, 1]) { const w = part(sph(1, 18, 12), c.spot, { ol: 0.025 }); w.scale.set(0.13 * s, 0.27 * s, 0.17 * s); w.position.set(d * (A - 0.02), CY - 0.05, 0.05); w.rotation.z = d * 0.55; g.add(w); parts['wing' + d] = w; }
  } else if (p.species === 'puff') {
    const h = [0.2, 0.28, 0.33, 0.37][stg];
    for (const d of [-1, 1]) {
      const ear = new Group(); ear.position.set(d * 0.5 * A, top - 0.2 * s, 0); ear.rotation.z = -d * 0.35;
      const e = part(new ConeGeometry(0.2 * s, h, 4), c.base, { ol: 0.025 }); e.rotation.y = Math.PI / 4; e.scale.z = 0.55; e.position.y = h / 2; ear.add(e);
      const inn = new Mesh(new ConeGeometry(0.11 * s, h * 0.7, 4), toon(c.inner)); inn.rotation.y = Math.PI / 4; inn.scale.z = 0.3; inn.position.set(0, h * 0.4, 0.07 * s); ear.add(inn);
      g.add(ear); parts['ear' + d] = ear;
    }
    if (lim) { const curve = new CatmullRomCurve3([new Vector3(0.45 * A, 0.35 * B, -0.6 * C), new Vector3(1.05 * A, 0.5 * B, -0.7 * C), new Vector3(1.2 * A, 1.15 * B, -0.5 * C), new Vector3(0.95 * A, 1.45 * B, -0.3 * C)]);
      const tail = part(new TubeGeometry(curve, 30, 0.1 * s + 0.02, 12), c.base, { ol: 0.02 }); g.add(tail); parts.tail = tail; }
  }
  // variants
  if (v === 'sparkle') {
    for (const d of [-1, 1]) { const w = part(sph(1, 20, 14), '#ffffff', { ol: 0.02, oc: '#f3c94b', mat: new MeshToonMaterial({ color: 0xffffff, gradientMap, transparent: true, opacity: 0.88 }) }); w.scale.set(0.5, 0.26, 0.06); w.position.set(d * (A + 0.28), CY + 0.28 * B, -0.35 * C); w.rotation.set(0, d * 0.35, d * 0.45); g.add(w); parts['swing' + d] = w; }
    const shp = new Shape(); for (let i = 0; i < 10; i++) { const an = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? 0.07 : 0.16; const x = Math.cos(an) * rr, y = -Math.sin(an) * rr; i ? shp.lineTo(x, y) : shp.moveTo(x, y); }
    const st3 = part(new ExtrudeGeometry(shp, { depth: 0.05, bevelEnabled: true, bevelSize: 0.015, bevelThickness: 0.02, bevelSegments: 2 }), '#ffd23f', { ol: 0.015, oc: '#c99400' });
    onSurface(st3, 0, CY - 0.3 * B, 0.08); st3.scale.setScalar(s); g.add(st3);
    sparkles = []; for (let i = 0; i < 3; i++) { const o = new Mesh(new OctahedronGeometry(0.06), toon('#ffe27a')); o.userData.ph = i * 2.1; g.add(o); sparkles.push(o); }
  } else sparkles = [];
  if (v === 'bouncy') for (const [x, y, r] of [[-0.62, 0.05, 0.09], [0.66, 0.15, 0.11], [0.45, 0.62, 0.07], [-0.4, -0.7, 0.06]]) { const sp = new Mesh(sph(1, 14, 10), toon(c.dark, { transparent: true, opacity: 0.4 })); onSurface(sp, x * A, CY + y * B, 0.0); sp.scale.set(r * s, r * s, 0.02); g.add(sp); }
  root.add(g); return g;
}

/* ---------- new creature families (designs: ChatGPT concept sheets, 2026-11-20) ---------- */
const HEADR = [0.42, 0.48, 0.53, 0.58], BODYR = [[0.34, 0.3, 0.32], [0.4, 0.37, 0.38], [0.46, 0.45, 0.42], [0.53, 0.5, 0.47]];
function ell(rx, ry, rz, color, opts) { const g = part(sph(1, 24, 18), color, opts); g.scale.set(rx, ry, rz); return g; }
function tube(pts, r, color, opts) { return part(new TubeGeometry(new CatmullRomCurve3(pts.map(a => new Vector3(...a))), 28, r, 10), color, opts || { ol: 0.02 }); }
function cone(r, h, color, opts, seg = 16) { return part(new ConeGeometry(r, h, seg), color, opts || { ol: 0.02 }); }
function starMesh(r, color) { const shp = new Shape(); for (let i = 0; i < 10; i++) { const an = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? r * 0.45 : r; const x = Math.cos(an) * rr, y = -Math.sin(an) * rr; i ? shp.lineTo(x, y) : shp.moveTo(x, y); }
  return part(new ExtrudeGeometry(shp, { depth: r * 0.3, bevelEnabled: true, bevelSize: r * 0.08, bevelThickness: r * 0.1, bevelSegments: 2 }), color, { ol: 0.012, oc: '#b98a00' }); }
function wingPair(g, y, z, x0, size, color, mode, lobes = 2, op = 1) {
  for (const d of [-1, 1]) {
    const w = new Group(); w.position.set(d * x0, y, z);
    for (let i = 0; i < lobes; i++) { const k = 1 - i * 0.28; const e = part(sph(1, 20, 14), color, { ol: 0.018, mat: op < 1 ? new MeshToonMaterial({ color: new Color(color), gradientMap, transparent: true, opacity: op }) : null });
      e.scale.set(size * 0.62 * k, size * k, 0.06); e.position.set(d * size * (0.45 + i * 0.22), size * (0.35 - i * 0.42), -i * 0.01); e.rotation.z = d * (0.5 + i * 0.35); w.add(e); }
    w.rotation.z = mode === 'up' ? -d * 0.45 : mode === 'fold' ? d * 0.5 : 0; w.rotation.y = d * 0.35; w.userData.rz = w.rotation.z;
    g.add(w); parts['wing' + d] = w;
  }
}
function legs(g, c, bx, by, bz, r, quad = true, color) {
  const col = color || c.base;
  const spots = quad ? [[-1, 0.55], [1, 0.55], [-1, -0.5], [1, -0.5]] : [[-1, 0.4], [1, 0.4]];
  for (const [d, f] of spots) { const l = ell(r * 0.85, r * 0.75, r, col, { ol: 0.02 }); l.position.set(d * bx * 0.55, r * 0.7, f * bz * 0.8); g.add(l); }
}
function mane(g, pts, cols, r) { pts.forEach((q, i) => { const k = 1 - Math.min(0.35, i * 0.03); const m = ell(r * 1.05 * k, r * 1.4 * k, r * 0.95 * k, cols[Math.floor(i / 2) % cols.length], { ol: 0.018 }); m.position.set(...q); m.rotation.z = (q[0] > 0 ? -1 : 1) * 0.35; g.add(m); }); }
function buildCreature(p) {
  const c = PAL[p.species], st = p.stage, v = p.variant, adult = st === 'adult';
  const si = { baby: 0, kid: 1, teen: 2, adult: 3 }[st], hr = HEADR[si], [bx, by, bz] = BODYR[si];
  const g = new Group(); parts = { shadow: parts.shadow }; sparkles = [];
  const turtle = p.species === 'turtle';
  // ---- body ----
  let bodyY = by + 0.12, headY, headZ;
  if (turtle) {
    const sx = bx * 1.35, sy = by * 0.85, sz = bz * 1.5; bodyY = sy * 0.55 + 0.16;
    const under = ell(sx * 0.95, sy * 0.45, sz * 0.95, c.belly, { ol: 0.03 }); under.position.y = bodyY - sy * 0.25; g.add(under);
    const shell = part(new SphereGeometry(1, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2), '#79b86a', { ol: 0.035 }); shell.scale.set(sx, sy * 1.15, sz); shell.position.y = bodyY - sy * 0.25; g.add(shell); parts.body = shell;
    const rim = part(new TorusGeometry(1, 0.07, 10, 40), c.dark, { ol: 0.01 }); rim.rotation.x = Math.PI / 2; rim.scale.set(sx, sz, 1); rim.position.y = bodyY - sy * 0.25; g.add(rim);
    for (const [x, z, r] of [[0, 0, 0.32], [-0.5, 0.3, 0.2], [0.5, 0.3, 0.2], [-0.45, -0.4, 0.2], [0.45, -0.4, 0.2]]) { const pl = new Mesh(sph(1, 16, 10), toon('#a9dc8f')); const yy = sy * 1.15 * Math.sqrt(Math.max(0.05, 1 - x * x - z * z)); pl.position.set(x * sx, bodyY - sy * 0.25 + yy - 0.02, z * sz); pl.scale.set(r * sx, 0.05, r * sz); g.add(pl); }
    for (const [dx, dz] of [[-1, 1], [1, 1], [-1, -1], [1, -1]]) { const l = ell(0.13 + si * 0.02, 0.12 + si * 0.015, 0.14 + si * 0.02, c.base, { ol: 0.02 }); l.position.set(dx * sx * 0.7, 0.12, dz * sz * 0.6); g.add(l); }
    headY = bodyY + 0.12; headZ = sz * 0.8 + hr * 0.35;
    const neck = ell(hr * 0.5, hr * 0.5, hr * 0.6, c.base, { ol: 0.02 }); neck.position.set(0, headY - 0.05, sz * 0.85); g.add(neck);
    // the garden grows with each stage
    const topY = bodyY - sy * 0.25 + sy * 1.15;
    const leaf = (x, y, z, r, col) => { const l = ell(r * 0.55, r, r * 0.18, col || '#6fbf5a', { ol: 0.015 }); l.position.set(x, y, z); return l; };
    const sprout = new Group(); sprout.position.y = topY - 0.02; g.add(sprout); parts.sprout = sprout;
    sprout.add(Object.assign(tube([[0, 0, 0], [0.02, 0.12, 0], [0.06, 0.22, 0.02]], 0.025, '#5aa04a', { ol: 0.01 })));
    const l1 = leaf(-0.08, 0.22, 0, 0.11); l1.rotation.z = 0.9; sprout.add(l1); const l2 = leaf(0.14, 0.24, 0.02, 0.1); l2.rotation.z = -0.9; sprout.add(l2);
    const flower = (x, y, z, col, r = 0.06) => { const f = new Group(); for (let i = 0; i < 5; i++) { const a = i / 5 * Math.PI * 2; const pe = new Mesh(sph(1, 10, 8), toon(col)); pe.scale.set(r, r, r * 0.45); pe.position.set(Math.cos(a) * r * 1.1, Math.sin(a) * r * 1.1, 0); f.add(pe); } const cc = new Mesh(sph(r * 0.55, 10, 8), toon('#ffd23f')); cc.position.z = r * 0.3; f.add(cc); f.position.set(x, y, z); return f; };
    if (si >= 1) { sprout.add(flower(-0.25 * sx, -0.02, 0.25 * sz, c.inner)); sprout.add(flower(0.3 * sx, -0.04, -0.1 * sz, '#ffffff')); }
    if (si >= 2) for (const [x, z] of [[-0.3, -0.2], [0.25, 0.25], [0, -0.35]]) { const b = ell(0.16, 0.12, 0.16, '#7fcf6a', { ol: 0.015 }); b.position.set(x * sx, 0.03, z * sz); sprout.add(b); }
    if (adult) {
      const trunk = part(new CylinderGeometry(0.07, 0.11, 0.42, 12), '#9a6a45', { ol: 0.015 }); trunk.position.y = 0.2; sprout.add(trunk);
      const canopy = v === 'sparkle' ? '#ffb7cf' : v === 'bouncy' ? '#8fdc6f' : '#a6d98f';
      for (const [x, y, z, r] of [[0, 0.55, 0, 0.3], [-0.24, 0.45, 0.05, 0.22], [0.24, 0.47, 0, 0.22], [0, 0.48, -0.2, 0.2], [0.05, 0.44, 0.2, 0.2]]) { const cpy = ell(r, r * 0.85, r, canopy, { ol: 0.018 }); cpy.position.set(x, y, z); sprout.add(cpy); }
      if (v === 'sparkle') for (const [x, y, z] of [[-0.2, 0.62, 0.15], [0.2, 0.6, 0.12], [0, 0.78, 0.05]]) sprout.add(flower(x, y, z, '#ffffff', 0.05));
      if (v === 'bouncy') for (const [x, y, z] of [[-0.15, 0.6, 0.18], [0.18, 0.55, 0.15]]) { const fr = new Mesh(sph(0.05, 12, 8), toon('#ff6b6b')); fr.position.set(x, y, z); sprout.add(fr); }
      if (v === 'cozy') { const lamp = new Mesh(sph(0.06, 12, 8), toon(c.glow)); lamp.position.set(0.25, 0.3, 0.12); sprout.add(lamp); }
    }
  } else {
    const body = ell(bx, by, bz, c.base, { ol: 0.035 }); body.position.y = bodyY; g.add(body); parts.body = body;
    const belly = ell(bx * 0.62, by * 0.7, bz * 0.45, c.belly, { outline: false }); belly.position.set(0, bodyY - by * 0.1, bz * 0.62); g.add(belly);
    headY = bodyY + by * 0.55 + hr * 0.7; headZ = 0.06;
    if (p.species === 'phoenix') legs(g, c, bx, by, bz, 0.1 + si * 0.015, false, '#ff9f1c');
    else if (p.species !== 'otter') legs(g, c, bx, by, bz, 0.11 + si * 0.02, true, p.species === 'pony' ? c.dark : null);
    else { for (const d of [-1, 1]) { const f = ell(0.1 + si * 0.015, 0.08, 0.12, c.base, { ol: 0.02 }); f.position.set(d * bx * 0.5, 0.08, bz * 0.5); g.add(f); const paw = ell(0.08 + si * 0.01, 0.07, 0.07, c.belly, { ol: 0.02 }); paw.position.set(d * bx * 0.35, bodyY + by * 0.15, bz * 0.85); g.add(paw); } }
  }
  // ---- head ----
  const HA = hr * (turtle ? 0.78 : 1), HB = HA * (turtle ? 0.9 : 0.94), HC = HA * 0.9;
  const head = ell(HA, HB, HC, c.base, { ol: 0.035 }); head.position.set(0, headY, headZ); g.add(head); parts.head = head; parts.body = head;
  A = HA; B = HB; C = HC; CY = headY; CZ = headZ; MOUTH_OUT = 0.004;
  const top = headY + HB;
  const muzzleSp = ['glitter', 'pony', 'pup', 'otter', 'fox'];
  if (muzzleSp.includes(p.species)) {
    const mw = p.species === 'pup' ? 0.3 : 0.26, mh = p.species === 'pony' ? 0.2 : 0.17;
    const mz = ell(mw * hr / 0.5, mh * hr / 0.5, 0.12 * hr / 0.5, c.belly, { ol: 0.015 });
    const sp = surf(0, headY - HB * 0.42, -0.06 * hr / 0.5); mz.position.copy(sp.p); g.add(mz);
    const noseCol = p.species === 'glitter' ? '#ffb6a0' : p.species === 'pony' ? '#f2a8c4' : INK;
    const nr = p.species === 'pup' ? 0.07 : 0.045; const nose = ell(nr * 1.3 * hr / 0.5, nr * hr / 0.5, nr * 0.8 * hr / 0.5, noseCol, { outline: false });
    const ns = surf(0, headY - HB * 0.3, 0.05 * hr / 0.5 + 0.06); nose.position.copy(ns.p); g.add(nose);
    MOUTH_OUT = 0.075 * hr / 0.5;
  }
  // ---- species features ----
  const S = hr / 0.5, D = [-1, 1];
  const accent = c.inner, glow = c.glow;
  switch (p.species) {
    case 'glitter': {
      const hh = [0.13, 0.21, 0.29, 0.34][si] * (v === 'cozy' ? 0.8 : 1);
      for (const d of D) { const h = cone(0.075 * S, hh, c.belly, { ol: 0.018 }); h.position.set(d * HA * 0.55, top - 0.04, headZ - 0.05); h.rotation.set(-0.3, 0, -d * 0.6); g.add(h);
        if (v === 'sparkle') { const tip = new Mesh(new ConeGeometry(0.04 * S, hh * 0.35, 12), toon(glow)); tip.position.set(d * HA * 0.55 + d * hh * 0.35, top - 0.04 + hh * 0.38, headZ - 0.11); tip.rotation.set(-0.3, 0, -d * 0.6); g.add(tip); } }
      const dew = new Mesh(sph(0.04 * S, 12, 8), toon(glow)); onSurface(dew, 0, headY + HB * 0.55, 0.01); g.add(dew);
      const ws = [0.17, 0.25, 0.33, v === 'sparkle' ? 0.48 : v === 'cozy' ? 0.3 : 0.42][si];
      wingPair(g, bodyY + by * 0.45, -bz * 0.35, bx * 0.8, ws, accent, v === 'bouncy' ? 'up' : v === 'cozy' ? 'fold' : '', adult ? 3 : 2, v === 'sparkle' ? 0.85 : 1);
      const tl = [0.25, 0.4, 0.55, v === 'bouncy' ? 0.75 : 0.62][si];
      parts.tail = tube([[0.1, bodyY - by * 0.5, -bz * 0.8], [0.3, bodyY - by * 0.6, -bz - tl * 0.4], [0.45 + tl * 0.3, bodyY - by * 0.3 + (v === 'bouncy' ? tl : 0), -bz - tl * 0.6], [0.35 + tl * 0.3, bodyY + (v === 'bouncy' ? tl * 1.3 : tl * 0.4), -bz - tl * 0.45]], 0.07 + si * 0.012, c.base); g.add(parts.tail);
      if (si >= 2) for (let i = 0; i < 3; i++) { const sp = cone(0.05, 0.11, accent, { ol: 0.012 }); sp.position.set(0, bodyY + by * (0.75 - i * 0.4), -bz * (0.75 + i * 0.12)); sp.rotation.x = -0.6 - i * 0.4; g.add(sp); }
      if (v === 'cozy') { for (let i = 0; i < 5; i++) { const a = i / 5 * Math.PI * 2; const pe = new Mesh(sph(1, 10, 8), toon('#fff3d6')); pe.scale.set(0.05, 0.07, 0.025); pe.position.set(Math.cos(a) * 0.07 - HA * 0.35, top - 0.02 + Math.sin(a) * 0.07, headZ + HC * 0.35); g.add(pe); } }
      break; }
    case 'pony': {
      for (const d of D) { const e = cone(0.09 * S, 0.2 * S, c.base, { ol: 0.018 }); e.position.set(d * HA * 0.5, top - 0.02, headZ - 0.05); e.rotation.z = -d * 0.3; e.scale.z = 0.6; g.add(e); }
      const mc = [accent, '#ffb3d1', '#a9e4ff', glow];
      const n = [2, 3, 4, 5][si] + (v === 'cozy' ? 2 : 0);
      const pts = []; for (let i = 0; i < n + 2; i++) { const t = i / Math.max(1, n + 1); pts.push([HA * (0.55 - t * 0.2), top - 0.02 - t * HB * 1.25, headZ - HC * (0.15 + t * 0.55)]); pts.push([-HA * (0.5 - t * 0.2), top - 0.06 - t * HB * 1.2, headZ - HC * (0.2 + t * 0.5)]); }
      pts.push([HA * 0.18, top - 0.02, headZ + HC * 0.35]); pts.push([-HA * 0.05, top + 0.02, headZ + HC * 0.2]);
      mane(g, pts, mc, (0.13 + si * 0.015) * S); parts.mane = true;
      if (si >= 2 || v) { const hh = [0, 0.1, 0.3, 0.43][si]; const horn = cone(0.07 * S, hh, glow, { ol: 0.015, oc: '#b98a00' }); horn.position.set(0, top + hh * 0.35, headZ + HC * 0.25); horn.rotation.x = 0.25; g.add(horn); }
      else if (si === 1) { const bump = cone(0.05, 0.08, glow, { ol: 0.012 }); bump.position.set(0, top - 0.01, headZ + HC * 0.3); g.add(bump); }
      const tl = [0.22, 0.4, 0.6, 0.7][si]; const tpts = [[0, bodyY, -bz * 0.85], [0.1, bodyY - tl * 0.2, -bz - tl * 0.3], [0.25, bodyY - tl * 0.6, -bz - tl * 0.25]];
      tpts.forEach((q, i) => { const m = ell(0.14 * S * (1 - i * 0.12), 0.18 * S, 0.13 * S, mc[i % mc.length], { ol: 0.015 }); m.position.set(...q); g.add(m); });
      for (let i = 0; i < 3; i++) { const dot = new Mesh(sph(0.03, 8, 6), toon(glow)); const a = -0.4 + i * 0.4; dot.position.set(bx * 0.98, bodyY + Math.sin(a) * by * 0.35, Math.cos(a) * bz * 0.3 - 0.05); g.add(dot); }
      if (si === 2) wingPair(g, bodyY + by * 0.5, -bz * 0.3, bx * 0.75, 0.2, '#e2d2ff', 'fold', 2);
      if (adult && v !== 'cozy') wingPair(g, bodyY + by * 0.55, -bz * 0.3, bx * 0.8, v === 'bouncy' ? 0.5 : 0.42, '#e2d2ff', v === 'bouncy' ? 'up' : '', 3);
      if (adult && v === 'sparkle') { const col = part(new TorusGeometry(hr * 0.75, 0.03, 8, 30), glow, { ol: 0.01, oc: '#b98a00' }); col.rotation.x = Math.PI / 2 - 0.2; col.position.set(0, headY - HB * 0.85, headZ * 0.5); g.add(col); }
      break; }
    case 'pup': {
      const el = [0.3, 0.38, 0.46, 0.5][si] * S;
      for (const d of D) { const ear = new Group(); ear.position.set(d * HA * 0.82, top - HB * 0.25, headZ - 0.02); const e = ell(0.13 * S, el * 0.55, 0.06 * S, c.dark, { ol: 0.018 }); e.position.y = -el * 0.4; ear.add(e); ear.rotation.z = d * 0.35; g.add(ear); parts['ear' + d] = ear; }
      const patch = starMesh(0.07 * S, c.dark); onSurface(patch, -HA * 0.3, headY + HB * 0.55, 0.0); g.add(patch);
      for (const [x, y] of [[0.4, 0.3], [-0.5, -0.1], [0.3, -0.5]]) { const sp = new Mesh(sph(1, 12, 8), toon(c.dark)); sp.scale.set(0.09, 0.08, 0.02); sp.position.set(x * bx, bodyY + y * by, Math.sqrt(Math.max(0.05, 1 - x * x - y * y)) * bz); g.add(sp); }
      if (si >= 1) { const col = part(new TorusGeometry(hr * 0.72, 0.035, 8, 30), accent, { ol: 0.01 }); col.rotation.x = Math.PI / 2 - 0.25; col.position.set(0, headY - HB * 0.88, headZ * 0.4); g.add(col); const tag = starMesh(0.06, glow); tag.position.set(0, headY - HB * 1.05, headZ + hr * 0.62); g.add(tag); }
      const tl = [0.2, 0.35, 0.5, 0.55][si];
      parts.tail = tube([[0, bodyY, -bz * 0.85], [0.05, bodyY + tl * 0.3, -bz - tl * 0.4], [0.1, bodyY + tl * 0.9, -bz - tl * 0.3]], 0.06 + si * 0.01, c.base); g.add(parts.tail);
      const ts = starMesh(0.06 + si * 0.01, glow); ts.position.set(0.1, bodyY + tl * 0.95 + 0.05, -bz - tl * 0.28); g.add(ts);
      if (si >= 2 && v !== 'cozy') for (const d of D) { const r = part(new TorusGeometry(0.1 * S, 0.025, 8, 20), '#ffd471', { ol: 0.01 }); r.position.set(d * 0.13 * S, top - 0.02, headZ + 0.05); r.rotation.x = -1.2; g.add(r); }
      if (adult && v === 'sparkle') { const orb = part(new TorusGeometry(bx * 1.15, 0.03, 8, 40), glow, { ol: 0.01 }); orb.position.set(0, bodyY + by * 0.3, -0.05); orb.rotation.x = Math.PI / 2 - 0.35; g.add(orb); parts.orbit = orb; }
      if (adult && v === 'cozy') { const hood = part(new SphereGeometry(1, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), accent, { ol: 0.02 }); hood.scale.set(HA * 1.12, HB * 1.1, HC * 1.1); hood.position.set(0, headY + 0.02, headZ - 0.04); hood.rotation.x = -0.25; g.add(hood); }
      break; }
    case 'kitty': {
      const eh = [0.2, 0.26, 0.3, 0.34][si] * S;
      for (const d of D) { const ear = new Group(); ear.position.set(d * HA * 0.55, top - 0.08, headZ - 0.02); ear.rotation.z = -d * 0.32;
        const e = cone(0.15 * S, eh, c.base, { ol: 0.018 }, 12); e.scale.z = 0.5; e.position.y = eh / 2; ear.add(e);
        const inn = new Mesh(new ConeGeometry(0.08 * S, eh * 0.65, 12), toon(accent)); inn.scale.z = 0.3; inn.position.set(0, eh * 0.42, 0.05 * S); ear.add(inn); g.add(ear); parts['ear' + d] = ear; }
      const mark = starMesh(0.045 * S, glow); onSurface(mark, 0, headY + HB * 0.58, 0.0); g.add(mark);
      const moon = part(new TorusGeometry(0.06 * S, 0.02 * S, 8, 16, Math.PI * 1.2), glow, { ol: 0.008 }); moon.position.set(0, bodyY + by * 0.2, bz * 1.0); moon.rotation.z = 0.9; g.add(moon);
      const tl = [0.3, 0.45, 0.55, 0.6][si];
      parts.tail = tube([[0.05, bodyY - by * 0.4, -bz * 0.85], [0.35, bodyY - by * 0.2, -bz - 0.1], [0.45, bodyY + tl * 0.6, -bz - 0.05], [0.25, bodyY + tl * 0.95, -bz + 0.05]], 0.06 + si * 0.01, c.base); g.add(parts.tail);
      if (adult && v === 'sparkle') { const halo = part(new TorusGeometry(hr * 0.55, 0.025, 8, 30), glow, { ol: 0.008 }); halo.position.set(0, top + 0.18, headZ - 0.05); halo.rotation.x = Math.PI / 2.4; g.add(halo); parts.halo = halo; }
      if (adult && v !== 'bouncy') { const cape = ell(bx * 1.0, by * 0.9, 0.06, accent, { ol: 0.015 }); cape.position.set(0, bodyY + by * 0.15, -bz * 0.75); g.add(cape); }
      if (adult && v === 'cozy') { const pil = ell(bx * 1.2, 0.08, bz * 1.1, '#9279D7', { ol: 0.02 }); pil.position.y = 0.04; g.add(pil); }
      break; }
    case 'phoenix': {
      const fl = [0.12, 0.17, 0.22, 0.27][si] * S; const fc = [accent, glow, accent];
      [-0.45, 0, 0.45].forEach((r, i) => { const f = ell(0.05 * S + 0.015, fl, 0.04, fc[i], { ol: 0.015 }); f.position.set(Math.sin(r) * fl * 0.9, top + fl * 0.7 - 0.04, headZ - 0.02); f.rotation.z = -r; g.add(f); if (i === 1) parts.tuft = f; });
      const bk = part(new ConeGeometry(0.06 * S, 0.12 * S, 12), '#ff9f1c', { ol: 0.012, oc: '#d97800' }); onSurface(bk, 0, headY - HB * 0.12, 0.04); bk.rotateX(Math.PI / 2); g.add(bk);
      MOUTH_OUT = 0.01;
      const ws = [0.18, 0.24, 0.32, v === 'sparkle' ? 0.5 : v === 'cozy' ? 0.3 : 0.44][si];
      wingPair(g, bodyY + by * 0.2, -bz * 0.2, bx * 0.85, ws, si >= 2 ? accent : c.base, v === 'bouncy' ? 'up' : v === 'cozy' ? 'fold' : '', si >= 2 ? 3 : 2);
      const tn = [2, 3, 4, 5][si]; for (let i = 0; i < tn; i++) { const a = (i - (tn - 1) / 2) * 0.35; const f = ell(0.06 * S, 0.2 * S + si * 0.04, 0.03, i % 2 ? glow : accent, { ol: 0.012 }); f.position.set(Math.sin(a) * 0.15, bodyY - by * 0.1 + Math.cos(a) * 0.12, -bz - 0.08); f.rotation.set(-0.9, 0, -a); g.add(f); }
      if (adult && v === 'sparkle') { const ring = part(new TorusGeometry(hr * 0.95, 0.03, 8, 40), glow, { ol: 0.008 }); ring.position.set(0, headY, headZ - HC - 0.06); g.add(ring); parts.halo = ring; }
      if (adult && v === 'cozy') { const nest = part(new TorusGeometry(bx * 0.95, 0.1, 10, 30), '#c89a6a', { ol: 0.015 }); nest.rotation.x = Math.PI / 2; nest.position.y = 0.08; g.add(nest); }
      break; }
    case 'otter': {
      for (const d of D) { const e = ell(0.08 * S, 0.08 * S, 0.05 * S, c.base, { ol: 0.015 }); e.position.set(d * HA * 0.7, top - HB * 0.2, headZ - 0.02); g.add(e); const inn = new Mesh(sph(0.04 * S, 10, 8), toon(accent)); inn.position.set(d * HA * 0.7, top - HB * 0.2, headZ + 0.03); g.add(inn); }
      const gem = part(new OctahedronGeometry(0.05 * S), glow, { ol: 0.01 }); onSurface(gem, HA * 0.25, headY + HB * 0.55, 0.02); g.add(gem);
      const fs = [0.16, 0.22, 0.28, v === 'bouncy' ? 0.38 : 0.32][si]; const tail = new Group(); tail.position.set(0, 0.15, -bz - 0.05);
      for (let i = 0; i < 3; i++) { const f = ell(fs * 0.45, fs * 0.9, 0.04, i === 1 ? accent : c.inner, { ol: 0.015 }); f.position.set((i - 1) * fs * 0.45, fs * 0.5, -i * 0.01); f.rotation.z = (i - 1) * -0.5; tail.add(f); }
      tail.rotation.x = v === 'bouncy' ? -1.2 : -0.6; g.add(tail); parts.tail = tail;
      if (si >= 2) for (const d of D) { const fin = ell(0.12 * S, 0.06 * S, 0.03, c.inner, { ol: 0.012 }); fin.position.set(d * (bx + 0.04), bodyY + by * 0.2, -0.05); fin.rotation.z = d * 0.5; g.add(fin); parts['fin' + d] = fin; }
      if (adult && v === 'sparkle') { wingPair(g, bodyY + by * 0.5, -bz * 0.5, bx * 0.5, 0.36, c.inner, '', 3, 0.85); const pearl = new Mesh(sph(0.06, 14, 10), toon('#fff3f8')); pearl.position.set(0, bodyY + by * 0.35, bz * 1.05); g.add(pearl); }
      if (adult && v === 'cozy') { const sh = part(new SphereGeometry(1, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), accent, { ol: 0.02 }); sh.scale.set(bx * 1.08, by * 0.9, bz * 1.1); sh.position.set(0, bodyY + by * 0.05, -bz * 0.12); sh.rotation.x = -0.5; g.add(sh); }
      break; }
    case 'turtle': {
      if (adult && v === 'sparkle') for (let i = 0; i < 3; i++) { const o = new Mesh(new OctahedronGeometry(0.05), toon(glow)); o.userData.ph = i * 2.1; g.add(o); sparkles.push(o); }
      break; }
    case 'fox': {
      const eh = [0.24, 0.3, 0.36, 0.4][si] * S;
      for (const d of D) { const ear = new Group(); ear.position.set(d * HA * 0.5, top - 0.08, headZ - 0.03); ear.rotation.z = -d * 0.18;
        const e = cone(0.12 * S, eh, c.base, { ol: 0.018 }, 4); e.rotation.y = Math.PI / 4; e.scale.z = 0.5; e.position.y = eh / 2; ear.add(e);
        const inn = new Mesh(new ConeGeometry(0.065 * S, eh * 0.7, 4), toon(accent)); inn.rotation.y = Math.PI / 4; inn.scale.z = 0.3; inn.position.set(0, eh * 0.45, 0.04 * S); ear.add(inn); g.add(ear); parts['ear' + d] = ear; }
      const rh = part(new OctahedronGeometry(0.05 * S), accent, { ol: 0.01 }); onSurface(rh, 0, headY + HB * 0.5, 0.02); rh.scale.set(0.8, 1.2, 0.5); g.add(rh);
      const tl = [0.35, 0.5, 0.62, v === 'cozy' ? 0.7 : 0.75][si], tr = [0.1, 0.13, 0.16, 0.19][si];
      const tp = v === 'cozy' ? [[0.1, bodyY - by * 0.6, -bz * 0.7], [0.5, 0.15, -bz * 0.3], [0.55, 0.15, bz * 0.4], [0.2, 0.18, bz * 0.85]] :
        [[0.05, bodyY - by * 0.4, -bz * 0.85], [0.3, bodyY - by * 0.2, -bz - tl * 0.35], [0.4, bodyY + tl * (v === 'bouncy' ? 1.0 : 0.6), -bz - tl * 0.35], [0.22, bodyY + tl * (v === 'bouncy' ? 1.35 : 0.95), -bz - tl * 0.1]];
      parts.tail = tube(tp, tr, c.base, { ol: 0.02 }); g.add(parts.tail);
      const tip = part(new OctahedronGeometry(tr * 1.1), accent, { ol: 0.012 }); tip.position.set(...tp[3]); tip.scale.set(1, 1.4, 1); g.add(tip);
      if (si >= 1) for (let i = 1; i < 3; i++) { const b = new Mesh(new OctahedronGeometry(0.035 + si * 0.006), toon(i % 2 ? glow : accent)); b.position.set(...tp[i]); b.position.z += tr * 0.6; g.add(b); }
      if (adult && v === 'sparkle') { for (const d of D) { const w = new Group(); w.position.set(d * bx * 0.6, bodyY + by * 0.5, -bz * 0.5); for (let i = 0; i < 3; i++) { const cr = part(new OctahedronGeometry(0.12), accent, { ol: 0.01, mat: new MeshToonMaterial({ color: new Color(accent), gradientMap, transparent: true, opacity: 0.8 }) }); cr.scale.set(0.5, 1.6 - i * 0.3, 0.3); cr.position.set(d * (0.12 + i * 0.12), 0.1 + i * 0.05, 0); cr.rotation.z = -d * (0.4 + i * 0.3); w.add(cr); } g.add(w); parts['wing' + d] = w; } }
      if (adult && v === 'bouncy') for (const d of D) { const b = new Mesh(new OctahedronGeometry(0.06), toon(glow)); b.position.set(d * bx * 0.6, 0.12, bz * 0.55); g.add(b); }
      break; }
  }
  // ---- shared variant touches ----
  if (adult && v === 'sparkle' && !turtle) { const st3 = starMesh(0.12, '#ffd23f'); st3.position.set(0, bodyY + by * 0.1, bz * 1.0); g.add(st3); if (!sparkles.length) for (let i = 0; i < 3; i++) { const o = new Mesh(new OctahedronGeometry(0.05), toon('#ffe27a')); o.userData.ph = i * 2.1; g.add(o); sparkles.push(o); } }
  if (adult && v === 'bouncy' && !turtle && p.species !== 'pup') for (const d of D) { const band = part(new TorusGeometry(0.1, 0.025, 8, 18), glow, { ol: 0.008 }); band.rotation.x = Math.PI / 2; band.position.set(d * bx * 0.55, 0.2, bz * 0.44); g.add(band); }
  if (adult && v === 'cozy' && ['glitter', 'fox', 'phoenix'].includes(p.species)) { const sc = part(new TorusGeometry(hr * 0.72, 0.06, 10, 30), '#ff8fa8', { ol: 0.015, oc: '#c94565' }); sc.rotation.x = Math.PI / 2 - 0.2; sc.position.set(0, headY - HB * 0.85, headZ * 0.5); g.add(sc); }
  if (turtle) g.position.z = -0.35;
  root.add(g); return g;
}

/* ---------- face (rebuilt on mood change) ---------- */
function buildFace(p, m) {
  const f = new Group(); const s = A; const st = p.stage;
  const er = (st === 'baby' ? 0.1 : 0.11 + 0.02 * (s - 0.78)) * (NEWSP.has(p.species) ? 1.12 : 1.32);
  const ey = CY + (st === 'baby' ? 0.1 : 0.17) * B, ex = 0.36 * A, my = ey - er - (st === 'baby' ? 0.1 : 0.13);
  const eyes = new Group(); eyes.userData.open = false; f.add(eyes); parts.eyes = eyes;
  const dark = flat(INK);
  const irisC = new Color(PAL[p.species].dark).lerp(new Color('#3a2a6a'), 0.35).getStyle();
  const openEye = (x, k = 1) => { const e = new Group(); const ball = new Mesh(sph(1, 24, 18), dark); ball.scale.set(er * 0.82 * k, er * 1.05 * k, er * 0.45); e.add(ball);
    const iris = new Mesh(sph(1, 24, 16), flat(irisC)); iris.scale.set(er * 0.62 * k, er * 0.62 * k, er * 0.2); iris.position.set(0, -er * 0.28 * k, er * 0.33); e.add(iris);
    const glow = new Mesh(sph(1, 16, 10), new MeshBasicMaterial({ color: new Color(PAL[p.species].inner || '#ffffff'), transparent: true, opacity: 0.55 })); glow.scale.set(er * 0.38 * k, er * 0.2 * k, er * 0.08); glow.position.set(0, -er * 0.55 * k, er * 0.44); e.add(glow);
    const h1 = new Mesh(sph(er * 0.3 * k, 14, 10), flat('#ffffff')); h1.position.set(-er * 0.3 * k, er * 0.4 * k, er * 0.44); h1.scale.set(1, 1.1, 0.5); e.add(h1);
    const h2 = new Mesh(sph(er * 0.13 * k, 10, 6), flat('#ffffff')); h2.position.set(er * 0.32 * k, -er * 0.1 * k, er * 0.44); h2.scale.z = 0.5; e.add(h2);
    onSurface(e, x, ey, 0.0); e.userData.bx = x; eyes.add(e); eyes.userData.open = true; return e; };
  const arc = (x, up) => { const t = new Mesh(new TorusGeometry(er * 0.75, er * 0.22, 8, 18, Math.PI), dark); const e = new Group(); e.add(t); if (!up) t.rotation.z = Math.PI; onSurface(e, x, ey - (up ? er * 0.25 : -er * 0.1), 0.0); eyes.add(e); };
  const heartEye = (x) => { const h = new Shape(); h.moveTo(0, -0.9); h.bezierCurveTo(-1.6, 0.2, -0.8, 1.4, 0, 0.5); h.bezierCurveTo(0.8, 1.4, 1.6, 0.2, 0, -0.9);
    const mm = new Mesh(new ExtrudeGeometry(h, { depth: 0.3, bevelEnabled: false }), flat('#ff4f8b')); mm.scale.setScalar(er * 0.95); const e = new Group(); e.add(mm); onSurface(e, x, ey, 0.0); eyes.add(e); };
  const xEye = (x) => { const e = new Group(); for (const r of [0.785, -0.785]) { const b = new Mesh(new BoxGeometry(er * 1.6, er * 0.32, 0.03), dark); b.rotation.z = r; e.add(b); } onSurface(e, x, ey, 0.01); eyes.add(e); };
  const lineEye = (x) => { const e = new Group(); e.add(new Mesh(new BoxGeometry(er * 1.6, er * 0.3, 0.03), dark)); onSurface(e, x, ey, 0.01); eyes.add(e); };
  const brow = (x, d, kind) => { const b = new Mesh(new CapsuleGeometry(er * 0.14, er * 1.1, 4, 8), dark); const e = new Group(); e.add(b); b.rotation.z = Math.PI / 2 + (kind === 'sad' ? -d * 0.35 : d * 0.45); onSurface(e, x, ey + er * 1.45, 0.0); f.add(e); };
  const L = -ex, R = ex;
  // mouth
  const mouth = new Group(); parts.mouth = mouth; f.add(mouth);
  const smile = (w = 0.1) => { const t = new Mesh(new TorusGeometry(w, 0.022, 8, 18, Math.PI), dark); t.rotation.z = Math.PI; mouth.add(t); };
  const frown = () => { const t = new Mesh(new TorusGeometry(0.085, 0.022, 8, 18, Math.PI), dark); t.position.y = -0.05; mouth.add(t); };
  const openM = (w = 0.12, h = 0.1) => { const om = new Mesh(new SphereGeometry(1, 24, 12, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), flat('#7a2840')); om.scale.set(w, h, 0.04); om.rotation.x = Math.PI; om.position.y = h * 0.1; mouth.add(om);
    const tg = new Mesh(sph(1, 14, 10), flat('#ff8fb1')); tg.scale.set(w * 0.5, h * 0.35, 0.03); tg.position.set(0, -h * 0.6, 0.012); mouth.add(tg); };
  const oh = (k = 1) => { const o = new Mesh(sph(1, 16, 12), flat('#7a2840')); o.scale.set(0.055 * k, 0.07 * k, 0.03); mouth.add(o); };
  switch (m) {
    case 'happy': arc(L, true); arc(R, true); openM(); break;
    case 'love': heartEye(L); heartEye(R); openM(); break;
    case 'sad': openEye(L); openEye(R); brow(L, -1, 'sad'); brow(R, 1, 'sad'); frown(); { const t = new Mesh(sph(1, 12, 8), toon('#7cc8ff')); t.scale.set(0.035, 0.05, 0.035); onSurface(t, L + er * 0.5, ey - er * 1.3, 0.03); f.add(t); parts.tear = t; } break;
    case 'sick': lineEye(L); lineEye(R); smile(0.06); break;
    case 'angry': openEye(L); openEye(R); brow(L, -1, 'mad'); brow(R, 1, 'mad'); frown(); break;
    case 'sleep': arc(L, false); arc(R, false); oh(0.6); break;
    case 'eat': arc(L, true); arc(R, true); oh(1.6); parts.chew = true; break;
    case 'surprised': openEye(L, 1.22); openEye(R, 1.22); oh(1.1); break;
    case 'dizzy': xEye(L); xEye(R); smile(0.06); break;
    default: openEye(L); openEye(R); smile();
  }
  parts.chew = m === 'eat';
  onSurface(mouth, 0, my, MOUTH_OUT); if (NEWSP.has(p.species)) mouth.scale.multiplyScalar(0.72);
  // beak for sunny (between eyes and mouth)
  if (p.species === 'sunny') { const bk = part(new ConeGeometry(0.06, 0.12, 12), '#ff9f1c', { ol: 0.012, oc: '#d97800' }); onSurface(bk, 0, (ey + my) / 2 + 0.02, 0.04); bk.rotateX(Math.PI / 2); f.add(bk); }
  // whiskers for puff
  if ((p.species === 'puff' || p.species === 'kitty') && st !== 'baby') for (const d of [-1, 1]) for (const k of [-1, 1]) { const w = new Mesh(new CylinderGeometry(0.008, 0.008, 0.28, 5), flat(INK, { transparent: true, opacity: 0.55 })); const sp = surf(d * 0.55 * A, my + k * 0.025, 0.01); w.position.copy(sp.p); w.rotation.z = Math.PI / 2 + k * d * 0.12; w.position.x += d * 0.12; f.add(w); }
  // cheeks
  for (const d of [-1, 1]) { const ch = new Mesh(sph(1, 16, 10), new MeshBasicMaterial({ color: new Color(m === 'angry' ? '#ff4d4d' : '#ff8fb1'), transparent: true, opacity: m === 'angry' ? 0.7 : 0.5 })); onSurface(ch, d * (ex + er * 0.95), ey - er * 1.25, 0.0); ch.scale.set(0.085, 0.05, 0.015); f.add(ch); }
  if (p.freckles) for (const d of [-1, 1]) { const fr = new Mesh(new OctahedronGeometry(0.03), flat('#ffd23f')); onSurface(fr, d * (ex + er * 1.9), ey - er * 0.9, 0.01); f.add(fr); }
  // cozy scarf (needs mouth height)
  if (p.variant === 'cozy' && !NEWSP.has(p.species)) {
    const sy = my - 0.14; const wdt = A * Math.sqrt(Math.max(0.05, 1 - ((sy - CY) / B) ** 2));
    const sc = part(new TorusGeometry(wdt * 0.98, 0.075, 10, 36), '#ff6b6b', { ol: 0.02, oc: '#c94545' }); sc.rotation.x = Math.PI / 2; sc.position.y = sy; sc.scale.z = 0.9; f.add(sc);
    const tl = part(new BoxGeometry(0.13, 0.36, 0.06), '#ff6b6b', { ol: 0.02, oc: '#c94545' }); const s2 = surf(0.32 * A, sy - 0.16, 0.06); tl.position.copy(s2.p); tl.rotation.z = 0.12; f.add(tl);
  }
  if (m === 'sick') parts.body.userData.mesh.material = toon(new Color(PAL[p.species].base).lerp(new Color('#9fdc84'), 0.35).getStyle());
  else parts.body.userData.mesh.material = toon(PAL[p.species].base);
  // hats sit on top of everything
  const hat = buildHat(p.hat, ex, ey, er); if (hat) f.add(hat);
  return f;
}
function buildHat(h, ex, ey, er) {
  if (!h) return null; const g = new Group(); const top = CY + B, s = A;
  const T = (geo, col, oc) => part(geo, col, { ol: 0.02, oc: oc || INK });
  switch (h) {
    case 'crown': { const band = T(new CylinderGeometry(0.28 * s, 0.3 * s, 0.16, 24, 1, true), '#ffd23f', '#b98a00'); band.position.y = 0.06; g.add(band);
      for (let i = 0; i < 6; i++) { const an = i / 6 * Math.PI * 2; const pt = T(new ConeGeometry(0.06, 0.16, 8), '#ffd23f', '#b98a00'); pt.position.set(Math.sin(an) * 0.28 * s, 0.2, Math.cos(an) * 0.28 * s); g.add(pt); }
      const gem = new Mesh(sph(0.05), toon('#ff4f8b')); gem.position.set(0, 0.07, 0.3 * s); g.add(gem); g.position.y = top - 0.05; break; }
    case 'party': { const c = T(new ConeGeometry(0.2, 0.5, 24), '#7c5cff'); c.position.y = 0.25; g.add(c); const pm = T(sph(0.07), '#ff4f8b'); pm.position.y = 0.52; g.add(pm); g.position.y = top - 0.04; g.rotation.z = 0.15; break; }
    case 'wizard': { const br = T(new CylinderGeometry(0.46 * s, 0.46 * s, 0.04, 32), '#5b3fc9'); g.add(br); const c = T(new ConeGeometry(0.28 * s, 0.7, 24), '#5b3fc9'); c.position.y = 0.36; c.rotation.z = 0.18; g.add(c); for (const [x, y] of [[-0.05, 0.3], [0.08, 0.5]]) { const st = new Mesh(new OctahedronGeometry(0.05), toon('#ffd23f')); st.position.set(x, y, 0.2 * s); g.add(st); } g.position.y = top - 0.02; break; }
    case 'beanie': { const d = T(new SphereGeometry(0.5 * s, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), '#18b6a4'); g.add(d); const band = T(new TorusGeometry(0.5 * s, 0.06, 8, 30), '#ffffff'); band.rotation.x = Math.PI / 2; g.add(band); const pm = T(sph(0.1), '#ffffff'); pm.position.y = 0.5 * s + 0.06; g.add(pm); g.position.y = top - 0.22 * s; break; }
    case 'cap': { const d = T(new SphereGeometry(0.5 * s, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), '#ff6b6b'); g.add(d); const br = T(new CylinderGeometry(0.32 * s, 0.32 * s, 0.035, 24, 1, false, -Math.PI / 2, Math.PI), '#ff6b6b'); br.position.set(0, 0.0, 0.42 * s); br.scale.z = 1.1; g.add(br); g.position.y = top - 0.2 * s; break; }
    case 'bow': { for (const d of [-1, 1]) { const w = T(new ConeGeometry(0.13, 0.26, 16), '#ff4f8b'); w.rotation.z = d * Math.PI / 2; w.position.x = -d * 0.13; w.scale.z = 0.5; g.add(w); } g.add(T(sph(0.06), '#ff7fab')); g.position.set(0.38 * A, top - 0.02, 0.15); g.rotation.z = -0.3; break; }
    case 'flower': { for (let i = 0; i < 5; i++) { const an = i / 5 * Math.PI * 2; const pe = T(sph(0.065), '#ffffff', '#ffb3d1'); pe.position.set(Math.cos(an) * 0.09, Math.sin(an) * 0.09, 0); pe.scale.z = 0.5; g.add(pe); } const cc = new Mesh(sph(0.055), toon('#ffd23f')); cc.position.z = 0.03; g.add(cc); g.position.set(-0.38 * A, top - 0.03, 0.18); g.rotation.x = -0.4; break; }
    case 'glasses': { for (const d of [-1, 1]) { const r = new Mesh(new TorusGeometry(er * 1.35, 0.022, 8, 5), toon('#ff4f8b')); r.rotation.z = Math.PI / 2; const lens = new Mesh(new CircleGeometry(er * 1.3, 5), new MeshBasicMaterial({ color: 0xff8fc0, transparent: true, opacity: 0.45 })); lens.rotation.z = Math.PI / 2; const e = new Group(); e.add(r); e.add(lens); onSurface(e, d * ex, ey, 0.06); g.add(e); }
      const br = new Mesh(new BoxGeometry(ex * 0.9, 0.025, 0.02), toon('#ff4f8b')); const sp = surf(0, ey + er * 0.4, 0.07); br.position.copy(sp.p); g.add(br); break; }
  }
  if (h !== 'glasses') g.position.z += CZ;
  return g;
}

/* ---------- 2D snapshots of any pet (Pet Book, games, menus) ---------- */
let snapR = null, snapFail = false; const snapCache = new Map();
function snapshot(p, m = 'happy', size = 220, lk = 0) {
  if (snapFail) return null;
  const key = keyOf(p) + '|' + m + '|' + size + '|' + lk; if (snapCache.has(key)) return snapCache.get(key);
  try {
    if (!snapR) { const cv = document.createElement('canvas'); const gl = cv.getContext('webgl2', { alpha: true, antialias: true, preserveDrawingBuffer: true }) || cv.getContext('webgl', { alpha: true, antialias: true, preserveDrawingBuffer: true }); if (!gl) { snapFail = true; return null; }
      snapR = new WebGLRenderer({ canvas: cv, context: gl, alpha: true, antialias: true }); snapR.outputColorSpace = SRGBColorSpace; }
    setupScene();
    const save = { A, B, C, CY, CZ, MOUTH_OUT, parts, sparkles, mood, rp: root.position.clone(), rs: root.scale.clone(), rr: root.rotation.clone(), cp: camera.position.clone(), cq: camera.quaternion.clone(), asp: camera.aspect, sh: parts.shadow.scale.clone() };
    if (pet) pet.visible = false;
    root.position.set(0, 0, 0); root.scale.set(1, 1, 1); root.rotation.set(0, p.stage === 'egg' ? 0 : (NEWSP.has(p.species) ? -0.24 : 0.12) + lk * 0.6, 0);
    let tmp;
    if (p.stage === 'egg') { tmp = buildEgg(p.species, 0); root.add(tmp); frame('egg', tmp); parts.shadow.scale.setScalar(0.95); }
    else { tmp = buildPet(p); const f = buildFace(p, m); tmp.add(f); root.updateMatrixWorld(true); frame(p.stage, tmp); parts.shadow.scale.setScalar(NEWSP.has(p.species) ? A * 1.25 + 0.12 : A * 1.05); }
    camera.aspect = 1; camera.updateProjectionMatrix();
    snapR.setPixelRatio(1); snapR.setSize(size, size, false); snapR.render(scene, camera);
    const url = snapR.domElement.toDataURL('image/png');
    root.remove(tmp); dispose(tmp);
    ({ A, B, C, CY, CZ, MOUTH_OUT, parts, sparkles, mood } = save); parts.shadow.scale.copy(save.sh);
    root.position.copy(save.rp); root.scale.copy(save.rs); root.rotation.copy(save.rr);
    camera.position.copy(save.cp); camera.quaternion.copy(save.cq); camera.aspect = save.asp; camera.updateProjectionMatrix();
    if (pet) pet.visible = true;
    snapCache.set(key, url); return url;
  } catch (e) { snapFail = true; return null; }
}

/* ---------- public API ---------- */
function frame(stage, obj, pull = 1) {
  if (obj) {
    const bb = new Box3().setFromObject(obj); const c = bb.getCenter(new Vector3()), sz = bb.getSize(new Vector3());
    const h = Math.max(sz.y, sz.x * 0.72) * 1.14, fov = MathUtils.degToRad(camera.fov);
    const d = (h / 2 / Math.tan(fov / 2) + sz.z * 0.5) * pull; const ty = c.y + (pull - 1) * h * 0.32;
    camera.position.set(0, ty + d * 0.1, d); camera.lookAt(0, ty, 0); return;
  }
  const [d, ty] = CAM[stage] || CAM.kid; camera.position.set(0, ty + 0.55, d); camera.lookAt(0, ty, 0); }
function build(p) {
  if (!ok || !p) return; cur = p;
  if (pet) { root.remove(pet); dispose(pet); }
  if (face) face = null;
  if (p.stage === 'egg') { A = 0.9; B = 1.15; CY = 1.15; pet = buildEgg(p.species, Math.floor((p.hatchTaps || 0) / 5)); root.add(pet); parts.shadow.scale.setScalar(0.95); frame('egg'); }
  else { pet = buildPet(p); face = buildFace(p, mood); pet.add(face); parts.shadow.scale.setScalar(NEWSP.has(p.species) ? A * 1.25 + 0.12 : A * 1.05); { root.updateMatrixWorld(true); const rr = root.rotation.clone(), rs = root.scale.clone(), rp = root.position.clone(); root.rotation.set(0,0,0); root.scale.set(1,1,1); root.position.set(0,0,0); root.updateMatrixWorld(true); frame(p.stage, pet, ({ baby: 1.5, kid: 1.3, teen: 1.15, adult: 1.05 })[p.stage] || 1.1); root.rotation.copy(rr); root.scale.copy(rs); root.position.copy(rp); } }
  structKey = keyOf(p);
}
function dispose(o) { o.traverse(n => { if (n.geometry) n.geometry.dispose(); }); }
const keyOf = p => [p.species, p.stage, p.variant, p.hat, !!p.freckles, p.stage === 'egg' ? Math.floor((p.hatchTaps || 0) / 5) : 0].join('|');
function show(p, m, lk) {
  if (!ok || !p) return;
  const k = keyOf(p);
  const moodChanged = m !== mood; mood = m || 'normal'; look = lk || 0;
  if (k !== structKey || !pet) { build(p); return; }
  cur = p;
  if (moodChanged && p.stage !== 'egg') { if (face) { pet.remove(face); dispose(face); } face = buildFace(p, mood); pet.add(face); }
}
function play(name) { action = name; actT = performance.now(); }

/* ---------- animation loop ---------- */
const ACT_LEN = { hug: 680, jump: 650, wobble: 550, shake: 500, dance: 2200, partyDance: 2200 };
function loop(now) {
  if (!visible || !pet || !container || !container.isConnected || container.offsetParent === null) return;
  const busyAnim = action && now - actT < (ACT_LEN[action] || 600);
  if (!busyAnim && now - lastFrame < 32) return; // ~30fps when idle, 60 during actions
  lastFrame = now;
  const t = now / 1000, el = container;
  const walking = el.classList.contains('walk'), asleep = el.classList.contains('asleep') || mood === 'sleep', egg = cur && cur.stage === 'egg';
  let sx = 1, sy = 1, py = 0, rz = 0, ry = 0;
  if (egg) { const w = (t % 2.2) < 0.6 ? Math.sin((t % 2.2) / 0.6 * Math.PI * 3) * 0.07 : 0; rz = w; }
  else if (asleep) { const b = Math.sin(t * 1.8) * 0.03; sx = 1 + b; sy = 1 - b; }
  else { const b = Math.sin(t * 2.9) * 0.025; sx = 1 + b; sy = 1 - b; ry = Math.sin(t * 0.7) * 0.08; }
  if (walking && !egg) { const h = Math.abs(Math.sin(t * 6.8)); py = h * 0.18; sy *= 1 + h * 0.05; sx *= 1 - h * 0.03; ry += 0.55; }
  if (busyAnim) {
    const k = (now - actT) / (ACT_LEN[action] || 600);
    if (action === 'hug') { const e = Math.sin(k * Math.PI); sx *= 1 + 0.16 * e * Math.cos(k * 9); sy *= 1 - 0.16 * e * Math.cos(k * 9); }
    if (action === 'jump') { const e = Math.sin(k * Math.PI); py += e * 0.7; sy *= k < 0.15 ? 0.85 : k > 0.85 ? 0.9 : 1.06; }
    if (action === 'wobble') rz += Math.sin(k * Math.PI * 4) * 0.25 * (1 - k);
    if (action === 'shake') ry += Math.sin(k * Math.PI * 6) * 0.45 * (1 - k);
    if (action === 'dance' || action === 'partyDance') { ry += k * Math.PI * 4; py += Math.abs(Math.sin(k * Math.PI * 8)) * 0.3; rz += Math.sin(k * Math.PI * 8) * 0.12; }
  } else action = null;
  // look toward finger / game direction
  const targetYaw = look * 0.38; yaw += (targetYaw - yaw) * 0.12;
  root.position.y = py; root.scale.set(sx, sy, sx); root.rotation.set(0, ry + (egg ? 0 : yaw + (cur && NEWSP.has(cur.species) ? -0.18 : 0)), rz);
  parts.shadow.material.opacity = 1 - Math.min(0.6, py);
  if (!egg) {
    // blink
    if (parts.eyes && parts.eyes.userData.open && !asleep) {
      if (now > blinkAt) { blinkT = now; blinkAt = now + 2500 + Math.random() * 3000; }
      const bk = now - blinkT < 130 ? 0.1 : 1; parts.eyes.children.forEach(e => { e.scale.y = bk; e.position.x = (e.userData.bx || e.position.x) + look * 0.035; });
    }
    if (parts.chew && parts.mouth) parts.mouth.scale.y = 0.4 + Math.abs(Math.sin(t * 9)) * 0.9;
    if (parts.tear) { const k2 = (t % 1.4) / 1.4; parts.tear.position.y = CY + 0.05 - k2 * 0.35; parts.tear.material.opacity = 1 - k2; parts.tear.material.transparent = true; }
    for (const d of [-1, 1]) {
      if (parts['ear' + d]) parts['ear' + d].rotation.x = Math.sin(t * 2.3 + d) * 0.06;
      if (parts['fin' + d]) parts['fin' + d].rotation.z = d * (0.5 + Math.sin(t * 5 + d) * 0.15);
      if (parts['wing' + d]) { const w = parts['wing' + d], b0 = w.userData.rz !== undefined ? w.userData.rz : d * 0.55; w.rotation.z = b0 + d * Math.sin(t * (walking || busyAnim ? 14 : 3)) * (walking || busyAnim ? 0.3 : 0.08); }
      if (parts['swing' + d]) parts['swing' + d].rotation.y = d * (0.35 + Math.sin(t * 4) * 0.25);
      if (parts['arm' + d]) parts['arm' + d].rotation.z = d * (0.45 + (busyAnim && action !== 'shake' ? Math.sin(t * 14) * 0.5 : Math.sin(t * 1.7) * 0.05));
    }
    if (parts.tail) parts.tail.rotation.y = Math.sin(t * 2) * 0.15;
    sparkles.forEach(o => { const a = t * 1.2 + o.userData.ph; o.position.set(Math.cos(a) * (A + 0.45), CY + 0.5 + Math.sin(a * 1.7) * 0.4, Math.sin(a) * (A + 0.3)); o.rotation.y = t * 3; o.scale.setScalar(0.7 + 0.4 * Math.abs(Math.sin(t * 3 + o.userData.ph))); });
  }
  renderer.render(scene, camera);
}

window.Pet3D = { init, build, show, play, snapshot, isNew: sp => NEWSP.has(sp), get ok() { return ok; } };
window.dispatchEvent(new Event('pet3d-ready'));
