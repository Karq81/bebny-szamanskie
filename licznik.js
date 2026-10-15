// Licznik odwiedzin w stopce. Jedno wejście na wizytę (sessionStorage) – odświeżanie i zakładki nie nabijają licznika.
// Gdy w bazie nie ma jeszcze licznika (supabase/odwiedziny.sql), napis się nie pokazuje.
(function () {
  const cfg = window.SKLEP_CONFIG || {};
  const el = document.getElementById('licznik');
  if (!el || !cfg.supabaseUrl || !cfg.supabaseKey) return;
  const lang = document.documentElement.lang || 'pl';
  const NAPIS = { pl: 'Odwiedzin', de: 'Besuche', en: 'Visits' };

  let policzone = false;
  try { policzone = sessionStorage.getItem('policzone') === '1'; } catch (e) {}

  const rpc = (nazwa, dane) => fetch(cfg.supabaseUrl + '/rest/v1/rpc/' + nazwa, {
    method: 'POST',
    headers: { apikey: cfg.supabaseKey, Authorization: 'Bearer ' + cfg.supabaseKey, 'Content-Type': 'application/json' },
    body: JSON.stringify(dane || {})
  }).then((r) => { if (!r.ok) throw new Error(r.status); return r.json(); });

  (policzone ? rpc('liczba_odwiedzin') : rpc('licz_wejscie', { jezyk: lang, strona: location.pathname }))
    .then((n) => {
      try { sessionStorage.setItem('policzone', '1'); } catch (e) {}
      el.textContent = (NAPIS[lang] || NAPIS.pl) + ': ' + Number(n).toLocaleString(lang === 'en' ? 'en-GB' : lang);
      el.hidden = false;
    })
    .catch(() => {});
})();
