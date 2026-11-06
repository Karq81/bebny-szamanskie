// Daty w strefie czasowej rodziny (domyślnie Europe/Warsaw), format RRRR-MM-DD
const TZ = process.env.TZ_FAMILY || 'Europe/Warsaw';

function partsNow(d = new Date()) {
  const f = new Intl.DateTimeFormat('en-CA', {
    timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hour12: false, weekday: 'short',
  });
  const o = Object.fromEntries(f.formatToParts(d).map(p => [p.type, p.value]));
  const hour = o.hour === '24' ? '00' : o.hour;
  return { date: `${o.year}-${o.month}-${o.day}`, time: `${hour}:${o.minute}` };
}
const today = () => partsNow().date;
const nowTime = () => partsNow().time;

// Operacje na datach kalendarzowych (bez stref - liczone w UTC na samej dacie)
function toUTC(s) { const [y, m, d] = s.split('-').map(Number); return new Date(Date.UTC(y, m - 1, d)); }
function fmt(dt) { return dt.toISOString().slice(0, 10); }
function addDays(s, n) { const d = toUTC(s); d.setUTCDate(d.getUTCDate() + n); return fmt(d); }
function weekday(s) { return toUTC(s).getUTCDay(); } // 0 = niedziela
function diffDays(a, b) { return Math.round((toUTC(a) - toUTC(b)) / 86400000); }
function addMonths(s, n, dayOfMonth) {
  const d = toUTC(s);
  const target = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + n, 1));
  const last = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  target.setUTCDate(Math.min(dayOfMonth || d.getUTCDate(), last));
  return fmt(target);
}

/**
 * Następny termin zadania cyklicznego po dacie `after`.
 * recur: { type: 'daily' } | { type: 'every', days: N } | { type: 'weekly', weekdays: [0..6] }
 *        | { type: 'monthly', months: N, day: D }
 */
function nextDue(recur, after) {
  if (!recur) return null;
  switch (recur.type) {
    case 'daily': return addDays(after, 1);
    case 'every': return addDays(after, Math.max(1, recur.days | 0));
    case 'weekly': {
      const wd = (recur.weekdays && recur.weekdays.length) ? recur.weekdays : [weekday(after)];
      for (let i = 1; i <= 7; i++) { const c = addDays(after, i); if (wd.includes(weekday(c))) return c; }
      return addDays(after, 7);
    }
    case 'monthly': return addMonths(after, Math.max(1, recur.months | 0 || 1), recur.day);
    default: return null;
  }
}

// Pierwszy termin >= start dla zadania tygodniowego (np. utworzonego w środę na wtorki)
function firstDue(recur, start) {
  if (recur && recur.type === 'weekly' && recur.weekdays && recur.weekdays.length) {
    for (let i = 0; i < 7; i++) { const c = addDays(start, i); if (recur.weekdays.includes(weekday(c))) return c; }
  }
  return start;
}

const DNI = ['niedziela', 'poniedziałek', 'wtorek', 'środa', 'czwartek', 'piątek', 'sobota'];
function recurLabel(r) {
  if (!r) return '';
  if (r.type === 'daily') return 'codziennie';
  if (r.type === 'every') return r.days === 1 ? 'codziennie' : `co ${r.days} dni`;
  if (r.type === 'weekly') return (r.weekdays || []).map(d => DNI[d]).join(', ') || 'co tydzień';
  if (r.type === 'monthly') return (r.months || 1) === 1 ? 'co miesiąc' : `co ${r.months} mies.`;
  return '';
}

module.exports = { TZ, today, nowTime, addDays, weekday, diffDays, nextDue, firstDue, recurLabel, DNI };
