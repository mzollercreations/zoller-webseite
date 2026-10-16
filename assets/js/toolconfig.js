/* »toolOrganizer«: Konfigurator – Nutzhöhe, Ansteuerung, Ausführung, Schubladen und Einteilung wie im Flyer
   »toolOrganizer« (Version 13, 2024-08-21, Seiten 2–8 »Kombinieren Sie sich Ihr Modell«). Texte kommen aus dem Block
   (content/toolorganizer.json, build.py r_toolconfig).

   Regeln aus dem Flyer:
   - Nutzhöhe 600 / 900 / 1225 mm (Schrankhöhe 875 / 1175 / 1500 mm), Stellfläche 800 × 790 mm
   - Schubladenhöhen 75, 100, 125, 150, 175, 200, 250, 300 mm; sie füllen die Nutzhöhe genau und werden immer von klein
     (oben) nach groß (unten) eingebaut; elektronischer Schrank höchstens 20 Schubladen
   - max. 80 kg je Schublade, optional 160 kg ab Schubladenhöhe 150 mm
   - Einteilungsmaterial 12/16/24/48 Fächer (48 nur bis 175 mm, laut Artikeltabelle), frei steckbar auf 602 × 602 mm
   - »smartCompartment« (Einzelfachverriegelung) 4/8/12/16/24/36 Fächer, nur auf mechanisch verriegelten Schubladen,
     36 Fächer nur bis 150 mm; Fachtiefe = Blendenhöhe − 19 mm
   Ausführung »mechanischer Schrank« = Zentralschloss ohne Ansteuerung; die elektronischen Ausführungen brauchen
   Tischelektronik, »cockpit«, TMS-Arbeitsstation, ein Messgerät mit Softwaremodul oder einen anderen Smart Cabinet. */
(() => {
  'use strict';
  const root = document.querySelector('[data-tcfg]');
  if (!root) return;
  const cfg = JSON.parse(root.getAttribute('data-tcfg'));
  const t = cfg.t;
  const form = root.querySelector('form');
  const sec = root.closest('section');
  const NS = 'http://www.w3.org/2000/svg';
  const lang = document.documentElement.lang || 'de';
  const fmt = (v) => new Intl.NumberFormat(lang).format(v);
  const fill = (s, o) => String(s).replace(/\{(\w+)\}/g, (m, k) => (k in o ? o[k] : m));
  const escH = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const $ = (k) => root.parentNode.querySelector(`[data-out="${k}"]`);

  // ---------- Daten aus dem Flyer ----------
  const CAB = { 600: 875, 900: 1175, 1225: 1500 };
  const WIDTH = 800, DEPTH = 790;
  const HS = [75, 100, 125, 150, 175, 200, 250, 300];
  const ART = {
    m: { 75: 'WZV0001-020', 100: 'WZV0001-021', 125: 'WZV0001-022', 150: 'WZV0001-023', 175: 'WZV0001-024', 200: 'WZV0001-025', 250: 'WZV0001-026', 300: 'WZV0001-027' },
    e: { 75: 'WZV0001-011', 100: 'WZV0001-04', 125: 'WZV0001-012', 150: 'WZV0001-05', 175: 'WZV0001-08', 200: 'WZV0001-06', 250: 'WZV0001-013', 300: 'WZV0001-014' },
  };
  const MAT_N = [12, 16, 24, 48];
  const MATS = { 75: [31, 32, 33, 34], 100: [14, 15, 16, 17], 125: [14, 15, 16, 17], 150: [18, 19, 20, 21], 175: [18, 19, 20, 21], 200: [22, 23, 24], 250: [25, 26, 27], 300: [28, 29, 30] };
  const HGROUP = { 75: '75', 100: '100/125', 125: '100/125', 150: '150/175', 175: '150/175', 200: '200', 250: '250', 300: '300' };
  const matArt = (h, n) => { const a = MATS[h][MAT_N.indexOf(n)]; return a ? `WZV0002-${a}` : ''; };
  const SC_N = [4, 8, 12, 16, 24, 36];
  const SC = { 4: [278, 237, 2, 2], 8: [129, 237, 4, 2], 12: [129, 148, 4, 3], 16: [129, 103, 4, 4], 24: [129, 58, 4, 6], 36: [90, 58, 6, 6] };   // B, L, Spalten, Reihen
  const GRID = { 12: [4, 3], 16: [4, 4], 24: [4, 6], 48: [6, 8] };   // Beispielaufteilung des Einteilungsmaterials (frei steckbar)
  const AREA = 602, MAX_E = 20, HEAD = 110;
  const CTRL = ['desk', 'cockpit', 'tms', 'device', 'other', 'none'];
  const CTRL_ART = { desk: 'WZV0003-01', cockpit: 'WZV0204-02' };
  const SW = [['sw1', '8712131'], ['sw2', '8774212'], ['sw3', '8712146']];
  const DEF_MAT = { 75: 24, 100: 16, 125: 16, 150: 12, 175: 12, 200: 12, 250: 0, 300: 0 };
  const DEF_SC = { 75: 24, 100: 24, 125: 16, 150: 12, 175: 8, 200: 8, 250: 4, 300: 4 };
  const PRESET = { 600: [75, 75, 75, 100, 125, 150], 900: [75, 75, 75, 75, 100, 100, 125, 125, 150], 1225: [75, 75, 75, 75, 100, 100, 100, 125, 150, 150, 200] };
  const BAD_REST = [25, 50];   // Reste, die keine Schublade füllen kann

  // ---------- Zustand ----------
  let uid = 0;
  const S = { H: 900, ctrl: 'desk', exec: 'e', dr: [], sel: null, touched: false };
  const okDiv = (h, k, n) => k === 'none' || (k === 'mat' && MAT_N.includes(n) && (n !== 48 || h <= 175))
    || (k === 'sc' && SC_N.includes(n) && (n !== 36 || h <= 150));
  const toMat = (h, n) => (n === 36 ? (h <= 175 ? 48 : 24) : n < 12 ? 12 : n);
  const toSc = (h, n) => (!n ? DEF_SC[h] : n === 48 ? (h <= 150 ? 36 : 24) : n);
  const divFor = (h) => (S.exec === 'f' ? { k: 'sc', n: DEF_SC[h] } : DEF_MAT[h] ? { k: 'mat', n: DEF_MAT[h] } : { k: 'none', n: 0 });
  const mk = (h, div = divFor(h)) => ({ id: ++uid, h, k: div.k, n: div.n, kg: false });
  const sortDr = () => S.dr.sort((a, b) => a.h - b.h || a.id - b.id);
  const used = () => S.dr.reduce((s, d) => s + d.h, 0);
  const free = () => S.H - used();
  const elec = () => S.exec !== 'm';
  const canAdd = (h) => h <= free() && !BAD_REST.includes(free() - h) && (!elec() || S.dr.length < MAX_E);
  const selDr = () => S.dr.find((d) => d.id === S.sel) || null;
  const comps = (d) => (d.k === 'none' ? 1 : d.n);

  function preset() {
    S.dr = PRESET[S.H].map((h) => mk(h));
    S.sel = S.dr[0].id;
  }
  function fillRest() {
    let r = free();
    while (r >= 75) {
      const h = [...HS].reverse().find((x) => x <= r && !BAD_REST.includes(r - x));
      if (!h || (elec() && S.dr.length >= MAX_E)) break;
      const d = mk(h);
      S.dr.push(d);
      S.sel = d.id;
      r -= h;
    }
    sortDr();
  }
  function fitTo() {            // kleinere Nutzhöhe: Schubladen von oben behalten, solange sie passen, Rest auffüllen
    sortDr();
    let sum = 0;
    S.dr = S.dr.filter((d) => {
      if (sum + d.h > S.H || BAD_REST.includes(S.H - sum - d.h)) return false;
      sum += d.h;
      return true;
    });
    fillRest();
    if (!selDr()) S.sel = S.dr.length ? S.dr[0].id : null;
  }
  function setExec(x) {
    S.exec = x;
    if (x === 'm') S.ctrl = 'none';
    else if (S.ctrl === 'none') S.ctrl = 'desk';
    for (const d of S.dr) {
      if (x === 'f') { const n = toSc(d.h, d.k === 'none' ? 0 : d.n); d.k = 'sc'; d.n = n; }
      else if (d.k === 'sc') { d.k = 'mat'; d.n = toMat(d.h, d.n); }
    }
  }
  function setCtrl(c) {
    S.ctrl = c;
    if (c === 'none' && elec()) setExec('m');
    else if (c !== 'none' && !elec()) { setExec('e'); S.ctrl = c; }
  }
  function syncExec() {         // alle Schubladen mit »smartCompartment« -> Einzelfach, keine -> Schubladenverriegelung
    if (!elec() || !S.dr.length) return;
    const sc = S.dr.filter((d) => d.k === 'sc').length;
    if (sc === S.dr.length) S.exec = 'f';
    else if (!sc) S.exec = 'e';
  }

  // ---------- Link zum Teilen: ?k=900.te.75m24.75m24.100s12.150m12k ----------
  const CC = { desk: 't', cockpit: 'c', tms: 'p', device: 'g', other: 'o', none: 'n' };
  const encode = () => [S.H, CC[S.ctrl] + S.exec, ...S.dr.map((d) => d.h + (d.k === 'none' ? 'o' : d.k === 'mat' ? 'm' : 's') + (d.n || '') + (d.kg ? 'k' : ''))].join('.');
  function decode(s) {
    const p = String(s || '').split('.');
    const H = +p[0];
    if (!CAB[H] || !p[1] || p[1].length !== 2) return false;
    const ctrl = Object.keys(CC).find((k) => CC[k] === p[1][0]);
    const exec = p[1][1];
    if (!ctrl || !'mef'.includes(exec) || (exec === 'm') !== (ctrl === 'none')) return false;
    const dr = [];
    for (const x of p.slice(2)) {
      const m = /^(\d+)([oms])(\d*)(k?)$/.exec(x);
      if (!m) return false;
      const h = +m[1], k = { o: 'none', m: 'mat', s: 'sc' }[m[2]], n = k === 'none' ? 0 : +m[3];
      if (!HS.includes(h) || !okDiv(h, k, n) || (k === 'sc' && exec === 'm')) return false;
      dr.push({ id: ++uid, h, k, n, kg: !!m[4] && h >= 150 });
    }
    const sum = dr.reduce((a, d) => a + d.h, 0);
    if (sum > H || BAD_REST.includes(H - sum) || (exec !== 'm' && dr.length > MAX_E)) return false;
    Object.assign(S, { H, ctrl, exec, dr, sel: dr.length ? dr[0].id : null, touched: true });
    sortDr();
    return true;
  }
  const shareUrl = () => `${location.origin}${location.pathname}?k=${encode()}#${sec ? sec.id : ''}`;

  // ---------- Texte ----------
  const divText = (d) => (d.k === 'none' ? t.d_none : fill(d.k === 'mat' ? t.d_mat : t.d_sc, { n: d.n }));
  const execText = () => {
    if (!elec()) return t.ex_m;
    const sc = S.dr.filter((d) => d.k === 'sc').length;
    return sc && sc < S.dr.length ? t.ex_mix : S.exec === 'f' ? t.ex_f : t.ex_e;
  };
  const plain = (s) => { const d = document.createElement('div'); d.innerHTML = s; return d.textContent.trim(); };
  const lockType = (d) => (d.k === 'sc' || !elec() ? 'm' : 'e');

  // ---------- SVG-Helfer ----------
  let gradN = 0;
  function el(name, attrs, parent) {
    const n = document.createElementNS(NS, name);
    for (const k in attrs) n.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(n);
    return n;
  }
  const txt = (parent, x, y, s, cls, size, anchor = 'middle', extra = {}) => {
    const n = el('text', { class: cls, x, y, 'font-size': size, 'text-anchor': anchor, ...extra }, parent);
    n.textContent = s;
    return n;
  };
  const pxPerMm = (svg, w, h) => Math.min((svg.clientWidth || 300) / w, (svg.clientHeight || 400) / h) || 0.2;

  // ---------- Vorderansicht ----------
  function drawFront(svg, fresh) {
    const Hc = CAB[S.H];
    const c = S.ctrl;
    // Platz links/oben für die Ansteuerung: Tischelektronik steht auf dem Schrank, die anderen links daneben
    const LEFT = { desk: -40, cockpit: -620, tms: -600, device: -680, other: -580, none: -40 };
    const TOP = { desk: -540, cockpit: Hc - 1520, tms: Hc - 1140, device: Hc - 1640, other: Hc - 1560, none: -40 };
    const x0 = LEFT[c], x1 = 990;
    const y0 = Math.min(-40, TOP[c]), y1 = Hc + 40;
    const vw = x1 - x0, vh = y1 - y0;
    svg.setAttribute('viewBox', `${x0} ${y0} ${vw} ${vh}`);
    svg.setAttribute('preserveAspectRatio', 'xMidYMax meet');
    svg.textContent = '';
    const px = pxPerMm(svg, vw, vh);
    const gid = `tg-grad-${++gradN}`;
    const defs = el('defs', {}, svg);
    const lg = el('linearGradient', { id: gid, x1: 0, y1: 0, x2: 0, y2: 1 }, defs);
    el('stop', { offset: 0, 'stop-color': '#f1f2f3' }, lg);
    el('stop', { offset: 1, 'stop-color': '#d3d5d8' }, lg);
    const g = el('g', {}, svg);

    // Korpus mit gerundeten oberen Ecken, Deckel, Schriftzug, Sockel
    const r = 26;
    el('path', { class: 'tg-body', d: `M0 ${Hc}V${r}Q0 0 ${r} 0H${WIDTH - r}Q${WIDTH} 0 ${WIDTH} ${r}V${Hc}Z` }, g);
    el('path', { class: 'tg-lid', d: `M0 18V${r}Q0 0 ${r} 0H${WIDTH - r}Q${WIDTH} 0 ${WIDTH} ${r}V18Z` }, g);
    txt(g, 742, 76, 'toolOrganizer', 'tg-word', 34, 'end');
    if (!elec()) {                                  // Zentralschloss
      el('circle', { class: 'tg-lock', cx: 82, cy: 63, r: 14 }, g);
      el('rect', { class: 'tg-recess', x: 79, y: 55, width: 6, height: 16, rx: 3 }, g);
    }
    const bottom = HEAD + S.H;
    el('rect', { class: 'tg-recess', x: 46, y: bottom + 18, width: WIDTH - 92, height: Hc - bottom - 46, rx: 4 }, g);
    el('rect', { class: 'tg-plinth', x: 0, y: Hc - 22, width: WIDTH, height: 22 }, g);

    // Schubladen von oben nach unten
    let y = HEAD;
    const lab = Math.min(13 / px, 46);
    S.dr.forEach((d, i) => {
      const gd = el('g', { class: `tg-dr${d.id === S.sel ? ' is-sel' : ''}${fresh && fresh.has(d.id) ? ' is-new' : ''}`, 'data-id': d.id }, g);
      const h = d.h - 4;
      el('rect', { class: 'tg-front', x: 46, y, width: WIDTH - 92, height: h, rx: 3, fill: `url(#${gid})` }, gd);
      el('rect', { class: 'tg-lip', x: 46, y, width: WIDTH - 92, height: 9, rx: 2 }, gd);
      el('rect', { class: 'tg-groove', x: 46, y: y + 9, width: WIDTH - 92, height: 3.5 }, gd);
      if (elec()) {
        el('rect', { class: 'tg-recess', x: 646, y: y + 20, width: 70, height: 14, rx: 7 }, gd);
        el('rect', { class: `tg-led${i === 0 || d.id === S.sel ? ' is-on' : ''}`, x: 652, y: y + 24.5, width: 50, height: 5, rx: 2.5 }, gd);
      }
      const fsz = Math.min(lab, h * 0.55);
      if (h * px >= 15) txt(gd, 70, y + 6 + h / 2 + fsz * 0.36, `${d.h}`, 'tg-dlab', fsz, 'start');
      if (d.id === S.sel) el('rect', { class: 'tg-sel', x: 44, y: y - 2, width: WIDTH - 88, height: h + 4, rx: 4 }, gd);
      y += d.h;
    });
    if (bottom - y > 0) {
      el('rect', { class: 'tg-free', x: 48, y: y + 2, width: WIDTH - 96, height: bottom - y - 6, rx: 3 }, g);
      if ((bottom - y) * px >= 16) txt(g, WIDTH / 2, y + (bottom - y) / 2 + lab * 0.35, fill(t.svg_free, { n: fmt(bottom - y) }), 'tg-freelab', Math.min(lab, (bottom - y) * 0.5));
    }

    // Ansteuerung
    const net = (d) => el('path', { class: 'tg-net', d: `${d}V${HEAD + 60}H0` }, g);
    if (c === 'desk') {                             // Tischelektronik: Gehäuse mit Bildschirm auf dem Schrank
      el('rect', { class: 'tg-wall', x: 240, y: -150, width: 320, height: 150, rx: 6 }, g);
      for (let i = 0; i < 4; i++) el('rect', { class: 'tg-groove', x: 300, y: -112 + i * 22, width: 200, height: 6, rx: 3 }, g);
      screen(g, 130, -515, 540, 360);
    } else if (c === 'cockpit') {                   // »cockpit«: separate Bedieneinheit links neben dem Schrank
      el('rect', { class: 'tg-dev2', x: -590, y: Hc - 34, width: 450, height: 34, rx: 8 }, g);
      el('rect', { class: 'tg-wall', x: -515, y: Hc - 330, width: 300, height: 296, rx: 8 }, g);
      el('rect', { class: 'tg-dev', x: -410, y: Hc - 1000, width: 90, height: 670 }, g);
      el('rect', { class: 'tg-dev', x: -590, y: Hc - 1050, width: 450, height: 50, rx: 12 }, g);
      el('rect', { class: 'tg-dev2', x: -381, y: Hc - 1200, width: 32, height: 150 }, g);
      screen(g, -575, Hc - 1500, 420, 300);
    } else if (c === 'tms') {                       // TMS-Arbeitsstation: PC auf einem Tisch, Netzwerk zum Schrank
      el('rect', { class: 'tg-dev2', x: -560, y: Hc - 732, width: 24, height: 732 }, g);
      el('rect', { class: 'tg-dev2', x: -164, y: Hc - 732, width: 24, height: 732 }, g);
      el('rect', { class: 'tg-dev', x: -580, y: Hc - 760, width: 460, height: 30, rx: 6 }, g);
      el('rect', { class: 'tg-dev', x: -260, y: Hc - 560, width: 90, height: 560, rx: 6 }, g);
      el('rect', { class: 'tg-dev2', x: -365, y: Hc - 860, width: 30, height: 100 }, g);
      el('rect', { class: 'tg-dev2', x: -420, y: Hc - 772, width: 140, height: 12, rx: 4 }, g);
      screen(g, -545, Hc - 1120, 390, 270);
      net(`M-170 ${Hc - 300}H-60`);
    } else if (c === 'device') {                    // Einstell- und Messgerät mit Softwaremodul Smart Cabinets
      el('rect', { class: 'tg-dev', x: -620, y: Hc - 820, width: 500, height: 820, rx: 12 }, g);
      el('rect', { class: 'tg-dev2', x: -640, y: Hc - 850, width: 540, height: 32, rx: 6 }, g);
      el('rect', { class: 'tg-dev', x: -230, y: Hc - 1620, width: 70, height: 772 }, g);
      el('rect', { class: 'tg-wall', x: -500, y: Hc - 950, width: 90, height: 100, rx: 8 }, g);
      el('rect', { class: 'tg-ui', x: -470, y: Hc - 1110, width: 30, height: 160, rx: 6 }, g);
      el('rect', { class: 'tg-dev2', x: -400, y: Hc - 1260, width: 240, height: 80, rx: 10 }, g);
      el('rect', { class: 'tg-ui--hi', x: -430, y: Hc - 1280, width: 60, height: 120, rx: 8 }, g);
      screen(g, -665, Hc - 1620, 300, 220);
      net(`M-120 ${Hc - 420}H-60`);
    } else if (c === 'other') {                     // anderer Smart Cabinet mit eigener Ansteuerung
      el('path', { class: 'tg-dev', d: `M-540 ${Hc}V${Hc - 1230}Q-540 ${Hc - 1250} -520 ${Hc - 1250}H-140Q-120 ${Hc - 1250} -120 ${Hc - 1230}V${Hc}Z` }, g);
      for (let i = 0; i < 9; i++) el('rect', { class: 'tg-wall', x: -510, y: Hc - 1150 + i * 112, width: 360, height: 100, rx: 3, opacity: 0.55 }, g);
      el('rect', { class: 'tg-wall', x: -400, y: Hc - 1400, width: 140, height: 150, rx: 6 }, g);
      screen(g, -520, Hc - 1555, 380, 250);
      net(`M-120 ${Hc - 700}H-60`);
    }
    // Höhenmaß rechts und Boden
    const xd = 880;
    el('line', { class: 'tg-dim', x1: xd, y1: 0, x2: xd, y2: Hc }, g);
    el('line', { class: 'tg-dim', x1: xd - 30, y1: 0, x2: xd + 30, y2: 0 }, g);
    el('line', { class: 'tg-dim', x1: xd - 30, y1: Hc, x2: xd + 30, y2: Hc }, g);
    const fs = Math.min(12 / px, 90);
    txt(g, xd + fs * 0.9, Hc / 2, `${fmt(Hc)} ${t.u_mm}`, 'tg-dimlab', fs, 'middle', { transform: `rotate(-90 ${xd + fs * 0.9} ${Hc / 2})` });
    el('line', { class: 'tg-floor', x1: x0 + 20, y1: Hc, x2: x1 - 20, y2: Hc }, g);
  }
  function screen(g, x, y, w, h) {
    el('rect', { class: 'tg-dev2', x, y, width: w, height: h, rx: 14 }, g);
    el('rect', { class: 'tg-screen', x: x + 16, y: y + 16, width: w - 32, height: h - 32, rx: 4 }, g);
    const iw = w - 64;
    el('rect', { class: 'tg-ui', x: x + 32, y: y + 32, width: iw, height: 20, rx: 3 }, g);
    for (let i = 0; i < 5; i++) {
      el('rect', { class: i === 2 ? 'tg-ui tg-ui--hi' : 'tg-ui', x: x + 32, y: y + 70 + i * 34, width: iw * 0.58, height: 16, rx: 3, opacity: i === 2 ? 1 : 0.45 }, g);
    }
    el('rect', { class: 'tg-ui--hi', x: x + 44 + iw * 0.62, y: y + 70, width: iw * 0.34, height: h - 128, rx: 4, opacity: 0.85 }, g);
  }

  // ---------- Draufsicht der gewählten Schublade ----------
  function drawTop(svg, d) {
    svg.setAttribute('viewBox', '-50 -50 702 780');
    svg.textContent = '';
    const g = el('g', {}, svg);
    el('rect', { class: 'tg-wall', x: -34, y: -34, width: AREA + 68, height: AREA + 68, rx: 10 }, g);
    el('rect', { class: 'tg-floor2', x: 0, y: 0, width: AREA, height: AREA, rx: 3 }, g);
    el('rect', { class: 'tg-wall', x: -50, y: AREA + 40, width: AREA + 100, height: 76, rx: 8 }, g);
    el('rect', { class: 'tg-groove', x: -50, y: AREA + 52, width: AREA + 100, height: 4 }, g);
    if (!d) {
      txt(g, AREA / 2, AREA / 2 + 12, t.st_empty_s, 'tg-emptylab', 34);
      return;
    }
    if (lockType(d) === 'e') {
      el('rect', { class: 'tg-recess', x: AREA - 150, y: AREA + 68, width: 120, height: 22, rx: 11 }, g);
      el('rect', { class: 'tg-led is-on', x: AREA - 140, y: AREA + 75, width: 100, height: 8, rx: 4 }, g);
    }
    if (d.k === 'none') {
      txt(g, AREA / 2, AREA / 2 + 12, t.d_none, 'tg-emptylab', 34);
      return;
    }
    if (d.k === 'mat') {
      const [c, rws] = GRID[d.n];
      el('rect', { class: 'tg-floor3', x: 0, y: 0, width: AREA, height: AREA, rx: 3 }, g);
      for (let i = 1; i < c; i++) el('rect', { class: 'tg-div', x: (i * AREA) / c - 3, y: 0, width: 6, height: AREA }, g);
      for (let j = 1; j < rws; j++) el('rect', { class: 'tg-div', x: 0, y: (j * AREA) / rws - 3, width: AREA, height: 6 }, g);
      if (!elec()) return;                          // elektronisch: »quickPick« zeigt den Lagerort
      const hi = Math.min(c + 1, c * rws - 1);
      const cx = hi % c, cy = Math.floor(hi / c);
      el('rect', { class: 'tg-hi is-pulse', x: (cx * AREA) / c + 8, y: (cy * AREA) / rws + 8, width: AREA / c - 16, height: AREA / rws - 16, rx: 4 }, g);
      return;
    }
    const [B, L, c, rws] = SC[d.n];
    const pw = AREA / c, ph = AREA / rws;
    const fw = Math.min(B, pw - 12), fh = Math.min(L + 0.45 * (ph - L), ph - 12);
    const open = Math.min(c + 1, c * rws - 1);
    for (let j = 0; j < rws; j++) {
      for (let i = 0; i < c; i++) {
        const x = i * pw + (pw - fw) / 2, y = j * ph + 6;
        el('rect', { class: 'tg-cell', x: i * pw + 3, y: j * ph + 3, width: pw - 6, height: ph - 6, rx: 4 }, g);
        el('rect', { class: `tg-flap${j * c + i === open ? ' is-open' : ''}`, x, y, width: fw, height: fh, rx: 4 }, g);
        el('rect', { class: 'tg-hinge', x: x + 4, y: y + 4, width: fw - 8, height: 4, rx: 2 }, g);
        el('rect', { class: 'tg-notch', x: x + fw / 2 - Math.min(20, fw * 0.18), y: y + fh - 12, width: Math.min(40, fw * 0.36), height: 8, rx: 4 }, g);
      }
    }
  }

  // ---------- Formular ----------
  const ICON_DEL = '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M3.5 3.5l9 9M12.5 3.5l-9 9"/></svg>';
  const ICON_L = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 18l-6-6 6-6"/></svg>';
  const ICON_R = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 18l6-6-6-6"/></svg>';
  function gridIcon(k, n) {
    const [c, r] = k === 'none' ? [1, 1] : k === 'mat' ? GRID[n] : SC[n].slice(2);
    let p = '';
    for (let i = 1; i < c; i++) p += `M${2 + (14 * i) / c} 2V16`;
    for (let j = 1; j < r; j++) p += `M2 ${2 + (14 * j) / r}H16`;
    return `<svg viewBox="0 0 18 18" fill="none" stroke="currentColor" stroke-width="${c * r > 20 ? 0.7 : 1}" aria-hidden="true"><rect x="2" y="2" width="14" height="14" rx="2" stroke-width="1.3"/>${p ? `<path d="${p}"/>` : ''}</svg>`;
  }

  function renderAdd() {
    const box = $('add');
    box.innerHTML = HS.map((h) => `<button type="button" class="tcfg__chip tcfg__chip--add" data-add="${h}"${canAdd(h) ? '' : ` disabled title="${escH(t.no_fit)}"`}>${fmt(h)} ${t.u_mm}</button>`).join('')
      + (!free() && S.dr.length ? `<p class="tcfg__hint">${escH(t.full_hint)}</p>` : '');
    root.querySelector('[data-act="fill"]').disabled = free() < 75 || !HS.some(canAdd);
    root.querySelector('[data-act="clear"]').disabled = !S.dr.length;
  }

  function renderList(fresh) {
    const list = $('list');
    if (!S.dr.length) {
      list.innerHTML = `<li class="tcfg__empty">${escH(t.st_empty)}</li>`;
      return;
    }
    list.innerHTML = S.dr.map((d, i) => `<li class="${d.id === S.sel ? 'is-sel' : ''}${fresh.has(d.id) ? ' is-new' : ''}">`
      + `<button type="button" class="tcfg__pick" data-pick="${d.id}"${d.id === S.sel ? ' aria-current="true"' : ''}>`
      + `<i>${i + 1}</i><b>${fmt(d.h)} ${t.u_mm}</b><span>${escH(divText(d))}${d.kg ? `<em>160 ${t.u_kg}</em>` : ''}</span></button>`
      + `<button type="button" class="tcfg__del" data-del="${d.id}" aria-label="${escH(fill(t.remove, { i: i + 1 }))}">${ICON_DEL}</button></li>`).join('');
  }

  function renderDiv() {
    const box = $('div');
    const d = selDr();
    if (!d) {
      box.innerHTML = `<p class="tcfg__empty">${escH(t.st_empty)}</p>`;
      return;
    }
    const i = S.dr.indexOf(d);
    const why = new Set();
    const chip = (k, n) => {
      const ok = okDiv(d.h, k, n);
      if (!ok) why.add(k === 'sc' ? t.r_36 : t.r_48);
      const on = d.k === k && (k === 'none' || d.n === n);
      const label = k === 'none' ? t.d_none_s : fmt(n);
      return `<button type="button" class="tcfg__chip" data-div="${k}:${n}" aria-pressed="${on}"${ok ? '' : ' disabled'}`
        + `${k === 'none' ? '' : ` aria-label="${escH(fill(k === 'mat' ? t.d_mat : t.d_sc, { n }))}"`}>${gridIcon(k, n)}${escH(label)}</button>`;
    };
    const grp = (title, sub, chips) => `<div class="tcfg__grp"><span class="tcfg__label">${title}<small>${sub}</small></span><div class="tcfg__chips">${chips}</div></div>`;
    let html = `<div class="tcfg__dhead"><b>${escH(fill(t.s5_drawer, { i: i + 1, h: fmt(d.h) }))}</b><div class="tcfg__dnav">`
      + `<button type="button" data-nav="-1" aria-label="${escH(t.prev)}"${i ? '' : ' disabled'}>${ICON_L}</button>`
      + `<button type="button" data-nav="1" aria-label="${escH(t.next)}"${i < S.dr.length - 1 ? '' : ' disabled'}>${ICON_R}</button></div></div>`;
    html += grp(elec() ? t.g_mat_e : t.g_mat_m, elec() ? t.g_mat_e_d : t.g_mat_m_d, chip('none', 0) + MAT_N.map((n) => chip('mat', n)).join(''));
    if (elec()) html += grp(t.g_sc, t.g_sc_d, SC_N.map((n) => chip('sc', n)).join(''));
    if (why.size) html += `<p class="tcfg__why">${[...why].map(escH).join(' · ')}</p>`;
    const kgOk = d.h >= 150;
    html += `<label class="tcfg__check${kgOk ? '' : ' is-off'}"><input type="checkbox" data-kg${d.kg ? ' checked' : ''}${kgOk ? '' : ' disabled'}>`
      + `<span>${escH(t.kg)}${kgOk ? '' : `<br><small>${escH(t.r_kg)}</small>`}</span></label>`;
    if (S.dr.length > 1) html += `<button type="button" class="tcfg__tool tcfg__apply" data-act="apply">${escH(t.apply)}</button>`;
    box.innerHTML = html;
  }

  function parts() {
    const rows = [];
    const add = (grp, qty, item, sub, art) => rows.push({ grp, qty, item, sub, art });
    add(t.p_g_cab, 1, `»toolOrganizer ${S.H}«`, fill(t.p_cab, { H: fmt(CAB[S.H]), w: fmt(WIDTH), d: fmt(DEPTH) }) + ' · ' + execText(), '');
    const count = (key, f) => { const m = new Map(); for (const d of S.dr) { const k = key(d); if (k) { const v = m.get(k) || { n: 0, d }; v.n++; m.set(k, v); } } return [...m.values()].map(f); };
    count((d) => `${lockType(d)}${d.h}`, ({ n, d }) => add(t.p_g_dr, n, fill(lockType(d) === 'e' ? t.p_dr_e : t.p_dr_m, { h: fmt(d.h) }), '', ART[lockType(d)][d.h]));
    count((d) => (d.k === 'mat' ? matArt(d.h, d.n) : ''), ({ n, d }) => add(t.p_g_div, n, fill(t.p_mat, { n: d.n, h: HGROUP[d.h] }), '', matArt(d.h, d.n)));
    count((d) => (d.k === 'sc' ? `sc${d.n}-${d.h}` : ''), ({ n, d }) => add(t.p_g_div, n, fill(t.p_sc, { n: d.n, h: fmt(d.h) }),
      fill(t.p_sc_d, { b: SC[d.n][0], l: SC[d.n][1], t: d.h - 19 }), t.on_req));
    count((d) => (d.kg ? `kg${d.h}` : ''), ({ n, d }) => add(t.p_g_div, n, fill(t.p_kg, { h: fmt(d.h) }), '', t.on_req));
    if (S.ctrl !== 'none') add(t.p_g_ctrl, 1, plain(t[`c_${S.ctrl}`]), plain(t[`c_${S.ctrl}_d`]), CTRL_ART[S.ctrl] || '');
    if (elec()) SW.forEach(([k, a]) => add(t.p_g_sw, 1, t[k], '', a));
    return rows;
  }
  function partsHtml(rows) {
    let grp = '', html = '';
    for (const r of rows) {
      if (r.grp !== grp) { grp = r.grp; html += `<tr class="tcfg__grow"><td colspan="3">${escH(grp)}</td></tr>`; }
      html += `<tr><td>${fmt(r.qty)} ×</td><td>${escH(r.item)}${r.sub ? `<small>${escH(r.sub)}</small>` : ''}</td><td>${escH(r.art || '–')}</td></tr>`;
    }
    return html;
  }

  function mailBody(rows) {
    const L = [t.mail_intro, '',
      `${t.m_H}: ${fmt(S.H)} ${t.u_mm} (»toolOrganizer ${S.H}«, ${fill(t.p_cab, { H: fmt(CAB[S.H]), w: fmt(WIDTH), d: fmt(DEPTH) })})`,
      `${t.m_ctrl}: ${plain(t[`c_${S.ctrl}`])}`, `${t.m_exec}: ${execText()}`, '', `${t.m_list}:`];
    S.dr.forEach((d, i) => L.push(`${i + 1}. ${fmt(d.h)} ${t.u_mm} – ${divText(d)}${d.kg ? ` – 160 ${t.u_kg}` : ''}`));
    if (free()) L.push(fill(t.st_free, { n: fmt(free()) }));
    L.push('', `${t.sum_t}:`);
    rows.forEach((r) => L.push(`${r.qty} × ${r.item}${r.art ? ` (${r.art})` : ''}`));
    L.push('', `${t.m_link}: ${shareUrl()}`, '');
    return L.join('\n');
  }

  // ---------- Ausgabe ----------
  let lastIds = new Set(), lastComp, firstRender = true;
  function update() {
    sortDr();
    const ids = new Set(S.dr.map((d) => d.id));
    const fresh = firstRender ? new Set() : new Set([...ids].filter((x) => !lastIds.has(x)));
    lastIds = ids;
    firstRender = false;
    for (const i of form.querySelectorAll('input[type=radio]')) {
      const n = i.name.slice(i.name.lastIndexOf('-') + 1);
      i.checked = String(n === 'H' ? S.H : n === 'ctrl' ? S.ctrl : S.exec) === i.value;
    }
    const sc = S.dr.filter((d) => d.k === 'sc').length;
    const mixed = $('mixed');
    mixed.hidden = !(elec() && sc && sc < S.dr.length);
    if (!mixed.hidden) mixed.textContent = fill(t.mixed, { a: sc, m: S.dr.length });

    const u = used(), f = free();
    const meter = $('meter');
    meter.classList.toggle('is-full', !f && S.dr.length > 0);
    meter.innerHTML = S.dr.map((d) => `<i class="${d.id === S.sel ? 'is-sel' : ''}" style="flex:0 0 calc(${(d.h / S.H) * 100}% - 2px)"></i>`).join('');
    $('meter-txt').innerHTML = `<b>${fmt(u)}</b> ${escH(fill(t.of_used, { H: fmt(S.H) }))} · `
      + (f ? escH(fill(t.free_n, { n: fmt(f) })) : `<span class="is-ok">${escH(t.full)}</span>`);
    renderAdd();
    renderList(fresh);
    renderDiv();

    const comp = S.dr.reduce((s, d) => s + comps(d), 0);
    $('k-comp').textContent = fmt(comp);
    $('k-drawers').textContent = fmt(S.dr.length);
    $('k-height').textContent = `${fmt(u)}/${fmt(S.H)}`;
    if (lastComp !== undefined && lastComp !== comp) {
      const k = $('k-comp').closest('.tcfg__kpi');
      k.classList.remove('is-bump');
      void k.offsetWidth;
      k.classList.add('is-bump');
    }
    lastComp = comp;
    const st = $('status');
    st.classList.toggle('is-ok', !f && S.dr.length > 0);
    st.textContent = !S.dr.length ? t.st_empty : f ? fill(t.st_free, { n: fmt(f) }) : t.st_ok;

    drawFront($('front'), fresh);
    $('front-cap').innerHTML = `<b>»toolOrganizer ${S.H}«</b>${escH(fill(t.p_cab, { H: fmt(CAB[S.H]), w: fmt(WIDTH), d: fmt(DEPTH) }))}`
      + ` · ${escH(t.m_ctrl)}: ${escH(plain(t[`c_${S.ctrl}`]))}`;
    const d = selDr();
    drawTop($('top'), d);
    let cap = '';
    if (d) {
      cap = `<b>${escH(fill(t.s5_drawer, { i: S.dr.indexOf(d) + 1, h: fmt(d.h) }))}</b>${escH(divText(d))} · `;
      if (d.k === 'sc') cap += escH(fill(t.fach_sc, { b: SC[d.n][0], l: SC[d.n][1], t: d.h - 19 }));
      else if (d.k === 'mat') cap += escH(fill(t.fach_mat, { b: Math.round(AREA / GRID[d.n][0] / 5) * 5, l: Math.round(AREA / GRID[d.n][1] / 5) * 5 }));
      else cap += escH(t.area);
      cap += ` · ${escH(lockType(d) === 'e' ? t.lock_e : d.k === 'sc' ? t.lock_sc : t.lock_m)}`;
    }
    $('top-cap').innerHTML = cap;

    const rows = parts();
    $('parts').innerHTML = partsHtml(rows);
    $('sum-sub').textContent = `»toolOrganizer ${S.H}« · ${execText()} · ${fill(t.sum_sub, { n: S.dr.length, c: fmt(comp) })}`;
    const href = `mailto:${cfg.mail}?subject=${encodeURIComponent(fill(t.mail_subject, { H: S.H }))}&body=${encodeURIComponent(mailBody(rows))}`;
    $('mail').href = href;
    $('mail2').href = href;

    const bar = $('bar');
    bar.innerHTML = `<b>${fmt(u)}</b>/${fmt(S.H)} ${t.u_mm} · ${escH(fill(t.bar, { n: S.dr.length, c: fmt(comp) }))}`;
    drawBarCab();
    if (S.touched) {
      try { history.replaceState(history.state, '', `${location.pathname}?k=${encode()}${location.hash}`); } catch (e) { /* file:// oder Sandbox */ }
    }
  }
  function drawBarCab() {
    const svg = $('barcab');
    const top = 56 - (CAB[S.H] / 1500) * 54, s = (CAB[S.H] / 1500) * 54 / CAB[S.H];
    let y = top + HEAD * s, h = '';
    for (const d of S.dr) { h += `<rect class="${d.id === S.sel ? 's' : 'd'}" x="5" y="${y.toFixed(2)}" width="20" height="${Math.max(0.6, d.h * s - 0.8).toFixed(2)}" rx=".5"/>`; y += d.h * s; }
    if (free()) h += `<rect class="f" x="5.4" y="${y.toFixed(2)}" width="19.2" height="${(free() * s - 0.8).toFixed(2)}"/>`;
    svg.innerHTML = `<rect class="b" x="2" y="${top.toFixed(2)}" width="26" height="${(56 - top).toFixed(2)}" rx="2"/>${h}`;
  }

  let queued = false;
  const run = () => { if (queued) { queued = false; update(); } };
  const schedule = () => { if (!queued) { queued = true; requestAnimationFrame(run); setTimeout(run, 120); } };
  const touch = () => { S.touched = true; schedule(); };

  // ---------- Bedienung ----------
  form.addEventListener('change', (e) => {
    const i = e.target;
    if (i.type === 'checkbox' && i.hasAttribute('data-kg')) {
      const d = selDr();
      if (d) d.kg = i.checked && d.h >= 150;
      touch();
      return;
    }
    if (i.type !== 'radio') return;
    const n = i.name.slice(i.name.lastIndexOf('-') + 1);
    if (n === 'H') {
      S.H = +i.value;
      if (!S.touched) preset();
      else if (used() > S.H) fitTo();
    } else if (n === 'ctrl') setCtrl(i.value);
    else if (n === 'exec') setExec(i.value);
    touch();
  });
  root.parentNode.addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (b && b.closest('[data-tcfg], .tcfg__sum')) {
      if (b.dataset.add) {
        const h = +b.dataset.add;
        if (!canAdd(h)) return;
        const d = mk(h);
        S.dr.push(d);
        S.sel = d.id;
      } else if (b.dataset.pick || b.dataset.nav) {
        const i = b.dataset.pick ? S.dr.findIndex((d) => d.id === +b.dataset.pick) : S.dr.indexOf(selDr()) + +b.dataset.nav;
        if (S.dr[i]) S.sel = S.dr[i].id;
        schedule();
        return;
      }
      else if (b.dataset.del) {
        const i = S.dr.findIndex((d) => d.id === +b.dataset.del);
        S.dr.splice(i, 1);
        if (!selDr()) S.sel = S.dr.length ? S.dr[Math.min(i, S.dr.length - 1)].id : null;
      } else if (b.dataset.div) {
        const d = selDr();
        const [k, n] = b.dataset.div.split(':');
        if (d && okDiv(d.h, k, +n)) { d.k = k; d.n = +n; syncExec(); }
      } else if (b.dataset.act === 'fill') fillRest();
      else if (b.dataset.act === 'preset') preset();
      else if (b.dataset.act === 'clear') { S.dr = []; S.sel = null; }
      else if (b.dataset.act === 'apply') {
        const s = selDr();
        for (const d of S.dr) {
          if (s.k === 'none') { d.k = 'none'; d.n = 0; } else if (s.k === 'mat') { d.k = 'mat'; d.n = okDiv(d.h, 'mat', s.n) ? s.n : 24; } else { d.k = 'sc'; d.n = okDiv(d.h, 'sc', s.n) ? s.n : 24; }
          d.kg = s.kg && d.h >= 150;
        }
        syncExec();
      } else if (b.dataset.act === 'print') { printSheet(); return; }
      else if (b.dataset.act === 'share') { share(b); return; }
      else return;
      touch();
      return;
    }
    const g = e.target.closest('.tg-dr');
    if (g && root.contains(g)) { S.sel = +g.getAttribute('data-id'); schedule(); }
  });

  function share(btn) {
    const url = shareUrl();
    const done = () => {
      const old = btn.innerHTML;                 // motion.js legt die Beschriftung doppelt an (Roll-Effekt)
      btn.textContent = t.copied;
      setTimeout(() => { btn.innerHTML = old; }, 2200);
    };
    if (navigator.clipboard && window.isSecureContext) navigator.clipboard.writeText(url).then(done, () => fallback(url, done));
    else fallback(url, done);
  }
  function fallback(url, done) {
    const ta = document.createElement('textarea');
    ta.value = url;
    ta.setAttribute('readonly', '');
    ta.style.cssText = 'position:fixed;opacity:0;left:0;top:0';
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand('copy'); done(); } catch (e) { window.prompt(t.share, url); }
    ta.remove();
  }

  // ---------- Druckblatt (»Drucken / als PDF«) ----------
  function printSheet() {
    document.querySelectorAll('.tcfg-sheet').forEach((n) => n.remove());
    const sheet = document.createElement('div');
    sheet.className = 'tcfg-sheet';
    const logo = document.querySelector('.site-header__logo img');
    const rows = parts();
    const set = [[t.m_H, `${fmt(S.H)} ${t.u_mm} · »toolOrganizer ${S.H}« · ${fill(t.p_cab, { H: fmt(CAB[S.H]), w: fmt(WIDTH), d: fmt(DEPTH) })}`],
      [t.m_ctrl, plain(t[`c_${S.ctrl}`])], [t.m_exec, execText()]];
    const date = new Intl.DateTimeFormat(lang, { dateStyle: 'long' }).format(new Date());
    sheet.innerHTML = `${logo ? `<img src="${escH(logo.src)}" alt="ZOLLER">` : ''}<h1>${escH(t.print_t)}</h1>`
      + `<p class="tcfg-sheet__meta">${escH(date)} · ${escH(shareUrl())}</p><div class="tcfg-sheet__grid"><svg></svg><div>`
      + `<table><tbody>${set.map(([k, v]) => `<tr><th scope="row">${escH(k)}</th><td>${escH(v)}</td></tr>`).join('')}</tbody></table>`
      + `<h2>${escH(t.m_list)}</h2><table><thead><tr><th>#</th><th>${escH(t.col_h)}</th><th>${escH(t.col_div)}</th></tr></thead><tbody>`
      + S.dr.map((d, i) => `<tr><td>${i + 1}</td><td>${fmt(d.h)} ${t.u_mm}</td><td>${escH(divText(d))}${d.kg ? ` · 160 ${t.u_kg}` : ''}</td></tr>`).join('')
      + `</tbody></table></div></div><h2>${escH(t.sum_t)}</h2><table><thead><tr><th>${escH(t.col_qty)}</th><th>${escH(t.col_item)}</th>`
      + `<th>${escH(t.col_art)}</th></tr></thead><tbody>${partsHtml(rows)}</tbody></table>`
      + `<p class="tcfg-sheet__note">${escH((root.parentNode.querySelector('.tcfg__note') || {}).textContent || '')}</p>`;
    document.body.appendChild(sheet);
    const svg = sheet.querySelector('svg');
    svg.style.width = '60mm';
    svg.style.height = '90mm';
    drawFront(svg, null);
    document.documentElement.classList.add('tcfg-printing');
    const end = () => { document.documentElement.classList.remove('tcfg-printing'); sheet.remove(); window.removeEventListener('afterprint', end); };
    window.addEventListener('afterprint', end);
    window.print();
  }

  // ---------- Start ----------
  root.querySelectorAll('[data-n]').forEach((n) => { n.textContent = fmt(+n.dataset.n); });   // Zahlen wie im Rest (Intl)
  root.querySelectorAll('[data-cab]').forEach((n) => { n.textContent = fill(t.s1_cab, { H: fmt(+n.dataset.cab) }); });
  const q = new URLSearchParams(location.search).get('k');
  if (!q || !decode(q)) preset();
  window.addEventListener('resize', schedule);
  if ('IntersectionObserver' in window) {     // Handy: Ergebniszeile ausblenden, sobald die große Vorschau zu sehen ist
    const bar = root.querySelector('.tcfg__bar');
    new IntersectionObserver(([en]) => bar.classList.toggle('is-off', en.isIntersecting), { threshold: 0.2 })
      .observe(root.querySelector('.tcfg__out'));
  }
  update();
  if (q && sec && location.hash === `#${sec.id}`) requestAnimationFrame(() => sec.scrollIntoView());
})();
