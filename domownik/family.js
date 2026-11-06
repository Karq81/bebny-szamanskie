// Logika rodziny: zadania, terminy, punkty, kary. Używana przez API i przez asystenta.
const crypto = require('crypto');
const { all, get, run, getSetting } = require('./db');
const D = require('./dates');

const COLORS = ['#3B6FD8', '#E0594A', '#D9A11B', '#3E9B5C', '#8A4FC7', '#D2558F'];

function hashPin(pin) {
  const salt = crypto.randomBytes(8).toString('hex');
  return salt + ':' + crypto.scryptSync(String(pin), salt, 32).toString('hex');
}
function checkPin(pin, stored) {
  const [salt, h] = stored.split(':');
  const test = crypto.scryptSync(String(pin), salt, 32).toString('hex');
  return crypto.timingSafeEqual(Buffer.from(h, 'hex'), Buffer.from(test, 'hex'));
}

// ---------- Członkowie ----------
function publicMember(m) {
  if (!m) return null;
  return { id: m.id, name: m.name, role: m.role, color: m.color, reminder_times: JSON.parse(m.reminder_times) };
}
function members() { return all('SELECT * FROM members ORDER BY role DESC, id').map(publicMember); }
function member(id) { return publicMember(get('SELECT * FROM members WHERE id = ?', id)); }
function memberByName(name) {
  if (!name) return null;
  const n = String(name).trim().toLowerCase();
  const list = members();
  return list.find(m => m.name.toLowerCase() === n)
    || list.find(m => m.name.toLowerCase().startsWith(n.slice(0, 3)))
    || null;
}
function addMember({ name, role, pin, color, reminder_times }) {
  if (!name || !/^\d{4,8}$/.test(String(pin || ''))) throw new Error('Podaj imię i PIN (4–8 cyfr).');
  const count = get('SELECT COUNT(*) c FROM members').c;
  const r = run('INSERT INTO members (name, role, color, pin_hash, reminder_times) VALUES (?, ?, ?, ?, ?)',
    name.trim(), role === 'child' ? 'child' : 'parent', color || COLORS[count % COLORS.length],
    hashPin(pin), JSON.stringify(reminder_times || []));
  return member(r.lastInsertRowid);
}
function updateMember(id, { name, role, color, pin, reminder_times }) {
  const m = get('SELECT * FROM members WHERE id = ?', id);
  if (!m) throw new Error('Nie ma takiej osoby.');
  run('UPDATE members SET name = ?, role = ?, color = ?, reminder_times = ? WHERE id = ?',
    name ?? m.name, role ?? m.role, color ?? m.color,
    reminder_times ? JSON.stringify(reminder_times.filter(t => /^\d{2}:\d{2}$/.test(t)).sort()) : m.reminder_times, id);
  if (pin) {
    if (!/^\d{4,8}$/.test(String(pin))) throw new Error('PIN musi mieć 4–8 cyfr.');
    run('UPDATE members SET pin_hash = ? WHERE id = ?', hashPin(pin), id);
  }
  return member(id);
}
function login(memberId, pin) {
  const m = get('SELECT * FROM members WHERE id = ?', memberId);
  if (!m || !checkPin(pin, m.pin_hash)) return null;
  const token = crypto.randomBytes(24).toString('hex');
  run('INSERT INTO sessions (token, member_id) VALUES (?, ?)', token, m.id);
  return { token, member: publicMember(m) };
}
function memberByToken(token) {
  if (!token) return null;
  const s = get('SELECT member_id FROM sessions WHERE token = ?', token);
  return s ? member(s.member_id) : null;
}

// ---------- Zadania ----------
function taskOut(t) {
  const recur = t.recur ? JSON.parse(t.recur) : null;
  return {
    id: t.id, title: t.title, assignee_id: t.assignee_id, due_date: t.due_date, due_time: t.due_time,
    recur, recur_label: D.recurLabel(recur), points: t.points, overdue_days: Math.max(0, D.diffDays(D.today(), t.due_date)),
  };
}
function addTask({ title, assignee_id, due_date, due_time, recur, points }, byId) {
  if (!title) throw new Error('Zadanie musi mieć nazwę.');
  const start = D.firstDue(recur, due_date || D.today());
  const r = run('INSERT INTO tasks (title, assignee_id, due_date, due_time, recur, points, created_by) VALUES (?, ?, ?, ?, ?, ?, ?)',
    title.trim(), assignee_id || null, start, due_time || null, recur ? JSON.stringify(recur) : null, points | 0, byId || null);
  return taskOut(get('SELECT * FROM tasks WHERE id = ?', r.lastInsertRowid));
}
function updateTask(id, fields) {
  const t = get('SELECT * FROM tasks WHERE id = ?', id);
  if (!t) throw new Error('Nie ma takiego zadania.');
  const recur = fields.recur !== undefined ? fields.recur : (t.recur ? JSON.parse(t.recur) : null);
  run('UPDATE tasks SET title = ?, assignee_id = ?, due_date = ?, due_time = ?, recur = ?, points = ? WHERE id = ?',
    fields.title ?? t.title, fields.assignee_id !== undefined ? fields.assignee_id : t.assignee_id,
    fields.due_date ?? t.due_date, fields.due_time !== undefined ? fields.due_time : t.due_time,
    recur ? JSON.stringify(recur) : null, fields.points ?? t.points, id);
  return taskOut(get('SELECT * FROM tasks WHERE id = ?', id));
}
function taskCreator(id) { const t = get('SELECT created_by FROM tasks WHERE id = ?', id); return t ? t.created_by : null; }
function deleteTask(id) { run('UPDATE tasks SET active = 0 WHERE id = ?', id); }
function restoreTask(id) { run('UPDATE tasks SET active = 1 WHERE id = ?', id); }

function completeTask(id, byMember) {
  const t = get('SELECT * FROM tasks WHERE id = ? AND active = 1', id);
  if (!t) throw new Error('Nie ma takiego zadania.');
  const who = t.assignee_id || byMember.id;
  const whoM = member(who);
  // Dziecko dostaje punkty od razu; rodzic może je cofnąć.
  const pts = whoM && whoM.role === 'child' ? t.points : 0;
  const c = run('INSERT INTO completions (task_id, title, member_id, due_date, points) VALUES (?, ?, ?, ?, ?)',
    t.id, t.title, who, t.due_date, pts);
  const recur = t.recur ? JSON.parse(t.recur) : null;
  if (recur) {
    const base = D.diffDays(D.today(), t.due_date) > 0 ? D.today() : t.due_date;
    run('UPDATE tasks SET due_date = ?, penalized_for = NULL WHERE id = ?', D.nextDue(recur, base), t.id);
  } else {
    run('UPDATE tasks SET active = 0 WHERE id = ?', t.id);
  }
  return { completion_id: Number(c.lastInsertRowid), points: pts, member: whoM?.name };
}
function undoCompletion(completionId) {
  const c = get('SELECT * FROM completions WHERE id = ?', completionId);
  if (!c) throw new Error('Nie ma takiego wpisu.');
  if (c.task_id) run('UPDATE tasks SET due_date = ?, active = 1 WHERE id = ?', c.due_date, c.task_id);
  run('DELETE FROM completions WHERE id = ?', completionId);
}
function todayDone() {
  return all(`SELECT c.*, m.name AS member_name FROM completions c LEFT JOIN members m ON m.id = c.member_id
              WHERE date(c.at, 'localtime') = date('now', 'localtime') OR c.due_date = ? ORDER BY c.at DESC`, D.today());
}

// ---------- Terminy (wydarzenia) ----------
function eventOut(e) {
  return { id: e.id, title: e.title, date: e.date, time: e.time, member_ids: JSON.parse(e.member_ids), remind_minutes: e.remind_minutes, notes: e.notes };
}
function addEvent({ title, date, time, member_ids, remind_minutes, notes }, byId) {
  if (!title || !/^\d{4}-\d{2}-\d{2}$/.test(date || '')) throw new Error('Termin musi mieć nazwę i datę.');
  const r = run('INSERT INTO events (title, date, time, member_ids, remind_minutes, notes, created_by) VALUES (?, ?, ?, ?, ?, ?, ?)',
    title.trim(), date, time || null, JSON.stringify(member_ids || []),
    remind_minutes == null || remind_minutes === '' ? null : Number(remind_minutes), notes || null, byId || null);
  return eventOut(get('SELECT * FROM events WHERE id = ?', r.lastInsertRowid));
}
function updateEvent(id, f) {
  const e = get('SELECT * FROM events WHERE id = ?', id);
  if (!e) throw new Error('Nie ma takiego terminu.');
  run('UPDATE events SET title = ?, date = ?, time = ?, member_ids = ?, remind_minutes = ?, notes = ?, reminded = 0 WHERE id = ?',
    f.title ?? e.title, f.date ?? e.date, f.time !== undefined ? f.time : e.time,
    f.member_ids ? JSON.stringify(f.member_ids) : e.member_ids,
    f.remind_minutes !== undefined ? f.remind_minutes : e.remind_minutes, f.notes !== undefined ? f.notes : e.notes, id);
  return eventOut(get('SELECT * FROM events WHERE id = ?', id));
}
function deleteEvent(id) { run('DELETE FROM events WHERE id = ?', id); }

// Plan: zadania (z rozwinięciem cyklicznych) i terminy w zakresie dat
function schedule(from, to) {
  const tasks = [];
  for (const t of all('SELECT * FROM tasks WHERE active = 1 ORDER BY due_date, due_time')) {
    const base = taskOut(t);
    if (t.due_date <= to) tasks.push({ ...base, date: t.due_date });
    // pokaż przyszłe powtórzenia zadań cyklicznych (tylko w podglądzie)
    if (base.recur) {
      let d = t.due_date < from ? D.today() : t.due_date;
      for (let i = 0; i < 40; i++) {
        d = D.nextDue(base.recur, d);
        if (!d || d > to) break;
        if (d >= from) tasks.push({ ...base, date: d, preview: true });
      }
    }
  }
  const events = all('SELECT * FROM events WHERE date >= ? AND date <= ? ORDER BY date, time', from, to).map(eventOut);
  return { tasks, events };
}

// ---------- Punkty, nagrody, kary ----------
function childPoints(memberId) {
  const earned = get("SELECT COALESCE(SUM(points),0) s FROM completions WHERE member_id = ? AND status = 'ok'", memberId).s;
  const spent = get("SELECT COALESCE(SUM(cost),0) s FROM redemptions WHERE member_id = ? AND status != 'rejected'", memberId).s;
  const week = get(`SELECT COALESCE(SUM(points),0) s FROM completions WHERE member_id = ? AND status = 'ok' AND date(at) >= date('now','-6 days')`, memberId).s;
  return { balance: earned - spent, earned_week: week };
}
function rewards() { return all('SELECT * FROM rewards ORDER BY cost'); }
function addReward(title, cost) { run('INSERT INTO rewards (title, cost) VALUES (?, ?)', title, cost | 0); }
function deleteReward(id) { run('DELETE FROM rewards WHERE id = ?', id); }
function redeem(memberId, rewardId) {
  const r = get('SELECT * FROM rewards WHERE id = ?', rewardId);
  if (!r) throw new Error('Nie ma takiej nagrody.');
  if (childPoints(memberId).balance < r.cost) throw new Error('Za mało punktów.');
  const x = run('INSERT INTO redemptions (member_id, title, cost) VALUES (?, ?, ?)', memberId, r.title, r.cost);
  return { id: Number(x.lastInsertRowid), title: r.title, cost: r.cost };
}
function redemptions() {
  return all(`SELECT r.*, m.name AS member_name FROM redemptions r JOIN members m ON m.id = r.member_id
              WHERE r.status = 'pending' OR date(r.at) >= date('now','-14 days') ORDER BY r.at DESC`);
}
function setRedemption(id, status) { run('UPDATE redemptions SET status = ? WHERE id = ?', status, id); }

function monthStart() { return D.today().slice(0, 8) + '01'; }
function addPenalty(memberId, reason, points, byId) {
  const r = run('INSERT INTO penalties (member_id, reason, points, by_id) VALUES (?, ?, ?, ?)', memberId, reason, points || 1, byId || null);
  return Number(r.lastInsertRowid);
}
function deletePenalty(id) { run('DELETE FROM penalties WHERE id = ?', id); }
function penalties() {
  const from = monthStart();
  const list = all(`SELECT p.*, m.name AS member_name FROM penalties p JOIN members m ON m.id = p.member_id
                    WHERE date(p.at, 'localtime') >= ? ORDER BY p.at DESC`, from);
  const totals = {};
  for (const m of members().filter(m => m.role === 'parent')) totals[m.id] = 0;
  for (const p of list) totals[p.member_id] = (totals[p.member_id] || 0) + p.points;
  return { month: from.slice(0, 7), list, totals, stake: getSetting('penalty_stake') || 'Kto ma więcej kar na koniec miesiąca, stawia kolację.' };
}
// Automatyczne kary dla rodziców za zadania przeterminowane o co najmniej 1 dzień (raz na termin)
function autoPenalties() {
  if (getSetting('auto_penalty') === false) return 0;
  let n = 0;
  const t0 = D.today();
  for (const t of all(`SELECT t.* FROM tasks t JOIN members m ON m.id = t.assignee_id
                       WHERE t.active = 1 AND m.role = 'parent' AND t.due_date < ? AND (t.penalized_for IS NULL OR t.penalized_for != t.due_date)`, t0)) {
    addPenalty(t.assignee_id, `Przeterminowane: ${t.title}`, 1, null);
    run('UPDATE tasks SET penalized_for = due_date WHERE id = ?', t.id);
    n++;
  }
  return n;
}

module.exports = {
  COLORS, members, member, memberByName, addMember, updateMember, login, memberByToken,
  addTask, updateTask, deleteTask, taskCreator, restoreTask, completeTask, undoCompletion, todayDone,
  addEvent, updateEvent, deleteEvent, schedule,
  childPoints, rewards, addReward, deleteReward, redeem, redemptions, setRedemption,
  addPenalty, deletePenalty, penalties, autoPenalties,
};
