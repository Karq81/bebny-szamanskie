// Skóry do bębnów na zamówienie – pobierane z bazy (Paweł dodaje je w panelu).
// Gdy baza nie odpowiada, zostają skóry zapisane w HTML.
(function () {
  const cfg = window.SKLEP_CONFIG || {};
  if (!cfg.supabaseUrl || !cfg.supabaseKey) return;

  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  fetch(cfg.supabaseUrl + '/rest/v1/skory?select=*&order=kolejnosc.asc,created_at.asc', {
    headers: { apikey: cfg.supabaseKey, Authorization: 'Bearer ' + cfg.supabaseKey }
  }).then((r) => { if (!r.ok) throw new Error(r.status); return r.json(); }).then((skory) => {
    if (!skory.length) return;
    const grid = document.getElementById('lista-skor');
    grid.innerHTML = skory.map((s, i) => {
      const rez = s.status === 'zarezerwowana';
      return '<button type="button" class="skin" data-skora="' + i + '"' + (rez ? ' disabled' : '') +
        ' aria-label="' + esc(s.nazwa) + (rez ? ' – zarezerwowana' : ' – zamów bęben z tej skóry') + '">' +
        '<span class="skin-foto"><img src="' + esc(s.zdjecie) + '" alt="" loading="lazy">' +
        (rez ? '<span class="rez-stamp" aria-hidden="true">Zarezerwowana</span>' : '') + '</span>' +
        '<span>' + esc(s.nazwa) + '</span>' +
        (s.cena_od && !rez ? '<small>bęben od ' + s.cena_od.toLocaleString('pl-PL') + ' zł</small>' : '') +
        '</button>';
    }).join('');
    grid.addEventListener('click', (e) => {
      const b = e.target.closest('[data-skora]');
      if (b && !b.disabled) window.otworzZamowienie(skory[+b.dataset.skora]);
    });

    const cta = document.getElementById('skin-cta');
    const nowy = cta.cloneNode(false);   // bez starego zachowania „przewiń do formularza”
    nowy.textContent = 'Nie wiesz, którą wybrać? Dobierzmy skórę razem →';
    nowy.addEventListener('click', (e) => { e.preventDefault(); window.otworzZamowienie(null); });
    cta.replaceWith(nowy);
  }).catch(() => { /* zostają skóry z HTML */ });
})();
