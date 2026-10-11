/* ZOLLER – Bewegung im Stil der Messtechnik
   Ergänzt main.js und scrollfx.js um Effekte, die aus der Welt der Einstell- und Messgeräte kommen:
   - Intro der Startseite (einmal pro Sitzung): Fadenkreuz, Logo, Messschieber öffnet sich (CSS, hier nur Überspringen)
   - Fadenkreuz-Cursor (Desktop mit Maus): Messrahmen rastet um Buttons und Karten ein, über Bildern Fadenkreuz mit X/Y-Anzeige
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

  /* ======================================================= Fadenkreuz-Cursor */
  // Nur mit Maus/Trackpad. Ein Punkt folgt exakt, vier Ecken (Messrahmen) folgen weich.
  // Über Links, Buttons und Karten rastet der Rahmen um das Element ein; über Bildern wird er zum Fadenkreuz mit X/Y-Anzeige
  // in Millimetern ab der linken oberen Bildecke. In Eingabefeldern, 3D-Ansichten und offenen Dialogen bleibt der normale Zeiger.
  if (!fine.matches) return;
  const cur = document.createElement('div');
  cur.className = 'cur'; cur.setAttribute('aria-hidden', 'true');
  cur.innerHTML = '<i class="cur__h"></i><i class="cur__v"></i><b class="cur__frame"><i></i><i></i><i></i><i></i></b><i class="cur__dot"></i><span class="cur__read"></span>';
  body.append(cur);
  const frameEl = $('.cur__frame', cur), dot = $('.cur__dot', cur), hl = $('.cur__h', cur), vl = $('.cur__v', cur), read = $('.cur__read', cur);
  root.classList.add('has-cur');

  const LOCK = 'a, button, summary, label[for], select, [role="button"], .product-card, .card, .download, .location, .hotspot__btn';
  const NATIVE = 'input, textarea, select, [contenteditable], canvas, iframe, video[controls], .no-cur';
  const MEDIA = '.media-frame, .immersive__media, .hero__slides, .product-hero__img, .card__media, .bento__tile, .value-tile';
  const PX_MM = 25.4 / 96;
  let mx = -100, my = -100, fx = -100, fy = -100, fw = 34, fh = 34, tx = -100, ty = -100, tw = 34, th = 34;
  let target = null, mode = '', media = null, dark = false, visible = false, down = false, running = false;
  // Hell oder dunkel entscheidet der Bereich (Abschnitt, Kopf, Fuß), nicht das Element unter dem Zeiger – ein gelber Button
  // in einem schwarzen Abschnitt bekommt einen gelben Rahmen
  const ZONE = '.site-header, .mega, .site-footer, .search-overlay, .mobile-nav, main > *, .homefilm, .hero, .immersive, .worldflight, .product-hero, .ev-hero';
  const darkCache = new WeakMap();
  const lum = (c) => (0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]) / 255;
  const bgc = (n) => { const c = getComputedStyle(n).backgroundColor.match(/[\d.]+/g); return c && (c.length < 4 || +c[3] > 0.5) ? c.map(Number) : null; };
  const isDark = (el) => {
    let z = el.closest(ZONE);
    while (z && z.parentElement && z.parentElement.closest(ZONE) && !bgc(z) && !$(':scope > .uf-bg', z)) z = z.parentElement.closest(ZONE);
    if (!z) z = body;
    if (darkCache.has(z)) return darkCache.get(z);
    const uf = $(':scope > .uf-bg', z);
    const c = bgc(uf || z);
    const d = c ? lum(c) < 0.45 : z.matches('.hero:not(.hero--light), .homefilm, .immersive, .worldflight, .ev-hero');
    darkCache.set(z, d);
    return d;
  };
  const setMode = (m) => { if (m !== mode) { cur.dataset.mode = mode = m; } };

  const pick = (el) => {
    if (!el || el.nodeType !== 1) return;
    if (el.closest(NATIVE) || root.classList.contains('cur-off')) { setMode('native'); target = null; media = null; return; }
    const lock = el.closest(LOCK);
    const r = lock && lock.getBoundingClientRect();
    if (lock && r.width < vw * 0.72 && r.height < vh * 0.7) { target = lock; media = null; setMode('lock'); }
    else {
      target = null;
      const m = el.closest(MEDIA);
      media = m && !el.closest('a, button') ? m : null;
      setMode(media ? 'measure' : lock ? 'grow' : '');
    }
    const d = isDark(el);
    if (d !== dark) { dark = d; cur.classList.toggle('is-dark', d); }
  };

  const tick = () => {
    running = false;
    // Ziel des Rahmens
    if (mode === 'lock' && target && target.isConnected) {
      const r = target.getBoundingClientRect();
      const pad = r.height < 64 ? 6 : 10;
      tw = r.width + pad * 2; th = r.height + pad * 2; tx = r.left + r.width / 2; ty = r.top + r.height / 2;
    } else {
      const s = mode === 'grow' ? 54 : mode === 'measure' ? 26 : 34;
      tw = th = s; tx = mx; ty = my;
    }
    const k = mode === 'lock' ? 0.22 : 0.3;
    fx += (tx - fx) * k; fy += (ty - fy) * k; fw += (tw - fw) * 0.22; fh += (th - fh) * 0.22;
    const sc = down ? 0.86 : 1;
    frameEl.style.transform = `translate3d(${(fx - fw / 2).toFixed(1)}px, ${(fy - fh / 2).toFixed(1)}px, 0) scale(${sc})`;
    frameEl.style.width = fw.toFixed(1) + 'px'; frameEl.style.height = fh.toFixed(1) + 'px';
    dot.style.transform = `translate3d(${mx}px, ${my}px, 0)`;
    if (mode === 'measure' && media) {
      const r = media.getBoundingClientRect();
      hl.style.transform = `translate3d(${r.left.toFixed(1)}px, ${my}px, 0)`; hl.style.width = r.width.toFixed(1) + 'px';
      vl.style.transform = `translate3d(${mx}px, ${r.top.toFixed(1)}px, 0)`; vl.style.height = r.height.toFixed(1) + 'px';
      const x = (mx - r.left) * PX_MM, y = (my - r.top) * PX_MM;
      read.textContent = `X ${x.toFixed(2)}  Y ${y.toFixed(2)}`;
      read.style.transform = `translate3d(${mx + 16}px, ${my + 16}px, 0)`;
    }
    if (Math.abs(tx - fx) > 0.2 || Math.abs(ty - fy) > 0.2 || Math.abs(tw - fw) > 0.2 || Math.abs(th - fh) > 0.2) loop();
  };
  const loop = () => { if (!running) { running = true; requestAnimationFrame(tick); } };

  addEventListener('pointermove', (e) => {
    if (e.pointerType !== 'mouse') { if (visible) { visible = false; cur.classList.remove('is-on'); } return; }
    mx = e.clientX; my = e.clientY;
    if (!visible) { visible = true; fx = mx; fy = my; cur.classList.add('is-on'); pick(e.target); }
    loop();
  }, { passive: true });
  addEventListener('pointerover', (e) => { if (e.pointerType === 'mouse') { pick(e.target); loop(); } }, { passive: true });
  document.addEventListener('mouseout', (e) => { if (!e.relatedTarget) { visible = false; cur.classList.remove('is-on'); } });
  // Modale Dialoge liegen in der obersten Ebene über allem – dort übernimmt wieder der normale Zeiger
  const dialogs = $$('dialog');
  const syncDialogs = () => root.classList.toggle('cur-off', dialogs.some((d) => d.open));
  const dmo = new MutationObserver(syncDialogs);
  dialogs.forEach((d) => dmo.observe(d, { attributes: true, attributeFilter: ['open'] }));
  addEventListener('pointerdown', (e) => { if (e.pointerType === 'mouse') { down = true; loop(); } }, { passive: true });
  addEventListener('pointerup', () => { down = false; loop(); }, { passive: true });
  // beim Scrollen wandert das Element unter dem Zeiger weg: neu bestimmen (gedrosselt) und den Rahmen nachführen
  let sT = 0;
  addEventListener('scroll', () => {
    if (!visible) return;
    loop();
    if (!sT) sT = setTimeout(() => { sT = 0; pick(document.elementFromPoint(mx, my)); loop(); }, 90);
  }, { passive: true });
  fine.addEventListener?.('change', () => { if (!fine.matches) { cur.remove(); root.classList.remove('has-cur'); } });
})();
