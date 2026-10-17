/* ZOLLER-Formulare -> HubSpot (Forms-API v3). Wird von tools/hubspot.py in jede HubSpot-Seite mit Formular eingebettet,
   damit es ohne neue Dateien auf GitHub Pages läuft. Felder mit data-hs gehen in die gleichnamige Kontakteigenschaft, alle
   Angaben zusätzlich lesbar in »zoller_formular« (wie bisher im E-Mail-Text). Klappt das Senden nicht, öffnet sich wie bisher
   die fertige E-Mail an die Landesgesellschaft (data-mailto-fallback). */
(() => {
  const S = window.ZHS || {};
  const t = (k) => S[k] || k;
  const cookie = (n) => decodeURIComponent((document.cookie.match('(?:^|; )' + n + '=([^;]*)') || [])[1] || '');
  const labelOf = (form, el) => {
    const lab = (el.id && form.querySelector(`label[for="${CSS.escape(el.id)}"]`)) || el.closest('label');
    return ((lab && lab.textContent) || el.placeholder || '').replace(/\s+/g, ' ').replace(/\*/g, '').trim();
  };
  const note = (form, text, cls) => {
    let p = form.querySelector('.form-sent');
    if (!p) { p = document.createElement('p'); p.className = 'form-sent form-note'; p.setAttribute('role', 'status'); form.append(p); }
    p.className = 'form-sent form-note' + (cls ? ' ' + cls : '');
    p.textContent = text;
    return p;
  };

  document.querySelectorAll('form[data-hs-form]').forEach(form => {
    const btn = form.querySelector('[type="submit"]');
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (form.dataset.busy || (form.reportValidity && !form.reportValidity())) return;
      const fields = [], lines = [], seen = {};
      let bot = false, consent = '';
      form.querySelectorAll('input, select, textarea').forEach(el => {
        if (!el.name || ['submit', 'button', 'hidden', 'password', 'reset', 'file'].includes(el.type)) return;
        if (el.getAttribute('aria-hidden') === 'true' && el.tabIndex === -1) { if (el.value) bot = true; return; }   // Honigtopf
        if ((el.type === 'checkbox' || el.type === 'radio') && !el.checked) return;
        const opt = el.tagName === 'SELECT' ? el.options[el.selectedIndex] : null;
        const val = opt ? (opt.value ? opt.text.trim() : '') : (el.type === 'checkbox' ? '✓' : el.value.trim());
        if (!val) return;
        const label = labelOf(form, el) || el.name;
        const prop = el.dataset.hs;
        if (prop === 'consent') consent = label;
        else if (prop && el.type === 'checkbox') fields.push({ name: prop, value: 'true' });
        else if (prop && !seen[prop]) { seen[prop] = 1; fields.push({ name: prop, value: val }); }
        lines.push(`${label}: ${val}`);
      });
      if (bot) { form.hidden = true; note(form, t('Vielen Dank – Ihre Angaben sind bei ZOLLER angekommen. Wir melden uns in Kürze.')); return; }
      const Z = window.ZCurrency;
      const extra = { zoller_anfrage: form.dataset.subject || document.title, zoller_formular: lines.join('\n'),
                      zoller_website: form.dataset.hsSite || location.hostname, zoller_waehrung: Z ? Z.get() : '' };
      if (form.dataset.hsNewsletter) extra.zoller_newsletter = 'true';
      Object.entries(extra).forEach(([name, value]) => { if (value && !fields.some(f => f.name === name)) fields.push({ name, value }); });
      const ctx = { pageUri: location.href, pageName: document.title };
      const hutk = cookie('hubspotutk');
      if (hutk) ctx.hutk = hutk;
      const body = { fields, context: ctx };
      if (consent) body.legalConsentOptions = { consent: { consentToProcess: true, text: consent } };
      const url = `https://api.hsforms.com/submissions/v3/integration/submit/${form.dataset.hsPortal}/${form.dataset.hsForm}`;
      const send = (b) => fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(b) });

      form.dataset.busy = '1';
      if (btn) btn.disabled = true;
      note(form, t('Wird gesendet …'));
      let ok = false;
      try {
        let r = await send(body);
        if (!r.ok && r.status === 400 && body.legalConsentOptions && /consent/i.test(await r.clone().text())) {
          delete body.legalConsentOptions;   // Konto ohne DSGVO-Optionen: Zustimmung steht dann nur im Formulartext
          r = await send(body);
        }
        ok = r.ok;
        if (!ok) console.warn('[ZOLLER HubSpot]', r.status, await r.text());
      } catch (err) { console.warn('[ZOLLER HubSpot]', err); }
      delete form.dataset.busy;
      if (btn) btn.disabled = false;
      if (ok) {
        const p = note(form, t('Vielen Dank – Ihre Angaben sind bei ZOLLER angekommen. Wir melden uns in Kürze.'), 'form-sent--ok');
        form.parentNode.insertBefore(p, form);
        form.hidden = true;
        p.tabIndex = -1; p.focus({ preventScroll: true });
        p.scrollIntoView({ block: 'center', behavior: 'smooth' });
        return;
      }
      // Rückfall: fertige E-Mail wie auf der statischen Seite
      note(form, t('Das Senden hat nicht geklappt – Ihr E-Mail-Programm öffnet sich stattdessen mit der fertigen Nachricht.'));
      location.href = `mailto:${form.dataset.mailtoFallback}?subject=${encodeURIComponent(form.dataset.subject || document.title)}` +
                      `&body=${encodeURIComponent(lines.join('\n'))}`;
    });
  });
})();
