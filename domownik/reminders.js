// Powiadomienia na telefony (Web Push) i harmonogram przypomnień
const webpush = require('web-push');
const { all, get, run, getSetting, setSetting } = require('./db');
const F = require('./family');
const D = require('./dates');

// Klucze VAPID: z .env albo generowane raz i zapisywane w bazie
let vapid = process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY
  ? { publicKey: process.env.VAPID_PUBLIC_KEY, privateKey: process.env.VAPID_PRIVATE_KEY }
  : getSetting('vapid');
if (!vapid) { vapid = webpush.generateVAPIDKeys(); setSetting('vapid', vapid); }
webpush.setVapidDetails(process.env.VAPID_SUBJECT || 'mailto:domownik@example.com', vapid.publicKey, vapid.privateKey);

function saveSubscription(memberId, sub) {
  run('INSERT INTO push_subs (endpoint, member_id, sub) VALUES (?, ?, ?) ON CONFLICT(endpoint) DO UPDATE SET member_id = excluded.member_id, sub = excluded.sub',
    sub.endpoint, memberId, JSON.stringify(sub));
}

async function notify(memberId, payload) {
  const subs = all('SELECT * FROM push_subs WHERE member_id = ?', memberId);
  for (const s of subs) {
    try {
      await webpush.sendNotification(JSON.parse(s.sub), JSON.stringify(payload), { TTL: 3600 });
    } catch (e) {
      if (e.statusCode === 404 || e.statusCode === 410) run('DELETE FROM push_subs WHERE endpoint = ?', s.endpoint);
      else console.warn('Push nie wysłany:', e.statusCode || e.message);
    }
  }
  return subs.length;
}
async function notifyParents(payload) {
  for (const m of F.members().filter(m => m.role === 'parent')) await notify(m.id, payload);
}

function onceKey(key) {
  try { run('INSERT INTO sent_reminders (key) VALUES (?)', key); return true; } catch { return false; }
}

// Lista zadań na dziś (i zaległych) dla osoby
function todayFor(memberId) {
  const t = D.today();
  return F.schedule(t, t).tasks.filter(x => !x.preview && (x.assignee_id === memberId || x.assignee_id == null));
}

async function tick() {
  const date = D.today();
  const time = D.nowTime();

  // 1) Przypomnienia o stałych godzinach: "Na dziś masz..."
  for (const m of F.members()) {
    if (!m.reminder_times.includes(time)) continue;
    if (!onceKey(`daily:${m.id}:${date}:${time}`)) continue;
    const tasks = todayFor(m.id);
    if (!tasks.length) continue;
    const lines = tasks.slice(0, 6).map(x => (x.overdue_days ? '⚠ ' : '• ') + x.title);
    await notify(m.id, {
      title: `${m.name}, na dziś: ${tasks.length} ${tasks.length === 1 ? 'zadanie' : 'zadania'}`,
      body: lines.join('\n') + (tasks.length > 6 ? `\n…i ${tasks.length - 6} więcej` : ''),
      tag: 'daily', url: '/#dzis',
    });
  }

  // 2) Przypomnienia o terminach (X minut przed)
  for (const e of all('SELECT * FROM events WHERE reminded = 0 AND remind_minutes IS NOT NULL AND date >= ? AND date <= ?', D.addDays(date, -1), D.addDays(date, 8))) {
    const at = new Date(`${e.date}T${e.time || '09:00'}:00`);
    const nowLocal = new Date(`${date}T${time}:00`);
    const minutesLeft = (at - nowLocal) / 60000;
    if (minutesLeft > e.remind_minutes || minutesLeft < -60) continue;
    run('UPDATE events SET reminded = 1 WHERE id = ?', e.id);
    const ids = JSON.parse(e.member_ids);
    const targets = ids.length ? ids : F.members().map(m => m.id);
    const when = e.date === date ? 'dziś' : e.date === D.addDays(date, 1) ? 'jutro' : e.date;
    for (const id of targets) {
      await notify(id, { title: `Przypomnienie: ${e.title}`, body: `${when}${e.time ? ' o ' + e.time : ''}${e.notes ? ' · ' + e.notes : ''}`, tag: 'event-' + e.id, url: '/#kalendarz' });
    }
  }

  // 3) Raz dziennie po północy: automatyczne kary dla rodziców za zaległości
  if (time >= '00:05' && onceKey(`penalties:${date}`)) {
    const n = F.autoPenalties();
    if (n) console.log(`Dodano ${n} automatycznych kar`);
  }
}

function start() {
  const loop = () => tick().catch(e => console.error('Błąd przypomnień:', e));
  setTimeout(loop, 3000);
  setInterval(loop, 30 * 1000);
}

module.exports = { publicKey: () => vapid.publicKey, saveSubscription, notify, notifyParents, start, tick };
