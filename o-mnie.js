// Sekcja „O mnie” – tekst i lista muzyków Paweł zmienia w panelu (tabela ustawienia).
// Gdy w bazie nic nie ma, zostaje treść zapisana w HTML.
(function () {
  const cfg = window.SKLEP_CONFIG || {};
  if (!cfg.supabaseUrl || !cfg.supabaseKey) return;
  // tekst „O mnie” z panelu jest po polsku – w wersjach DE/EN zostaje przetłumaczony tekst ze strony
  const pl = (document.documentElement.lang || 'pl') === 'pl';
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  fetch(cfg.supabaseUrl + '/rest/v1/ustawienia?select=klucz,wartosc&klucz=in.(o_mnie,grali)', {
    headers: { apikey: cfg.supabaseKey, Authorization: 'Bearer ' + cfg.supabaseKey }
  }).then((r) => { if (!r.ok) throw new Error(r.status); return r.json(); }).then((rows) => {
    const v = (k) => ((rows.find((r) => r.klucz === k) || {}).wartosc || '').trim();
    const tekst = v('o_mnie');
    if (tekst && pl) {
      document.getElementById('o-mnie-tekst').innerHTML =
        tekst.split(/\n\s*\n/).map((a) => '<p>' + esc(a.trim()).replace(/\n/g, '<br>') + '</p>').join('');
    }
    const grali = v('grali');
    if (grali) {
      // każda linia: „Nazwa | link” (link opcjonalny)
      document.getElementById('grali-lista').innerHTML = grali.split('\n').map((l) => l.trim()).filter(Boolean).map((l) => {
        const [nazwa, link] = l.split('|').map((x) => x.trim());
        return /^https?:\/\//.test(link || '')
          ? '<li><a href="' + esc(link) + '" target="_blank" rel="noopener">' + esc(nazwa) + '</a></li>'
          : '<li><span>' + esc(nazwa) + '</span></li>';
      }).join('');
    }
  }).catch(() => {});
})();
