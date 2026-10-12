/* ZOLLER – Zoom-Through, Iris-Blende und Text-Maske
   Scroll-gesteuerte Szenenwechsel (Startseite, Abschnitte aus build.py: zoom_iris, zoom_mask):
   - data-zoomx="iris": ein großes Wort wächst beim Scrollen, bis man zwischen den Buchstaben hindurchfliegt. An dieser
     Stelle öffnet sich ein Kreis mit Messskala am Rand (Iris-Blende) und zeigt den nächsten Satz.
   - data-zoomx="mask": das Bild der nächsten Szene ist nur in den Buchstaben zu sehen (Text-Maske). Die Schrift wächst,
     bis man durch einen Buchstaben ins Bild fliegt; danach schiebt sich die Karte mit dem Text darüber.
   Die Flugrichtung wird aus der Schrift berechnet: die Stelle mit dem meisten Platz nahe der Mitte – zwischen den
   Buchstaben (Iris) bzw. im dicksten Strich (Maske). So passt es in jeder Sprache und Bildschirmgröße.
   Läuft nach motion.js. Ohne JavaScript oder bei »Bewegung reduzieren« stehen Satz bzw. Bild mit Karte einfach da. */
(() => {
  'use strict';

  const root = document.documentElement;
  if (matchMedia('(prefers-reduced-motion: reduce)').matches || root.classList.contains('reduced-motion')) return;
  const secs = [...document.querySelectorAll('[data-zoomx]')];
  if (!secs.length) return;
  const $ = (s, c = document) => c.querySelector(s);
  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const smooth = (a, b, v) => { const t = clamp((v - a) / (b - a)); return t * t * (3 - 2 * t); };
  let vw = innerWidth, vh = innerHeight;

  /* ------------------------------------------------------- Flugziel in der Schrift */
  // Schrift Zeichen für Zeichen (Positionen aus dem DOM, also mit Laufweite und Umbruch) auf eine kleine Leinwand
  // zeichnen, dann per Abstandstransformation die Stelle mit dem größten Abstand zur nächsten Kante suchen.
  // inside = im Buchstaben, sonst dazwischen. Rückgabe in px relativ zur Box des Elements (ohne Skalierung).
  const focusPoint = (el, inside) => {
    const box = el.getBoundingClientRect();
    if (!box.width || !box.height) return null;
    const k = Math.min(1, 560 / box.width);
    const W = Math.ceil(box.width * k) + 4, H = Math.ceil(box.height * k) + 4;
    const cv = document.createElement('canvas');
    cv.width = W; cv.height = H;
    const g = cv.getContext('2d', { willReadFrequently: true });
    if (!g) return null;
    const cs = getComputedStyle(el);
    g.font = `${cs.fontWeight} ${parseFloat(cs.fontSize) * k}px ${cs.fontFamily}`;
    const fm = g.measureText('H');
    const asc = fm.fontBoundingBoxAscent || parseFloat(cs.fontSize) * k * 0.8;
    const dsc = fm.fontBoundingBoxDescent || parseFloat(cs.fontSize) * k * 0.2;
    const range = document.createRange();
    const walk = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    for (let n = walk.nextNode(); n; n = walk.nextNode()) {
      for (let i = 0; i < n.length; i++) {
        if (!n.data[i].trim()) continue;
        range.setStart(n, i); range.setEnd(n, i + 1);
        const r = range.getClientRects()[0];
        if (!r) continue;
        g.fillText(n.data[i], (r.left - box.left) * k + 2, (r.top - box.top) * k + r.height * k * asc / (asc + dsc) + 2);
      }
    }
    const px = g.getImageData(0, 0, W, H).data;
    const N = W * H, d = new Float32Array(N);
    let x0 = W, x1 = -1, y0 = H, y1 = -1;
    for (let i = 0; i < N; i++) {
      const ink = px[i * 4 + 3] > 127;
      d[i] = ink === inside ? 1e6 : 0;
      if (ink) { const x = i % W, y = (i / W) | 0; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
    }
    if (x1 < 0) return null;
    // Chamfer-Abstand (1 / √2), zwei Durchgänge
    const D = Math.SQRT2;
    for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) {
      const i = y * W + x;
      d[i] = Math.min(d[i], d[i - 1] + 1, d[i - W] + 1, d[i - W - 1] + D, d[i - W + 1] + D);
    }
    for (let y = H - 2; y > 0; y--) for (let x = W - 2; x > 0; x--) {
      const i = y * W + x;
      d[i] = Math.min(d[i], d[i + 1] + 1, d[i + W] + 1, d[i + W + 1] + D, d[i + W - 1] + D);
    }
    // nahe der Mitte bevorzugen; zwischen den Buchstaben nur im mittleren Band der Zeile(n) suchen
    const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2, hw = (x1 - x0) / 2 || 1, hh = (y1 - y0) / 2 || 1;
    const ya = inside ? y0 : Math.round(y0 + hh * 0.7), yb = inside ? y1 : Math.round(y1 - hh * 0.4);
    let best = -1, bx = cx, by = cy, br = 1;
    for (let y = ya; y <= yb; y++) for (let x = x0; x <= x1; x++) {
      const v = d[y * W + x];
      if (!v || v >= 1e5) continue;
      const u = (x - cx) / hw, w = (y - cy) / hh;
      const s = v * (1 - 0.8 * u * u) * (1 - 0.4 * w * w);
      if (s > best) { best = s; bx = x; by = y; br = v; }
    }
    return { x: (bx - 2) / k, y: (by - 2) / k, r: br / k };
  };

  // größter Abstand von (x, y) zu einer Ecke der Bühne
  const corner = (x, y, w, h) => Math.max(Math.hypot(x, y), Math.hypot(w - x, y), Math.hypot(x, h - y), Math.hypot(w - x, h - y));

  // Schriftgröße so wählen, dass das Wort die Breite füllt, aber nicht zu hoch wird
  const fit = (p, span, wf, hf) => {
    p.style.fontSize = '';
    const fs = parseFloat(getComputedStyle(p).fontSize);
    const w = span.offsetWidth, h = span.offsetHeight;
    if (w && h) p.style.fontSize = (fs * Math.min(vw * wf / w, vh * hf / h)).toFixed(2) + 'px';
  };

  /* ------------------------------------------------- Zoom-Through mit Iris-Blende */
  const iris = (sec) => {
    const stage = $('.zoomx__stage', sec), bigP = $('.zoomx__big', sec), big = $('.zoomx__big > span', sec);
    const disc = $('.zoomx__disc', sec), line = $('.zoomx__line', sec), em = $('.zoomx__line em', sec);
    const ret = $('.zoomx__reticle', sec), ring = $('.zoomx__ring', sec);
    const [ticks, major] = ring.querySelectorAll('circle');
    let S = 26, R = 1, cx = 0, cy = 0, last = -1;
    return {
      sec,
      measure() {
        big.style.transform = '';
        fit(bigP, big, 0.86, 0.36);
        const sr = stage.getBoundingClientRect(), br = big.getBoundingClientRect();
        const f = focusPoint(big, false) || { x: br.width / 2, y: br.height * 0.55, r: br.height * 0.06 };
        big.style.transformOrigin = `${f.x.toFixed(1)}px ${f.y.toFixed(1)}px`;
        cx = br.left - sr.left + f.x; cy = br.top - sr.top + f.y;
        const c = corner(cx, cy, sr.width, sr.height);
        R = c + 40;
        S = clamp(c / Math.max(3, f.r) * 1.5, 24, 96);   // so weit, dass die Buchstaben den Rand verlassen
        for (const el of [ticks, major]) { el.setAttribute('cx', cx.toFixed(1)); el.setAttribute('cy', cy.toFixed(1)); }
        ret.style.transform = `translate(${cx.toFixed(1)}px, ${cy.toFixed(1)}px)`;
        last = -1;
      },
      progress(r) { return clamp(-r.top / Math.max(1, r.height - vh)); },
      update(p) {
        if (Math.abs(p - last) < 0.0004) return;
        last = p;
        // 1) das Wort fliegt auf die Kamera zu (exponentiell: gleichmäßiges Tempo beim Hindurchfliegen)
        const a = smooth(0.02, 0.56, p);
        big.style.transform = `scale(${Math.pow(S, a * a).toFixed(4)})`;
        big.style.opacity = (1 - smooth(0.42, 0.54, p)).toFixed(3);
        // 2) Iris: der Kreis öffnet sich an der Stelle, durch die man fliegt
        const o = smooth(0.26, 0.72, p), r = o * o * R;
        disc.style.clipPath = `circle(${r.toFixed(1)}px at ${cx.toFixed(1)}px ${cy.toFixed(1)}px)`;
        // Messskala am Kreisrand: 120 feine Striche (3°), alle 15° ein langer – dreht sich beim Öffnen leicht mit
        const ro = smooth(0.27, 0.33, p) * (1 - smooth(0.6, 0.7, p));
        ring.style.opacity = ro.toFixed(3);
        if (ro > 0) {
          const rt = r + 7, rm = r + 11;
          const ct = 2 * Math.PI * rt, cm = 2 * Math.PI * rm, turn = p * 0.06;
          ticks.setAttribute('r', rt.toFixed(1));
          ticks.style.strokeDasharray = `1.4 ${Math.max(0.5, ct / 120 - 1.4).toFixed(2)}`;
          ticks.style.strokeDashoffset = (-ct * turn).toFixed(1);
          major.setAttribute('r', rm.toFixed(1));
          major.style.strokeDasharray = `2.2 ${Math.max(0.5, cm / 24 - 2.2).toFixed(2)}`;
          major.style.strokeDashoffset = (-cm * turn).toFixed(1);
        }
        // Fadenkreuz wie im Kamerabild eines Einstellgeräts, solange der Kreis noch klein ist
        ret.style.opacity = (smooth(0.3, 0.4, p) * (1 - smooth(0.56, 0.66, p))).toFixed(3);
        // 3) der Satz
        const t = smooth(0.6, 0.84, p);
        line.style.opacity = t.toFixed(3);
        line.style.transform = t >= 1 ? '' : `translate3d(0, ${((1 - t) * 40).toFixed(1)}px, 0) scale(${(0.94 + 0.06 * t).toFixed(4)})`;
        if (em) em.style.setProperty('--mk', `${(smooth(0.8, 0.94, p) * 100).toFixed(1)}%`);
      },
    };
  };

  /* --------------------------------------------------------------- Text-Maske */
  const mask = (sec) => {
    const stage = $('.zoomx__stage', sec), veil = $('.zoomx__veil', sec), bigP = $('.zoomx__big', sec), big = $('.zoomx__big > span', sec);
    const img = $('.zoomx__media img', sec), shade = $('.zoomx__shade', sec), kicker = $('.zoomx__kicker', sec), content = $('.zoomx__content', sec);
    let S = 40, flight = 1, last = -1, lastShade = -1;
    return {
      sec,
      measure() {
        big.style.transform = '';
        bigP.classList.toggle('is-stacked', vw < vh * 0.95);   // Hochformat: ein Wort pro Zeile, damit die Buchstaben groß genug sind
        fit(bigP, big, 0.9, 0.64);
        const sr = stage.getBoundingClientRect(), br = big.getBoundingClientRect();
        const f = focusPoint(big, true) || { x: br.width / 2, y: br.height / 2, r: br.height * 0.05 };
        big.style.transformOrigin = `${f.x.toFixed(1)}px ${f.y.toFixed(1)}px`;
        S = clamp(corner(br.left - sr.left + f.x, br.top - sr.top + f.y, sr.width, sr.height) / Math.max(2, f.r) * 1.15, 6, 220);
        if (kicker) kicker.style.top = `${Math.max(0, br.top - sr.top - kicker.offsetHeight - Math.max(14, br.height * 0.06)).toFixed(1)}px`;
        flight = Math.max(1, content.offsetTop - stage.offsetHeight);
        last = -1; lastShade = -1;
      },
      progress(r) { return clamp(-r.top / flight); },
      update(p, r) {
        // Abdunkeln für die Karte, sobald sie über das Bild fährt
        const sh = smooth(0, 0.55, (-r.top - flight) / vh);
        if (Math.abs(sh - lastShade) > 0.002) { lastShade = sh; shade.style.opacity = sh.toFixed(3); }
        if (Math.abs(p - last) < 0.0004) return;
        last = p;
        const a = smooth(0.05, 0.9, p);
        big.style.transform = `scale(${Math.pow(S, a * a).toFixed(4)})`;
        veil.style.opacity = (1 - smooth(0.8, 0.93, p)).toFixed(3);
        veil.style.visibility = p >= 0.93 ? 'hidden' : '';
        if (kicker) {
          const k = smooth(0.02, 0.16, p);
          kicker.style.opacity = (1 - k).toFixed(3);
          kicker.style.transform = `translate3d(0, ${(-k * 24).toFixed(1)}px, 0)`;
        }
        // das Bild dahinter kommt mit, aber viel langsamer als die Schrift (Tiefe)
        if (img) img.style.transform = `scale(${(1 + 0.12 * a).toFixed(4)})`;
      },
    };
  };

  const items = secs.map((s) => (s.dataset.zoomx === 'mask' ? mask(s) : iris(s)));

  /* --------------------------------------------------------------- Schleife */
  let queued = false;
  const frame = () => {
    queued = false;
    const rects = items.map((it) => it.sec.getBoundingClientRect());
    items.forEach((it, i) => {
      const r = rects[i];
      if (r.bottom < -vh * 0.5 || r.top > vh * 1.5) return;   // weit weg: nichts tun
      it.update(it.progress(r), r);
    });
  };
  const request = () => { if (!queued) { queued = true; requestAnimationFrame(frame); } };
  const measure = () => { vw = innerWidth; vh = innerHeight; items.forEach((it) => it.measure()); request(); };
  addEventListener('scroll', request, { passive: true });
  let rt = 0;
  addEventListener('resize', () => {
    // nur Breitenänderung oder deutliche Höhenänderung (Adressleiste auf dem Handy blendet ein/aus)
    if (innerWidth === vw && Math.abs(innerHeight - vh) < 120) { vh = innerHeight; request(); return; }
    clearTimeout(rt); rt = setTimeout(measure, 120);
  });
  measure();
  if (document.fonts) document.fonts.ready.then(measure);
  addEventListener('load', measure);
})();
