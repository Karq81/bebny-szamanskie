// Asystent rodzinny oparty na Claude: rozmowa, zdjęcia, zapisywanie terminów i zadań
const Anthropic = require('@anthropic-ai/sdk');
const { get, run } = require('./db');
const F = require('./family');
const D = require('./dates');

const MODEL = process.env.CLAUDE_MODEL || 'claude-opus-5-5';
let client = null;
function api() {
  if (!client) client = new Anthropic(); // klucz z ANTHROPIC_API_KEY
  return client;
}
const enabled = () => Boolean(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN);

const recurSchema = {
  type: 'object',
  description: 'Powtarzanie zadania. Pomiń dla zadania jednorazowego.',
  properties: {
    type: { type: 'string', enum: ['daily', 'every', 'weekly', 'monthly'], description: 'daily = codziennie, every = co N dni, weekly = w wybrane dni tygodnia, monthly = co N miesięcy' },
    days: { type: 'integer', description: 'Dla every: co ile dni' },
    weekdays: { type: 'array', items: { type: 'integer', minimum: 0, maximum: 6 }, description: 'Dla weekly: dni tygodnia, 0 = niedziela, 1 = poniedziałek ... 6 = sobota' },
    months: { type: 'integer', description: 'Dla monthly: co ile miesięcy' },
  },
  required: ['type'],
};

const TOOLS = [
  {
    name: 'show_plan',
    description: 'Pokazuje zadania i terminy rodziny w zakresie dat (włącznie). Używaj, gdy ktoś pyta, co jest zaplanowane, albo zanim coś zmienisz lub usuniesz, żeby poznać id.',
    input_schema: {
      type: 'object',
      properties: {
        from: { type: 'string', description: 'Data początkowa RRRR-MM-DD' },
        to: { type: 'string', description: 'Data końcowa RRRR-MM-DD' },
      },
      required: ['from', 'to'],
    },
  },
  {
    name: 'add_event',
    description: 'Zapisuje termin w kalendarzu rodziny (wizyta, zebranie, wyjazd, trening, urodziny, dzień wolny w szkole).',
    input_schema: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'Krótka nazwa, np. "Dentysta" albo "Zebranie klasy 5b"' },
        date: { type: 'string', description: 'RRRR-MM-DD' },
        time: { type: 'string', description: 'GG:MM, pomiń gdy brak godziny' },
        people: { type: 'array', items: { type: 'string' }, description: 'Imiona osób, których dotyczy. Pusta lista = cała rodzina.' },
        remind_minutes_before: { type: 'integer', description: 'Ile minut wcześniej przypomnieć. Pomiń, żeby użyć domyślnego (60 min, a bez godziny: wieczór dzień wcześniej).' },
        notes: { type: 'string', description: 'Miejsce, sala, co zabrać itp.' },
      },
      required: ['title', 'date', 'people'],
    },
  },
  {
    name: 'add_task',
    description: 'Dodaje zadanie domowe (jednorazowe albo cykliczne) dla osoby z rodziny lub dla wszystkich.',
    input_schema: {
      type: 'object',
      properties: {
        title: { type: 'string' },
        person: { type: 'string', description: 'Imię osoby. Pomiń, jeśli zadanie jest dla kogokolwiek.' },
        date: { type: 'string', description: 'Pierwszy termin RRRR-MM-DD (domyślnie dziś)' },
        time: { type: 'string', description: 'Do której godziny GG:MM, opcjonalnie' },
        recur: recurSchema,
        points: { type: 'integer', description: 'Punkty dla dziecka za wykonanie. Dla rodziców 0.' },
      },
      required: ['title'],
    },
  },
  {
    name: 'complete_task',
    description: 'Oznacza zadanie jako zrobione (id z show_plan).',
    input_schema: { type: 'object', properties: { task_id: { type: 'integer' } }, required: ['task_id'] },
  },
  {
    name: 'delete_item',
    description: 'Usuwa zadanie albo termin (id z show_plan). Usuwaj tylko na wyraźną prośbę.',
    input_schema: {
      type: 'object',
      properties: { kind: { type: 'string', enum: ['task', 'event'] }, id: { type: 'integer' } },
      required: ['kind', 'id'],
    },
  },
  {
    name: 'add_penalty',
    description: 'Dopisuje punkt karny do słoika kar rodzica (zabawa między rodzicami). Tylko rodzic może to zlecić.',
    input_schema: {
      type: 'object',
      properties: { person: { type: 'string' }, reason: { type: 'string' }, points: { type: 'integer', minimum: 1, maximum: 5 } },
      required: ['person', 'reason'],
    },
  },
];

function systemPrompt(me) {
  const fam = F.members().map(m => `- ${m.name} (${m.role === 'parent' ? 'rodzic' : 'dziecko'})`).join('\n');
  return `Jesteś asystentem rodzinnej aplikacji "Domownik". Pomagasz rodzinie ogarniać dom: zapisujesz terminy, dodajesz zadania domowe, przypominasz, co jest do zrobienia.

Rodzina:
${fam}

Rozmawiasz z: ${me.name} (${me.role === 'parent' ? 'rodzic' : 'dziecko'}).
Dzisiaj jest ${D.DNI[D.weekday(D.today())]}, ${D.today()}. Strefa czasowa: ${D.TZ}.

Jak działać:
- Mów po polsku, krótko i ciepło, jak domownik, nie jak urzędnik.
- Daty względne ("jutro", "w piątek", "za tydzień") zamieniaj na konkretne daty RRRR-MM-DD.
- Gdy ktoś wprost prosi o zapisanie ("zapisz", "dodaj", "przypomnij mi"), zapisz od razu i potwierdź jednym zdaniem, co zapisałeś i kiedy.
- Gdy dane pochodzą ze zdjęcia (karteczka z przychodni, pismo ze szkoły, zaproszenie) albo czegoś brakuje lub jest niejasne, najpierw wypisz, co odczytałeś (co, kiedy, kogo dotyczy), i zapytaj, czy zapisać. Nie zgaduj godzin ani dat.
- "Ja", "mi", "mnie" oznacza osobę, z którą rozmawiasz (${me.name}).
- Dla dzieci proponuj punkty za zadania: drobne 5, średnie 10–15, duże 20–30. Rodzice nie dostają punktów.
- ${me.role === 'child' ? 'Rozmawiasz z dzieckiem: może dodawać zadania i terminy dla siebie. Nie dodawaj kar i nie zmieniaj spraw innych osób.' : 'Rozmawiasz z rodzicem: ma pełny dostęp.'}
- Słoik kar to żart między rodzicami. Dopisuj karę tylko na wyraźną prośbę rodzica.`;
}

function today(me) {
  const row = get('SELECT messages FROM chats WHERE member_id = ? AND day = ?', me.id, D.today());
  return row ? JSON.parse(row.messages) : [];
}
function save(me, messages) {
  run('INSERT INTO chats (member_id, day, messages) VALUES (?, ?, ?) ON CONFLICT(member_id, day) DO UPDATE SET messages = excluded.messages',
    me.id, D.today(), JSON.stringify(messages));
}

const isDate = s => /^\d{4}-\d{2}-\d{2}$/.test(s || '');
const isTime = s => /^\d{2}:\d{2}$/.test(s || '');

function personId(name, me) {
  if (!name) return null;
  const m = F.memberByName(name);
  if (!m) throw new Error(`Nie znam osoby "${name}". W rodzinie są: ${F.members().map(x => x.name).join(', ')}.`);
  if (me.role === 'child' && m.id !== me.id) throw new Error('Dziecko może dodawać sprawy tylko dla siebie.');
  return m.id;
}

// Wykonanie narzędzia; zwraca tekst dla modelu i opcjonalną akcję do pokazania (z możliwością cofnięcia)
function runTool(name, input, me) {
  switch (name) {
    case 'show_plan': {
      if (!isDate(input.from) || !isDate(input.to)) throw new Error('Podaj daty RRRR-MM-DD.');
      const s = F.schedule(input.from, input.to);
      const names = Object.fromEntries(F.members().map(m => [m.id, m.name]));
      return {
        text: JSON.stringify({
          tasks: s.tasks.map(t => ({ id: t.id, title: t.title, date: t.date, time: t.due_time, person: names[t.assignee_id] || 'ktokolwiek', recur: t.recur_label || null, points: t.points, overdue_days: t.preview ? 0 : t.overdue_days })),
          events: s.events.map(e => ({ id: e.id, title: e.title, date: e.date, time: e.time, people: e.member_ids.map(i => names[i]), notes: e.notes })),
        }),
      };
    }
    case 'add_event': {
      if (!isDate(input.date)) throw new Error('Data musi mieć format RRRR-MM-DD.');
      const time = isTime(input.time) ? input.time : null;
      const ids = (input.people || []).map(p => personId(p, me));
      const remind = input.remind_minutes_before != null ? input.remind_minutes_before : (time ? 60 : 12 * 60);
      const e = F.addEvent({ title: input.title, date: input.date, time, member_ids: ids, remind_minutes: remind, notes: input.notes }, me.id);
      return { text: `Zapisano termin id=${e.id}.`, action: { kind: 'event', id: e.id, label: `Termin: ${e.title}, ${e.date}${time ? ' ' + time : ''}` } };
    }
    case 'add_task': {
      const pid = input.person ? personId(input.person, me) : (me.role === 'child' ? me.id : null);
      const date = isDate(input.date) ? input.date : D.today();
      const t = F.addTask({ title: input.title, assignee_id: pid, due_date: date, due_time: isTime(input.time) ? input.time : null, recur: input.recur || null, points: input.points || 0 }, me.id);
      const who = pid ? F.member(pid).name : 'ktokolwiek';
      return { text: `Dodano zadanie id=${t.id}, pierwszy termin ${t.due_date}.`, action: { kind: 'task', id: t.id, label: `Zadanie: ${t.title} · ${who} · ${t.recur_label || t.due_date}${t.points ? ` · +${t.points} pkt` : ''}` } };
    }
    case 'complete_task': {
      const r = F.completeTask(input.task_id, me);
      return { text: `Zrobione. Punkty: ${r.points}.`, action: { kind: 'completion', id: r.completion_id, label: `Zrobione${r.points ? ` · +${r.points} pkt dla ${r.member}` : ''}` } };
    }
    case 'delete_item': {
      if (me.role === 'child') throw new Error('Usuwać może tylko rodzic.');
      if (input.kind === 'task') { F.deleteTask(input.id); return { text: 'Usunięto zadanie.', action: { kind: 'deleted_task', id: input.id, label: 'Usunięto zadanie' } }; }
      F.deleteEvent(input.id); return { text: 'Usunięto termin.' };
    }
    case 'add_penalty': {
      if (me.role !== 'parent') throw new Error('Kary dopisują tylko rodzice.');
      const m = F.memberByName(input.person);
      if (!m || m.role !== 'parent') throw new Error('Słoik kar jest tylko dla rodziców.');
      const id = F.addPenalty(m.id, input.reason, input.points || 1, me.id);
      return { text: 'Dopisano karę.', action: { kind: 'penalty', id, label: `Kara dla ${m.name}: ${input.reason} (+${input.points || 1})` } };
    }
    default: throw new Error('Nieznane narzędzie.');
  }
}

async function chat(me, { text, image }) {
  if (!enabled()) {
    return { text: 'Asystent jeszcze nie jest włączony. Trzeba dodać klucz API Claude w ustawieniach serwera (ANTHROPIC_API_KEY). Do tego czasu zadania i terminy dodasz przyciskiem +.', actions: [] };
  }
  const messages = today(me);
  const content = [];
  if (image) {
    const m = /^data:(image\/(?:jpeg|png|webp|gif));base64,(.+)$/.exec(image);
    if (!m) throw new Error('Nieobsługiwany format zdjęcia.');
    content.push({ type: 'image', source: { type: 'base64', media_type: m[1], data: m[2] } });
  }
  content.push({ type: 'text', text: text && text.trim() ? text.trim() : 'Co tu jest? Wypisz terminy i zapytaj, czy zapisać.' });
  messages.push({ role: 'user', content });

  const actions = [];
  let finalText = '';
  for (let i = 0; i < 8; i++) {
    const response = await api().beta.messages.create({
      model: MODEL,
      max_tokens: 16000,
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      output_config: { effort: 'medium' },
      system: systemPrompt(me),
      tools: TOOLS,
      messages,
    });
    // Pełną treść odpowiedzi dopisujemy do historii (bez edycji wcześniejszych wiadomości)
    messages.push({ role: 'assistant', content: response.content });

    if (response.stop_reason === 'refusal') { finalText = 'Tej prośby nie mogę wykonać. Spróbuj sformułować ją inaczej.'; break; }
    const uses = response.content.filter(b => b.type === 'tool_use');
    finalText = response.content.filter(b => b.type === 'text').map(b => b.text).join('\n').trim();
    if (response.stop_reason !== 'tool_use' || !uses.length) break;

    const results = [];
    for (const u of uses) {
      try {
        const r = runTool(u.name, u.input || {}, me);
        if (r.action) actions.push(r.action);
        results.push({ type: 'tool_result', tool_use_id: u.id, content: r.text });
      } catch (e) {
        results.push({ type: 'tool_result', tool_use_id: u.id, content: e.message, is_error: true });
      }
    }
    messages.push({ role: 'user', content: results });
  }
  // Akcje zapisujemy przy ostatniej odpowiedzi, żeby historia pokazała je po odświeżeniu
  save(me, messages);
  if (actions.length) {
    run('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
      `actions:${me.id}:${D.today()}:${messages.length - 1}`, JSON.stringify(actions));
  }
  return { text: finalText || 'Gotowe.', actions };
}

function historyWithActions(me) {
  const msgs = today(me);
  const out = [];
  msgs.forEach((m, idx) => {
    if (m.role === 'user' && Array.isArray(m.content) && m.content.every(b => b.type === 'tool_result')) return;
    const text = typeof m.content === 'string' ? m.content : m.content.filter(b => b.type === 'text').map(b => b.text).join('\n').trim();
    const image = Array.isArray(m.content) && m.content.some(b => b.type === 'image');
    const a = get('SELECT value FROM settings WHERE key = ?', `actions:${me.id}:${D.today()}:${idx}`);
    if (!text && !image && !a) return;
    out.push({ role: m.role, text, image, actions: a ? JSON.parse(a.value) : undefined });
  });
  return out;
}

module.exports = { chat, history: historyWithActions, enabled, TOOLS, runTool };
