// Pobiera bębny i filmy z Supabase i wstawia je na stronę.
// Gdy baza nie jest podłączona albo nie odpowiada, zostają karty zapisane w HTML.
(function () {
  const cfg = window.SKLEP_CONFIG || {};
  if (!cfg.supabaseUrl || !cfg.supabaseKey) return;
  const T = window.T || ((s) => s);   // tłumaczenia (i18n.js – tylko w wersjach DE/EN)
  // wersja DE/EN: pola nazwa_de / opis_en itd. z panelu; puste = tekst polski (albo słownik i18n)
  const LOK = document.documentElement.lang || 'pl';
  // tekst z bazy w wersji DE/EN: tłumaczenie z panelu, a gdy go brak – słownik strony (całość albo linijka po linijce)
  const zeSlownika = (tekst) => {
    const s = String(tekst || '');
    if (T(s) !== s) return T(s);
    return s.split('\n').map((l) => (l.trim() && T(l.trim()) !== l.trim() ? T(l.trim()) : l)).join('\n');
  };
  // zdjęcia z własnej strony zawsze z tego samego adresu co strona (działa i na http, i na https)
  const adresZdj = (u) => String(u || '').replace(/^https?:\/\/(karq81\.github\.io\/bebny-szamanskie|(www\.)?bebny-szamanskie\.pl)\//, '/');
  const lokalnie = (r, pola) => { if (LOK !== 'pl') pola.forEach((k) => { const t = (r[k + '_' + LOK] || '').trim(); r[k] = t || zeSlownika(r[k]); }); return r; };

  const api = (path) => fetch(cfg.supabaseUrl + '/rest/v1/' + path, {
    headers: { apikey: cfg.supabaseKey, Authorization: 'Bearer ' + cfg.supabaseKey }
  }).then((r) => { if (!r.ok) throw new Error(r.status); return r.json(); });

  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const LANG = document.documentElement.lang || 'pl';
  // w wersjach DE/EN obok złotówek orientacyjnie euro (kurs przybliżony)
  const zl = (n) => n.toLocaleString('pl-PL') + ' zł' + (LANG === 'pl' ? '' : ' <small class="eur">(≈ ' + Math.round(n / 4.3) + ' €)</small>');

  const STATUS = {
    dostepny: null,
    zarezerwowany: { tekst: T('Zarezerwowany'), klasa: 'reserved' },
    na_zamowienie: { tekst: T('Na zamówienie'), klasa: 'custom' },
    wkrotce: { tekst: T('Wkrótce'), klasa: 'soon' },
    sprzedany: { tekst: T('Sprzedany'), klasa: 'sold' }
  };

  function youtubeId(url) {
    const m = String(url || '').match(/(?:youtu\.be\/|v=|shorts\/|embed\/|live\/)([\w-]{11})/);
    return m ? m[1] : null;
  }

  // Miniatura z przyciskiem – właściwy odtwarzacz ładuje się dopiero po kliknięciu.
  function filmHtml(url, tytul) {
    const id = youtubeId(url);
    if (!id) return '';
    return '<button class="film" type="button" data-yt="' + id + '" aria-label="' + T('Odtwórz film:') + ' ' + esc(tytul) + '">' +
      '<img src="https://i.ytimg.com/vi/' + id + '/hqdefault.jpg" alt="" loading="lazy">' +
      '<span class="film-play" aria-hidden="true"></span></button>';
  }

  document.addEventListener('click', (e) => {
    const b = e.target.closest('.film[data-yt]');
    if (!b) return;
    const f = document.createElement('iframe');
    f.src = 'https://www.youtube-nocookie.com/embed/' + b.dataset.yt + '?autoplay=1&rel=0';
    f.allow = 'autoplay; encrypted-media; picture-in-picture; fullscreen';
    f.allowFullscreen = true;
    f.title = b.getAttribute('aria-label') || 'Film';
    f.className = 'film film-on';
    b.replaceWith(f);
  });

  function cena(p) {
    if (p.cena == null) {
      return '<span>' + (p.status === 'wkrotce' ? T('cena wkrótce') : p.status === 'na_zamowienie' ? T('cena po ustaleniu szczegółów') : T('zapytaj o cenę')) + '</span>';
    }
    let h = '<strong>' + zl(p.cena) + '</strong>';
    if (p.cena_przed && p.cena_przed > p.cena) h += '<s>' + zl(p.cena_przed) + '</s>';
    return h;
  }

  function omnibus(p) {
    return p.cena_przed && p.cena_najnizsza_30
      ? '<p class="omnibus">' + T('Najniższa cena z 30 dni przed obniżką:') + ' ' + zl(p.cena_najnizsza_30) + '</p>' : '';
  }

  // Napis „Zarezerwowany” na samym zdjęciu (karta i okienko szczegółów).
  const napisRez = (p) => p.status === 'zarezerwowany' ? '<span class="rez-stamp" aria-hidden="true">' + T('Zarezerwowany') + '</span>' : '';

  function badge(p) {
    if (p.status === 'zarezerwowany') return '';
    if (p.status === 'dostepny' && p.cena_przed && p.cena && p.cena_przed > p.cena) return '<span class="badge">' + T('Promocja') + '</span>';
    const s = STATUS[p.status];
    return s ? '<span class="badge ' + s.klasa + '">' + s.tekst + '</span>' : '';
  }

  function karta(p, i) {
    const cechy = p.cechy.split('\n').map((c) => c.trim()).filter(Boolean).slice(0, 4);
    const foto = p.zdjecia[0];
    return '<article class="card' + (p.status === 'sprzedany' ? ' card-sold' : p.status === 'zarezerwowany' ? ' card-reserved' : '') + '">' +
      '<button class="card-img" type="button" data-produkt="' + i + '" aria-label="' + T('Szczegóły:') + ' ' + esc(p.nazwa) + '">' + badge(p) + napisRez(p) +
      (foto ? '<img src="' + esc(foto) + '" alt="' + esc(p.nazwa) + '" loading="lazy">' : '') +
      (p.zdjecia.length > 1 ? '<span class="photo-count">' + p.zdjecia.length + ' ' + T('zdjęć') + '</span>' : '') +
      (p.film ? '<span class="photo-count video-tag">▶ film</span>' : '') + '</button>' +
      '<div class="card-body"><h3>' + esc(p.nazwa) + '</h3>' +
      (cechy.length ? '<ul class="specs">' + cechy.map((c) => '<li>' + esc(c) + '</li>').join('') + '</ul>' : '') +
      '<div class="price">' + cena(p) + '</div>' +
      '<button class="btn btn-dark" type="button" data-produkt="' + i + '">' + (p.status === 'sprzedany' || p.status === 'zarezerwowany' ? T('Zobacz szczegóły') : T('Zobacz i zapytaj')) + '</button>' +
      '</div></article>';
  }

  // Każdy bęben jest jedyny – zamiast „Kup teraz” klient najpierw pisze, a Paweł po rozmowie rezerwuje.
  function przyciski(p) {
    const btn = (rodzaj, klasa, tekst) => '<button type="button" class="btn ' + klasa + '" data-zapytaj="' + rodzaj + '">' + tekst + '</button>';
    if (p.status === 'dostepny' || p.status === 'na_zamowienie') {
      return '<p class="pm-note">' + T('Każdy bęben jest jedyny w swoim rodzaju, dlatego przed zakupem zawsze rozmawiamy. Wyślij zgłoszenie – odezwę się, odpowiem na pytania, a gdy się zdecydujesz, zarezerwuję bęben dla Ciebie.') + '</p>' +
        '<div class="pm-ctas">' + btn('kupno', 'btn-primary', p.status === 'na_zamowienie' ? T('Chcę zamówić') : T('Chcę kupić ten bęben')) +
        btn('pytanie', 'btn-outline', T('Mam pytanie')) + '</div>';
    }
    if (p.status === 'zarezerwowany') {
      return '<p class="pm-note">' + T('Ten bęben jest zarezerwowany dla innej osoby. Zostaw kontakt – dam znać, jeśli rezerwacja się zwolni, albo zrobię dla Ciebie podobny.') + '</p>' +
        '<div class="pm-ctas">' + btn('pytanie', 'btn-primary', T('Zapytaj o ten lub podobny')) + '</div>';
    }
    if (p.status === 'sprzedany') {
      return '<p class="pm-note">' + T('Ten bęben ma już właściciela. Napisz, jeśli chcesz podobny.') + '</p>' +
        '<div class="pm-ctas">' + btn('pytanie', 'btn-primary', T('Chcę podobny bęben')) + '</div>';
    }
    return '<div class="pm-ctas">' + btn('pytanie', 'btn-primary', T('Daj mi znać, gdy będzie')) + '</div>';
  }

  let produkty = [];
  const modal = document.getElementById('produkt-modal');

  function otworz(p) {
    const cechy = p.cechy.split('\n').map((c) => c.trim()).filter(Boolean);
    const zdj = p.zdjecia;
    modal.querySelector('.pm-body').innerHTML =
      '<div class="pm-media">' +
        (zdj[0] ? '<div class="pm-foto"><img class="pm-main" src="' + esc(zdj[0]) + '" alt="' + esc(p.nazwa) + (p.status === 'zarezerwowany' ? ' – zarezerwowany' : '') + '">' + napisRez(p) + '</div>' : '') +
        (zdj.length > 1 ? '<div class="pm-thumbs">' + zdj.map((z, k) => '<button type="button" data-src="' + esc(z) + '"' + (k === 0 ? ' class="on"' : '') + '><img src="' + esc(z) + '" alt="' + T('Zdjęcie') + ' ' + (k + 1) + '" loading="lazy"></button>').join('') + '</div>' : '') +
        (p.film ? filmHtml(p.film, p.nazwa) : '') +
      '</div>' +
      '<div class="pm-info">' + badge(p) +
        '<h3>' + esc(p.nazwa) + '</h3>' +
        '<div class="price">' + cena(p) + '</div>' + omnibus(p) +
        (cechy.length ? '<ul class="specs">' + cechy.map((c) => '<li>' + esc(c) + '</li>').join('') + '</ul>' : '') +
        (p.opis ? '<div class="pm-opis">' + p.opis.split(/\n{2,}/).map((a) => '<p>' + esc(a).replace(/\n/g, '<br>') + '</p>').join('') + '</div>' : '') +
        przyciski(p) +
      '</div>';
    modal.querySelectorAll('[data-zapytaj]').forEach((b) => b.addEventListener('click', () => {
      zamknij();
      window.otworzZapytanie(p, b.dataset.zapytaj);
    }));
    modal.hidden = false;
    document.body.style.overflow = 'hidden';
    modal.querySelector('.pm-close').focus();
  }

  function zamknij() {
    modal.hidden = true;
    modal.querySelector('.pm-body').innerHTML = '';
    document.body.style.overflow = '';
  }

  modal.addEventListener('click', (e) => {
    if (e.target === modal || e.target.closest('.pm-close')) return zamknij();
    const t = e.target.closest('.pm-thumbs button');
    if (t) {
      modal.querySelector('.pm-main').src = t.dataset.src;
      modal.querySelectorAll('.pm-thumbs button').forEach((b) => b.classList.toggle('on', b === t));
    }
  });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !modal.hidden) zamknij(); });

  api('produkty?select=*&order=kolejnosc.asc,created_at.desc').then((lista) => {
    if (!lista.length) return;
    lista.forEach((p) => { lokalnie(p, ['nazwa', 'cechy', 'opis']); p.zdjecia = (p.zdjecia || []).map(adresZdj); });
    // sprzedane na końcu listy
    produkty = lista.filter((p) => p.status !== 'sprzedany').concat(lista.filter((p) => p.status === 'sprzedany'));
    const kontener = document.getElementById('lista-produktow');
    kontener.innerHTML = produkty.map(karta).join('');
    kontener.addEventListener('click', (e) => {
      const b = e.target.closest('[data-produkt]');
      if (b) otworz(produkty[+b.dataset.produkt]);
    });
  }).catch(() => { /* zostają karty z HTML */ });

  api('ustawienia?select=klucz,wartosc').then((rows) => {
    const film = (rows.find((r) => r.klucz === 'film_strojenie') || {}).wartosc;
    const html = filmHtml(film, T('Jak stroję bęben'));
    if (!html) return;
    document.querySelector('#film-strojenie .film-slot').innerHTML = html;
  }).catch(() => {});
})();
