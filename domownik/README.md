# Domownik

Rodzinna aplikacja do ogarniania domu: zadania na dziś, terminy, przypomnienia o stałych godzinach, punkty dla dzieci, słoik kar dla rodziców i asystent AI (Claude), z którym się rozmawia, któremu można powiedzieć termin albo pokazać zdjęcie kartki.

## Co już działa

- **Profile rodziny** z PIN-em: rodzice mają pełny dostęp, dzieci widzą swoje zadania i zbierają punkty.
- **Dziś**: zadania na dziś i zaległe, odhaczanie jednym dotknięciem, terminy na 7 dni, filtr „Moje / Cała rodzina”.
- **Zadania cykliczne**: codziennie, w wybrane dni tygodnia, co N dni, co N miesięcy. Po odhaczeniu same przechodzą na kolejny termin.
- **Kalendarz** na 30 dni: terminy i zadania razem.
- **Przypomnienia na telefon**: każdy ustawia swoje godziny (np. 15:00 po powrocie z pracy) i dostaje listę „na dziś”. Terminy przypominają się X minut wcześniej.
- **Punkty i nagrody**: dziecko dostaje punkty za zadania, wymienia je na nagrody (np. +30 min na telefonie), rodzic zatwierdza prośbę.
- **Słoik kar**: rodzice dopisują sobie kary dla zabawy, a za zadanie zaległe o dzień kara wpada sama (można wyłączyć).
- **Asystent**: rozmowa tekstem, głosem (mikrofon w Chrome) i zdjęciem. Sam zapisuje terminy i zadania, a każdą zmianę można cofnąć jednym przyciskiem.

## Uruchomienie na komputerze (próba)

Potrzebny Node.js 22.13 lub nowszy.

```bash
cd domownik
npm install
cp .env.example .env    # wpisz ANTHROPIC_API_KEY, żeby włączyć asystenta
npm start
```

Aplikacja będzie pod adresem http://localhost:3000. Przy pierwszym uruchomieniu zakłada się rodzinę (imiona, role, PIN-y).

## Uruchomienie dla całej rodziny (serwer)

Telefony muszą łączyć się z serwerem przez **HTTPS**: bez tego Android nie pozwoli zainstalować aplikacji ani wysyłać powiadomień. Serwer musi działać cały czas, bo to on pilnuje godzin przypomnień.

Najprościej: mały serwer VPS (kilka euro miesięcznie) z Dockerem:

```bash
docker build -t domownik .
docker run -d --name domownik --restart unless-stopped \
  -p 3000:3000 -v domownik-data:/data --env-file .env domownik
```

Przed tym trzeba wystawić HTTPS, np. przez Caddy (sam załatwia certyfikat) albo Cloudflare Tunnel. Można też użyć komputera albo Raspberry Pi w domu z Cloudflare Tunnel.

Wszystkie dane są w jednym pliku `data/domownik.db` (w Dockerze w wolumenie `/data`). Kopia zapasowa to skopiowanie tego pliku.

## Instalacja na telefonie (Android)

1. Otwórz adres aplikacji w Chrome.
2. Menu ⋮ i **Zainstaluj aplikację** (albo **Dodaj do ekranu głównego**).
3. Zaloguj się swoim PIN-em i na ekranie Dziś dotknij **Włącz powiadomienia**.

## Asystent (Claude)

Asystent korzysta z API Claude. Klucz zakłada się na console.anthropic.com i wpisuje do `.env` jako `ANTHROPIC_API_KEY`. API jest płatne za użycie, osobno od abonamentu Claude. Bez klucza reszta aplikacji działa normalnie.

Model ustawia zmienna `CLAUDE_MODEL` (domyślnie `claude-opus-5-5`). Rozmowa z asystentem zaczyna się od nowa każdego dnia.

## Budowa

| Plik | Co robi |
|---|---|
| `server.js` | serwer i API |
| `family.js` | zadania, terminy, punkty, kary |
| `assistant.js` | asystent Claude i jego narzędzia |
| `reminders.js` | powiadomienia push i harmonogram przypomnień |
| `db.js` | baza SQLite |
| `dates.js` | daty i powtarzanie zadań |
| `public/` | aplikacja w telefonie (PWA) |

## Pomysły na dalej

- Połączenie z Twoim Claude (łącznik MCP), żeby zarządzać domem z czatu Claude.
- Przypomnienie po przyjściu do domu (lokalizacja), co wymaga aplikacji natywnej.
- Niedzielne podsumowanie tygodnia.
- Lista zakupów.
