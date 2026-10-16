/* ZOLLER – Seite »Das System« (Abschnitte aus build.py render_system)
   Leitmotiv Kreis, alle Übergänge hängen am Scrollen:
   - Hero: Messring mit umlaufendem Lichtpunkt; beim Scrollen fliegt man in die Nabe, die sich gelb füllt und den
     ganzen Bildschirm einnimmt – darunter beginnt das gelbe Statement ohne Kante
   - Systemring: wächst als dunkler Kreis um die Nabe z.One + TMS aus dem Gelb; danach klebt der Ring, und die
     Erzählung daneben schaltet Kapitel für Kapitel Stationen und Leitungen ein, Datenpunkte laufen über die Leitungen
   - Wertesystem: jeder Wert zeichnet sein Viertel des Messrings, zusammen ein Kreis
   - Smart Factory: das Bild öffnet sich als Iris aus dem Schwarz, Messskala und vier gelbe Viertel am Rand
   Klick auf eine Station springt zu ihrer Karte (auch ohne Bewegung). Bei »Bewegung reduzieren« steht alles fertig da. */
(() => {
  'use strict';

  const root = document.documentElement;
  const $ = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => [...c.querySelectorAll(s)];
  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const smooth = (a, b, v) => { const t = clamp((v - a) / (b - a)); return t * t * (3 - 2 * t); };
  const lerp = (a, b, t) => a + (b - a) * t;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches || root.classList.contains('reduced-motion');
  const portrait = () => matchMedia('(max-width: 1023px), (orientation: portrait) and (max-width: 1100px)').matches;
  let vw = innerWidth, vh = innerHeight;

  const map = $('[data-sys="map"]');
  const scrollToY = (y) => (window.__lenis ? window.__lenis.scrollTo(y, { duration: 1.4 }) : window.scrollTo({ top: y, behavior: reduced ? 'auto' : 'smooth' }));

  /* ------------------------------------------- Station antippen → Karte */
  // Lesezeile: dort wird ein Kapitel aktiv (Querformat Bildmitte, Hochformat unter dem klebenden Ring)
  const stage = map && $('.sys-map__stage', map);
  const readLine = () => (portrait() && stage ? Math.min(vh * 0.8, stage.getBoundingClientRect().height + (vh - stage.getBoundingClientRect().height) * 0.4) : vh * 0.55);
  if (map) {
    map.addEventListener('click', (e) => {
      const st = e.target.closest('.sys-st');
      if (!st) return;
      const card = document.getElementById('sys-' + st.dataset.st);
      if (!card) return;
      e.preventDefault();
      const phase = card.closest('.sys-phase');
      const r = (phase || card).getBoundingClientRect();
      const target = scrollY + r.top + Math.min(r.height, vh) * 0.5 - readLine();
      scrollToY(Math.max(0, target));
      $$('.sys-card.is-hl', map).forEach((c) => c.classList.remove('is-hl'));
      card.classList.add('is-hl');
      clearTimeout(card._hl);
      card._hl = setTimeout(() => card.classList.remove('is-hl'), 2600);
      history.replaceState(null, '', '#sys-' + st.dataset.st);
    });
  }
  if (reduced) return;

  const items = [];

  /* -------------------------------------------------------------- Hero */
  const hero = $('[data-sys="hero"]');
  if (hero) {
    const box = $('.sys-hero__ringbox', hero), fill = $('.sys-hero__fill', hero), copy = $('.sys-hero__copy', hero);
    let bx = 0, by = 0, size = 1, last = -1;
    items.push({
      sec: hero,
      measure() {
        box.style.transform = '';
        const r = box.getBoundingClientRect(), s = hero.firstElementChild.getBoundingClientRect();
        bx = r.left - s.left + r.width / 2; by = r.top - s.top + r.height / 2; size = r.width;
        last = -1;
      },
      progress(r) { return clamp(-r.top / Math.max(1, r.height - vh)); },
      update(p) {
        if (Math.abs(p - last) < 0.0005) return;
        last = p;
        // Text geht nach oben weg
        const c = smooth(0, 0.3, p);
        copy.style.opacity = (1 - c).toFixed(3);
        copy.style.transform = c > 0 ? `translate3d(0, ${(-c * 90).toFixed(1)}px, 0)` : '';
        // Ring wandert in die Bildmitte und wächst, bis die Nabe den Bildschirm füllt
        const m = smooth(0, 0.55, p);
        const cx = lerp(bx, vw / 2, m), cy = lerp(by, vh / 2, m);
        const coreR = size * 92 / 1000;
        const S = Math.hypot(vw, vh) / 2 / coreR * 1.04;
        const g = smooth(0.06, 1, p);
        const sc = Math.pow(S, g * g);
        box.style.transform = `translate3d(${(cx - bx).toFixed(1)}px, ${(cy - by).toFixed(1)}px, 0) scale(${sc.toFixed(4)})`;
        box.style.opacity = (1 - smooth(0.78, 0.96, p)).toFixed(3);
        box.style.visibility = p > 0.97 ? 'hidden' : '';
        // die Nabe füllt sich gelb und wächst mit
        const f = smooth(0.1, 0.42, p);
        const R = coreR * sc * f;
        fill.style.clipPath = p >= 0.995 ? 'none' : `circle(${R.toFixed(1)}px at ${cx.toFixed(1)}px ${cy.toFixed(1)}px)`;
      },
    });
  }

  /* -------------------------------------------------------- Systemring */
  if (map) {
    const veil = $('.sys-map__veil', map), board = $('.sys-map__board', map), svg = $('.sys-map__svg', map);
    const phases = $$('.sys-phase', map);
    const stations = $$('.sys-st', map);
    const lines = $$('.sys-line', map);
    const packG = $('.sys-packets', map);
    const phaseOf = {};
    stations.forEach((s) => { phaseOf[s.dataset.st] = +s.dataset.phase; });
    const NS = 'http://www.w3.org/2000/svg';
    // Datenpunkte: je Leitung zwei (aktives Kapitel) bzw. einer (schon erzählte Kapitel)
    const tracks = lines.map((l) => {
      const len = l.getTotalLength();
      const dots = [0, 1].map(() => {
        const c = document.createElementNS(NS, 'circle');
        c.setAttribute('r', '5'); c.setAttribute('class', 'sys-packet'); c.style.opacity = '0';
        packG.append(c);
        return c;
      });
      return { l, len, dots, ph: phaseOf[l.dataset.st] || 0, seed: Math.random() };
    });
    map.classList.add('is-live', 'is-entering');
    let cur = -2, entering = true, lastE = -1;

    const setPhase = (k, done) => {
      if (k === cur) return;
      cur = k;
      phases.forEach((p) => p.classList.toggle('is-on', +p.dataset.phase === k));
      stations.forEach((s) => {
        const ph = +s.dataset.phase;
        s.classList.toggle('is-on', ph === k);
        s.classList.toggle('is-done', done || (k > 0 && ph < k));
      });
      lines.forEach((l) => {
        const ph = phaseOf[l.dataset.st] || 0;
        l.classList.toggle('is-on', ph === k);
        l.classList.toggle('is-done', done || (k > 0 && ph < k));
      });
    };

    let inView = false, raf = 0, t0 = performance.now();
    const animate = (now) => {
      raf = 0;
      if (!inView) return;
      const t = (now - t0) / 1000;
      tracks.forEach((tr) => {
        const on = tr.ph === cur, done = cur === 99 || (cur > 0 && tr.ph < cur);
        tr.dots.forEach((c, i) => {
          const show = on || (done && i === 0);
          if (!show) { if (c.style.opacity !== '0') c.style.opacity = '0'; return; }
          const speed = on ? 210 : 120;   // Einheiten des viewBox pro Sekunde
          const dur = Math.max(0.9, tr.len / speed) + 0.6;
          const u = ((t / dur) + tr.seed + i * 0.5) % 1;
          const d = clamp(u * dur * speed / tr.len);
          const pt = tr.l.getPointAtLength(d * tr.len);
          c.setAttribute('cx', pt.x.toFixed(1)); c.setAttribute('cy', pt.y.toFixed(1));
          c.setAttribute('class', on ? 'sys-packet' : 'sys-packet sys-packet--dim');
          c.style.opacity = (Math.min(1, d * 6, (1 - d) * 6) * (on ? 1 : 0.55)).toFixed(3);
        });
      });
      raf = requestAnimationFrame(animate);
    };
    if ('IntersectionObserver' in window) {
      new IntersectionObserver((en) => {
        inView = en[0].isIntersecting;
        if (inView && !raf) raf = requestAnimationFrame(animate);
      }, { rootMargin: '10% 0px' }).observe(map);
    }

    items.push({
      sec: map,
      measure() { lastE = -1; },
      progress(r) { return r; },
      update(r) {
        // 1) Eintritt: dunkler Kreis um die Nabe wächst aus dem Gelb. Solange die Oberkante des Abschnitts im Bild ist,
        //    bleibt der Kreis unter ihr (sonst schnitte die Kante ihn gerade ab – auf dem Handy liegt die Nabe nah daran)
        const e = clamp((vh - r.top) / (vh * 1.15));
        if (e < 1 || entering) {
          if (Math.abs(e - lastE) > 0.0005) {
            lastE = e;
            const b = board.getBoundingClientRect();
            const cx = b.left + b.width / 2 - r.left, cy = b.top + b.height / 2 - r.top;
            const top = Math.max(0, -r.top), bot = -r.top + vh;
            const far = Math.max(Math.hypot(cx, cy - top), Math.hypot(vw - cx, cy - top), Math.hypot(cx, bot - cy), Math.hypot(vw - cx, bot - cy));
            const R = Math.min(smooth(0, 1, e) * far * 1.02, cy + Math.max(0, -r.top) * 5);
            const covered = e >= 1 && R >= far;
            veil.style.clipPath = covered ? 'none' : `circle(${Math.max(0, R).toFixed(1)}px at ${cx.toFixed(1)}px ${cy.toFixed(1)}px)`;
            if (covered === entering) { entering = !covered; map.classList.toggle('is-entering', entering); }
          }
        }
        // 2) Kapitel an der Lesezeile
        const line = readLine();
        let k = -1;
        phases.forEach((p) => { if (p.getBoundingClientRect().top < line) k = +p.dataset.phase; });
        const lastP = phases[phases.length - 1];
        const done = !!lastP && lastP.getBoundingClientRect().bottom < line - vh * 0.08;
        setPhase(done ? 99 : k, done);
      },
    });
  }

  /* ------------------------------------------------------ Wertesystem */
  const values = $('[data-sys="values"]');
  if (values) {
    const grid = $('.sys-values__grid', values);
    const dials = $$('.sys-value', values).map((v) => {
      const arc = $('.sys-value__arc', v), dot = $('.sys-value__dotg', v);
      return { arc, dot, a0: +v.dataset.a0, q: parseFloat(arc.getAttribute('stroke-dasharray')) };
    });
    let last = -1;
    items.push({
      sec: values,
      measure() { last = -1; },
      progress() {
        const g = grid.getBoundingClientRect();
        return clamp((vh * 0.92 - g.top) / (vh * 0.62));
      },
      update(p) {
        if (Math.abs(p - last) < 0.0005) return;
        last = p;
        const step = portrait() ? 0.07 : 0.13;
        dials.forEach((d, i) => {
          const v = smooth(i * step, i * step + 0.5, p);
          d.arc.style.strokeDashoffset = (d.q * (1 - v)).toFixed(2);
          d.dot.style.transform = `rotate(${(d.a0 + 90 * v).toFixed(2)}deg)`;
          d.dot.style.opacity = smooth(0, 0.08, v + (v > 0 ? 0.08 : 0)).toFixed(3);
        });
      },
    });
  }

  /* ----------------------------------------------- Smart Factory (Iris) */
  const iris = $('[data-sys="iris"]');
  if (iris) {
    const media = $('.sys-iris__media', iris), img = $('.sys-iris__media img', iris), ring = $('.sys-iris__ring', iris);
    const [ticks, quad] = ring.querySelectorAll('circle');
    let last = -1;
    items.push({
      sec: iris,
      measure() { last = -1; },
      progress(r) { return clamp((vh * 0.3 - r.top) / (vh * 0.9)); },
      update(p, r) {
        if (Math.abs(p - last) < 0.0004 && r.top > -vh) return;
        last = p;
        const st = media.parentElement.getBoundingClientRect();
        const cx = st.width / 2, cy = st.height / 2;
        const r0 = Math.min(vw, vh) * 0.11, R = Math.hypot(st.width, st.height) / 2 + 30;
        const o = smooth(0, 1, p);
        const rad = lerp(r0, R, Math.pow(o, 1.6));
        media.style.clipPath = p >= 1 ? 'none' : `circle(${rad.toFixed(1)}px at 50% 50%)`;
        if (img) img.style.transform = `scale(${(1.14 - 0.14 * o).toFixed(4)})`;
        const ro = 1 - smooth(0.78, 0.97, p);
        ring.style.opacity = ro.toFixed(3);
        if (ro > 0) {
          const rt = rad + 14, rq = rad + 4;
          const ct = 2 * Math.PI * rt, cq = 2 * Math.PI * rq;
          for (const c of [ticks, quad]) { c.setAttribute('cx', cx.toFixed(1)); c.setAttribute('cy', cy.toFixed(1)); }
          ticks.setAttribute('r', rt.toFixed(1));
          ticks.style.strokeDasharray = `1.4 ${Math.max(0.5, ct / 120 - 1.4).toFixed(2)}`;
          quad.setAttribute('r', rq.toFixed(1));
          // vier gelbe Viertel (wie im Wertesystem), drehen sich beim Öffnen um eine Achtelumdrehung
          quad.style.strokeDasharray = `${(cq / 4 - 14).toFixed(1)} 14`;
          quad.style.strokeDashoffset = (-cq * (0.125 * o - 0.25) + 7).toFixed(1);
        }
      },
    });
  }

  /* --------------------------------------------------------- Schleife */
  let queued = false;
  const frame = () => {
    queued = false;
    const rects = items.map((it) => it.sec.getBoundingClientRect());
    items.forEach((it, i) => {
      const r = rects[i];
      if (r.bottom < -vh * 0.5 || r.top > vh * 1.5) return;
      it.update(it.progress(r), r);
    });
  };
  const request = () => { if (!queued) { queued = true; requestAnimationFrame(frame); } };
  const measure = () => { vw = innerWidth; vh = innerHeight; items.forEach((it) => it.measure()); request(); };
  addEventListener('scroll', request, { passive: true });
  let rt = 0;
  addEventListener('resize', () => {
    if (innerWidth === vw && Math.abs(innerHeight - vh) < 120) { vh = innerHeight; request(); return; }
    clearTimeout(rt); rt = setTimeout(measure, 120);
  });
  measure();
  if (document.fonts) document.fonts.ready.then(measure);
  addEventListener('load', measure);
})();
