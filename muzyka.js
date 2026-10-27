// Cicha muzyka w tle z YouTube + przycisk z głośniczkiem do wyciszania.
// Co gra, ustawia Paweł w panelu (Więcej → Filmy i muzyka w tle): kilka linków po kolei, w pętli.
// Dopóki nic nie ustawi – gra kanał zespołu WADADA.
// Przeglądarki nie pozwalają grać dźwięku przed pierwszym dotknięciem strony – wtedy muzyka rusza
// przy pierwszym kliknięciu / dotknięciu. Wyciszenie zapamiętujemy, żeby nie grała przy kolejnych wizytach.
(function () {
  const T = window.T || ((s) => s);   // tłumaczenia (i18n.js – tylko w wersjach DE/EN)
  const PLAYLISTA = 'UUURKlxa0wvclrphrG6iONKA';   // domyślnie: wszystkie filmy z kanału WADADA, po kolei
  const cfg = window.SKLEP_CONFIG || {};
  const GLOSNOSC = 15;
  // link z YouTube -> { v: film } albo { p: playlista }; kanał (youtube.com/channel/UC…) gra wszystkie swoje filmy
  const pozycja = (url) => {
    url = String(url || '');
    const v = url.match(/(?:youtu\.be\/|v=|shorts\/|embed\/|live\/)([\w-]{11})/);
    const l = url.match(/[?&]list=([\w-]+)/);
    const k = url.match(/\/channel\/UC([\w-]{22})/);
    if (v) return { v: v[1] };          // link do utworu (nawet otwartego z playlisty) = ten jeden utwór
    if (l) return { p: l[1] };
    if (k) return { p: 'UU' + k[1] };
    return null;
  };

  function uruchom(kolejka) {
    const czytaj = () => { try { return localStorage.getItem('muzyka'); } catch (e) { return null; } };
    const zapisz = (v) => { try { localStorage.setItem('muzyka', v); } catch (e) {} };

    let player = null, gotowy = false, gra = false;
    let chce = czytaj() !== 'off';

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'muzyka-btn';
    document.body.appendChild(btn);
    const ikona = () => {
      btn.classList.toggle('gra', gra);
      btn.setAttribute('aria-label', gra ? T('Wycisz muzykę w tle') : T('Włącz muzykę w tle'));
      btn.title = gra ? T('Gra: Zespół WADADA – kliknij, aby wyciszyć') : T('Włącz muzykę (Zespół WADADA)');
      btn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">' +
        '<path d="M11 5L6 9H3v6h3l5 4V5z" fill="currentColor"/>' +
        (gra ? '<path d="M15.5 8.5a5 5 0 010 7M18.5 5.5a9 9 0 010 13"/>' : '<path d="M16 9l5 6M21 9l-5 6"/>') + '</svg>';
    };
    ikona();

    const graj = () => { if (gotowy) { player.setVolume(GLOSNOSC); player.unMute(); player.playVideo(); } };

    btn.addEventListener('click', () => {
      if (gra) { chce = false; zapisz('off'); if (gotowy) player.pauseVideo(); }
      else { chce = true; zapisz('on'); graj(); }
    });

    // pierwsze dotknięcie strony odblokowuje dźwięk
    const odblokuj = (e) => {
      if (e.target.closest('.muzyka-btn')) return;
      document.removeEventListener('pointerdown', odblokuj, true);
      document.removeEventListener('keydown', odblokuj, true);
      if (chce && !gra) graj();
    };
    document.addEventListener('pointerdown', odblokuj, true);
    document.addEventListener('keydown', odblokuj, true);

    // gdy ktoś włącza film na stronie – muzyka w tle milknie
    document.addEventListener('click', (e) => {
      if (gotowy && gra && e.target.closest('.film, #listen-lista button, [data-graj]')) { chce = false; player.pauseVideo(); }
    }, true);

    const box = document.createElement('div');
    box.className = 'muzyka-player';
    box.setAttribute('aria-hidden', 'true');
    box.innerHTML = '<div id="muzyka-yt"></div>';
    document.body.appendChild(box);

    // kolejka: pojedyncze filmy i playlisty po kolei, po ostatnim wraca pierwszy
    let nr = 0;
    const zaladuj = (u) => u.v ? player.loadVideoById(u.v) : player.loadPlaylist({ list: u.p, listType: 'playlist' });
    const pierwszy = kolejka[0];
    const vars = { controls: 0, playsinline: 1, rel: 0 };
    if (kolejka.length === 1) {
      // jeden link – pętlę robi sam YouTube
      if (pierwszy.v) Object.assign(vars, { loop: 1, playlist: pierwszy.v });
      else Object.assign(vars, { listType: 'playlist', list: pierwszy.p, loop: 1 });
    } else if (pierwszy.p) Object.assign(vars, { listType: 'playlist', list: pierwszy.p });

    window.onYouTubeIframeAPIReady = () => {
      player = new YT.Player('muzyka-yt', {
        host: 'https://www.youtube-nocookie.com',
        width: 200, height: 200,
        videoId: pierwszy.v || undefined,
        playerVars: vars,
        events: {
          onReady: () => { gotowy = true; player.setVolume(GLOSNOSC); if (chce) graj(); },
          onStateChange: (e) => {
            gra = e.data === YT.PlayerState.PLAYING; ikona();
            if (e.data !== YT.PlayerState.ENDED || kolejka.length < 2) return;
            const u = kolejka[nr];
            const lista = u.p ? (player.getPlaylist() || []) : [];
            if (u.p && player.getPlaylistIndex() < lista.length - 1) return player.nextVideo();
            nr = (nr + 1) % kolejka.length;
            zaladuj(kolejka[nr]);
          }
        }
      });
    };
    const s = document.createElement('script');
    s.src = 'https://www.youtube.com/iframe_api';
    document.head.appendChild(s);
  }

  // ustawienia z panelu; gdy baza nie odpowie albo nic nie ustawiono – gra kanał WADADA
  const domyslnie = () => uruchom([{ p: PLAYLISTA }]);
  if (!cfg.supabaseUrl || !cfg.supabaseKey) return domyslnie();
  fetch(cfg.supabaseUrl + '/rest/v1/ustawienia?select=wartosc&klucz=eq.muzyka_tlo', {
    headers: { apikey: cfg.supabaseKey, Authorization: 'Bearer ' + cfg.supabaseKey }
  }).then((r) => r.ok ? r.json() : []).then((rows) => {
    if (!rows.length) return domyslnie();
    let u = {}; try { u = JSON.parse(rows[0].wartosc || '{}'); } catch (e) {}
    if (u.wlaczona === false) return;   // Paweł wyłączył muzykę w tle
    const kolejka = (u.linki || []).map(pozycja).filter(Boolean);
    kolejka.length ? uruchom(kolejka) : domyslnie();
  }).catch(domyslnie);
})();
