/* Tooling-Shop: Werkzeugaufnahme finden – Art der Aufnahme und Schnittstelle der Maschine wählen, der Knopf öffnet den
   Shop in MYZOLLER mit genau diesen Filtern (kind=tooling, category, iface). Kategorien und Schnittstellen sind dieselben
   Schlüssel wie im Shop (content/tooling.json). Ohne JavaScript öffnet der Knopf alle Werkzeugaufnahmen. */
(() => {
  'use strict';
  document.querySelectorAll('[data-toolfinder]').forEach((root) => {
    const cfg = JSON.parse(root.getAttribute('data-toolfinder'));
    const form = root.querySelector('form');
    const step2 = root.querySelector('[data-step="iface"]');
    const none = step2.querySelector('.toolfinder__none');
    const ifaces = step2.querySelector('.toolfinder__ifaces');
    const out = (k) => root.querySelector(`[data-out="${k}"]`);
    const picked = (name) => form.querySelector(`input[name$="-${name}"]:checked`);
    // Kategorienamen werden nicht getrennt (»Werkzeugaufnah-men«): passt das längste Wort nicht in die Box, wird die Schrift kleiner
    const fit = () => {
      const h = out('cat');
      h.style.fontSize = '';
      const over = h.scrollWidth / Math.max(1, h.clientWidth);
      if (over > 1.005) h.style.fontSize = `${(parseFloat(getComputedStyle(h).fontSize) / over * 0.97).toFixed(1)}px`;
    };

    function update() {
      const cat = picked('cat');
      const iface = picked('if');
      const needsIface = !cat || !cat.value || cat.dataset.iface === '1';
      // Spannzangen, Verlängerungen, Zubehör: unabhängig von der Spindelschnittstelle
      none.hidden = needsIface;
      ifaces.hidden = !needsIface;
      step2.classList.toggle('is-off', !needsIface);
      const url = new URL(cfg.shop);
      if (cat && cat.value) url.searchParams.set('category', cat.value);
      if (needsIface && iface && iface.value) url.searchParams.set('iface', iface.value);
      out('link').href = url.toString();
      out('cat').textContent = cat && cat.value ? cat.nextElementSibling.textContent : cfg.all_cats;
      out('iface').textContent = !needsIface ? cfg.s2_none : iface && iface.value ? iface.value : cfg.all_ifaces;
      fit();
    }
    form.addEventListener('change', update);
    form.addEventListener('submit', (e) => e.preventDefault());
    update();
    addEventListener('resize', fit);
    document.fonts?.ready.then(fit);
  });
})();
