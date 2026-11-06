// Domownik - serwer rodzinnej aplikacji
const path = require('path');
const fs = require('fs');
// Prosty odczyt pliku .env (bez dodatkowych bibliotek)
const envFile = path.join(__dirname, '.env');
if (fs.existsSync(envFile)) {
  for (const line of fs.readFileSync(envFile, 'utf8').split('\n')) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
}

const express = require('express');
const F = require('./family');
const D = require('./dates');
const R = require('./reminders');
const A = require('./assistant');
const { getSetting, setSetting } = require('./db');

const app = express();
app.use(express.json({ limit: '12mb' }));
app.use(express.static(path.join(__dirname, 'public'), { extensions: ['html'] }));

// --- uwierzytelnianie ---
function auth(req, res, next) {
  const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  const me = F.memberByToken(token);
  if (!me) return res.status(401).json({ error: 'Zaloguj się ponownie.' });
  req.me = me;
  next();
}
function parent(req, res, next) {
  if (req.me.role !== 'parent') return res.status(403).json({ error: 'To może zmienić tylko rodzic.' });
  next();
}
const wrap = fn => async (req, res) => {
  try { res.json(await fn(req, res)); } catch (e) { console.error(e); res.status(400).json({ error: e.message }); }
};

// --- konfiguracja i logowanie ---
app.get('/api/status', wrap(() => ({
  setup_needed: F.members().length === 0,
  members: F.members().map(m => ({ id: m.id, name: m.name, color: m.color, role: m.role })),
  assistant: A.enabled(),
  vapid: R.publicKey(),
  today: D.today(),
})));

// Pierwsze uruchomienie: tworzymy rodzinę. Działa tylko, gdy nie ma jeszcze nikogo.
app.post('/api/setup', wrap(req => {
  if (F.members().length) throw new Error('Rodzina jest już założona.');
  const list = (req.body.members || []).filter(m => m.name && m.name.trim());
  if (!list.some(m => m.role === 'parent')) throw new Error('Potrzebny jest przynajmniej jeden rodzic.');
  for (const m of list) F.addMember(m);
  for (const [title, cost] of [['+30 min na telefonie', 30], ['Wybór filmu na wieczór', 50], ['Pizza w weekend', 150]]) F.addReward(title, cost);
  return { ok: true };
}));

app.post('/api/login', wrap(req => {
  const r = F.login(req.body.member_id, req.body.pin);
  if (!r) throw new Error('Zły PIN.');
  return r;
}));

app.get('/api/me', auth, wrap(req => req.me));

// --- plan dnia i kalendarz ---
app.get('/api/today', auth, wrap(() => {
  const t = D.today();
  const s = F.schedule(t, D.addDays(t, 7));
  return {
    today: t,
    tasks: s.tasks.filter(x => !x.preview && x.date <= t),
    upcoming_tasks: s.tasks.filter(x => x.date > t).slice(0, 30),
    events: s.events,
    done: F.todayDone(),
    members: F.members(),
  };
}));
app.get('/api/schedule', auth, wrap(req => {
  const from = req.query.from || D.today();
  const to = req.query.to || D.addDays(from, 30);
  return { ...F.schedule(from, to), members: F.members() };
}));

// --- zadania ---
app.get('/api/tasks', auth, wrap(() => F.schedule('0000-01-01', D.today()).tasks.concat(
  F.schedule(D.addDays(D.today(), 1), '9999-12-31').tasks.filter(t => !t.preview))));
app.post('/api/tasks', auth, wrap(req => {
  const b = req.body;
  if (req.me.role === 'child') b.assignee_id = req.me.id;
  return F.addTask(b, req.me.id);
}));
app.put('/api/tasks/:id', auth, parent, wrap(req => F.updateTask(+req.params.id, req.body)));
app.delete('/api/tasks/:id', auth, wrap(req => {
  // rodzic usuwa wszystko, dziecko tylko zadania, które samo dodało
  if (req.me.role !== 'parent' && F.taskCreator(+req.params.id) !== req.me.id) throw new Error('To może usunąć tylko rodzic.');
  F.deleteTask(+req.params.id); return { ok: true };
}));
app.post('/api/tasks/:id/restore', auth, parent, wrap(req => { F.restoreTask(+req.params.id); return { ok: true }; }));
app.post('/api/tasks/:id/done', auth, wrap(async req => {
  const r = F.completeTask(+req.params.id, req.me);
  if (r.points && req.me.role === 'child') {
    R.notifyParents({ title: `${r.member}: +${r.points} pkt`, body: 'Zadanie odhaczone jako zrobione.', tag: 'done', url: '/#punkty' }).catch(() => {});
  }
  return r;
}));
app.delete('/api/completions/:id', auth, wrap(req => { F.undoCompletion(+req.params.id); return { ok: true }; }));

// --- terminy ---
app.post('/api/events', auth, wrap(req => F.addEvent(req.body, req.me.id)));
app.put('/api/events/:id', auth, wrap(req => F.updateEvent(+req.params.id, req.body)));
app.delete('/api/events/:id', auth, wrap(req => { F.deleteEvent(+req.params.id); return { ok: true }; }));

// --- punkty, nagrody, kary ---
app.get('/api/points', auth, wrap(() => ({
  children: F.members().filter(m => m.role === 'child').map(m => ({ ...m, ...F.childPoints(m.id) })),
  rewards: F.rewards(),
  redemptions: F.redemptions(),
  penalties: F.penalties(),
  parents: F.members().filter(m => m.role === 'parent'),
})));
app.post('/api/rewards', auth, parent, wrap(req => { F.addReward(req.body.title, req.body.cost); return { ok: true }; }));
app.delete('/api/rewards/:id', auth, parent, wrap(req => { F.deleteReward(+req.params.id); return { ok: true }; }));
app.post('/api/redeem', auth, wrap(async req => {
  const who = req.me.role === 'child' ? req.me.id : req.body.member_id;
  const r = F.redeem(who, req.body.reward_id);
  R.notifyParents({ title: `${F.member(who).name} chce: ${r.title}`, body: `Za ${r.cost} pkt. Zatwierdź w zakładce Punkty.`, tag: 'redeem', url: '/#punkty' }).catch(() => {});
  return r;
}));
app.post('/api/redemptions/:id', auth, parent, wrap(req => {
  F.setRedemption(+req.params.id, req.body.status === 'approved' ? 'approved' : 'rejected');
  return { ok: true };
}));
app.post('/api/penalties', auth, parent, wrap(req => {
  const target = F.member(req.body.member_id);
  if (!target || target.role !== 'parent') throw new Error('Słoik kar jest tylko dla rodziców.');
  const id = F.addPenalty(target.id, req.body.reason || 'Bez powodu :)', req.body.points || 1, req.me.id);
  if (target.id !== req.me.id) R.notify(target.id, { title: `Kara od ${req.me.name} 🫙`, body: req.body.reason || '', tag: 'penalty', url: '/#punkty' }).catch(() => {});
  return { id };
}));
app.delete('/api/penalties/:id', auth, parent, wrap(req => { F.deletePenalty(+req.params.id); return { ok: true }; }));
app.put('/api/settings/stake', auth, parent, wrap(req => { setSetting('penalty_stake', String(req.body.stake || '')); return { ok: true }; }));
app.put('/api/settings/auto-penalty', auth, parent, wrap(req => { setSetting('auto_penalty', !!req.body.on); return { ok: true }; }));
app.get('/api/settings', auth, wrap(() => ({ auto_penalty: getSetting('auto_penalty') !== false, stake: F.penalties().stake })));

// --- rodzina ---
app.get('/api/members', auth, wrap(() => F.members()));
app.post('/api/members', auth, parent, wrap(req => F.addMember(req.body)));
app.put('/api/members/:id', auth, wrap(req => {
  const id = +req.params.id;
  if (req.me.role !== 'parent' && id !== req.me.id) throw new Error('Możesz zmieniać tylko swój profil.');
  const b = { ...req.body };
  if (req.me.role !== 'parent') delete b.role;
  return F.updateMember(id, b);
}));

// --- powiadomienia ---
app.post('/api/push/subscribe', auth, wrap(req => { R.saveSubscription(req.me.id, req.body); return { ok: true }; }));
app.post('/api/push/test', auth, wrap(async req => ({ sent: await R.notify(req.me.id, { title: 'Domownik działa 👍', body: 'Tak będą wyglądać przypomnienia.', url: '/' }) })));

// --- asystent ---
app.get('/api/assistant', auth, wrap(req => ({ enabled: A.enabled(), history: A.history(req.me) })));
app.post('/api/assistant', auth, wrap(req => A.chat(req.me, req.body)));

app.get(/^\/(?!api\/).*/, (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Domownik działa na http://localhost:${PORT} (strefa ${D.TZ}, asystent: ${A.enabled() ? 'włączony' : 'wyłączony'})`);
  R.start();
});
