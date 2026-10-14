// „Posłuchaj, jak brzmią” – filmy muzyków grających na bębnach Pawła.
// Lista jest w bazie (ustawienia, klucz filmy_muzycy), Paweł dodaje filmy w panelu.
// Sekcja pokazuje się dopiero, gdy jest choć jeden film.
(function () {
  const cfg = window.SKLEP_CONFIG || {};
  if (!cfg.supabaseUrl || !cfg.supabaseKey) return;
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const ytId = (url) => { const m = String(url || '').match(/(?:youtu\.be\/|v=|shorts\/|embed\/|live\/)([\w-]{11})/); return m ? m[1] : null; };
  const miniatura = (id) => 'https://i.ytimg.com/vi/' + id + '/hqdefault.jpg';

  fetch(cfg.supabaseUrl + '/rest/v1/ustawienia?select=wartosc&klucz=eq.filmy_muzycy', {
    headers: { apikey: cfg.supabaseKey, Authorization: 'Bearer ' + cfg.supabaseKey }
  }).then((r) => { if (!r.ok) throw new Error(r.status); return r.json(); }).then((rows) => {
    let filmy = [];
    try { filmy = JSON.parse((rows[0] || {}).wartosc || '[]'); } catch (e) { return; }
    filmy = filmy.map((f) => ({ ...f, id: ytId(f.url) })).filter((f) => f.id);
    if (!filmy.length) return;

    const main = document.getElementById('listen-main');
    const lista = document.getElementById('listen-lista');

    // graj = true tylko po kliknięciu – wtedy od razu ładujemy odtwarzacz z dźwiękiem
    function pokaz(i, graj) {
      const f = filmy[i];
      main.innerHTML = (graj
        ? '<iframe class="film film-on" src="https://www.youtube-nocookie.com/embed/' + f.id + '?autoplay=1&rel=0" title="' + esc(f.tytul || 'Film') + '" allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowfullscreen></iframe>'
        : '<button class="film" type="button" data-yt="' + f.id + '" aria-label="Odtwórz: ' + esc(f.tytul) + '"><img src="' + miniatura(f.id) + '" alt=""><span class="film-play" aria-hidden="true"></span></button>') +
        '<div class="listen-teraz"><strong>' + esc(f.tytul) + '</strong>' + (f.kto ? '<span>' + esc(f.kto) + '</span>' : '') + '</div>';
      lista.querySelectorAll('button').forEach((b) => b.classList.toggle('on', +b.dataset.i === i));
    }

    lista.innerHTML = filmy.map((f, i) =>
      '<li><button type="button" data-i="' + i + '">' +
        '<span class="mini"><img src="' + miniatura(f.id) + '" alt="" loading="lazy"></span>' +
        '<span><b>' + esc(f.tytul) + '</b>' + (f.kto ? '<small>' + esc(f.kto) + '</small>' : '') + '</span>' +
      '</button></li>').join('');
    lista.addEventListener('click', (e) => {
      const b = e.target.closest('button[data-i]'); if (!b) return;
      pokaz(+b.dataset.i, true);
      if (innerWidth <= 820) main.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
    pokaz(0, false);   // pierwszy film jako miniatura – kliknięcie odtwarza (obsługa w produkty.js)

    document.getElementById('posluchaj').hidden = false;
    document.getElementById('nav-posluchaj').hidden = false;
    document.getElementById('grali-posluchaj').hidden = false;
  }).catch(() => {});
})();
