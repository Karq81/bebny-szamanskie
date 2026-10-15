// Zapytania od klientów: okienko „Chcę kupić / Mam pytanie” przy bębnie oraz formularz kontaktowy.
// Zgłoszenie trafia do bazy (tabela zapytania), a baza wysyła Pawłowi powiadomienie na WhatsApp / e-mail.
(function () {
  const cfg = window.SKLEP_CONFIG || {};
  // zgłoszenie z wersji DE/EN – Paweł od razu widzi, w jakim języku odpisać
  const JEZYK = (document.documentElement.lang || 'pl') === 'pl' ? '' : '[' + document.documentElement.lang.toUpperCase() + '] ';
  const T = window.T || ((s) => s);   // tłumaczenia (i18n.js – tylko w wersjach DE/EN)
  const modal = document.getElementById('zapytanie-modal');
  const form = document.getElementById('zapytanie-form');
  const ok = document.getElementById('zapytanie-ok');
  let produkt = null;
  let otwartoO = 0;

  function wyslij(dane) {
    if (!cfg.supabaseUrl || !cfg.supabaseKey) return Promise.reject(new Error('brak bazy'));
    return fetch(cfg.supabaseUrl + '/rest/v1/zapytania', {
      method: 'POST',
      headers: {
        apikey: cfg.supabaseKey,
        Authorization: 'Bearer ' + cfg.supabaseKey,
        'Content-Type': 'application/json',
        Prefer: 'return=minimal'
      },
      body: JSON.stringify(dane)
    }).then(async (r) => {
      if (r.ok) return;
      const blad = await r.json().catch(() => ({}));
      const m = String(blad.message || '');
      // komunikaty z bazy (ochrona przed spamem) są napisane dla klienta
      const e = new Error(m);
      e.dotarlo = /już do mnie dotarło/.test(m);   // to samo zgłoszenie drugi raz – traktujemy jak sukces
      e.dlaKlienta = /Za dużo/.test(m);
      throw e;
    });
  }

  const BLAD = T('Nie udało się wysłać. Spróbuj jeszcze raz za chwilę albo napisz do mnie na Messengerze.');
  // komunikat z bazy (limit zgłoszeń) jest po polsku – klient widzi go w swoim języku
  const ZA_DUZO = T('Za dużo zgłoszeń – spróbuj ponownie później.');

  function waLink(tekst) {
    const nr = String(cfg.whatsapp || '').replace(/\D/g, '');
    return nr ? 'https://wa.me/' + nr + '?text=' + encodeURIComponent(tekst) : '';
  }

  // Wspólne pola obu formularzy -> obiekt dla bazy. Zwraca null i pokazuje błąd, gdy czegoś brakuje.
  function zbierz(f, blad) {
    const v = (n) => (f.elements[n] ? f.elements[n].value.trim() : '');
    blad.hidden = true;
    const dane = {
      imie: v('imie'),
      telefon: v('telefon'),
      email: v('email'),
      kontakt: v('kontakt') || 'whatsapp',
      wiadomosc: v('wiadomosc'),
      zgoda: f.elements.zgoda.checked
    };
    // wybrany sposób kontaktu dopasowujemy do tego, co klient faktycznie wpisał
    if (dane.kontakt === 'email' && !dane.email && dane.telefon) dane.kontakt = 'telefon';
    if (dane.kontakt !== 'email' && !dane.telefon && dane.email) dane.kontakt = 'email';
    let msg = '';
    if (!dane.imie) msg = T('Wpisz, jak masz na imię.');
    else if (!dane.telefon && !dane.email) msg = T('Podaj telefon albo e-mail – inaczej nie będę mógł odpisać.');
    else if (dane.email && !/^\S+@\S+\.\S+$/.test(dane.email)) msg = T('Sprawdź adres e-mail.');
    else if (dane.telefon && dane.telefon.replace(/\D/g, '').length < 9) msg = T('Sprawdź numer telefonu.');
    else if (!dane.zgoda) msg = T('Zaznacz zgodę, żebym mógł odpisać.');
    if (msg) { blad.textContent = msg; blad.hidden = false; return null; }
    return dane;
  }

  // Boty wypełniają ukryte pole albo wysyłają formularz w ułamku sekundy.
  const toBot = (f, start) => (f.elements.www_adres && f.elements.www_adres.value) || Date.now() - start < 1500;

  // ---------- okienko przy bębnie / przy skórze ----------
  const RODZAJ = {
    kupno: { tytul: T('Chcę kupić ten bęben'), przycisk: T('Wyślij – chcę kupić'), placeholder: T('Np. wysyłka czy odbiór osobisty, kiedy można odebrać…') },
    pytanie: { tytul: T('Mam pytanie o ten bęben'), przycisk: T('Wyślij pytanie'), placeholder: T('O co chcesz zapytać? Brzmienie, skóra, wysyłka…') },
    zamowienie: { tytul: T('Bęben z tej skóry'), przycisk: T('Wyślij – chcę taki bęben'), placeholder: T('Np. jakie brzmienie lubisz, na kiedy potrzebujesz bębna…') }
  };
  let skora = null;
  let rodzajAkt = 'kupno';

  function ustawRodzaj(r) {
    rodzajAkt = r;
    if (r !== 'zamowienie') form.elements.rodzaj.value = r;
    document.getElementById('zq-tytul').textContent = RODZAJ[r].tytul;
    form.querySelector('button[type=submit]').textContent = RODZAJ[r].przycisk;
    form.elements.wiadomosc.placeholder = RODZAJ[r].placeholder;
    document.getElementById('zq-info-kupno').hidden = r !== 'kupno';
    document.getElementById('zq-info-zam').hidden = r !== 'zamowienie';
    document.getElementById('zq-srednica').hidden = r !== 'zamowienie';
  }

  function pokazOkno() {
    form.hidden = false; ok.hidden = true;
    document.getElementById('zq-blad').hidden = true;
    otwartoO = Date.now();
    modal.hidden = false;
    document.body.style.overflow = 'hidden';
    form.elements.imie.focus();
  }

  window.otworzZapytanie = function (p, rodzaj) {
    produkt = p; skora = null;
    document.getElementById('zq-produkt').textContent = p.nazwa;
    document.getElementById('zq-opis').hidden = true;
    document.getElementById('zq-foto').hidden = true;
    // przy bębnie zarezerwowanym / sprzedanym / „wkrótce” nie ma opcji „chcę kupić”
    const moznaKupic = p.status === 'dostepny' || p.status === 'na_zamowienie';
    document.getElementById('zq-wybor').hidden = !moznaKupic;
    ustawRodzaj(moznaKupic ? rodzaj : 'pytanie');
    if (!moznaKupic) {
      document.getElementById('zq-tytul').textContent = p.status === 'wkrotce' ? T('Daj mi znać, gdy będzie dostępny') : T('Zapytaj o podobny bęben');
    }
    pokazOkno();
  };

  // k = wybór z konfiguratora: { rozmiar, korpus, skora } – każde może być puste („do ustalenia”)
  let konf = { rozmiar: '', korpus: null, skora: null };
  window.otworzZamowienie = function (k) {
    produkt = null; konf = k; skora = k.skora;
    document.getElementById('zq-wybor').hidden = true;
    ustawRodzaj('zamowienie');
    document.getElementById('zq-tytul').textContent = T('Twój bęben na zamówienie');
    const czesci = [k.korpus && T('korpus: ') + k.korpus.nazwa, k.skora && k.skora.nazwa].filter(Boolean);
    document.getElementById('zq-produkt').textContent = czesci.length ? czesci.join(' · ') : T('Korpus i skórę dobierzemy razem');
    form.elements.srednica.value = k.rozmiar || 'jeszcze nie wiem';
    document.getElementById('zq-opis').hidden = true;
    const foto = document.getElementById('zq-foto');
    const zdj = (k.skora && k.skora.zdjecie) || (k.korpus && k.korpus.zdjecie);
    foto.hidden = !zdj; if (zdj) { foto.src = zdj; foto.alt = ''; }
    pokazOkno();
  };

  function zamknij() {
    modal.hidden = true;
    document.body.style.overflow = '';
  }

  modal.addEventListener('click', (e) => {
    if (e.target === modal || e.target.closest('.pm-close') || e.target.closest('[data-zamknij]')) zamknij();
  });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !modal.hidden) zamknij(); });
  form.elements.rodzaj.forEach((r) => r.addEventListener('change', () => ustawRodzaj(r.value)));

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const blad = document.getElementById('zq-blad');
    const dane = zbierz(form, blad);
    if (!dane) return;
    const btn = form.querySelector('button[type=submit]');
    const rodzaj = rodzajAkt;
    const srednica = rodzaj === 'zamowienie' ? form.elements.srednica.value : '';
    const czego = produkt ? produkt.nazwa : T('bęben na zamówienie') + (srednica ? ' ' + srednica : '') +
      (konf.korpus ? ', korpus: ' + konf.korpus.nazwa : '') + (skora ? ', ' + skora.nazwa : '');
    const pokazOk = () => {
      form.reset(); form.hidden = true; ok.hidden = false;
      document.getElementById('zq-ok-tekst').textContent =
        rodzaj === 'kupno' ? T('Zgłoszenie dotarło. Odezwę się, odpowiem na pytania i jeśli się zdecydujesz, zarezerwuję bęben dla Ciebie.')
        : rodzaj === 'zamowienie' ? T('Zgłoszenie dotarło. Odezwę się, doradzę i podam cenę') + (skora ? T(', a gdy się zdecydujesz – zarezerwuję tę skórę dla Ciebie.') : '.')
        : T('Pytanie dotarło. Odezwę się najszybciej, jak to możliwe.');
      const wa = waLink(T('Dzień dobry, piszę w sprawie: ') + czego + ' (' + location.origin + location.pathname + ')');
      const a = document.getElementById('zq-ok-wa');
      a.hidden = !wa; if (wa) a.href = wa;
    };
    if (toBot(form, otwartoO)) return pokazOk();
    btn.disabled = true; btn.dataset.tekst = btn.textContent; btn.textContent = T('Wysyłam…');
    try {
      // skóry z HTML (gdy baza nie odpowiedziała) nie mają id – nazwę dopisujemy do wiadomości
      const extra = produkt ? { produkt_id: produkt.id || null } : {
        skora_id: skora && skora.id ? skora.id : null,
        srednica
      };
      if (!produkt && konf.korpus) extra.korpus_id = konf.korpus.id;
      if (!produkt && skora && !skora.id) dane.wiadomosc = '[' + skora.nazwa + '] ' + dane.wiadomosc;
      await wyslij({ ...dane, wiadomosc: JEZYK + dane.wiadomosc, rodzaj, ...extra });
      pokazOk();
    } catch (err) {
      if (err.dotarlo) return pokazOk();
      blad.textContent = err.dlaKlienta ? ZA_DUZO : BLAD; blad.hidden = false;
    } finally {
      btn.disabled = false; btn.textContent = btn.dataset.tekst;
    }
  });

  // ---------- formularz kontaktowy na dole strony ----------
  const kf = document.getElementById('kontakt-form');
  const kfStart = Date.now();
  kf.addEventListener('submit', async (e) => {
    e.preventDefault();
    const blad = document.getElementById('kf-blad');
    const dane = zbierz(kf, blad);
    if (!dane) return;
    const btn = kf.querySelector('button[type=submit]');
    const temat = kf.elements.temat.value;
    const pokazOk = () => {
      kf.reset();
      btn.textContent = T('Dziękuję! Wiadomość dotarła – odezwę się wkrótce.');
      setTimeout(() => { btn.textContent = T('Wyślij wiadomość'); }, 8000);
    };
    if (toBot(kf, kfStart)) return pokazOk();
    btn.disabled = true; btn.textContent = T('Wysyłam…');
    try {
      await wyslij({ ...dane, wiadomosc: JEZYK + '[' + temat + '] ' + dane.wiadomosc, rodzaj: 'kontakt' });
      btn.disabled = false;
      pokazOk();
    } catch (err) {
      btn.disabled = false; btn.textContent = T('Wyślij wiadomość');
      if (err.dotarlo) return pokazOk();
      blad.textContent = err.dlaKlienta ? ZA_DUZO : BLAD; blad.hidden = false;
    }
  });
})();
