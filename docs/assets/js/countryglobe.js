/* ZOLLER – Globus im Länderdialog (Three.js)
   Öffnet sich mit dem Länder-Knopf (Weltkugel + Flagge). Jedes Land mit eigener
   ZOLLER-Länderseite ist auf dem Globus zart gelb umrandet, das aktuelle Land leuchtet,
   der Hauptsitz steht als kleine gelbe Markierung darin. Zeigen auf ein Land (auf dem
   Globus oder in der Liste) lässt es aufleuchten und blendet die Route vom aktuellen
   Land ein; ein Klick fliegt als Lichtpunkt über den Bogen dorthin, rahmt das ganze
   Land ein, lässt es gelb aufleuchten und öffnet dann dieselbe Seite im anderen Land.
   Wird von main.js beim ersten Öffnen geladen; Daten aus dem JSON-Block im Dialog
   (build.py, lang_dialog), Ländergrenzen aus globe-countries.js (tools/make_countries.py). */

import * as THREE from 'three';
import { DEG, clamp, damp, vec, arcPoints, createEarth, createMarker, YELLOW, WHITE, TAU } from './globe-core.js';
import { COUNTRIES } from './globe-countries.js';

const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const FLY = 1.35, HOLD = 0.55;                      // Flugdauer, Halt über dem Land (s)
const MASK = 1024;                                  // längste Kante einer Ländermaske (px)

export function mount(dialog) {
  const test = document.createElement('canvas');
  if (!(test.getContext('webgl2') || test.getContext('webgl'))) { dialog.classList.add('is-static'); return null; }
  const data = JSON.parse(dialog.querySelector('[data-cglobe-data]').textContent);
  const box = dialog.querySelector('[data-cglobe]');
  const canvas = box.querySelector('canvas');
  const pinLayer = box.querySelector('[data-cglobe-pins]');
  const veil = dialog.querySelector('[data-cglobe-veil]');
  for (const s of data.sites) {                      // Blickpunkt des Landes (sonst Hauptsitz)
    s.geo = COUNTRIES[s.cc] || null;
    [s.clng, s.clat] = s.geo ? s.geo.c : [s.lng, s.lat];
  }
  const byId = Object.fromEntries(data.sites.map((s) => [s.id, s]));
  const cur = byId[data.cur];

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 50);
  const { scene, earth, ring, uni, dotMat } = createEarth(renderer);
  const globeMesh = earth.children[0];

  // --- Länder: alle Länderseiten zart umrandet, aktuelles Land und Ziel leuchten
  const world = overlay(uni, 1.0028);
  world.set(worldMask(data.sites), [-180, -90, 180, 90], 0);
  world.mat.uniforms.uOn.value = 0.55; world.mat.uniforms.uFill.value = 0.05;
  earth.add(world.mesh);
  const masks = {};
  const maskOf = (s) => s.geo && (masks[s.id] ||= countryMask(s.geo));
  const curLayer = overlay(uni, 1.0032), focus = overlay(uni, 1.0036);
  if (maskOf(cur)) { const m = maskOf(cur); curLayer.set(m.tex, m.box, m.wrap); curLayer.mat.uniforms.uOn.value = 0.7; }
  earth.add(curLayer.mesh, focus.mesh);
  let focusId = null;
  function setFocus(id) {
    if (id === focusId) return;
    focusId = id;
    const m = id && id !== cur.id ? maskOf(byId[id]) : null;
    if (m) focus.set(m.tex, m.box, m.wrap);
  }

  // --- Hauptsitze: kleine gelbe Markierungen, weitere ZOLLER-Seiten weiß
  const marks = [];
  for (const s of data.sites) {
    const mk = createMarker(s.lat, s.lng, YELLOW, 0.7);
    const size = s.id === cur.id ? 0.011 : 0.008, h = s.id === cur.id ? 0.14 : 0.08;
    mk.head.scale.setScalar(size); mk.beam.scale.set(size * 0.2, h, size * 0.2);
    earth.add(mk.g);
    marks.push({ s, ...mk, size, h, phase: Math.random(), hi: 0 });
  }
  for (const e of data.ext) {
    const mk = createMarker(e.lat, e.lng, WHITE, 0.45);
    mk.head.scale.setScalar(0.008); mk.beam.scale.set(0.0026, 0.05, 0.0026);
    earth.add(mk.g);
    marks.push({ s: e, ext: true, ...mk, size: 0.008, h: 0.05, phase: Math.random(), hi: 0 });
  }
  const markOf = Object.fromEntries(marks.filter((m) => !m.ext).map((m) => [m.s.id, m]));

  // --- Routen von der Mitte des aktuellen Landes zu den anderen Ländern
  const routes = {};
  const from = vec(cur.clat, cur.clng);
  for (const s of data.sites) {
    if (s.id === cur.id) continue;
    const pts = arcPoints(from, vec(s.clat, s.clng), 96), t = new Float32Array(pts.length);
    pts.forEach((_, i) => { t[i] = i / (pts.length - 1); });
    const geo = new THREE.BufferGeometry().setFromPoints(pts);
    geo.setAttribute('t', new THREE.BufferAttribute(t, 1));
    const mat = new THREE.ShaderMaterial({
      uniforms: { uTime: uni.uTime, uOff: { value: Math.random() }, uO: { value: 1 }, uHi: { value: 0 }, uFly: { value: -1 } },
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      vertexShader: 'attribute float t; varying float vT; void main(){ vT = t; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.); }',
      fragmentShader: `uniform float uTime; uniform float uOff; uniform float uO; uniform float uHi; uniform float uFly; varying float vT;
        void main(){
          float a;
          if (uFly >= 0.) { float d = vT - uFly; a = d < 0. ? .25 + .75 * exp(d * 4.) : .06; }
          else { float head = fract(uTime * .2 + uOff); float d = vT - head; float trail = d < 0. ? exp(d * 9.) : 0.;
                 a = (.03 + uHi * .45 + trail * (.25 + uHi * .75)); }
          a *= smoothstep(0., .03, vT) * smoothstep(1., .97, vT);
          gl_FragColor = vec4(vec3(.94, .9, 0.), a * uO); }`,
    });
    earth.add(new THREE.Line(geo, mat));
    routes[s.id] = { pts, mat };
  }
  // Lichtpunkt für den Flug
  const comet = new THREE.Mesh(new THREE.SphereGeometry(0.012, 16, 12), new THREE.MeshBasicMaterial({ color: 0xfffbd0, transparent: true }));
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), color: YELLOW, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
  glow.scale.setScalar(0.12); comet.add(glow); comet.visible = false; earth.add(comet);

  // --- HTML-Beschriftungen mit Flagge in der Mitte des Landes (sichtbar: aktuelles Land, Zeiger, Ziel)
  const pins = {};
  for (const s of data.sites) {
    const el = document.createElement('div');
    el.className = `cg-pin cg-pin--${s.side || 'ne'}${s.id === cur.id ? ' is-current' : ''}`;
    const entry = dialog.querySelector(`.lang-site[data-site="${s.id}"]`);
    const flag = entry?.querySelector('.flag')?.outerHTML || '';
    const langs = s.locs.length > 1
      ? `<span class="cg-pin__langs">${s.locs.map((l) => `<a href="${l.href}" hreflang="${l.code}" lang="${l.lang}" data-site="${s.id}" data-loc="${l.code}" tabindex="-1">${l.lang.toUpperCase()}</a>`).join('')}</span>` : '';
    el.innerHTML = `<i class="cg-pin__line"></i><span class="cg-pin__card"><a class="cg-pin__main" href="${pick(s).href}" data-site="${s.id}" data-loc="${pick(s).code}" tabindex="-1">${flag}<b>${s.name}</b></a>`
      + `<small>${s.id === cur.id ? data.t.here : s.city}</small>${langs}</span>`;
    pinLayer.appendChild(el);
    pins[s.id] = { el, n: vec(s.clat, s.clng), screen: new THREE.Vector3(), facing: 1 };
  }
  // Sprachfassung beim Wechsel: dieselbe Sprache wie jetzt, wenn das Land sie anbietet (Deutschland EN, Kanada FR)
  function pick(s) { return s.locs.find((l) => l.lang === data.lang) || s.locs[0]; }

  // ------------------------------------------------------------------ Ansicht
  const view = { rx: 0, ry: 0, dist: 7 }, goal = { rx: 0, ry: 0, dist: 3.4 };
  let W = 1, H = 1, fit = 1, running = false, raf = 0, last = 0, t0 = performance.now(), hover = null, flight = null;
  const unwrap = (ry) => { while (ry - view.ry > Math.PI) ry -= TAU; while (ry - view.ry < -Math.PI) ry += TAU; return ry; };
  const lookAt = (lat, lng, dist) => { goal.rx = clamp(lat * DEG, -1.2, 1.2); goal.ry = unwrap(-lng * DEG); if (dist) goal.dist = dist; };
  const latLng = (v) => { const n = v.clone().normalize(); return [Math.asin(n.y) / DEG, Math.atan2(n.x, n.z) / DEG]; };
  const home = () => lookAt(cur.view[0], cur.view[1], cur.view[2]);
  // Route zeigen: Mittelpunkt des Bogens, Abstand so, dass beide Länder zu sehen sind
  function preview(id) {
    if (flight) return;
    hover = id && id !== cur.id && byId[id] ? id : null;
    setFocus(hover);
    if (!id || id === cur.id) { home(); return; }
    const s = byId[id] || data.ext.find((e) => e.id === id);
    if (!s) return;
    const b = vec(s.clat ?? s.lat, s.clng ?? s.lng), ang = from.angleTo(b);
    const [lat, lng] = latLng(from.clone().add(b));
    lookAt(lat, lng, clamp(2.7 + ang * 1.9, 2.8, 5.2));
  }

  function resize() {
    const r = canvas.getBoundingClientRect();
    W = Math.max(1, r.width); H = Math.max(1, r.height);
    renderer.setSize(W, H, false);
    camera.aspect = W / H; camera.updateProjectionMatrix();
    // Schmale, hohe Flächen: Kamera weiter weg, damit der Globus nicht seitlich angeschnitten wird
    fit = camera.aspect < 1.15 ? Math.min(1.7, 1.15 / camera.aspect) : 1;
    uni.uPix.value = renderer.getPixelRatio() * Math.min(1.25, Math.max(0.8, H / 900));
  }
  new ResizeObserver(resize).observe(canvas);

  // ------------------------------------------------------------ Interaktion
  // Welches Land liegt unter dem Zeiger? Strahl auf die Kugel, dann Punkt-in-Umriss
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
  function siteAt(x, y) {
    const r = canvas.getBoundingClientRect();
    ndc.set(((x - r.left) / r.width) * 2 - 1, -((y - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    const hit = ray.intersectObject(globeMesh, false)[0];
    if (!hit) return null;
    let [lat, lng] = latLng(earth.worldToLocal(hit.point.clone()));
    for (const s of data.sites) {
      const g = s.geo;
      if (!g) continue;
      const x2 = g.b[2] > 180 && lng < 0 ? lng + 360 : lng;
      if (x2 < g.b[0] || x2 > g.b[2] || lat < g.b[1] || lat > g.b[3]) continue;
      if (g.p.some((ring) => inside(ring, x2, lat))) return s.id;
    }
    return null;
  }
  let drag = null, down = null;
  canvas.addEventListener('pointerdown', (e) => {
    if (flight) return;
    drag = { x: e.clientX, y: e.clientY }; down = { x: e.clientX, y: e.clientY, type: e.pointerType };
    canvas.setPointerCapture(e.pointerId); box.classList.add('is-dragging');
  });
  canvas.addEventListener('pointermove', (e) => {
    if (!drag) {                                   // Maus ohne gedrückte Taste: Land unter dem Zeiger aufleuchten lassen
      if (e.pointerType !== 'mouse' || flight) return;
      const id = siteAt(e.clientX, e.clientY);
      canvas.classList.toggle('is-over-site', !!id && id !== cur.id);
      if (id !== hover && (id || hover)) preview(id);
      return;
    }
    const k = 2.2 / H * (view.dist - 0.85) / 2.4;
    goal.ry += (e.clientX - drag.x) * k; goal.rx = clamp(goal.rx + (e.clientY - drag.y) * k, -1.2, 1.2);
    drag.x = e.clientX; drag.y = e.clientY;
  });
  const endDrag = () => { drag = null; box.classList.remove('is-dragging'); };
  canvas.addEventListener('pointerup', (e) => {
    endDrag();
    if (!down || flight) return;
    const moved = Math.hypot(e.clientX - down.x, e.clientY - down.y), type = down.type;
    down = null;
    if (moved > 6) return;
    const id = siteAt(e.clientX, e.clientY);
    if (!id) { if (type !== 'mouse') preview(null); return; }
    if (id === cur.id) return;
    // Maus: Klick fliegt sofort; Finger: erstes Tippen zeigt das Land, zweites Tippen fliegt
    if (type === 'mouse' || hover === id) go(byId[id], pick(byId[id]));
    else preview(id);
  });
  canvas.addEventListener('pointercancel', () => { endDrag(); down = null; });
  canvas.addEventListener('pointerleave', (e) => { if (e.pointerType === 'mouse' && !drag) canvas.classList.remove('is-over-site'); });

  // Zeigen auf Länderseiten (Liste und Beschriftungen) -> Route; Klick -> Flug
  const siteOf = (el) => el?.closest('[data-site]')?.dataset.site;
  dialog.addEventListener('pointerover', (e) => { if (e.pointerType === 'mouse' && e.target !== canvas) { const id = siteOf(e.target); if (id) preview(id); } });
  dialog.querySelector('.lang-dialog__inner').addEventListener('pointerleave', (e) => { if (e.pointerType === 'mouse') preview(null); });
  dialog.addEventListener('focusin', (e) => { const id = siteOf(e.target); if (id) preview(id); });
  dialog.addEventListener('click', (e) => {
    const a = e.target.closest('a[data-site][data-loc]');
    if (!a || e.metaKey || e.ctrlKey || e.shiftKey || e.button) return;
    const s = byId[a.dataset.site], loc = s?.locs.find((l) => l.code === a.dataset.loc);
    if (!loc) return;
    e.preventDefault();
    if (loc.cur) { dialog.close(); return; }
    go(s, loc);
  });

  // ------------------------------------------------------------- Flug
  function go(s, loc) {
    if (flight) return;
    const hint = document.createElement('link'); hint.rel = 'prefetch'; hint.href = loc.href; document.head.appendChild(hint);
    veil.innerHTML = `${pins[s.id].el.querySelector('.flag')?.outerHTML || ''}<span><b>ZOLLER</b><i></i>${s.country}</span><small>${loc.label}</small>`;
    dialog.classList.add('is-flying');
    pins[s.id].el.classList.add('is-target');
    setFocus(s.id);
    const leave = () => {
      try { sessionStorage.setItem('zoller-arrive', JSON.stringify({ site: s.id, t: Date.now() })); } catch (err) { /* privat */ }
      location.href = loc.href;
    };
    if (reduced) { dialog.classList.add('is-leaving'); setTimeout(leave, 250); return; }
    const route = routes[s.id];
    flight = { s, route, start: performance.now(), dist0: view.dist, zEnd: s.geo ? s.geo.z : 1.75,
               ang: route ? from.angleTo(vec(s.clat, s.clng)) : 0, leave, left: false };
    hover = null;
  }
  function fly(now) {
    const f = flight, el = (now - f.start) / 1000;
    let t;
    if (f.route) {
      t = ease(clamp(el / FLY));
      const pts = f.route.pts, x = t * (pts.length - 1), i = Math.min(pts.length - 2, Math.floor(x));
      const p = pts[i].clone().lerp(pts[i + 1], x - i);
      comet.visible = el < FLY + 0.1; comet.position.copy(p);
      f.route.mat.uniforms.uFly.value = t;
      const [lat, lng] = latLng(p);
      goal.rx = clamp(lat * DEG, -1.2, 1.2); goal.ry = unwrap(-lng * DEG);
      goal.dist = f.dist0 + (f.zEnd - f.dist0) * t + Math.sin(Math.PI * t) * f.ang * 0.9;
    } else {                                     // gleiche Länderseite, andere Sprache: nur heranzoomen
      t = ease(clamp(el / 0.8));
      lookAt(f.s.clat, f.s.clng); goal.dist = f.dist0 + (f.zEnd - f.dist0) * t;
    }
    // Ankunft: das Land leuchtet gelb auf
    const fu = (f.s.id === cur.id ? curLayer : focus).mat.uniforms;
    fu.uFlash.value = clamp((el - (f.route ? FLY * 0.72 : 0.4)) / 0.45);
    const dur = f.route ? FLY : 0.8;
    if (!f.left && el > dur + HOLD - 0.3) { f.left = true; dialog.classList.add('is-leaving'); }
    if (el > dur + HOLD + 0.2) { flight = null; f.leave(); }
  }

  // ------------------------------------------------------------------ Loop
  const tmp = new THREE.Vector3(), cam = new THREE.Vector3();
  function frame(now) {
    raf = requestAnimationFrame(frame);
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    const time = (now - t0) / 1000; uni.uTime.value = time;
    if (flight) fly(now);
    const k = reduced ? 60 : flight ? 7 : 3.2;
    view.rx = damp(view.rx, goal.rx, drag ? 18 : k, dt);
    view.ry = damp(view.ry, goal.ry, drag ? 18 : k, dt);
    view.dist = damp(view.dist, goal.dist, flight ? 6 : k * 0.8, dt);
    earth.rotation.set(view.rx, view.ry, 0);
    camera.position.set(0, 0, 1 + (view.dist - 1) * fit); camera.lookAt(0, 0, 0);
    ring.rotation.y = time * 0.03;
    dotMat.uniforms.uFocusOn.value = 0;
    const fid = flight ? flight.s.id : hover;
    const fo = focus.mat.uniforms.uOn;
    fo.value = damp(fo.value, fid && fid !== cur.id && fid === focusId ? 1 : 0, fid ? 7 : 4, dt);
    if (!flight) { focus.mat.uniforms.uFlash.value = damp(focus.mat.uniforms.uFlash.value, 0, 4, dt); curLayer.mat.uniforms.uFlash.value = 0; }
    curLayer.mat.uniforms.uOn.value = damp(curLayer.mat.uniforms.uOn.value, flight && flight.s.id !== cur.id ? 0.25 : 0.7, 4, dt);
    earth.updateMatrixWorld(); camera.updateMatrixWorld();
    cam.copy(camera.position);
    const zoomK = clamp((view.dist - 1.25) / 3.2, 0.3, 1.05);
    for (const m of marks) {
      const on = !m.ext && (m.s.id === hover || (flight && flight.s.id === m.s.id)) ? 1 : 0;
      m.hi = damp(m.hi, on, 8, dt);
      m.head.scale.setScalar(m.size * zoomK * (1 + m.hi * 0.6));
      m.beam.scale.y = m.h * (1 + m.hi * 1.2) * zoomK;
      const p = (time * 0.55 + m.phase) % 1;
      m.pulse.scale.setScalar(m.size * zoomK * (1.2 + p * (m.ext ? 2.6 : 3.4) + m.hi * 2));
      m.pulse.material.opacity = (1 - p) * (m.ext ? 0.4 : 0.6);
    }
    for (const [id, r] of Object.entries(routes)) {
      const fl = flight && flight.s.id === id;
      r.mat.uniforms.uHi.value = damp(r.mat.uniforms.uHi.value, hover === id ? 1 : 0, 6, dt);
      r.mat.uniforms.uO.value = damp(r.mat.uniforms.uO.value, flight && !fl ? 0 : 1, 6, dt);
      if (!fl) r.mat.uniforms.uFly.value = -1;
    }
    for (const [id, p] of Object.entries(pins)) {
      tmp.copy(p.n).applyMatrix4(earth.matrixWorld);
      p.facing = tmp.clone().normalize().dot(cam.clone().sub(tmp).normalize());
      tmp.project(camera);
      p.el.style.transform = `translate(${(tmp.x * 0.5 + 0.5) * W}px, ${(-tmp.y * 0.5 + 0.5) * H}px)`;
      const shown = id === cur.id ? !flight : (flight ? flight.s.id === id : hover === id);
      p.el.classList.toggle('is-hidden', p.facing < 0.18 || !shown);
      p.el.classList.toggle('is-hover', hover === id);
    }
    renderer.render(scene, camera);
  }

  const warm = renderer.compileAsync ? renderer.compileAsync(scene, camera).catch(() => {}) : Promise.resolve();
  function open() {
    dialog.classList.remove('is-flying', 'is-leaving');
    Object.values(pins).forEach((p) => p.el.classList.remove('is-target'));
    flight = null; hover = null; comet.visible = false; setFocus(null);
    resize(); home();
    if (reduced) Object.assign(view, goal);
    else Object.assign(view, { rx: goal.rx - 0.25, ry: goal.ry + 1.1, dist: 7.5 });
    // erst starten, wenn die Shader (im Hintergrund kompiliert) bereit sind – sonst stockt das Öffnen
    warm.then(() => {
      if (!dialog.open) return;
      if (!running) { running = true; last = performance.now(); raf = requestAnimationFrame(frame); }
      requestAnimationFrame(() => box.classList.add('is-ready'));
    });
  }
  function close() { running = false; cancelAnimationFrame(raf); box.classList.remove('is-ready'); }
  dialog.addEventListener('close', close);
  // Zurück-Taste: Seite kommt aus dem Cache – Dialog ohne Schleier wieder schließen
  window.addEventListener('pageshow', (e) => { if (e.persisted && dialog.open) { dialog.classList.remove('is-flying', 'is-leaving'); dialog.close(); } });
  return { open };
}

/* Punkt im Umriss (Strahl-Methode); ring = [Länge, Breite, Länge, Breite …] */
function inside(ring, x, y) {
  let hit = false;
  for (let i = 0, j = ring.length - 2; i < ring.length; j = i, i += 2) {
    const xi = ring[i], yi = ring[i + 1], xj = ring[j], yj = ring[j + 1];
    if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) hit = !hit;
  }
  return hit;
}

/* Leuchtende Länderfläche: Kugelschale knapp über den Landpunkten, die eine Maske im
   Längen-/Breiten-Ausschnitt uBox abtastet (rot = Fläche, grün = Kante, blau = Lichthof). */
function overlay(uni, radius) {
  const mat = new THREE.ShaderMaterial({
    uniforms: { uTime: uni.uTime, uMask: { value: null }, uBox: { value: new THREE.Vector4(0, 0, 1, 1) }, uWrap: { value: 0 },
                uOn: { value: 0 }, uFlash: { value: 0 }, uFill: { value: 0.18 } },
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: `varying vec3 vP; varying float vF;
      void main(){ vP = position; vec4 mv = modelViewMatrix * vec4(position,1.);
        vF = dot(normalize(normalMatrix * position), normalize(-mv.xyz)); gl_Position = projectionMatrix * mv; }`,
    fragmentShader: `uniform sampler2D uMask; uniform vec4 uBox; uniform float uWrap; uniform float uOn; uniform float uFlash; uniform float uFill; uniform float uTime;
      varying vec3 vP; varying float vF;
      void main(){
        if (uOn < .003) discard;
        vec3 n = normalize(vP);
        float lat = degrees(asin(clamp(n.y, -1., 1.))), lng = degrees(atan(n.x, n.z));
        if (uWrap > .5 && lng < 0.) lng += 360.;
        vec2 uv = vec2((lng - uBox.x) / (uBox.z - uBox.x), (lat - uBox.y) / (uBox.w - uBox.y));
        if (uv.x < 0. || uv.x > 1. || uv.y < 0. || uv.y > 1.) discard;
        vec3 m = texture2D(uMask, uv).rgb;
        float wave = .82 + .18 * sin(uTime * 2.4 - (lng + lat) * .45);
        float a = m.r * (uFill + .5 * uFlash) * wave + m.g * (.7 + .3 * uFlash) + m.b * (.22 + .5 * uFlash);
        a *= uOn * smoothstep(-.02, .3, vF);
        gl_FragColor = vec4(vec3(.94, .9, 0.) * (1. + uFlash * .25), a);
      }`,
  });
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(radius, 128, 96), mat);
  mesh.renderOrder = 2;
  return {
    mesh, mat,
    set(tex, b, wrap) { mat.uniforms.uMask.value = tex; mat.uniforms.uBox.value.set(b[0], b[1], b[2], b[3]); mat.uniforms.uWrap.value = wrap ? 1 : 0; },
  };
}

function path(rings, tx) {
  const p = new Path2D();
  for (const r of rings) {
    for (let i = 0; i < r.length; i += 2) { const [x, y] = tx(r[i], r[i + 1]); if (i) p.lineTo(x, y); else p.moveTo(x, y); }
    p.closePath();
  }
  return p;
}

/* Maske eines Landes im eigenen Ausschnitt (scharf auch bei kleinen Ländern wie Slowenien) */
function countryMask(c) {
  const [w0, s0, e0, n0] = c.b;
  const dx = (e0 - w0) * 0.08 + 0.4, dy = (n0 - s0) * 0.08 + 0.4;
  const b = [w0 - dx, s0 - dy, e0 + dx, n0 + dy];
  const ax = (b[2] - b[0]) * Math.cos(((b[1] + b[3]) / 2) * DEG), ay = b[3] - b[1];
  const W = ax >= ay ? MASK : Math.max(64, Math.round(MASK * ax / ay));
  const H = ax >= ay ? Math.max(64, Math.round(MASK * ay / ax)) : MASK;
  const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
  const g = cv.getContext('2d');
  g.fillStyle = '#000'; g.fillRect(0, 0, W, H);
  const p = path(c.p, (x, y) => [(x - b[0]) / (b[2] - b[0]) * W, (b[3] - y) / (b[3] - b[1]) * H]);
  g.globalCompositeOperation = 'lighter';
  g.save(); g.shadowColor = 'rgb(0,0,255)'; g.shadowBlur = Math.max(8, Math.max(W, H) / 45);
  g.strokeStyle = 'rgb(0,0,255)'; g.lineWidth = Math.max(2, Math.max(W, H) / 260); g.stroke(p); g.restore();
  g.fillStyle = 'rgb(255,0,0)'; g.fill(p);
  g.strokeStyle = 'rgb(0,255,0)'; g.lineWidth = Math.max(1.5, Math.max(W, H) / 420); g.lineJoin = 'round'; g.stroke(p);
  return { tex: texture(cv), box: b, wrap: b[2] > 180 };
}

/* Alle Länder mit eigener Seite auf einer Weltkarte (zarte Umrandung) */
function worldMask(sites) {
  const W = 4096, H = 2048;
  const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
  const g = cv.getContext('2d');
  g.fillStyle = '#000'; g.fillRect(0, 0, W, H);
  g.globalCompositeOperation = 'lighter';
  for (const s of sites) {
    if (!s.geo) continue;
    for (const shift of s.geo.b[2] > 180 ? [0, -360] : [0]) {
      const p = path(s.geo.p, (x, y) => [(x + shift + 180) / 360 * W, (90 - y) / 180 * H]);
      g.fillStyle = 'rgb(255,0,0)'; g.fill(p);
      g.strokeStyle = 'rgb(0,150,0)'; g.lineWidth = 1.4; g.lineJoin = 'round'; g.stroke(p);
    }
  }
  return texture(cv);
}

function texture(cv) {
  const t = new THREE.CanvasTexture(cv);
  t.generateMipmaps = false; t.minFilter = THREE.LinearFilter; t.magFilter = THREE.LinearFilter;
  return t;
}

function glowTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const g = c.getContext('2d'), r = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  r.addColorStop(0, 'rgba(255,255,255,1)'); r.addColorStop(0.25, 'rgba(255,255,255,.55)'); r.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = r; g.fillRect(0, 0, 64, 64);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
