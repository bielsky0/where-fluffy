# 04 — Auth i bezpieczeństwo

## Co to robi / Jak działa

### Trzy ścieżki logowania → jeden kontrakt

`auth.service.ts` udostępnia `register`/`login` (hasło), `requestOtp`/`verifyOtp` (kody
jednorazowe) i `loginWithOAuth` (Google/Facebook). Wszystkie trzy **zbiegają do jednego
`AuthResponseDTO`**, więc kontroler ma jedną ścieżkę ustawienia cookie — dodanie czwartego
providera nie dotyka kontrolera.

1. **Hasło** — bcrypt przez wstrzykiwany kontrakt `PasswordHasher` (testy podmieniają na fake bez
   kosztu hashowania). Rejestracja: proaktywny `findByEmail` + **fallback na race condition**:
   `auth.repository.create` tłumaczy Prismowe `P2002` (unique violation) na domenowe
   `EMAIL_ALREADY_EXISTS_ERROR` — dwa równoległe requesty z tym samym emailem nie wyciekną
   `PrismaClientKnownRequestError` na zewnątrz.
2. **OTP + ghost accounts** — 6-cyfrowy kod, TTL 5 min, tabela `OtpCode` celowo odklejona od
   `User` (konto może nie istnieć w momencie żądania). Pierwsza weryfikacja tworzy **ghost
   usera** (`isGhost: true`, bez hasła, `name: 'Gość'`) — minimalizuje tarcie: zgłoszenie
   zaginięcia bez klasycznej rejestracji. W dev kod jest logowany i zwracany jako `devCode`
   (oszczędza limity Resend); mail przez Resend w prod.
3. **OAuth (Google/Facebook)** — przepływ authorization code po stronie backendu.
   `findOrCreateOAuthUser`: match po `(provider, providerId)` → po emailu (linkuje tożsamość
   OAuth do istniejącego konta hasłowego/ghost) → create. **State nonce w Redis, konsumowany
   przez `GETDEL`** — atomowe single-use, ochrona przed CSRF na callbacku. Błędy callbacku →
   redirect na frontend z `?error=` (użytkownik jest w przeglądarce, JSON by nic nie dał).
   Per-provider kill switch (`GOOGLE_OAUTH_ENABLED` / `FACEBOOK_OAUTH_ENABLED`) — w prod overlay
   OAuth jest domyślnie wyłączony, dopóki nie ma zweryfikowanych aplikacji u providerów.

### JWT w httpOnly cookie — weryfikowany w DWÓCH miejscach

Token (`HS256`, 1 dzień) trafia do cookie `token`: `httpOnly` (JS nie ma dostępu — odporność na
XSS-kradzież), `secure` w prod, `sameSite: 'lax'` (chroni przed CSRF na POST-ach cross-site,
a pozwala na top-level nawigację z maila). Weryfikacja:

- HTTP: `shared/middleware/auth.middleware.ts` (`authenticate` → `req.user`),
- WS: `io.use(...)` w `shared/infrastructure/socket.ts` — parsuje cookie z
  `socket.request.headers.cookie`, bo handshake Socket.io to zwykły HTTP request z cookies.

Te dwa miejsca **muszą być utrzymywane w synchronizacji** — to jawnie udokumentowany invariant.
`jwt.verify` z `{algorithms: ['HS256']}` — jawna lista algorytmów zamyka klasyczny atak
`alg: none`/confusion. Fallback sekretu (`'super-secret-key-change-me'`) jest **strzeżony**:
boot rzuca, jeśli `NODE_ENV=production` i sekret jest pusty lub równy fallbackowi.

### Rate limiting — jedna fabryka, wiele polityk, jeden klient Redis

Wszystkie na `rate-limiter-flexible` (`RateLimiterRedis`), wszystkie na **tym samym,
ogólnoprzeznaczeniowym `redisClient`**. Ta sama fabryka `createRateLimiterMiddleware(redis,
options, resolveKey?)` — różnią się tylko opcjami i funkcją klucza:

| Limiter | Gdzie | Klucz | Parametry |
|---|---|---|---|
| HTTP globalny | `app.ts`, przed `/api/v1` | IP | 100 req / 60 s |
| Login | `POST /auth/login` | IP | 5 / 60 s, block 300 s (brute force) |
| OTP request | `POST /auth/otp/request` | **email z body** (fallback IP) | 3 / 60 s, block 300 s |
| OTP verify | `POST /auth/otp/verify` | **email z body** | 5 / 60 s, block 300 s |
| OAuth start / callback | `GET /auth/{google,facebook}[/callback]` | IP | 10 i 20 / 60 s |
| WS connection | `io.use(...)`, PRZED middleware JWT | `handshake.address` | 5 / 10 s, block 60 s |
| WS event | `socket.use(rateLimitEvents(userId))` | userId | 20 / 10 s |

Detal wart podkreślenia: limitery OTP są **keyowane emailem, nie IP** — bo chronioną wartością
jest skrzynka JEDNEGO odbiorcy (spam kodami / brute force 6 cyfr), nie serwer przed jednym
adresem. `resolveKey` jako wstrzykiwana strategia właśnie po to istnieje.

Dwa niuanse, które robią wrażenie:

- **Dlaczego nie `pubClient`/`subClient`**: w node-redis v4+ klient w trybie subscribera (a tym
  są klienty adaptera Socket.io) nie przyjmuje już zwykłych komend (`EVAL`/`MULTI`), których
  potrzebuje rate-limiter-flexible. Tylko „zwykły" `redisClient` jest bezpieczny do reużycia —
  i to ten sam, który graceful shutdown już zamyka, więc limitery nie potrzebują własnego
  teardownu.
- **`useRedisPackage: true`** — biblioteka auto-wykrywa tylko ioredis (po
  `client.constructor.name === 'Commander'`); bez flagi cicho używa złej ścieżki dispatch
  komend dla node-redis.

**Fail-open** (świadomie): rejection z limitera jest rozróżniane — `RateLimiterRes` (limit
przekroczony) → 429 + `Retry-After`; prawdziwy `Error` (Redis padł) → normalny 500, **ruch nie
jest blokowany**. Trade-off: dostępność > egzekwowanie limitu przy awarii infrastruktury; dla
bankowości wybrałbym odwrotnie.

### Higiena pozostała

- `helmet()` + `cors({origin: frontendUrl, credentials: true})` (credentials wymagane przez
  cookie; origin NIE jest `*` — z credentials to zabronione i słusznie).
- `express.json({limit: '5mb'})` — świadomy limit pod base64 zdjęć (nie default 100kb).
- **Redakcja logów pino**: `req.headers.cookie`, `authorization`, `req.body.password`,
  `req.body.token`, `set-cookie` — JWT ani hasła nigdy nie trafiają do Loki.
- Prod compose: `${JWT_SECRET:?}`-style fail-fast — kontener nie wstanie bez sekretu.

## Dlaczego tak (alternatywy)

| Decyzja | Alternatywa | Uzasadnienie |
|---|---|---|
| JWT w httpOnly cookie | Bearer token w localStorage | localStorage czytelny dla XSS; cookie httpOnly + sameSite + CORS-with-credentials to bezpieczniejszy default dla SPA na tej samej domenie. Trade-off: trudniejsza rewokacja i mobile — akceptowalne. |
| Stateless JWT | sesje server-side w Redis | Zero lookupów na request i darmowa autoryzacja WS; koszt: brak natychmiastowej rewokacji (TTL 1 dzień ogranicza okno). Przy wymogu rewokacji: krótki access + refresh token z rotacją. |
| Ghost accounts (OTP) | wymuszona rejestracja | Produktowo: zgłaszający zgubione zwierzę jest w stresie — każda przeszkoda to stracone zgłoszenie. Ghost łączy się później z pełnym kontem (match po emailu w OAuth). |
| OAuth code flow na backendzie | implicit/PKCE na froncie | Sekrety klienta zostają na serwerze; frontend dostaje tylko cookie — spójnie z resztą auth. |
| rate-limiter-flexible + Redis | express-rate-limit (in-memory) | Limity muszą być współdzielone między replikami API i między HTTP a WS; in-memory pęka przy pierwszej skali poziomej. |

## Skalowanie

- Auth jest stateless — skaluje się z API. Redis (nonce OAuth, rate limit) to pojedynczy,
  współdzielony punkt — przy skali: Redis Cluster/replika, ale limity per-klucz są tanie.
- Bcrypt jest celowo drogi — przy dużym wolumenie logowań to CPU na replikach API; cost factor
  do strojenia świadomie.

## Słabości + ulepszenia

- OTP generowany `Math.random()` zamiast `crypto.randomInt()` — niska szkodliwość (6 cyfr,
  TTL 5 min, limiter per-email na verify), ale fix to jedna linia i poprawny default.
- `authenticate` zwraca surowy 401 JSON poza pipeline `AppError` — niespójność.
- Brak rotacji/rewokacji JWT (wylogowanie = skasowanie cookie po stronie klienta; token żyje
  dalej do TTL). Fix przy potrzebie: denylista jti w Redis albo refresh-token flow.
- Sekrety podawane przez env/`.env` (poza gitem — w repo są tylko `.env.example`) — OK na tę
  skalę, ale docelowo menedżer sekretów (SOPS/Vault) + gitleaks w CI jako siatka bezpieczeństwa.
- `GET /chats/:roomId/messages` bez checku członkostwa — opisane w rozdziale 05/10, ale to
  słabość klasy „authorization", więc wymieniam też tutaj.

## Pytania, które mogą tu paść

- „Jak wylogowujesz JWT?" → czyszczę cookie; token formalnie żyje do TTL — świadomy trade-off,
  plan: denylista/refresh flow, patrz wyżej.
- „CSRF?" → `sameSite: 'lax'` + CORS z konkretnym origin + brak endpointów mutujących na GET;
  dla formularzy cross-site dodałbym token CSRF, ale SPA na tym samym originie go nie wymaga.
- „Skąd wiesz, że WS jest uwierzytelniony?" → handshake niesie te same cookies; `io.use` walidację
  robi raz na połączenie, a rate limit połączeń stoi PRZED weryfikacją JWT (tania obrona przed
  floodem handshake'ów, zanim wydamy CPU na verify).
- „Co się stanie, gdy dwa requesty zarejestrują ten sam email jednocześnie?" → unique constraint
  w DB jest ostatecznym arbitrem; P2002 tłumaczone na błąd domenowy — check-then-act w aplikacji
  to tylko szybka ścieżka UX.
