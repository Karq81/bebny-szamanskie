// „Posłuchaj, jak brzmią” – filmy muzyków grających na bębnach Pawła, a pod nimi linki do ich stron.
// Filmy: baza (ustawienia, klucz filmy_muzycy) – Paweł zmienia je w panelu; dopóki nic nie zapisze, gra FILMY_START.
// Linki: ta sama lista co „Grają na moich bębnach” w sekcji O mnie (klucz grali albo treść z HTML).
(function () {
  const cfg = window.SKLEP_CONFIG || {};
  const T = window.T || ((s) => s);   // tłumaczenia (i18n.js – tylko w wersjach DE/EN)
  // zdjęcia względem miejsca skryptu – działa też w wersji /app/
  const IMG = new URL('img/', document.currentScript.src).href;
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const FILMY_START = [
    { url: 'https://www.youtube.com/channel/UCURKlxa0wvclrphrG6iONKA', tytul: T('Zespół WADADA'), kto: T('kanał zespołu na YouTube') }
  ];

  // Link do filmu, playlisty albo kanału (youtube.com/channel/UC…) -> adres odtwarzacza i miniatura.
  // Kanał gra po kolei swoje filmy (playlista „uploads”: UC… -> UU…).
  function yt(url) {
    url = String(url || '');
    const film = url.match(/(?:youtu\.be\/|[?&]v=|shorts\/|embed\/|live\/)([\w-]{11})/);
    if (film) return { embed: film[1] + '?', mini: 'https://i.ytimg.com/vi/' + film[1] + '/hqdefault.jpg' };
    const lista = url.match(/[?&]list=([\w-]+)/);
    const kanal = url.match(/\/channel\/UC([\w-]{22})/);
    const l = lista ? lista[1] : kanal ? 'UU' + kanal[1] : null;
    return l ? { embed: 'videoseries?list=' + l + '&', mini: IMG + 'galeria-3.jpg', seria: true } : null;
  }

  // linki z HTML sekcji O mnie (gdy w bazie nie ma listy)
  const linkiZHtml = () => [...document.querySelectorAll('#grali-lista a')].map((a) => ({ nazwa: a.textContent.trim(), link: a.href }));

  function rysuj(filmy, linki) {
    filmy = filmy.map((f) => ({ ...f, yt: yt(f.url) })).filter((f) => f.yt);
    const main = document.getElementById('listen-main');
    const lista = document.getElementById('listen-lista');

    if (filmy.length) {
      // graj = true tylko po kliknięciu – wtedy od razu ładujemy odtwarzacz z dźwiękiem
      const pokaz = (i, graj) => {
        const f = filmy[i];
        main.innerHTML = (graj
          ? '<iframe class="film film-on" src="https://www.youtube-nocookie.com/embed/' + f.yt.embed + 'autoplay=1&rel=0" title="' + esc(f.tytul || 'Film') + '" allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowfullscreen></iframe>'
          : '<button class="film" type="button" data-graj="' + i + '" aria-label="' + T('Odtwórz:') + ' ' + esc(f.tytul) + '"><img src="' + f.yt.mini + '" alt=""><span class="film-play" aria-hidden="true"></span></button>') +
          '<div class="listen-teraz"><strong>' + esc(f.tytul) + '</strong>' + (f.kto ? '<span>' + esc(f.kto) + '</span>' : '') + '</div>';
        lista.querySelectorAll('button').forEach((b) => b.classList.toggle('on', +b.dataset.i === i));
      };
      lista.innerHTML = filmy.map((f, i) =>
        '<li><button type="button" data-i="' + i + '">' +
          '<span class="mini"><img src="' + f.yt.mini + '" alt="" loading="lazy"></span>' +
          '<span><b>' + esc(f.tytul) + '</b>' + (f.kto || f.yt.seria ? '<small>' + esc(f.kto) + (f.yt.seria ? (f.kto ? ' · ' : '') + T('kilka filmów po kolei') : '') + '</small>' : '') + '</span>' +
        '</button></li>').join('');
      lista.addEventListener('click', (e) => {
        const b = e.target.closest('button[data-i]'); if (!b) return;
        pokaz(+b.dataset.i, true);
        if (innerWidth <= 820) main.scrollIntoView({ behavior: 'smooth', block: 'center' });
      });
      main.addEventListener('click', (e) => { const b = e.target.closest('[data-graj]'); if (b) pokaz(+b.dataset.graj, true); });
      pokaz(0, false);   // pierwszy film jako miniatura – kliknięcie odtwarza
      // jeden film – lista obok nic nie dodaje, odtwarzacz na całą szerokość
      if (filmy.length === 1) { lista.hidden = true; document.querySelector('.listen-grid').classList.add('jeden'); }
    } else {
      document.querySelector('.listen-grid').hidden = true;
    }

    if (linki.length) {
      document.getElementById('listen-linki').innerHTML = '<h3>' + T('Zobacz i posłuchaj więcej') + '</h3><ul>' +
        linki.map((l) => '<li><a href="' + esc(l.link) + '" target="_blank" rel="noopener">' + esc(l.nazwa) + '</a></li>').join('') + '</ul>';
    }

    if (!filmy.length && !linki.length) return;
    document.getElementById('posluchaj').hidden = false;
    document.getElementById('nav-posluchaj').hidden = false;
    document.getElementById('grali-posluchaj').hidden = false;
  }

  if (!cfg.supabaseUrl || !cfg.supabaseKey) return rysuj(FILMY_START, linkiZHtml());
  fetch(cfg.supabaseUrl + '/rest/v1/ustawienia?select=klucz,wartosc&klucz=in.(filmy_muzycy,grali)', {
    headers: { apikey: cfg.supabaseKey, Authorization: 'Bearer ' + cfg.supabaseKey }
  }).then((r) => { if (!r.ok) throw new Error(r.status); return r.json(); }).then((rows) => {
    const wiersz = (k) => rows.find((r) => r.klucz === k);
    let filmy = FILMY_START;
    if (wiersz('filmy_muzycy')) { try { filmy = JSON.parse(wiersz('filmy_muzycy').wartosc || '[]'); } catch (e) { filmy = []; } }
    const grali = ((wiersz('grali') || {}).wartosc || '').trim();
    const linki = grali
      ? grali.split('\n').map((l) => l.split('|').map((x) => x.trim())).filter(([n, l]) => n && /^https?:\/\//.test(l || '')).map(([nazwa, link]) => ({ nazwa, link }))
      : linkiZHtml();
    rysuj(filmy, linki);
  }).catch(() => rysuj(FILMY_START, linkiZHtml()));
})();
