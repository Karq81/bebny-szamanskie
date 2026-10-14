// Cicha muzyka w tle (kanał zespołu WADADA na YouTube) + przycisk z głośniczkiem do wyciszania.
// Przeglądarki nie pozwalają grać dźwięku przed pierwszym dotknięciem strony – wtedy muzyka rusza
// przy pierwszym kliknięciu / dotknięciu. Wyciszenie zapamiętujemy, żeby nie grała przy kolejnych wizytach.
(function () {
  const PLAYLISTA = 'UUURKlxa0wvclrphrG6iONKA';   // wszystkie filmy z kanału WADADA, po kolei
  const GLOSNOSC = 15;
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
    btn.setAttribute('aria-label', gra ? 'Wycisz muzykę w tle' : 'Włącz muzykę w tle');
    btn.title = gra ? 'Gra: Zespół WADADA – kliknij, aby wyciszyć' : 'Włącz muzykę (Zespół WADADA)';
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

  window.onYouTubeIframeAPIReady = () => {
    player = new YT.Player('muzyka-yt', {
      host: 'https://www.youtube-nocookie.com',
      width: 200, height: 200,
      playerVars: { listType: 'playlist', list: PLAYLISTA, controls: 0, playsinline: 1, loop: 1, rel: 0 },
      events: {
        onReady: () => { gotowy = true; player.setVolume(GLOSNOSC); if (chce) graj(); },
        onStateChange: (e) => { gra = e.data === YT.PlayerState.PLAYING; ikona(); }
      }
    });
  };
  const s = document.createElement('script');
  s.src = 'https://www.youtube.com/iframe_api';
  document.head.appendChild(s);
})();
