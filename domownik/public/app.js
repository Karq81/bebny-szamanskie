// Domownik - aplikacja w telefonie (bez frameworków)
'use strict';

// ---------- narzędzia ----------
const $root = document.getElementById('root');
const DNI = ['nd', 'pn', 'wt', 'śr', 'cz', 'pt', 'sb'];
const DNI_PELNE = ['niedziela', 'poniedziałek', 'wtorek', 'środa', 'czwartek', 'piątek', 'sobota'];
const MIES = ['sty', 'lut', 'mar', 'kwi', 'maj', 'cze', 'lip', 'sie', 'wrz', 'paź', 'lis', 'gru'];
const MIES_D = ['stycznia', 'lutego', 'marca', 'kwietnia', 'maja', 'czerwca', 'lipca', 'sierpnia', 'września', 'października', 'listopada', 'grudnia'];

function h(tag, attrs, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else if (k === 'style' && typeof v === 'object') {
      for (const [p, val] of Object.entries(v)) { if (p.startsWith('--')) el.style.setProperty(p, val); else el.style[p] = val; }
    }
    else if (k === 'cls') el.className = v;
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const c of kids.flat(Infinity)) if (c != null && c !== false) el.append(c.nodeType ? c : String(c));
  return el;
}
const store = {
  get(k) { try { return localStorage.getItem(k); } catch { return null; } },
  set(k, v) { try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, v); } catch {} },
};
let toastTimer;
function toast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg; t.hidden = false;
  clearTimeout(toastTimer); toastTimer = setTimeout(() => (t.hidden = true), 2600);
}
async function api(path, opts = {}) {
  const res = await fetch('/api' + path, {
    method: opts.method || (opts.body ? 'POST' : 'GET'),
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + (store.get('token') || '') },
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (res.status === 401 && path !== '/login') { store.set('token', null); state.me = null; render(); throw new Error(data.error || 'Zaloguj się'); }
  if (!res.ok) throw new Error(data.error || 'Coś poszło nie tak');
  return data;
}
const run = fn => async (...a) => { try { await fn(...a); } catch (e) { toast(e.message); } };

function parse(d) { const [y, m, dd] = d.split('-').map(Number); return new Date(y, m - 1, dd); }
function iso(dt) { return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`; }
function addDays(d, n) { const x = parse(d); x.setDate(x.getDate() + n); return iso(x); }
function dayLabel(d) {
  const t = state.today;
  if (d === t) return 'Dziś';
  if (d === addDays(t, 1)) return 'Jutro';
  if (d === addDays(t, -1)) return 'Wczoraj';
  const x = parse(d);
  return `${DNI_PELNE[x.getDay()]}, ${x.getDate()} ${MIES_D[x.getMonth()]}`;
}
function initial(name) { return (name || '?').trim()[0].toUpperCase(); }
function av(m, cls) { return h('span', { cls: 'av ' + (cls || ''), style: { '--c': m ? m.color : '#888' } }, m ? initial(m.name) : '?'); }
function memberById(id) { return state.members.find(m => m.id === id); }

const icons = {
  dzis: '<rect x="3" y="5" width="18" height="16" rx="3"/><path d="M3 10h18M8 3v4M16 3v4"/>',
  kalendarz: '<path d="M4 6h16M4 12h16M4 18h10"/>',
  asystent: '<path d="M4 5h16v11H9l-5 4z"/><path d="M9 10h.01M12 10h.01M15 10h.01"/>',
  punkty: '<path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z"/>',
  rodzina: '<circle cx="9" cy="8" r="3.5"/><circle cx="17" cy="9" r="2.5"/><path d="M2.5 20c.8-4 3.4-6 6.5-6s5.7 2 6.5 6M15 14.5c2.8-.4 5.4 1.3 6.3 5"/>',
};
function svg(name) {
  const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  s.setAttribute('viewBox', '0 0 24 24'); s.setAttribute('fill', 'none'); s.setAttribute('stroke', 'currentColor');
  s.setAttribute('stroke-width', '2'); s.setAttribute('stroke-linecap', 'round'); s.setAttribute('stroke-linejoin', 'round');
  s.innerHTML = icons[name]; return s;
}

// ---------- stan ----------
const state = { status: null, me: null, members: [], today: null, tab: 'dzis', filter: store.get('filter') || 'moje', data: {} };
const TABS = [['dzis', 'Dziś'], ['kalendarz', 'Kalendarz'], ['asystent', 'Asystent'], ['punkty', 'Punkty'], ['rodzina', 'Rodzina']];

async function boot() {
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(() => {});
  state.status = await api('/status');
  state.today = state.status.today;
  if (store.get('token')) { try { state.me = await api('/me'); } catch {} }
  const hash = location.hash.slice(1);
  if (TABS.some(t => t[0] === hash)) state.tab = hash;
  render();
}
window.addEventListener('hashchange', () => {
  const hash = location.hash.slice(1);
  if (TABS.some(t => t[0] === hash) && hash !== state.tab) { state.tab = hash; render(); }
});
document.addEventListener('visibilitychange', () => { if (!document.hidden && state.me) refresh(); });

function render() {
  $root.innerHTML = '';
  if (!state.status) return;
  if (state.status.setup_needed) return $root.append(SetupView());
  if (!state.me) return $root.append(LoginView());
  $root.append(Shell());
  refresh();
}
async function refresh() {
  const view = VIEWS[state.tab];
  try { await view.load(); } catch (e) { toast(e.message); }
  const box = document.getElementById('view');
  if (box) { box.innerHTML = ''; box.append(view.render()); }
}

// ---------- pierwsze uruchomienie ----------
function SetupView() {
  const rows = [
    { name: 'Michał', role: 'parent' }, { name: 'Marta', role: 'parent' }, { name: 'Maja', role: 'child' }, { name: '', role: 'child' },
  ];
  const err = h('p', { cls: 'err' });
  const list = h('div', { cls: 'list' });
  const draw = () => {
    list.innerHTML = '';
    rows.forEach((r, i) => list.append(h('div', { cls: 'card form' },
      h('div', { cls: 'grid2' },
        h('label', {}, 'Imię', h('input', { id: 'n' + i, value: r.name, placeholder: 'Imię', oninput: e => (r.name = e.target.value) })),
        h('label', {}, 'Rola', h('select', { id: 'r' + i, onchange: e => (r.role = e.target.value) },
          h('option', { value: 'parent', selected: r.role === 'parent' }, 'Rodzic'),
          h('option', { value: 'child', selected: r.role === 'child' }, 'Dziecko')))),
      h('label', {}, 'PIN do logowania (4 cyfry)', h('input', { id: 'p' + i, inputmode: 'numeric', maxlength: 8, value: r.pin || '', placeholder: '••••', oninput: e => (r.pin = e.target.value.replace(/\D/g, '')) })),
    )));
  };
  draw();
  return h('div', { cls: 'app' }, h('div', { cls: 'center' },
    h('div', { cls: 'brand' }, 'Domownik', h('small', {}, 'Zakładamy Waszą rodzinę')),
    h('h1', {}, 'Kto mieszka w domu?'),
    h('p', { cls: 'sub' }, 'Każdy dostaje swój profil i PIN. Puste wiersze zostaną pominięte. Później można to zmienić w zakładce Rodzina.'),
    list,
    h('button', { cls: 'btn ghost', onclick: () => { rows.push({ name: '', role: 'child' }); draw(); } }, '+ Dodaj osobę'),
    err,
    h('button', { cls: 'btn', onclick: run(async () => {
      const members = rows.filter(r => r.name.trim()).map(r => ({ ...r, reminder_times: r.role === 'parent' ? ['07:30', '15:00'] : ['15:30'] }));
      const bad = members.find(r => !/^\d{4,8}$/.test(r.pin || ''));
      if (bad) { err.textContent = `${bad.name}: PIN musi mieć 4–8 cyfr.`; return; }
      await api('/setup', { body: { members } });
      state.status = await api('/status');
      toast('Rodzina założona. Zaloguj się.');
      render();
    }) }, 'Załóż rodzinę'),
  ));
}

// ---------- logowanie ----------
function LoginView() {
  let chosen = null, pin = '';
  const err = h('p', { cls: 'err' });
  const dots = h('div', { cls: 'pin' });
  const who = h('div', { cls: 'who' });
  const pad = h('div', { cls: 'pad' });
  const drawDots = () => { dots.innerHTML = ''; for (let i = 0; i < 4; i++) dots.append(h('span', { cls: i < pin.length ? 'on' : '' })); };
  const tryLogin = run(async () => {
    try {
      const r = await api('/login', { body: { member_id: chosen.id, pin } });
      store.set('token', r.token); state.me = r.member; render();
    } catch (e) { pin = ''; drawDots(); err.textContent = e.message; }
  });
  const press = k => {
    if (!chosen) { err.textContent = 'Najpierw wybierz siebie.'; return; }
    err.textContent = '';
    if (k === '⌫') pin = pin.slice(0, -1); else if (k === 'OK') { if (pin.length >= 4) tryLogin(); return; } else if (pin.length < 8) pin += k;
    drawDots();
    if (pin.length === 4 && chosen) tryLogin();
  };
  state.status.members.forEach(m => {
    const b = h('button', { 'aria-pressed': 'false', onclick: () => {
      chosen = m; pin = ''; drawDots(); err.textContent = '';
      who.querySelectorAll('button').forEach(x => x.setAttribute('aria-pressed', x === b ? 'true' : 'false'));
    } }, av(m, 'lg'), m.name);
    who.append(b);
  });
  ['1', '2', '3', '4', '5', '6', '7', '8', '9', '⌫', '0', 'OK'].forEach(k => pad.append(h('button', { onclick: () => press(k), 'aria-label': k === '⌫' ? 'Usuń' : k }, k)));
  drawDots();
  return h('div', { cls: 'app' }, h('div', { cls: 'center' },
    h('div', { cls: 'brand' }, 'Domownik', h('small', {}, 'Wasz rodzinny organizer')),
    h('h1', {}, 'Kim jesteś?'), who, dots, err, pad));
}

// ---------- powłoka ----------
function Shell() {
  const nav = h('nav', { cls: 'tabs', 'aria-label': 'Ekrany' }, h('div', {},
    TABS.map(([id, label]) => h('a', { href: '#' + id, 'aria-current': state.tab === id ? 'page' : null, onclick: e => {
      e.preventDefault(); if (state.tab === id) return;
      state.tab = id; history.replaceState(null, '', '#' + id); render();
    } }, svg(id), label, id === 'punkty' ? h('span', { cls: 'dot', id: 'badge', hidden: true }) : null))));
  const header = h('header', { cls: 'top' },
    h('div', { cls: 'brand' }, 'Domownik', h('small', {}, dayLabel(state.today) + ', ' + parse(state.today).getDate() + ' ' + MIES_D[parse(state.today).getMonth()])),
    h('button', { cls: 'av', style: { '--c': state.me.color, width: '40px', height: '40px' }, 'aria-label': 'Mój profil', onclick: () => { state.tab = 'rodzina'; location.hash = 'rodzina'; render(); } }, initial(state.me.name)));
  const showFab = state.tab === 'dzis' || state.tab === 'kalendarz';
  return h('div', {},
    h('div', { cls: 'app' }, header, h('main', { id: 'view' }, h('p', { cls: 'muted' }, 'Ładuję…'))),
    showFab ? h('button', { cls: 'fab', 'aria-label': 'Dodaj', onclick: () => AddSheet() }, '+') : null,
    nav);
}

// ---------- arkusz ----------
function sheet(title, body) {
  const bg = h('div', { cls: 'sheet-bg', onclick: e => { if (e.target === bg) close(); } });
  const close = () => bg.remove();
  bg.append(h('div', { cls: 'sheet', role: 'dialog', 'aria-label': title },
    h('div', { cls: 'spread' }, h('h3', {}, title), h('button', { cls: 'x', 'aria-label': 'Zamknij', onclick: close }, '✕')),
    body(close)));
  document.body.append(bg);
  return close;
}

function peoplePicker(selected, { multi = true, allowNone = false } = {}) {
  const box = h('div', { cls: 'people' });
  const draw = () => {
    box.innerHTML = '';
    if (allowNone) box.append(h('button', { type: 'button', 'aria-pressed': selected.length === 0 ? 'true' : 'false', onclick: () => { selected.length = 0; draw(); } }, h('span', { cls: 'av', style: { '--c': '#888' } }, '★'), multi ? 'Wszyscy' : 'Ktokolwiek'));
    state.members.forEach(m => box.append(h('button', { type: 'button', 'aria-pressed': selected.includes(m.id) ? 'true' : 'false', onclick: () => {
      const i = selected.indexOf(m.id);
      if (multi) { if (i >= 0) selected.splice(i, 1); else selected.push(m.id); }
      else { selected.length = 0; if (i < 0) selected.push(m.id); }
      draw();
    } }, av(m), m.name)));
  };
  draw();
  return box;
}

function AddSheet(kind, item) {
  const isChild = state.me.role === 'child';
  let mode = kind || 'task';
  sheet(item ? 'Edytuj' : 'Dodaj', close => {
    const wrap = h('div', { cls: 'form' });
    const seg = h('div', { cls: 'seg' });
    const draw = () => {
      seg.innerHTML = '';
      [['task', 'Zadanie'], ['event', 'Termin']].forEach(([k, l]) => seg.append(h('button', { type: 'button', 'aria-pressed': mode === k ? 'true' : 'false', onclick: () => { mode = k; draw(); } }, l)));
      wrap.innerHTML = ''; wrap.append(item ? '' : seg, mode === 'task' ? taskForm() : eventForm());
    };
    const taskForm = () => {
      const t = item && kind === 'task' ? item : { title: '', assignee_id: isChild ? state.me.id : null, due_date: state.today, due_time: '', recur: null, points: 0 };
      const who = t.assignee_id ? [t.assignee_id] : [];
      let rtype = t.recur ? t.recur.type : 'none';
      const wd = t.recur && t.recur.weekdays ? [...t.recur.weekdays] : [];
      const f = { title: h('input', { id: 'tt', value: t.title, placeholder: 'np. Wynieść śmieci' }),
        date: h('input', { id: 'td', type: 'date', value: t.due_date }), time: h('input', { id: 'tm', type: 'time', value: t.due_time || '' }),
        every: h('input', { id: 'te', type: 'number', min: 1, value: t.recur && t.recur.days || 3 }),
        months: h('input', { id: 'tmo', type: 'number', min: 1, value: t.recur && t.recur.months || 1 }),
        points: h('input', { id: 'tp', type: 'number', min: 0, step: 5, value: t.points || 0 }) };
      const rsel = h('select', { id: 'tr', onchange: e => { rtype = e.target.value; drawR(); } },
        [['none', 'Jednorazowo'], ['daily', 'Codziennie'], ['weekly', 'W wybrane dni tygodnia'], ['every', 'Co kilka dni'], ['monthly', 'Co miesiąc / co kilka miesięcy']]
          .map(([v, l]) => h('option', { value: v, selected: rtype === v }, l)));
      const rbox = h('div', {});
      const drawR = () => {
        rbox.innerHTML = '';
        if (rtype === 'weekly') {
          const days = h('div', { cls: 'days' });
          [1, 2, 3, 4, 5, 6, 0].forEach(d => days.append(h('button', { type: 'button', 'aria-pressed': wd.includes(d) ? 'true' : 'false', onclick: e => {
            const i = wd.indexOf(d); if (i >= 0) wd.splice(i, 1); else wd.push(d);
            e.currentTarget.setAttribute('aria-pressed', wd.includes(d) ? 'true' : 'false');
          } }, DNI[d])));
          rbox.append(days);
        }
        if (rtype === 'every') rbox.append(h('label', {}, 'Co ile dni', f.every));
        if (rtype === 'monthly') rbox.append(h('label', {}, 'Co ile miesięcy', f.months));
      };
      drawR();
      return h('div', { cls: 'form' },
        h('label', {}, 'Co trzeba zrobić', f.title),
        isChild ? null : h('label', {}, 'Kto', peoplePicker(who, { multi: false, allowNone: true })),
        h('div', { cls: 'grid2' }, h('label', {}, item ? 'Najbliższy termin' : 'Od kiedy', f.date), h('label', {}, 'Do godziny (opcjonalnie)', f.time)),
        h('label', {}, 'Powtarzanie', rsel), rbox,
        h('label', {}, 'Punkty dla dziecka', f.points),
        h('div', { cls: 'row' },
          h('button', { cls: 'btn', onclick: run(async () => {
            if (!f.title.value.trim()) return toast('Wpisz, co trzeba zrobić.');
            const recur = rtype === 'none' ? null : rtype === 'weekly' ? { type: 'weekly', weekdays: wd.length ? wd : [parse(f.date.value).getDay()] }
              : rtype === 'every' ? { type: 'every', days: +f.every.value || 1 } : rtype === 'monthly' ? { type: 'monthly', months: +f.months.value || 1 } : { type: 'daily' };
            const body = { title: f.title.value, assignee_id: who[0] || null, due_date: f.date.value || state.today, due_time: f.time.value || null, recur, points: +f.points.value || 0 };
            if (item) await api('/tasks/' + item.id, { method: 'PUT', body }); else await api('/tasks', { body });
            close(); toast(item ? 'Zapisano zmiany' : 'Dodano zadanie'); refresh();
          }) }, item ? 'Zapisz' : 'Dodaj zadanie'),
          item && !isChild ? h('button', { cls: 'btn danger', onclick: run(async () => { await api('/tasks/' + item.id, { method: 'DELETE' }); close(); toast('Usunięto zadanie'); refresh(); }) }, 'Usuń') : null));
    };
    const eventForm = () => {
      const e = item && kind === 'event' ? item : { title: '', date: addDays(state.today, 1), time: '', member_ids: isChild ? [state.me.id] : [], remind_minutes: 60, notes: '' };
      const who = [...e.member_ids];
      const f = { title: h('input', { id: 'et', value: e.title, placeholder: 'np. Dentysta' }), date: h('input', { id: 'ed', type: 'date', value: e.date }),
        time: h('input', { id: 'em', type: 'time', value: e.time || '' }), notes: h('input', { id: 'en', value: e.notes || '', placeholder: 'np. gabinet 12, zabrać skierowanie' }) };
      const rem = h('select', { id: 'er' }, [[null, 'Bez przypomnienia'], [15, '15 min wcześniej'], [60, 'Godzinę wcześniej'], [180, '3 godziny wcześniej'], [720, 'Wieczorem dzień wcześniej (12 h)'], [1440, 'Dzień wcześniej'], [2880, '2 dni wcześniej']]
        .map(([v, l]) => h('option', { value: v == null ? '' : v, selected: (e.remind_minutes ?? '') === (v ?? '') }, l)));
      return h('div', { cls: 'form' },
        h('label', {}, 'Co', f.title),
        h('div', { cls: 'grid2' }, h('label', {}, 'Dzień', f.date), h('label', {}, 'Godzina', f.time)),
        h('label', {}, 'Kogo dotyczy', peoplePicker(who, { multi: true, allowNone: true })),
        h('label', {}, 'Przypomnienie', rem),
        h('label', {}, 'Notatka', f.notes),
        h('div', { cls: 'row' },
          h('button', { cls: 'btn', onclick: run(async () => {
            if (!f.title.value.trim() || !f.date.value) return toast('Wpisz nazwę i dzień.');
            const body = { title: f.title.value, date: f.date.value, time: f.time.value || null, member_ids: who, remind_minutes: rem.value === '' ? null : +rem.value, notes: f.notes.value };
            if (item) await api('/events/' + item.id, { method: 'PUT', body }); else await api('/events', { body });
            close(); toast(item ? 'Zapisano zmiany' : 'Zapisano termin'); refresh();
          }) }, item ? 'Zapisz' : 'Zapisz termin'),
          item ? h('button', { cls: 'btn danger', onclick: run(async () => { await api('/events/' + item.id, { method: 'DELETE' }); close(); toast('Usunięto termin'); refresh(); }) }, 'Usuń') : null));
    };
    draw();
    return wrap;
  });
}

// ---------- elementy listy ----------
function TaskRow(t, { readonly } = {}) {
  const m = memberById(t.assignee_id);
  const late = t.overdue_days > 0 && !t.preview;
  const meta = [t.due_time ? 'do ' + t.due_time : null, late ? `zaległe ${t.overdue_days} ${t.overdue_days === 1 ? 'dzień' : 'dni'}` : null, t.recur_label || null, m ? m.name : 'ktokolwiek'].filter(Boolean).join(' · ');
  return h('div', { cls: 'task' + (late ? ' late' : ''), style: { '--c': m ? m.color : 'var(--line)' } },
    readonly ? h('span', { cls: 'chk', 'aria-hidden': 'true' }) : h('button', { cls: 'chk', 'aria-label': 'Zrobione: ' + t.title, onclick: run(async e => {
      e.currentTarget.classList.add('on'); e.currentTarget.textContent = '✓';
      const r = await api(`/tasks/${t.id}/done`, { body: {} });
      toast(r.points ? `+${r.points} pkt dla ${r.member}! 🎉` : 'Zrobione ✓'); refresh();
    }) }),
    h('div', { cls: 't', onclick: state.me.role === 'parent' || t.assignee_id === state.me.id ? () => AddSheet('task', t) : null },
      h('strong', {}, t.title), h('small', {}, meta)),
    h('span', { cls: 'pts' }, t.points ? `+${t.points}` : ''));
}
function EventRow(e) {
  const x = parse(e.date);
  const people = e.member_ids.map(memberById).filter(Boolean);
  return h('button', { cls: 'ev', onclick: () => AddSheet('event', e) },
    h('div', { cls: 'd' }, DNI[x.getDay()].toUpperCase(), h('small', {}, `${x.getDate()} ${MIES[x.getMonth()]}`)),
    h('div', { cls: 't' }, h('strong', {}, e.title),
      h('small', {}, [e.time || 'cały dzień', e.notes].filter(Boolean).join(' · ')),
      h('div', {}, people.length ? people.map(p => h('span', { cls: 'tag', style: { '--c': p.color } }, p.name)) : h('span', { cls: 'tag', style: { '--c': '#888' } }, 'Wszyscy'))));
}

// ---------- powiadomienia ----------
function b64ToBytes(b64) {
  const pad = '='.repeat((4 - (b64.length % 4)) % 4);
  const raw = atob((b64 + pad).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from([...raw].map(c => c.charCodeAt(0)));
}
const pushSupported = () => 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
async function enablePush() {
  if (!pushSupported()) throw new Error('Ten telefon lub przeglądarka nie obsługuje powiadomień. Zainstaluj aplikację z Chrome.');
  const perm = await Notification.requestPermission();
  if (perm !== 'granted') throw new Error('Powiadomienia są zablokowane. Włącz je w ustawieniach telefonu dla tej aplikacji.');
  const reg = await navigator.serviceWorker.ready;
  let sub = await reg.pushManager.getSubscription();
  if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64ToBytes(state.status.vapid) });
  await api('/push/subscribe', { body: sub.toJSON() });
  store.set('push:' + state.me.id, '1');
}
// odnawiamy subskrypcję po cichu przy każdym uruchomieniu
async function syncPush() {
  if (!pushSupported() || Notification.permission !== 'granted') return;
  try { await enablePush(); } catch {}
}

// ---------- widoki ----------
const VIEWS = {};

VIEWS.dzis = {
  async load() { const d = await api('/today'); state.data.today = d; state.members = d.members; state.today = d.today; },
  render() {
    const d = state.data.today;
    const mine = t => state.filter === 'wszyscy' || t.assignee_id === state.me.id || t.assignee_id == null;
    const tasks = d.tasks.filter(mine).sort((a, b) => b.overdue_days - a.overdue_days || (a.due_time || '99').localeCompare(b.due_time || '99'));
    const doneMine = d.done.filter(c => state.filter === 'wszyscy' || c.member_id === state.me.id);
    const me = state.members.find(m => m.id === state.me.id) || state.me;
    const now = new Date(); const hm = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    const next = (me.reminder_times || []).find(t => t > hm) || (me.reminder_times || [])[0];
    const pushOn = pushSupported() && Notification.permission === 'granted';
    const greeting = tasks.length ? `Cześć, ${me.name}. Na dziś ${tasks.length === 1 ? 'jest 1 rzecz' : `jest ${tasks.length} ${tasks.length < 5 ? 'rzeczy' : 'rzeczy'}`}.` : `Brawo, ${me.name}! Na dziś wszystko zrobione.`;
    const events = d.events.filter(e => state.filter === 'wszyscy' || !e.member_ids.length || e.member_ids.includes(state.me.id));
    return h('div', {},
      h('h1', {}, greeting),
      h('div', { cls: 'banner' },
        h('b', {}, next || '—'),
        h('strong', {}, next ? 'Następne przypomnienie' : 'Brak godzin przypomnień'),
        h('p', {}, pushOn ? 'Telefon przypomni Ci, co jest na dziś. Godziny zmienisz w zakładce Rodzina.' : 'Włącz powiadomienia, żeby telefon sam przypominał o zadaniach i terminach.'),
        pushOn ? null : h('button', { cls: 'btn light sm', onclick: run(async () => { await enablePush(); toast('Powiadomienia włączone'); refresh(); }) }, 'Włącz powiadomienia')),
      h('div', { cls: 'chips', role: 'group', 'aria-label': 'Pokaż' },
        [['moje', 'Moje'], ['wszyscy', 'Cała rodzina']].map(([k, l]) => h('button', { cls: 'chip', 'aria-pressed': state.filter === k ? 'true' : 'false', onclick: () => { state.filter = k; store.set('filter', k); refresh(); } }, l))),
      h('h2', {}, 'Zadania na dziś', h('span', {}, `${doneMine.length} zrobione`)),
      tasks.length ? h('div', { cls: 'list' }, tasks.map(t => TaskRow(t))) : h('div', { cls: 'empty' }, 'Nic do zrobienia. Nowe zadanie dodasz przyciskiem +.'),
      doneMine.length ? [h('h2', {}, 'Zrobione dziś'), h('div', { cls: 'list' }, doneMine.map(c => {
        const m = memberById(c.member_id);
        return h('div', { cls: 'task done', style: { '--c': m ? m.color : 'var(--line)' } },
          h('span', { cls: 'chk on' }, '✓'), h('div', { cls: 't' }, h('strong', {}, c.title), h('small', {}, m ? m.name : '')),
          h('button', { cls: 'btn ghost sm', onclick: run(async () => { await api('/completions/' + c.id, { method: 'DELETE' }); toast('Cofnięto'); refresh(); }) }, 'Cofnij'));
      }))] : null,
      h('h2', {}, 'Terminy', h('span', {}, 'najbliższe 7 dni')),
      events.length ? h('div', { cls: 'list' }, events.map(EventRow)) : h('div', { cls: 'empty' }, 'Brak terminów. Powiedz asystentowi albo dodaj przyciskiem +.'),
    );
  },
};

VIEWS.kalendarz = {
  async load() { const d = await api(`/schedule?from=${state.today}&to=${addDays(state.today, 30)}`); state.data.cal = d; state.members = d.members; },
  render() {
    const d = state.data.cal;
    const byDay = new Map();
    const push = (date, el) => { const k = date < state.today ? state.today : date; if (!byDay.has(k)) byDay.set(k, []); byDay.get(k).push(el); };
    d.events.forEach(e => push(e.date, { sort: '0' + (e.time || '00:00'), el: EventRow(e) }));
    // codzienne powtórzenia pomijamy w podglądzie przyszłych dni, żeby nie zasłaniały reszty
    const frequent = t => t.recur && (t.recur.type === 'daily' || (t.recur.type === 'every' && t.recur.days <= 2));
    d.tasks.filter(t => !(t.preview && frequent(t))).forEach(t => push(t.date, { sort: '1' + (t.due_time || '99'), el: TaskRow(t, { readonly: t.preview }) }));
    const days = [...byDay.keys()].sort();
    return h('div', {},
      h('h1', {}, 'Kalendarz'),
      h('p', { cls: 'sub' }, 'Terminy i zadania na najbliższe 30 dni. Dotknij, żeby zmienić.'),
      days.length ? days.map(day => [h('h2', {}, dayLabel(day)), h('div', { cls: 'list' }, byDay.get(day).sort((a, b) => a.sort.localeCompare(b.sort)).map(x => x.el))])
        : h('div', { cls: 'empty', style: { marginTop: '16px' } }, 'Pusto. Dodaj pierwszy termin przyciskiem +.'));
  },
};

// ---------- asystent ----------
let pendingImage = null;
VIEWS.asystent = {
  async load() {
    const [a, m] = await Promise.all([api('/assistant'), state.members.length ? null : api('/members')]);
    state.data.chat = a; if (m) state.members = m;
  },
  render() {
    const a = state.data.chat;
    const chat = h('div', { cls: 'chat', id: 'chat' });
    if (!a.history.length) {
      chat.append(h('div', { cls: 'msg assistant' }, `Cześć ${state.me.name}! Napisz albo powiedz, co zapisać, np.\n„Jutro dentysta o 10, przypomnij godzinę wcześniej”\n„Dodaj Mai wynoszenie śmieci we wtorki i piątki za 10 pkt”\n„Co mamy w tym tygodniu?”\nMożesz też zrobić zdjęcie kartki ze szkoły albo z przychodni.`));
    }
    a.history.forEach(m => chat.append(Bubble(m)));
    if (!a.enabled) chat.append(h('div', { cls: 'msg assistant' }, 'Asystent jest jeszcze wyłączony: brakuje klucza API Claude na serwerze. Zadania i terminy możesz już dodawać ręcznie przyciskiem +.'));
    const input = h('input', { type: 'text', id: 'chatIn', placeholder: 'Napisz albo powiedz…', autocomplete: 'off', enterkeyhint: 'send' });
    const file = h('input', { type: 'file', accept: 'image/*', capture: 'environment', hidden: true, onchange: run(async e => {
      const f = e.target.files[0]; if (!f) return;
      pendingImage = await shrink(f); drawPreview(); input.focus();
    }) });
    const prev = h('div', { id: 'prev' });
    const drawPreview = () => {
      prev.innerHTML = '';
      if (pendingImage) prev.append(h('div', { cls: 'preview' }, h('img', { src: pendingImage, alt: 'Zdjęcie do wysłania' }), h('span', { cls: 'small muted' }, 'Zdjęcie dołączone'), h('button', { cls: 'x', 'aria-label': 'Usuń zdjęcie', onclick: () => { pendingImage = null; drawPreview(); } }, '✕')));
    };
    drawPreview();
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    let rec = null;
    const mic = SR ? h('button', { type: 'button', cls: 'round', 'aria-label': 'Mów', onclick: () => {
      if (rec) { rec.stop(); return; }
      rec = new SR(); rec.lang = 'pl-PL'; rec.interimResults = true;
      mic.classList.add('rec');
      rec.onresult = ev => { input.value = [...ev.results].map(r => r[0].transcript).join(' '); };
      rec.onend = () => { mic.classList.remove('rec'); rec = null; if (input.value.trim()) form.requestSubmit(); };
      rec.onerror = () => { mic.classList.remove('rec'); rec = null; toast('Nie udało się nagrać. Spróbuj mikrofonu na klawiaturze.'); };
      rec.start();
    } }, '🎤') : null;
    const form = h('form', { onsubmit: run(async e => {
      e.preventDefault();
      const text = input.value.trim();
      if (!text && !pendingImage) return;
      const img = pendingImage; pendingImage = null; drawPreview(); input.value = '';
      chat.append(Bubble({ role: 'user', text, imageSrc: img }));
      const typing = h('div', { cls: 'msg assistant typing' }, 'Myślę…');
      chat.append(typing); typing.scrollIntoView({ block: 'end', behavior: 'smooth' });
      try {
        const r = await api('/assistant', { body: { text, image: img } });
        typing.replaceWith(Bubble({ role: 'assistant', text: r.text, actions: r.actions }));
      } catch (err) { typing.replaceWith(h('div', { cls: 'msg assistant' }, 'Nie udało się: ' + err.message)); }
      chat.lastChild.scrollIntoView({ block: 'end', behavior: 'smooth' });
    }) },
      h('button', { type: 'button', cls: 'round', 'aria-label': 'Zrób zdjęcie', onclick: () => file.click() }, '📷'),
      input, mic, h('button', { type: 'submit', cls: 'round go', 'aria-label': 'Wyślij' }, '➤'));
    setTimeout(() => chat.lastChild && chat.lastChild.scrollIntoView({ block: 'end' }), 50);
    return h('div', { style: { paddingBottom: '70px' } },
      h('h1', {}, 'Asystent'),
      h('p', { cls: 'sub' }, 'Mów, pisz albo zrób zdjęcie. Rozmowa zaczyna się od nowa każdego dnia.'),
      chat, prev, file, h('div', { cls: 'composer' }, form));
  },
};
function Bubble(m) {
  const el = h('div', { cls: 'msg ' + m.role });
  if (m.imageSrc) el.append(h('img', { src: m.imageSrc, alt: 'Wysłane zdjęcie' }));
  else if (m.image) el.append(h('div', { cls: 'imgnote' }, '📷 zdjęcie'));
  if (m.text) el.append(m.text);
  (m.actions || []).forEach(a => {
    const undo = { event: ['/events/' + a.id, 'DELETE'], task: ['/tasks/' + a.id, 'DELETE'], completion: ['/completions/' + a.id, 'DELETE'], penalty: ['/penalties/' + a.id, 'DELETE'], deleted_task: ['/tasks/' + a.id + '/restore', 'POST'] }[a.kind];
    const row = h('div', { cls: 'act' }, h('span', {}, '✓ ' + a.label));
    if (undo) row.append(h('button', { cls: 'btn ghost sm', onclick: run(async e => {
      await api(undo[0], { method: undo[1], body: undo[1] === 'POST' ? {} : undefined });
      row.classList.add('undone'); e.target.remove(); toast('Cofnięto');
    }) }, 'Cofnij'));
    el.append(row);
  });
  return el;
}
// zmniejszamy zdjęcie przed wysłaniem (szybciej i taniej)
function shrink(file) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const max = 1600, k = Math.min(1, max / Math.max(img.width, img.height));
      const c = document.createElement('canvas'); c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(img.src); resolve(c.toDataURL('image/jpeg', 0.85));
    };
    img.onerror = () => reject(new Error('Nie udało się wczytać zdjęcia.'));
    img.src = URL.createObjectURL(file);
  });
}

// ---------- punkty ----------
VIEWS.punkty = {
  async load() { state.data.points = await api('/points'); },
  render() {
    const p = state.data.points;
    const isParent = state.me.role === 'parent';
    const pending = p.redemptions.filter(r => r.status === 'pending');
    const badge = document.getElementById('badge');
    if (badge) { badge.hidden = !(isParent && pending.length); badge.textContent = pending.length; }
    const kids = p.children;
    const pen = p.penalties;
    const parents = p.parents;
    return h('div', {},
      h('h1', {}, 'Punkty i nagrody'),
      h('p', { cls: 'sub' }, 'Dzieci zbierają punkty za zadania. Rodzice pilnują słoika kar.'),
      kids.length ? [h('h2', {}, 'Dzieci', h('span', {}, 'saldo punktów')),
        h('div', { cls: 'score' }, kids.map(k => {
          const goal = p.rewards.find(r => r.cost > k.balance) || p.rewards[p.rewards.length - 1];
          const pct = goal ? Math.min(100, Math.round(k.balance / goal.cost * 100)) : 0;
          return h('div', { cls: 'sc', style: { '--c': k.color } }, h('small', {}, k.name), h('span', { cls: 'n' }, k.balance),
            h('small', {}, `w tym tygodniu +${k.earned_week}`), goal ? [h('div', { cls: 'bar' }, h('i', { style: { width: pct + '%' } })), h('small', {}, `do „${goal.title}”: ${Math.max(0, goal.cost - k.balance)} pkt`)] : null);
        }))] : null,
      isParent && pending.length ? [h('h2', {}, 'Prośby do zatwierdzenia'), h('div', { cls: 'list' }, pending.map(r => h('div', { cls: 'card spread' },
        h('div', {}, h('strong', {}, `${r.member_name}: ${r.title}`), h('div', { cls: 'small muted' }, `${r.cost} pkt`)),
        h('div', { cls: 'row' },
          h('button', { cls: 'btn sm', onclick: run(async () => { await api('/redemptions/' + r.id, { body: { status: 'approved' } }); toast('Zatwierdzone. Pamiętaj dodać czas w Family Link, jeśli to minuty.'); refresh(); }) }, 'Tak'),
          h('button', { cls: 'btn ghost sm', onclick: run(async () => { await api('/redemptions/' + r.id, { body: { status: 'rejected' } }); toast('Odrzucone, punkty wróciły'); refresh(); }) }, 'Nie')))))] : null,
      h('h2', {}, 'Na co wymienić punkty'),
      h('div', { cls: 'list' }, p.rewards.map(r => h('div', { cls: 'card spread' }, h('span', {}, r.title),
        h('div', { cls: 'row' },
          state.me.role === 'child' ? h('button', { cls: 'btn sm', disabled: (kids.find(k => k.id === state.me.id) || { balance: 0 }).balance < r.cost, onclick: run(async () => { await api('/redeem', { body: { reward_id: r.id } }); toast('Wysłano prośbę do rodziców'); refresh(); }) }, `${r.cost} pkt`) : h('span', { cls: 'pts' }, `${r.cost} pkt`),
          isParent ? h('button', { cls: 'x', 'aria-label': 'Usuń nagrodę', onclick: run(async () => { await api('/rewards/' + r.id, { method: 'DELETE' }); refresh(); }) }, '✕') : null))),
        isParent ? NewReward() : null),
      p.redemptions.filter(r => r.status !== 'pending').length ? h('p', { cls: 'small muted' }, 'Ostatnio: ' + p.redemptions.filter(r => r.status !== 'pending').slice(0, 5).map(r => `${r.member_name} – ${r.title} (${r.status === 'approved' ? 'tak' : 'nie'})`).join(', ')) : null,
      parents.length >= 1 ? [h('h2', {}, 'Słoik kar', h('span', {}, pen.month)),
        h('div', { cls: 'card' },
          h('div', { cls: 'duel' }, parents.slice(0, 2).map((m, i) => [i === 1 ? h('div', { cls: 'vs' }, 'KONTRA') : null,
            h('div', { style: { color: m.color } }, h('div', { cls: 'n' }, pen.totals[m.id] || 0), h('small', {}, m.name))])),
          h('p', { cls: 'small muted', style: { margin: '10px 0 0' } }, pen.stake + ' ' + leaderText(parents, pen.totals)),
          isParent ? NewPenalty(parents) : null,
          pen.list.length ? h('div', { cls: 'log' }, pen.list.map(x => h('div', {},
            h('span', {}, `${x.member_name}: ${x.reason}`),
            h('span', { cls: 'row' }, h('b', {}, '+' + x.points), isParent ? h('button', { cls: 'x', 'aria-label': 'Usuń karę', onclick: run(async () => { await api('/penalties/' + x.id, { method: 'DELETE' }); refresh(); }) }, '✕') : null)))) : h('p', { cls: 'small muted' }, 'W tym miesiącu jeszcze nikt nie podpadł.'))] : null);
  },
};
function leaderText(parents, totals) {
  if (parents.length < 2) return '';
  const [a, b] = parents; const ta = totals[a.id] || 0, tb = totals[b.id] || 0;
  if (ta === tb) return 'Na razie remis.';
  return `Na razie płaci ${ta > tb ? a.name : b.name}.`;
}
function NewReward() {
  const t = h('input', { id: 'rwT', placeholder: 'Nowa nagroda, np. +60 min gry' });
  const c = h('input', { id: 'rwC', type: 'number', min: 1, step: 5, placeholder: 'pkt', style: { width: '90px' } });
  return h('div', { cls: 'row', style: { flexWrap: 'nowrap' } }, t, c, h('button', { cls: 'btn sm', onclick: run(async () => {
    if (!t.value.trim() || !+c.value) return toast('Wpisz nagrodę i liczbę punktów.');
    await api('/rewards', { body: { title: t.value, cost: +c.value } }); refresh();
  }) }, 'Dodaj'));
}
function NewPenalty(parents) {
  const who = [parents.find(p => p.id !== state.me.id)?.id || parents[0].id];
  const reason = h('input', { id: 'pnR', placeholder: 'Za co? np. buty w przedpokoju' });
  return h('div', { cls: 'form', style: { marginTop: '12px' } },
    h('div', { cls: 'people' }, parents.map(m => {
      const b = h('button', { type: 'button', 'aria-pressed': who[0] === m.id ? 'true' : 'false', onclick: () => { who[0] = m.id; b.parentNode.querySelectorAll('button').forEach(x => x.setAttribute('aria-pressed', x === b ? 'true' : 'false')); } }, av(m), m.name);
      return b;
    })),
    h('div', { cls: 'row', style: { flexWrap: 'nowrap' } }, reason, h('button', { cls: 'btn sm', onclick: run(async () => {
      await api('/penalties', { body: { member_id: who[0], reason: reason.value || 'Bez powodu :)', points: 1 } }); toast('Do słoika! 🫙'); refresh();
    }) }, '+1 kara')));
}

// ---------- rodzina ----------
VIEWS.rodzina = {
  async load() {
    const [m, tasks, s] = await Promise.all([api('/members'), api('/tasks'), api('/settings')]);
    state.members = m; state.data.tasks = tasks; state.data.settings = s;
  },
  render() {
    const isParent = state.me.role === 'parent';
    const recurring = state.data.tasks.filter(t => t.recur);
    const s = state.data.settings;
    return h('div', {},
      h('h1', {}, 'Rodzina'),
      h('p', { cls: 'sub' }, 'Profile, godziny przypomnień i zadania cykliczne.'),
      h('div', { cls: 'list', style: { marginTop: '14px' } }, state.members.map(m => h('div', { cls: 'task', style: { '--c': m.color } },
        av(m), h('div', { cls: 't' }, h('strong', {}, m.name + (m.id === state.me.id ? ' (Ty)' : '')),
          h('small', {}, `${m.role === 'parent' ? 'rodzic' : 'dziecko'} · przypomnienia: ${m.reminder_times.join(', ') || 'brak'}`)),
        isParent || m.id === state.me.id ? h('button', { cls: 'btn ghost sm', onclick: () => MemberSheet(m) }, 'Zmień') : h('span')))),
      isParent ? h('button', { cls: 'btn ghost', style: { marginTop: '10px' }, onclick: () => MemberSheet(null) }, '+ Dodaj osobę') : null,
      h('h2', {}, 'Zadania cykliczne', h('span', {}, recurring.length ? `${recurring.length}` : '')),
      recurring.length ? h('div', { cls: 'list' }, recurring.map(t => TaskRow(t, { readonly: true }))) : h('div', { cls: 'empty' }, 'Brak. Dodaj np. „odkurzanie co sobotę” przyciskiem + na ekranie Dziś.'),
      h('h2', {}, 'Ustawienia'),
      h('div', { cls: 'card form' },
        h('div', { cls: 'spread' }, h('span', {}, 'Powiadomienia na tym telefonie'),
          h('button', { cls: 'btn sm', onclick: run(async () => { await enablePush(); const r = await api('/push/test', { body: {} }); toast(r.sent ? 'Wysłano próbne powiadomienie' : 'Nie ma zapisanego telefonu'); }) }, 'Włącz i sprawdź')),
        isParent ? h('label', { style: { flexDirection: 'row', alignItems: 'center', gap: '10px', color: 'var(--ink)' } },
          h('input', { type: 'checkbox', id: 'autoP', checked: s.auto_penalty, style: { width: '22px', height: '22px' }, onchange: run(async e => { await api('/settings/auto-penalty', { method: 'PUT', body: { on: e.target.checked } }); toast('Zapisano'); }) }),
          'Automatyczna kara dla rodzica za zadanie zaległe o dzień') : null,
        isParent ? h('label', {}, 'Stawka w słoiku kar', h('input', { id: 'stake', value: s.stake, onchange: run(async e => { await api('/settings/stake', { method: 'PUT', body: { stake: e.target.value } }); toast('Zapisano'); }) })) : null,
        h('button', { cls: 'btn ghost', onclick: () => { store.set('token', null); state.me = null; render(); } }, 'Wyloguj')),
      h('p', { cls: 'small muted', style: { marginTop: '16px' } }, 'Instalacja na telefonie: otwórz tę stronę w Chrome, menu ⋮ i „Dodaj do ekranu głównego” (albo „Zainstaluj aplikację”).'));
  },
};
function MemberSheet(m) {
  const isParent = state.me.role === 'parent';
  const x = m || { name: '', role: 'child', color: '#8A4FC7', reminder_times: ['15:30'] };
  const times = [...x.reminder_times];
  sheet(m ? m.name : 'Nowa osoba', close => {
    const name = h('input', { id: 'mN', value: x.name });
    const role = h('select', { id: 'mR', disabled: !isParent }, h('option', { value: 'parent', selected: x.role === 'parent' }, 'Rodzic'), h('option', { value: 'child', selected: x.role === 'child' }, 'Dziecko'));
    const color = h('input', { id: 'mC', type: 'color', value: x.color, style: { height: '46px', padding: '4px' } });
    const pin = h('input', { id: 'mP', inputmode: 'numeric', maxlength: 8, placeholder: m ? 'Zostaw puste, żeby nie zmieniać' : '4 cyfry' });
    const tbox = h('div', { cls: 'row' });
    const newT = h('input', { id: 'mT', type: 'time', value: '15:00', style: { width: '130px' } });
    const drawT = () => { tbox.innerHTML = ''; times.sort().forEach((t, i) => tbox.append(h('span', { cls: 'chip' }, t, ' ', h('button', { cls: 'x', 'aria-label': 'Usuń ' + t, onclick: () => { times.splice(i, 1); drawT(); } }, '✕')))); };
    drawT();
    return h('div', { cls: 'form' },
      h('div', { cls: 'grid2' }, h('label', {}, 'Imię', name), h('label', {}, 'Rola', role)),
      h('div', { cls: 'grid2' }, h('label', {}, 'Kolor', color), h('label', {}, m ? 'Nowy PIN' : 'PIN', pin)),
      h('label', {}, 'Codzienne przypomnienia „Na dziś masz…”', tbox),
      h('div', { cls: 'row' }, newT, h('button', { type: 'button', cls: 'btn ghost sm', onclick: () => { if (newT.value && !times.includes(newT.value)) { times.push(newT.value); drawT(); } } }, '+ Dodaj godzinę')),
      h('button', { cls: 'btn', onclick: run(async () => {
        const body = { name: name.value, role: role.value, color: color.value, reminder_times: times };
        if (pin.value) body.pin = pin.value;
        if (m) await api('/members/' + m.id, { method: 'PUT', body }); else await api('/members', { body: { ...body, pin: pin.value } });
        if (m && m.id === state.me.id) state.me = await api('/me');
        close(); toast('Zapisano'); refresh();
      }) }, 'Zapisz'));
  });
}

boot().then(() => state.me && syncPush()).catch(e => { $root.textContent = 'Nie mogę połączyć się z serwerem: ' + e.message; });
