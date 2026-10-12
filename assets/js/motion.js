/* ZOLLER – Bewegung im Stil der Messtechnik
   Ergänzt main.js und scrollfx.js um Effekte, die aus der Welt der Einstell- und Messgeräte kommen:
   - Intro der Startseite (einmal pro Sitzung): Fadenkreuz, Logo, Messschieber öffnet sich (CSS, hier nur Überspringen)
   - Scan beim Hereinscrollen: eine gelbe Messlinie fährt über jedes Bild, darunter liegt es noch grau im Messraster
   - Messwert-Anzeige: kleine Überschriften (Kicker, Eyebrows, Footer) laufen wie eine Digitalanzeige auf ihren Text
   - Hero-Titel Buchstabe für Buchstabe, Text-Hervorhebungen mit gelbem Marker, technische Daten als Messprotokoll
   - Raster im Hintergrund dunkler Abschnitte (Parallaxe), Tiefe zwischen Bild und Text, Fortschrittsring am »Nach oben«-Knopf
   - Buttons: Beschriftung rollt beim Überfahren durch
   Läuft nach main.js und scrollfx.js. Bei »Bewegung reduzieren« bleibt alles stehen. */
(() => {
  'use strict';

  const root = document.documentElement;
  if (matchMedia('(prefers-reduced-motion: reduce)').matches || root.classList.contains('reduced-motion')) {
    root.classList.remove('intro-on');
    return;
  }
  const body = document.body;
  const $ = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => [...c.querySelectorAll(s)];
  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const ease = (t) => t * t * (3 - 2 * t);
  const fine = matchMedia('(hover: hover) and (pointer: fine)');
  let vh = innerHeight, vw = innerWidth;
  root.classList.add('motion');

  /* ------------------------------------------------------------- Intro */
  // Das Intro läuft als reine CSS-Animation (main.css, .intro). Scrollen, Klicken oder eine Taste überspringen es.
  const intro = $('div.intro');
  if (intro && root.classList.contains('intro-on')) {
    const done = () => { root.classList.remove('intro-on', 'intro-skip'); intro.remove(); };
    const skip = () => { if (!root.classList.contains('intro-on')) return; root.classList.add('intro-skip'); setTimeout(done, 450); };
    ['wheel', 'touchstart', 'keydown', 'pointerdown'].forEach((ev) => addEventListener(ev, skip, { once: true, passive: true }));
    intro.addEventListener('animationend', (e) => { if (e.animationName === 'jaw-bot') done(); });
    setTimeout(done, 3200);   // Sicherheitsnetz
  } else if (intro) intro.remove();
  const introDelay = root.classList.contains('intro-on') ? 1.55 : 0;

  /* ---------------------------------------------------- Buchstaben-Titel */
  // Hero-Titel (Seitenbühnen, Produktname, Startseite) steigen Buchstabe für Buchstabe aus einer Maske
  $$('.hero__title, .product-hero__name, .homefilm__panel[data-panel="0"] h1').forEach((h) => {
    if (h.closest('[data-words]')) return;
    let i = 0;
    const split = (node) => {
      if (node.nodeType === 3) {
        const frag = document.createDocumentFragment();
        node.textContent.split(/(\s+)/).forEach((part) => {
          if (!part) return;
          if (/^\s+$/.test(part)) { frag.append(' '); return; }
          const w = document.createElement('span'); w.className = 'cw';
          [...part].forEach((ch) => {
            const c = document.createElement('span'); c.className = 'cc'; c.textContent = ch; c.style.setProperty('--i', i++);
            w.append(c);
          });
          frag.append(w);
        });
        node.replaceWith(frag);
      } else if (node.nodeType === 1 && node.nodeName !== 'BR') [...node.childNodes].forEach(split);
    };
    const orig = h.innerHTML;
    const label = h.textContent.replace(/\s+/g, ' ').trim();
    [...h.childNodes].forEach(split);
    h.setAttribute('aria-label', label);
    $$('.cw', h).forEach((w) => w.setAttribute('aria-hidden', 'true'));
    const delay = introDelay + 0.18;
    h.style.setProperty('--cs-d', `${delay}s`);
    h.classList.add('c-split');
    // danach wieder normaler Text (Unterschneidung, Silbentrennung, Übersetzungstools)
    setTimeout(() => { h.innerHTML = orig; h.removeAttribute('aria-label'); h.classList.remove('c-split'); }, (delay + i * 0.024 + 1.15) * 1000);
  });

  /* ---------------------------------------------------- Messwert-Anzeige */
  // Kurze Großbuchstaben-Texte laufen wie eine Digitalanzeige: Zeichen flackern und rasten von links nach rechts ein
  const GLYPHS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789#%/+';
  const decode = (el) => {
    const txt = el.textContent;
    if (!txt.trim() || txt.length > 90) return;
    const chars = [...txt];
    const dur = Math.min(1100, 420 + chars.length * 16);
    const t0 = performance.now();
    let lastStep = -1;
    el.style.minHeight = el.offsetHeight + 'px';
    const step = (now) => {
      const p = clamp((now - t0) / dur);
      const s = Math.floor((now - t0) / 45);   // ~22 Wechsel pro Sekunde – wirkt wie eine mechanische Anzeige
      if (s !== lastStep || p >= 1) {
        lastStep = s;
        const fixed = Math.floor(ease(p) * chars.length);
        el.textContent = chars.map((ch, i) => (i < fixed || /\s|[·|•:.,\-–]/.test(ch) ? ch : GLYPHS[(Math.random() * GLYPHS.length) | 0])).join('');
      }
      if (p < 1) requestAnimationFrame(step);
      else { el.textContent = txt; el.style.minHeight = ''; }
    };
    requestAnimationFrame(step);
  };
  const decodeEls = $$('.hero__kicker, .product-hero__eyebrow, .eyebrow, .eyebrow-h, .footer-grid h3, .app-card__num, .wf-chapter__num, .card__tags')
    .filter((el) => !el.children.length || [...el.children].every((c) => !c.children.length && c.nodeName === 'SPAN'))
    .filter((el) => !el.closest('.mega, .mobile-nav, dialog'));
  if ('IntersectionObserver' in window) {
    const dio = new IntersectionObserver((entries) => entries.forEach((en) => {
      if (!en.isIntersecting) return;
      dio.unobserve(en.target);
      const el = en.target;
      const late = el.closest('.homefilm, .hero, .product-hero') ? introDelay * 1000 + 250 : 0;
      setTimeout(() => (el.children.length ? $$(':scope > span', el).forEach(decode) : decode(el)), late);
    }), { threshold: 0.6 });
    decodeEls.forEach((el) => dio.observe(el));
  }

  /* --------------------------------------------- Marker, Messprotokoll, Footer */
  const once = (els, cls, opts) => {
    if (!els.length) return;
    const io = new IntersectionObserver((entries) => entries.forEach((en) => {
      if (en.isIntersecting) { en.target.classList.add(cls); io.unobserve(en.target); }
    }), opts);
    els.forEach((el) => io.observe(el));
  };
  // gelber Marker unter hervorgehobenen Wörtern großer Texte
  once($$(':is(.large-text, .extra-large-text, .lead, .statement, .subheader) :is(strong, b)'), 'mk-in', { rootMargin: '0px 0px -18% 0px' });
  $$(':is(.large-text, .extra-large-text, .lead, .statement, .subheader) :is(strong, b)').forEach((s) => s.classList.add('mk'));
  // technische Daten: Zeilen laufen wie ein Messprotokoll ein, jede mit kurzem gelben Prüfstrich
  $$('.spec-table, .table-wrap table').forEach((t) => {
    $$('tr', t).forEach((tr, i) => tr.style.setProperty('--r', Math.min(i, 24)));
    t.classList.add('proto');
  });
  once($$('table.proto'), 'proto-in', { rootMargin: '0px 0px -12% 0px' });
  // Footer: Spalten und Links nacheinander
  const fgrid = $('.footer-grid');
  if (fgrid) {
    $$(':scope > *', fgrid).forEach((col, i) => {
      col.style.setProperty('--c', i);
      $$('li', col).forEach((li, j) => li.style.setProperty('--l', Math.min(j, 12)));
    });
    fgrid.classList.add('fg');
    once([fgrid], 'fg-in', { rootMargin: '0px 0px -10% 0px' });
  }

  /* ------------------------------------------------------- Buttons rollen */
  // Beschriftung rollt beim Überfahren nach oben weg, eine Kopie kommt von unten (nur reine Text-Buttons)
  if (fine.matches) $$('.btn').forEach((b) => {
    const t = b.textContent.trim();
    if (b.children.length || !t || t.length > 36 || b.closest('.subnav, .consent')) return;
    b.textContent = '';
    const roll = document.createElement('span'); roll.className = 'roll';
    const a = document.createElement('span'); a.textContent = t;
    const c = document.createElement('span'); c.textContent = t; c.setAttribute('aria-hidden', 'true');
    roll.append(a, c); b.append(roll);
  });

  /* ---------------------------------------------- Fortschrittsring »Nach oben« */
  const toTop = $('[data-to-top]');
  let ring = null;
  if (toTop) {
    toTop.insertAdjacentHTML('beforeend', '<svg class="to-top__ring" viewBox="0 0 48 48" aria-hidden="true"><circle cx="24" cy="24" r="22" pathLength="1"/></svg>');
    if (!(window.CSS && CSS.supports('animation-timeline: scroll()'))) ring = $('.to-top__ring circle', toTop);
  }

  /* ----------------------------------------------------- Scan der Bilder */
  // Jede Bildmaske (.reveal-mask) bekommt pro Bild eine Messlinie. Die Linie steht wie die Zeile eines Scanners fest bei 86 %
  // der Fensterhöhe, das Bild wandert beim Scrollen hindurch: darüber in Farbe, darunter noch grau im Messraster.
  const scans = $$('.reveal-mask').map((m) => {
    const frames = m.matches('.media-frame') ? [m] : $$('.media-frame', m);
    const list = (frames.length ? frames : [m]).map((f) => {
      const s = document.createElement('i'); s.className = 'scan'; s.setAttribute('aria-hidden', 'true');
      f.append(s);
      return s;
    });
    return { m, list, p: -1 };
  });

  /* ----------------------------------------- Messraster in dunklen Abschnitten */
  // Bei Abschnitten, die sich als Karte aufklappen (scrollfx.js), liegt das Raster in der Karte und wird mit ihr beschnitten.
  // Das Muster wiederholt sich alle 192 px – es wandert nur innerhalb einer Periode, die Maske bleibt stehen.
  const grids = $$('main > .bg-black, main > section.feature-dark, .site-footer').map((sec) => {
    if (getComputedStyle(sec).position === 'static') sec.style.position = 'relative';
    const g = document.createElement('i'); g.className = 'bp-grid'; g.setAttribute('aria-hidden', 'true');
    g.append(document.createElement('i'));
    const bg = $(':scope > .uf-bg', sec);
    bg ? bg.append(g) : sec.prepend(g);
    return { sec, g: g.firstChild, y: NaN };
  });

  /* --------------------------------------------- Tiefe zwischen Bild und Text */
  const depths = $$('.textmedia--right, .textmedia--left').map((tm) => ({ el: $(':scope > .textmedia__media', tm), y: NaN })).filter((d) => d.el);
  const depthOn = () => vw >= 1024;

  /* --------------------------------------------------------------- Schleife */
  let queued = false;
  const frame = () => {
    queued = false;
    // erst messen …
    const sR = scans.map((s) => s.m.getBoundingClientRect());
    const gR = grids.map((g) => g.sec.getBoundingClientRect());
    const dR = depthOn() ? depths.map((d) => d.el.getBoundingClientRect()) : null;
    const docH = root.scrollHeight;
    // … dann schreiben
    scans.forEach((s, i) => {
      const r = sR[i];
      const p = clamp((vh * 0.86 - r.top) / Math.max(1, r.height));   // feste Scannerebene bei 86 % Höhe: das Bild wandert hindurch
      if (Math.abs(p - s.p) < 0.002) return;
      s.p = p;
      s.list.forEach((el) => {
        el.style.transform = `translate3d(0, ${(p * 100).toFixed(2)}%, 0)`;
        el.classList.toggle('is-live', p > 0.004 && p < 0.996);
        el.hidden = p >= 0.999;
      });
    });
    grids.forEach((g, i) => {
      const r = gR[i];
      if (r.bottom < -200 || r.top > vh + 200) return;
      const y = ((r.top + r.height / 2 - vh / 2) * -0.16) % 192;
      if (Math.abs(y - g.y) < 0.3) return;
      g.y = y;
      g.g.style.transform = `translate3d(0, ${y.toFixed(1)}px, 0)`;
    });
    if (dR) depths.forEach((d, i) => {
      const r = dR[i];
      const near = r.bottom > -100 && r.top < vh + 100;
      if (near !== !!d.layer) { d.layer = near; d.el.style.willChange = near ? 'translate' : ''; }   // eigene Ebene nur solange sichtbar
      if (!near) return;
      const top = r.top - (d.y || 0);   // ohne die eigene Verschiebung messen, sonst schaukelt sich der Wert auf
      const y = clamp((top + r.height / 2 - vh / 2) / vh, -1, 1) * 46;
      if (Math.abs(y - d.y) < 0.3) return;
      d.y = y;
      d.el.style.translate = `0 ${y.toFixed(1)}px`;
    });
    if (ring) ring.style.strokeDashoffset = (1 - clamp(scrollY / Math.max(1, docH - vh))).toFixed(4);
  };
  const request = () => { if (!queued) { queued = true; requestAnimationFrame(frame); } };
  addEventListener('scroll', request, { passive: true });
  addEventListener('resize', () => {
    vh = innerHeight; vw = innerWidth;
    scans.forEach((s) => { s.p = -1; }); grids.forEach((g) => { g.y = NaN; });
    depths.forEach((d) => { if (!depthOn()) { d.el.style.translate = ''; d.el.style.willChange = ''; d.layer = false; d.y = NaN; } });
    request();
  });
  addEventListener('load', request);
  request();
})();
