// Konfigurator bębna na zamówienie: rozmiar, korpus (wykończenie ramy) i skóra.
// Korpusy i skóry Paweł dodaje w panelu. Gdy baza nie odpowiada, zostają skóry zapisane w HTML.
(function () {
  const cfg = window.SKLEP_CONFIG || {};
  const T = window.T || ((s) => s);   // tłumaczenia (i18n.js – tylko w wersjach DE/EN)
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const wybor = { rozmiar: '', korpus: null, skora: null };
  let korpusy = [];
  let skory = [];

  function suma() {
    document.getElementById('suma-rozmiar').textContent = wybor.rozmiar || T('do ustalenia');
    document.getElementById('suma-korpus').textContent = wybor.korpus ? wybor.korpus.nazwa : T('do ustalenia');
    document.getElementById('suma-skora').textContent = wybor.skora ? wybor.skora.nazwa : T('do ustalenia');
  }

  // ---------- rozmiar ----------
  const rozmiary = document.getElementById('konf-rozmiary');
  rozmiary.addEventListener('click', (e) => {
    const b = e.target.closest('[data-rozmiar]'); if (!b) return;
    wybor.rozmiar = wybor.rozmiar === b.dataset.rozmiar ? '' : b.dataset.rozmiar;   // drugie kliknięcie odznacza
    rozmiary.querySelectorAll('button').forEach((x) => {
      x.classList.toggle('on', x.dataset.rozmiar === wybor.rozmiar);
      x.setAttribute('aria-pressed', x.dataset.rozmiar === wybor.rozmiar);
    });
    suma();
  });

  // ---------- korpus ----------
  const korpusyBox = document.getElementById('lista-korpusow');
  korpusyBox.addEventListener('click', (e) => {
    const b = e.target.closest('[data-korpus]'); if (!b) return;
    const k = korpusy[+b.dataset.korpus];
    wybor.korpus = wybor.korpus === k ? null : k;
    korpusyBox.querySelectorAll('[data-korpus]').forEach((x) => {
      const on = korpusy[+x.dataset.korpus] === wybor.korpus;
      x.classList.toggle('on', on); x.setAttribute('aria-pressed', on);
    });
    suma();
  });

  // ---------- skóra ----------
  const grid = document.getElementById('lista-skor');
  // skóry zapisane w HTML (gdy baza nie odpowie)
  skory = [...grid.querySelectorAll('.skin')].map((el) => ({ id: null, nazwa: el.querySelector('span').textContent, zdjecie: el.querySelector('img').src, status: 'dostepna' }));
  grid.querySelectorAll('.skin').forEach((el, i) => { el.dataset.skora = i; });

  function wybierzSkore(el) {
    if (!el || el.disabled) return;
    const s = skory[+el.dataset.skora];
    wybor.skora = wybor.skora === s ? null : s;
    grid.querySelectorAll('[data-skora]').forEach((x) => {
      const on = skory[+x.dataset.skora] === wybor.skora;
      x.classList.toggle('on', on); x.setAttribute('aria-pressed', on);
    });
    suma();
  }
  grid.addEventListener('click', (e) => wybierzSkore(e.target.closest('[data-skora]')));
  grid.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') { const el = e.target.closest('div[data-skora]'); if (el) { e.preventDefault(); wybierzSkore(el); } }
  });

  document.getElementById('skin-cta').addEventListener('click', () => window.otworzZamowienie({ ...wybor }));

  if (!cfg.supabaseUrl || !cfg.supabaseKey) return;
  const api = (path) => fetch(cfg.supabaseUrl + '/rest/v1/' + path, {
    headers: { apikey: cfg.supabaseKey, Authorization: 'Bearer ' + cfg.supabaseKey }
  }).then((r) => { if (!r.ok) throw new Error(r.status); return r.json(); });

  api('skory?select=*&order=kolejnosc.asc,created_at.asc').then((lista) => {
    if (!lista.length) return;
    skory = lista; wybor.skora = null; suma();
    grid.innerHTML = skory.map((s, i) => {
      const rez = s.status === 'zarezerwowana';
      return '<button type="button" class="skin" data-skora="' + i + '" aria-pressed="false"' + (rez ? ' disabled' : '') +
        ' aria-label="' + esc(s.nazwa) + (rez ? ' – ' + T('Zarezerwowana') : '') + '"' + (s.opis ? ' title="' + esc(s.opis) + '"' : '') + '>' +
        '<span class="skin-foto"><img src="' + esc(s.zdjecie) + '" alt="" loading="lazy">' +
        (rez ? '<span class="rez-stamp" aria-hidden="true">' + T('Zarezerwowana') + '</span>' : '') + '</span>' +
        '<span>' + esc(s.nazwa) + '</span></button>';
    }).join('');
  }).catch(() => { /* zostają skóry z HTML */ });

  // korpusy – krok pokazuje się dopiero, gdy Paweł doda choć jeden
  api('korpusy?select=*&order=kolejnosc.asc,created_at.asc').then((lista) => {
    if (!lista.length) return;
    korpusy = lista;
    korpusyBox.innerHTML = korpusy.map((k, i) =>
      '<button type="button" class="korpus" data-korpus="' + i + '" aria-pressed="false">' +
        (k.zdjecie ? '<img src="' + esc(k.zdjecie) + '" alt="" loading="lazy">' : '') +
        '<span>' + esc(k.nazwa) + '</span>' + (k.opis ? '<small>' + esc(k.opis) + '</small>' : '') + '</button>').join('');
    document.getElementById('konf-korpusy').hidden = false;
    document.getElementById('suma-korpus-li').hidden = false;
    document.getElementById('konf-nr-skora').textContent = '3';
  }).catch(() => {});
})();
