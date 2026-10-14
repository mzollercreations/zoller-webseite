/* AR-/3D-Ansicht der Produktseiten (build.py r_ar, Texte content/ar.json, Modelle tools/ar_models.py).
   - iPhone/iPad: AR Quick Look direkt mit der USDZ-Datei (Banner »Jetzt anfragen« führt zum Kontakt)
   - Android: im Abschnitt WebXR über model-viewer (sonst Scene Viewer), sonst Scene Viewer direkt
   - Rechner: drehbares CAD-Modell mit Maßlinien, QR-Code fürs Handy
   - AR-Knöpfe außerhalb des Abschnitts (Produktkopf, AR-Abzeichen der Produktkarten, AR in der Produktnavigation,
     build.py ar_launch → data-ar-launch): auf Handy/Tablet sofort AR, ohne Umweg über die Produktseite
   model-viewer (assets/vendor, enthält three.js) wird erst geladen, wenn der Abschnitt in die Nähe kommt. */
(function () {
  'use strict';
  const secs = [...document.querySelectorAll('[data-ar]')];
  if (!secs.length && !document.querySelector('[data-ar-launch]')) return;

  const ua = navigator.userAgent;
  const IOS = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const probe = document.createElement('a');
  // Safari meldet rel="ar"; Chrome, Firefox, Edge … auf iOS (WKWebView) nicht, öffnen Quick Look aber ebenso (wie model-viewer)
  const QL = IOS && (!!(probe.relList && probe.relList.supports && probe.relList.supports('ar')) ||
    /CriOS\/|EdgiOS\/|FxiOS\/|GSA\/|DuckDuckGo\//.test(ua));
  const ANDROID = /Android/i.test(ua);
  const MOBILE = QL || ANDROID;
  const FINE = matchMedia('(pointer: fine)').matches && !matchMedia('(pointer: coarse)').matches;
  const REDUCED = document.documentElement.classList.contains('reduced-motion');
  const ORBIT = '-28deg 74deg auto';
  const ORBIT_IN = '-62deg 78deg auto';
  const here = () => location.href.split('#')[0];

  let mvLoad = null;
  function loadMV(src, draco) {
    if (!mvLoad) {
      mvLoad = new Promise((ok, fail) => {
        self.ModelViewerElement = Object.assign(self.ModelViewerElement || {}, { dracoDecoderLocation: draco });
        const s = document.createElement('script');
        s.type = 'module'; s.src = src;
        s.onerror = fail;
        document.head.appendChild(s);
        customElements.whenDefined('model-viewer').then(ok);
      });
    }
    return mvLoad;
  }

  // ---------------------------------------------------------------- AR starten ohne model-viewer
  // m: Modell (usdz, glb, name, full), o: Banner und Ziele (cta, contact)
  function quickLookUrl(m, o) {
    const u = new URL(m.usdz, location.href);
    const enc = encodeURIComponent;
    u.hash = `callToAction=${enc(o.cta)}&checkoutTitle=${enc(m.name)}&checkoutSubtitle=${enc(m.full)}&allowsContentScaling=0`;
    return u.href;
  }

  let qlAnchor = null, qlContact = '';
  function quickLook(m, o) {
    // <a rel="ar"> mit <img> als erstem Kind, Klick noch in der Nutzergeste (kein await davor)
    if (!qlAnchor) {
      qlAnchor = document.createElement('a');
      qlAnchor.rel = 'ar';
      qlAnchor.style.display = 'none';
      qlAnchor.appendChild(document.createElement('img'));
      qlAnchor.addEventListener('message', e => { if (e.data === '_apple_ar_quicklook_button_tapped' && qlContact) location.href = qlContact; });
      document.body.appendChild(qlAnchor);
    }
    qlContact = o.contact;
    qlAnchor.href = quickLookUrl(m, o);
    qlAnchor.click();
  }

  // page: Produktseite für »zurück« aus Scene Viewer bzw. ohne ARCore (dann deren 3D-Ansicht)
  function sceneViewer(m, page) {
    const glb = new URL(m.glb, location.href);
    glb.search = '';
    const back = new URL(page || here(), location.href).href.split('#')[0];
    const p = new URLSearchParams({ mode: 'ar_preferred', resizable: 'false', disable_occlusion: 'true', title: m.name, link: back });
    location.href = `intent://arvr.google.com/scene-viewer/1.2?${p}&file=${encodeURIComponent(glb.href)}` +
      `#Intent;scheme=https;package=com.google.android.googlequicksearchbox;action=android.intent.action.VIEW;` +
      `S.browser_fallback_url=${encodeURIComponent(back + '#ar')};end;`;
  }

  function startAR(st) {
    if (QL) return quickLook(st.model, st.cfg);
    if (st.mv && st.mv.canActivateAR) return st.mv.activateAR();
    if (ANDROID) return sceneViewer(st.model);
  }

  // ---------------------------------------------------------------- Maßlinien
  const SVGNS = 'http://www.w3.org/2000/svg';
  const DIMS = ['w', 'd', 'h'];

  function dimSetup(st) {
    const svg = document.createElementNS(SVGNS, 'svg');
    svg.setAttribute('class', 'ar__dimlines');
    svg.setAttribute('aria-hidden', 'true');
    st.lines = {};
    st.labels = {};
    for (const k of DIMS) {
      const g = document.createElementNS(SVGNS, 'g');
      g.innerHTML = '<line class="ar__dimline"/><line class="ar__dimtick"/><line class="ar__dimtick"/>';
      svg.appendChild(g);
      st.lines[k] = g;
    }
    st.stage.appendChild(svg);
    st.svg = svg;
    for (const k of DIMS) {
      for (const end of ['a', 'b']) {
        const p = document.createElement('div');
        p.slot = `hotspot-dim-${k}${end}`;
        p.className = 'ar__dimpt';
        p.dataset.position = '0m 0m 0m';
        st.mv.appendChild(p);
      }
      const lab = document.createElement('span');
      lab.className = `ar__dimlabel ar__dimlabel--${k}`;
      lab.setAttribute('aria-hidden', 'true');
      st.stage.appendChild(lab);
      st.labels[k] = lab;
    }
  }

  function dimPlace(st) {
    // Kanten zur Kamera hin: Breite vorn unten, Tiefe an der sichtbaren Seite unten, Höhe an der vorderen sichtbaren Ecke
    const [W, D, H] = st.model.mm.map(v => v / 1000);
    const o = 0.06;
    const orbit = st.mv.getCameraOrbit();
    const s = Math.sin(orbit.theta) >= 0 ? 1 : -1;
    const c = Math.cos(orbit.theta) >= 0 ? 1 : -1;
    const key = `${st.model.id}${s}${c}`;
    if (key === st.dimKey) return;
    st.dimKey = key;
    const x = s * (W / 2 + o), z = c * (D / 2 + o);
    const pts = {
      w: [[-W / 2, 0, z], [W / 2, 0, z]],
      d: [[x, 0, -D / 2], [x, 0, D / 2]],
      h: [[x, 0, z], [x, H, z]],
    };
    for (const k of DIMS) {
      const [a, b] = pts[k];
      const fmt = p => p.map(v => v.toFixed(4) + 'm').join(' ');
      st.mv.updateHotspot({ name: `hotspot-dim-${k}a`, position: fmt(a) });
      st.mv.updateHotspot({ name: `hotspot-dim-${k}b`, position: fmt(b) });
    }
  }

  function dimDraw(st) {
    if (!st.dimsOn || !st.mv || !st.mv.loaded) return;
    dimPlace(st);
    for (const k of DIMS) {
      const a = st.mv.queryHotspot(`hotspot-dim-${k}a`), b = st.mv.queryHotspot(`hotspot-dim-${k}b`);
      const [ln, t1, t2] = st.lines[k].children;
      const lab = st.labels[k];
      if (!a || !b) { st.lines[k].style.display = lab.style.display = 'none'; continue; }
      st.lines[k].style.display = lab.style.display = '';
      const A = a.canvasPosition, B = b.canvasPosition;
      const dx = B.x - A.x, dy = B.y - A.y, len = Math.hypot(dx, dy) || 1;
      const nx = -dy / len * 6, ny = dx / len * 6;
      const set = (el, x1, y1, x2, y2) => { el.setAttribute('x1', x1); el.setAttribute('y1', y1); el.setAttribute('x2', x2); el.setAttribute('y2', y2); };
      set(ln, A.x, A.y, B.x, B.y);
      set(t1, A.x - nx, A.y - ny, A.x + nx, A.y + ny);
      set(t2, B.x - nx, B.y - ny, B.x + nx, B.y + ny);
      lab.style.transform = `translate(${(A.x + B.x) / 2}px, ${(A.y + B.y) / 2}px) translate(-50%, -50%)`;
    }
  }

  function dimLoop(st) {
    if (st.dimRaf) return;
    const tick = () => {
      st.dimRaf = st.dimsOn ? requestAnimationFrame(tick) : 0;
      dimDraw(st);
    };
    st.dimRaf = requestAnimationFrame(tick);
  }

  function dimLabels(st) {
    const m = st.model;
    for (const k of DIMS) {
      if (st.labels && st.labels[k]) st.labels[k].textContent = m['lab_' + k] || m[k];
    }
  }

  function setDims(st, on) {
    st.dimsOn = on;
    st.stage.classList.toggle('show-dims', on);
    const b = st.sec.querySelector('[data-ar-tool="dims"]');
    if (b) b.setAttribute('aria-pressed', on ? 'true' : 'false');
    if (on) { st.dimKey = ''; dimLabels(st); dimLoop(st); }
  }

  // ---------------------------------------------------------------- Kamera
  function zoomBy(st, f) {
    const mv = st.mv;
    if (!mv) return;
    const o = mv.getCameraOrbit();
    const min = st.r0 * 0.35, max = st.r0 * 1.6;
    mv.cameraOrbit = `${o.theta}rad ${o.phi}rad ${Math.min(max, Math.max(min, o.radius * f))}m`;
    stopIntro(st);
  }

  function stopIntro(st) {
    if (st.hint) st.hint.hidden = true;
  }

  // ---------------------------------------------------------------- Modell wählen
  function applyModel(st, m) {
    st.model = m;
    const set = (k, v) => { const el = st.sec.querySelector(`[data-ar-out="${k}"]`); if (el) el.textContent = v; };
    for (const k of ['w', 'd', 'h', 'area', 'w2', 'd2', 'h2', 'area2', 'title']) set(k, m[k]);
    st.stage.setAttribute('aria-label', m.label);
    st.poster.src = m.poster;
    st.poster.alt = m.label;
    st.sec.querySelectorAll('[data-ar-model]').forEach(b => b.setAttribute('aria-checked', b.dataset.arModel === m.id ? 'true' : 'false'));
    if (st.mv) {
      // das bisherige Modell bleibt stehen, bis das neue geladen ist (model-viewer tauscht dann)
      st.mv.src = m.glb;
      st.mv.iosSrc = quickLookUrl(m, st.cfg);
      st.mv.alt = m.label;
      st.dimKey = '';
      dimLabels(st);
    }
  }

  // ---------------------------------------------------------------- QR-Code (Rechner)
  function showQR(st) {
    const box = st.sec.querySelector('[data-ar-qr]');
    if (!box || MOBILE) return;
    const draw = () => {
      if (typeof qrcode !== 'function') return;
      const q = qrcode(0, 'M');
      q.addData(here() + '#ar');
      q.make();
      st.sec.querySelector('[data-ar-qrcode]').innerHTML = q.createSvgTag({ cellSize: 4, margin: 0, scalable: true });
      box.hidden = false;
    };
    if (typeof qrcode === 'function') return draw();
    let s = document.querySelector('script[data-ar-qrlib]');
    if (!s) {
      s = document.createElement('script');
      s.src = st.cfg.qr;
      s.dataset.arQrlib = '';
      document.head.appendChild(s);
    }
    s.addEventListener('load', draw);
  }

  function msg(st, text) {
    const el = st.sec.querySelector('[data-ar-msg]');
    if (!el) return;
    el.textContent = text || '';
    el.hidden = !text;
  }

  // ---------------------------------------------------------------- 3D-Ansicht aufbauen
  function build(st) {
    const { cfg, stage } = st;
    const loading = stage.querySelector('[data-ar-loading]');
    const slow = setTimeout(() => { if (!stage.classList.contains('is-loaded')) loading.hidden = false; }, 350);
    loadMV(cfg.mv, cfg.draco).then(() => {
      const mv = st.mv = document.createElement('model-viewer');
      const attrs = {
        src: st.model.glb, 'ios-src': quickLookUrl(st.model, st.cfg), alt: st.model.label,
        ar: '', 'ar-modes': 'webxr scene-viewer quick-look', 'ar-scale': 'fixed', 'ar-placement': 'floor',
        'camera-controls': '', 'touch-action': 'pan-y', 'interaction-prompt': 'none',
        'environment-image': 'legacy', exposure: '1.1', 'tone-mapping': 'neutral',
        'shadow-intensity': '1', 'shadow-softness': '0.85',
        'camera-orbit': REDUCED ? ORBIT : ORBIT_IN, 'min-camera-orbit': 'auto 18deg auto', 'max-camera-orbit': 'auto 92deg auto',
        'interpolation-decay': '110', loading: 'eager',
      };
      if (FINE) attrs['disable-zoom'] = '';
      for (const [k, v] of Object.entries(attrs)) mv.setAttribute(k, v);
      // eigener AR-Knopf statt des eingebauten (der steht im Text und unten im Bild)
      const slot = document.createElement('span');
      slot.slot = 'ar-button'; slot.hidden = true;
      mv.appendChild(slot);
      stage.insertBefore(mv, stage.querySelector('[data-ar-loading]'));
      dimSetup(st);

      mv.addEventListener('load', () => {
        clearTimeout(slow);
        loading.hidden = true;
        stage.classList.add('is-loaded');
        st.tools.hidden = false;
        if (!st.touched) st.hint.hidden = false;
        mv.cameraOrbit = REDUCED ? ORBIT : ORBIT_IN;
        mv.jumpCameraToGoal();
        st.r0 = mv.getCameraOrbit().radius;
        if (!REDUCED) requestAnimationFrame(() => { mv.cameraOrbit = ORBIT; });
        st.dimKey = '';
        dimLabels(st);
      });
      mv.addEventListener('error', () => { clearTimeout(slow); loading.hidden = true; });
      mv.addEventListener('camera-change', e => {
        if (e.detail && e.detail.source === 'user-interaction') { st.touched = true; stopIntro(st); }
      });
      mv.addEventListener('quick-look-button-tapped', () => { location.href = cfg.contact; });
      mv.addEventListener('ar-status', e => {
        const s = e.detail.status;
        if (s === 'failed') msg(st, cfg.t.arfail);
        else if (s === 'session-started') msg(st, '');
      });
      if (FINE) {
        // Rad scrollt die Seite; Zoomen mit Strg/⌘ + Rad bzw. Trackpad-Geste oder den Knöpfen
        stage.addEventListener('wheel', e => {
          if (!e.ctrlKey && !e.metaKey) return;
          e.preventDefault(); e.stopPropagation();
          zoomBy(st, e.deltaY > 0 ? 1.08 : 1 / 1.08);
        }, { passive: false });
      }
      if (ANDROID) {
        // Android ohne ARCore: kein AR – Hinweis statt Knopf
        setTimeout(() => {
          if (!mv.canActivateAR) { st.go.forEach(b => { b.hidden = true; }); msg(st, cfg.t.noar); }
        }, 1500);
      }
    }).catch(() => { clearTimeout(slow); loading.hidden = true; });
  }

  function setup(sec) {
    let cfg;
    try { cfg = JSON.parse(sec.dataset.ar); } catch (e) { return; }
    const stage = sec.querySelector('[data-ar-stage]');
    const st = {
      sec, cfg, stage, model: cfg.models[0], dimsOn: false,
      poster: stage.querySelector('[data-ar-poster]'), tools: stage.querySelector('[data-ar-tools]'),
      hint: stage.querySelector('[data-ar-hint]'), go: [],
    };
    sec._ar = st;

    // AR-Knöpfe: im Text und unten im Bild (nur Handy/Tablet)
    const go = sec.querySelector('[data-ar-go]');
    if (MOBILE) {
      const inStage = document.createElement('button');
      inStage.type = 'button';
      inStage.className = 'ar__stagego';
      inStage.innerHTML = go.innerHTML;
      stage.appendChild(inStage);
      st.go = [go, inStage];
      st.go.forEach(b => { b.hidden = false; b.addEventListener('click', () => startAR(st)); });
      const hint = document.createElement('p');
      hint.className = 'ar__arhint';
      hint.textContent = cfg.t.ar_hint;
      go.parentNode.after(hint);
    }
    showQR(st);
    if (!document.fullscreenEnabled && !document.webkitFullscreenEnabled) {
      const fs = sec.querySelector('[data-ar-tool="fullscreen"]');
      if (fs) fs.remove();
    }

    sec.querySelectorAll('[data-ar-model]').forEach(b => b.addEventListener('click', () => {
      const m = cfg.models.find(x => x.id === b.dataset.arModel);
      if (m && m !== st.model) applyModel(st, m);
    }));
    sec.querySelectorAll('[data-ar-tool]').forEach(b => b.addEventListener('click', () => {
      const k = b.dataset.arTool;
      if (k === 'dims') setDims(st, !st.dimsOn);
      else if (k === 'zoom_in') zoomBy(st, 1 / 1.25);
      else if (k === 'zoom_out') zoomBy(st, 1.25);
      else if (k === 'reset' && st.mv) { st.mv.cameraOrbit = ORBIT; st.mv.cameraTarget = 'auto auto auto'; st.mv.fieldOfView = 'auto'; }
      else if (k === 'fullscreen') {
        const el = stage;
        if (document.fullscreenElement || document.webkitFullscreenElement) (document.exitFullscreen || document.webkitExitFullscreen).call(document);
        else (el.requestFullscreen || el.webkitRequestFullscreen).call(el);
      }
    }));
    return st;
  }

  const states = new Map();
  const ensure = sec => {
    if (!states.has(sec)) states.set(sec, setup(sec));
    return states.get(sec);
  };
  secs.forEach(ensure);

  // Modell laden, wenn der Abschnitt näher als ~1 Bildschirmhöhe ist
  const io = new IntersectionObserver(entries => {
    for (const en of entries) {
      if (!en.isIntersecting) continue;
      io.unobserve(en.target);
      const st = ensure(en.target);
      if (st) build(st);
    }
  }, { rootMargin: '900px 0px' });
  secs.forEach(s => io.observe(s));

  // AR-Knöpfe außerhalb des Abschnitts: auf Handy/Tablet sofort AR; am Rechner zur 3D-Ansicht – Links folgen ihrem
  // Ziel (#ar, main.js scrollt), das Abzeichen in der Produktkarte führt statt an den Seitenanfang direkt zu …#ar.
  // Capture-Phase: vor dem Anker-Scrollen von main.js und vor dem Kartenlink.
  document.addEventListener('click', e => {
    const el = e.target.closest('[data-ar-launch]');
    if (!el) return;
    let o;
    try { o = JSON.parse(el.dataset.arLaunch); } catch (err) { return; }
    const page = new URL(o.page, location.href);
    if (MOBILE) {
      e.preventDefault();
      e.stopPropagation();
      // Knopf auf der Produktseite selbst: das dort gewählte Modell (z. B. »venturion 800«)
      const st = page.href.split('#')[0] === here() && secs[0] ? ensure(secs[0]) : null;
      const m = st ? st.model : o;
      if (QL) quickLook(m, o);
      else sceneViewer(m, page.href);
    } else if (!el.matches('a[href]')) {
      e.preventDefault();
      e.stopPropagation();
      location.href = page.href;
    }
  }, true);
})();
