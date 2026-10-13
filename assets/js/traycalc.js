/* »highTower«: Tablar-Rechner – wie viele Tablare und Werkzeugplätze passen in den Lagerlift?
   Richtwert aus Gerätehöhe, Werkzeughöhe und Tablargröße; Texte kommen aus dem Block (content/hightower.json).

   Feste Werte aus dem Datenblatt des Geräts: Gerätehöhe 2.550–30.050 mm im 100-mm-Raster, Lagerplatzraster 25 mm,
   Nutzlast bis 555 kg je Tablar, Gerätebreite = Tablarbreite + 330 mm, Gerätetiefe = 2 × Tablartiefe + 1.092 mm.
   Tablar 55 mm hoch. Werkzeugeinsätze 72 mm breit, große Aufnahmen 95 mm (ZOLLER »keeper«, Konfiguration).
   Annahmen (als solche im Rechner genannt): Sockel 150 mm, Kopf 500 mm, Bedienöffnung in 900 mm Arbeitshöhe mit
   250 mm Sturz, 20 mm Luft über dem Werkzeug, 40 mm Rand auf dem Tablar. */
(() => {
  'use strict';
  const root = document.querySelector('[data-traycalc]');
  if (!root) return;
  const cfg = JSON.parse(root.getAttribute('data-traycalc'));
  const t = cfg.t;
  const form = root.querySelector('form');
  const svg = root.querySelector('.traycalc__svg');
  const NS = 'http://www.w3.org/2000/svg';
  const lang = document.documentElement.lang || 'de';
  const fmt = (v, d = 0) => new Intl.NumberFormat(lang, { minimumFractionDigits: d, maximumFractionDigits: d }).format(v);
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

  const K = { base: 150, head: 500, sill: 900, lintel: 250, tray: 55, gap: 20, grid: 25, load: 555, edge: 40, addW: 330, addD: 1092 };
  const HOLDERS = {
    hsk40: { insert: 72, dia: 40, kg: 1.0 }, hsk63: { insert: 72, dia: 63, kg: 2.5 }, hsk100: { insert: 95, dia: 100, kg: 6.5 },
    sk30: { insert: 72, dia: 50, kg: 1.2 }, sk40: { insert: 72, dia: 63, kg: 2.5 }, sk50: { insert: 95, dia: 100, kg: 6.5 },
  };

  const radio = (k) => form.querySelector(`input[type=radio][name$="-${k}"]:checked`);
  const pair = (k) => [...form.querySelectorAll(`input[name="${k}"]`)];
  const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

  function read() {
    const v = (k) => parseFloat(pair(k)[1].value);
    return { holder: radio('holder').value, h: v('h'), dia: v('dia'), kg: v('kg'), H: v('H'), w: +radio('w').value, d: +radio('d').value };
  }

  function calc(s) {
    const pitch = Math.ceil((K.tray + s.h + K.gap) / K.grid) * K.grid;
    const open = Math.max(350, Math.ceil((s.h + K.tray + 95) / 50) * 50);     // lichte Höhe der Bedienöffnung
    const frontStart = K.sill + open + K.lintel;
    const rear = Math.max(0, Math.floor((s.H - K.base - K.head) / pitch));
    const front = Math.max(0, Math.floor((s.H - K.head - frontStart) / pitch));
    const g = Math.max(HOLDERS[s.holder].insert, s.dia + 10);
    const rows = Math.max(0, Math.floor((s.d - 2 * K.edge) / g));
    const cols = Math.max(0, Math.floor((s.w - 2 * K.edge) / g));
    const geo = rows * cols;
    const byKg = Math.floor(K.load / s.kg);
    const per = Math.min(geo, byKg);
    const trays = rear + front;
    return {
      pitch, open, frontStart, rear, front, trays, g, rows, per, limit: geo <= byKg ? 'space' : 'weight',
      tools: trays * per, area: trays * s.w * s.d / 1e6,
      footW: s.w + K.addW, footD: 2 * s.d + K.addD,
    };
  }

  // ---------- Zahlen ----------
  // Zahlen zählen kurz hoch; der Endwert steht spätestens nach 0,5 s da (auch wenn der Tab im Hintergrund kein rAF liefert)
  const shown = {}, runs = {};
  function count(el, key, to, dec) {
    const from = shown[key] ?? to;
    shown[key] = to;
    const run = runs[key] = (runs[key] || 0) + 1;
    const done = () => { if (runs[key] === run) el.textContent = fmt(to, dec); };
    if (reduced || from === to) { done(); return; }
    const t0 = performance.now();
    const step = (now) => {
      if (runs[key] !== run) return;
      const k = Math.min(1, (now - t0) / 420);
      const e = 1 - Math.pow(1 - k, 3);
      el.textContent = fmt(from + (to - from) * e, k < 1 ? 0 : dec);
      if (k < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
    setTimeout(done, 500);
  }
  const out = (k) => root.querySelector(`[data-out="${k}"]`);
  const pre = (k) => root.querySelector(`[data-pre="${k}"]`);

  // ---------- Schnitt durch das Gerät ----------
  function el(name, attrs, parent) {
    const n = document.createElementNS(NS, name);
    for (const k in attrs) n.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(n);
    return n;
  }

  function draw(s, r) {
    const H = s.H, D = s.d, Dd = r.footD;
    const left = 700, man = 1050, pad = 260;
    const W = left + Dd + man, top = 250;
    const total = H + top + pad;
    svg.setAttribute('viewBox', `${-left} ${-top} ${W + 120} ${total}`);
    svg.style.aspectRatio = `${W + 120} / ${total}`;
    svg.textContent = '';
    const y = (v) => H - v;                       // Höhe über Boden -> SVG-Koordinate
    const px = Math.min(svg.clientWidth / (W + 120), svg.clientHeight / total) || .1;   // Pixel je mm – Details nur, wenn sichtbar
    const g = el('g', {}, svg);

    el('rect', { class: 'tc-body', x: 0, y: 0, width: Dd, height: H, rx: 30 }, g);
    const wall = 70, xr = wall, xf = Dd - wall - D;
    el('rect', { class: 'tc-zone', x: wall, y: y(K.base), width: Dd - 2 * wall, height: K.base - 20 }, g);
    el('rect', { class: 'tc-zone', x: wall, y: wall * .6, width: Dd - 2 * wall, height: K.head - wall * .6 - 20 }, g);
    el('line', { class: 'tc-shaft', x1: Dd / 2, y1: K.head, x2: Dd / 2, y2: y(K.base) }, g);

    const toolW = Math.min(r.g * .72, s.dia), holdW = Math.min(r.g * .82, HOLDERS[s.holder].insert * .78);
    const drawTray = (x, base, cls) => {
      el('rect', { class: cls || 'tc-tray', x, y: y(base + K.tray), width: D, height: K.tray }, g);
      if (r.pitch * px < 7 || !r.rows) return;
      const hh = s.h * .42, th = s.h - hh;
      const x0 = x + (D - (r.rows - 1) * r.g) / 2;
      for (let i = 0; i < r.rows; i++) {
        const cx = x0 + i * r.g;
        el('rect', { class: cls ? 'tc-tool tc-tool--hi' : 'tc-tool', x: cx - holdW / 2, y: y(base + K.tray + hh), width: holdW, height: hh }, g);
        el('rect', { class: cls ? 'tc-tool tc-tool--hi tc-cut' : 'tc-tool tc-cut', x: cx - toolW / 2 * .7, y: y(base + K.tray + s.h), width: toolW * .7, height: th }, g);
      }
    };
    for (let i = 0; i < r.rear; i++) drawTray(xr, K.base + i * r.pitch);
    for (let i = 0; i < r.front; i++) drawTray(xf, r.frontStart + i * r.pitch);

    // Bedienöffnung vorne mit dem bereitgestellten Tablar
    el('rect', { class: 'tc-open', x: xf - 20, y: y(K.sill + r.open), width: D + wall + 20, height: r.open }, g);
    drawTray(xf + wall * .5, K.sill - K.tray, 'tc-tray tc-tray--hi');

    // Boden, Maßlinie, Mensch zum Größenvergleich
    el('line', { class: 'tc-floor', x1: -left + 80, y1: H, x2: Dd + man + 60, y2: H }, g);
    const xm = -330;
    el('line', { class: 'tc-dim', x1: xm, y1: 0, x2: xm, y2: H }, g);
    el('line', { class: 'tc-dim', x1: xm - 70, y1: 0, x2: xm + 70, y2: 0 }, g);
    el('line', { class: 'tc-dim', x1: xm - 70, y1: H, x2: xm + 70, y2: H }, g);
    const fs = clamp(14 / px, 120, 2400);
    const tx = el('text', { class: 'tc-label', x: xm - fs * .45, y: H / 2, 'font-size': fs, 'text-anchor': 'middle', transform: `rotate(-90 ${xm - fs * .45} ${H / 2})` }, g);
    tx.textContent = `${fmt(H)} ${t.u_mm}`;
    const mx = Dd + 520;
    const m = el('g', { class: 'tc-man', transform: `translate(${mx} ${H - 1750})` }, g);
    el('circle', { cx: 0, cy: 115, r: 115 }, m);
    el('path', { d: 'M-190 300 Q-200 250 -140 250 L140 250 Q200 250 190 300 L170 900 L120 900 L110 1000 L95 1750 L15 1750 L0 1050 L-15 1750 L-95 1750 L-110 1000 L-120 900 L-170 900 Z' }, m);
  }

  // ---------- Ausgabe ----------
  let lastTrays;
  function update() {
    const s = read();
    const r = calc(s);
    count(out('trays'), 'trays', r.trays, 0);
    count(out('tools'), 'tools', r.tools, 0);
    count(out('area'), 'area', r.area, 0);
    root.querySelector('[data-bar="trays"]').textContent = fmt(r.trays);
    root.querySelector('[data-bar="tools"]').textContent = fmt(r.tools);
    pre('trays').textContent = t.approx;
    pre('tools').textContent = t.upto;
    pre('area').textContent = t.approx;
    const lim = r.limit === 'space' ? t.lim_space : t.lim_weight;
    out('detail').textContent = [
      `${t.pitch} ${fmt(r.pitch)} ${t.u_mm}`,
      `${t.per_tray}: ${fmt(r.per)} (${lim})`,
      `${t.foot} ${fmt(r.footW)} × ${fmt(r.footD)} ${t.u_mm}`,
    ].join(' · ');
    draw(s, r);
    if (lastTrays !== undefined && lastTrays !== r.trays) {
      out('trays').closest('.traycalc__kpi').classList.remove('is-bump');
      void out('trays').offsetWidth;
      out('trays').closest('.traycalc__kpi').classList.add('is-bump');
    }
    lastTrays = r.trays;
    const holder = radio('holder').nextElementSibling.textContent;
    const body = [t.mail_intro, '',
      `${t.H}: ${fmt(s.H)} ${t.u_mm}`, `${t.tray}: ${fmt(s.w)} × ${fmt(s.d)} ${t.u_mm}`, `${t.holder}: ${holder}`,
      `${t.h}: ${fmt(s.h)} ${t.u_mm}`, `${t.dia}: ${fmt(s.dia)} ${t.u_mm}`, `${t.kg}: ${fmt(s.kg, 1)} ${t.u_kg}`, '',
      `${t.mail_result}:`, `${t.k_trays}: ${t.approx} ${fmt(r.trays)}`, `${t.k_tools}: ${t.upto} ${fmt(r.tools)}`, ''].join('\n');
    out('mail').href = `mailto:${cfg.mail}?subject=${encodeURIComponent(t.mail_subject)}&body=${encodeURIComponent(body)}`;
  }

  let queued = false;
  const run = () => { if (queued) { queued = false; update(); } };
  const schedule = () => { if (!queued) { queued = true; requestAnimationFrame(run); setTimeout(run, 120); } };

  // Regler und Zahlenfeld laufen gemeinsam; Eingaben werden erst beim Verlassen auf Raster und Grenzen gesetzt
  form.addEventListener('input', (e) => {
    const i = e.target;
    if (i.type === 'range' || i.type === 'number') {
      const [num, range] = pair(i.name);
      if (i.type === 'range') num.value = i.value;
      else if (i.value !== '' && !isNaN(+i.value)) range.value = clamp(+i.value, +range.min, +range.max);
      else return;
    }
    if (i.name && i.name.endsWith('-holder')) {           // neue Aufnahme: Durchmesser und Gewicht vorschlagen
      const h = HOLDERS[i.value];
      pair('dia').forEach((x) => { x.value = h.dia; });
      pair('kg').forEach((x) => { x.value = h.kg; });
    }
    schedule();
  });
  form.addEventListener('change', (e) => {
    const i = e.target;
    if (i.type !== 'number') return;
    const [num, range] = pair(i.name);
    const st = +range.step, lo = +range.min;
    let v = clamp(isNaN(+num.value) || num.value === '' ? +range.value : +num.value, lo, +range.max);
    v = lo + Math.round((v - lo) / st) * st;
    v = +v.toFixed(st < 1 ? 1 : 0);
    num.value = range.value = v;
    schedule();
  });
  form.addEventListener('submit', (e) => e.preventDefault());
  window.addEventListener('resize', schedule);
  if ('IntersectionObserver' in window) {     // Ergebniszeile ausblenden, sobald das große Ergebnis zu sehen ist
    const bar = root.querySelector('.traycalc__bar');
    new IntersectionObserver(([en]) => bar.classList.toggle('is-off', en.isIntersecting), { threshold: .25 })
      .observe(root.querySelector('.traycalc__kpis'));
  }
  update();
})();
