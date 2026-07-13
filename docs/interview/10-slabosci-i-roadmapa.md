# 10 — Słabości i roadmapa (szczera lista)

Na poziomie senior+ świadomość długu jest atutem: wymieniaj te punkty **samemu**, z uzasadnieniem
skąd się wzięły i planem naprawy. Format: problem → dlaczego tak jest → fix → priorytet.

## 🔴 Krytyczne

### 1. REST-owa historia czatu bez sprawdzenia członkostwa
- **Co**: `GET /chats/:roomId/messages` jest za `authenticate`, ale nie weryfikuje, czy user
  należy do pokoju — każdy zalogowany znający `roomId` odczyta cudzą rozmowę. UUID jest
  praktycznie nieodgadywalny, ale to nie jest kontrola dostępu.
- **Fix**: w `getChatHistory` ten sam check co w `joinChatRoom` (owner/finder pokoju), ~10 linii.
- **Priorytet**: wysoki (dane prywatne).

## 🟠 Ważne

### 2. Okno rewokacji czatu (1h grant w Redis)
- **Co**: `sendMessage` ufa kluczowi `access:<userId>:<roomId>` przez godzinę; odebranie dostępu
  (usunięty pet, ban) nie unieważnia go.
- **Dlaczego**: świadomy trade-off — hot path bez round-tripu do Postgresa.
- **Fix**: aktywna inwalidacja — `DEL` kluczy przy zdarzeniach rewokujących (są rzadkie, klucze
  wyliczalne). Trade-off zostaje, okno znika.

### 3. Brak reconciliation sweep dla embeddingów
- **Co**: gdy enqueue do BullMQ padnie w momencie tworzenia peta (Redis down), pet zostaje bez
  embeddingu na zawsze — jest tylko log.
- **Dlaczego**: „nie wycofuj sukcesu" — utworzenie peta nie może się wywalić przez kolejkę;
  sweep świadomie odłożony.
- **Fix**: cron/job okresowy: `WHERE embedding IS NULL AND photoUrls <> '{}'` → re-enqueue;
  mechanika już istnieje w `backfill-embeddings.ts`.

### 4. Deploy bez rollbacku
- **Co**: `git pull` + `compose up -d --build` na serwerze prod; nieudany build = przestój,
  brak poprzedniego artefaktu.
- **Fix**: obrazy w GHCR z tagami, deploy = `pull && up -d`, rollback = poprzedni tag; przy
  okazji build schodzi z maszyny prod.

### 5. Zero testów frontendu
- **Co**: `web/` nie ma żadnej suity.
- **Fix**: Vitest + Testing Library; najpierw czysta logika (rounding/klucze bboxa,
  stepAwareResolver, pending intents TTL), potem komponenty krytyczne (BottomSheet handoff).

## 🟡 Średnie

### 6. Brak dashboardów i alertingu Grafany
- Datasources w pełni spięte (Explore działa), ale provider dashboardów pusty i zero reguł
  alertów. Fix: 1 dashboard RED per endpoint (z metrics_generatora Tempo) + alerty na error
  rate i brak próbek z ai-workera.

### 7. Niespójności walidacji/błędów
- `GET /pets/nearby` — ręczne `parseFloat` zamiast `validateQuery(zod)` (relikt sprzed
  `validate-query.ts`).
- `authenticate` zwraca surowy 401 poza pipeline'em `AppError`.
- Fix obu: mechaniczny, po godzinie.

### 8. OTP przez `Math.random()`
- Niska szkodliwość (TTL 5 min, 6 cyfr, limitery per-email na request 3/60s i verify 5/60s),
  ale `crypto.randomInt(0, 1_000_000)` to jedna linia i poprawny default dla kodów
  bezpieczeństwa.

### 9. Historia czatu bez paginacji + presence single-device
- `getRoomMessages` zwraca całość — pokój z tysiącami wiadomości będzie bolał; fix: keyset jak
  w feedzie. Presence trzyma jeden socketId per user — drugi tab nadpisuje pierwszy.

### 10. Kruchy indeks HNSW vs `prisma migrate dev`
- Prisma nie zna HNSW → schema-diff widzi drift → każda migracja dotykająca Pet wymaga
  drop+recreate indeksu (jest komentarz ostrzegawczy). Ryzyko: ktoś kiedyś usunie blok.
  Fix docelowy: wsparcie w Prisma albo wydzielenie indeksów wektorowych do osobnego,
  nie-diffowanego kroku migracji.

## 🟢 Kosmetyka / świadome placeholdery

- **Stale wzmianki o Jaegerze w CLAUDE.md** — stack to Tempo od migracji; do posprzątania
  (odnotowane w POLISH.md).
- **Brak root `.env.example`** — świeży klon nie wie, jakie `${VAR:?}` ustawić.
- **seo/bot-gate.middleware nie jest wpięty w app.ts** — moduł SEO renderuje OG-shell, ale
  brakuje mostka SPA↔bot (decyzja o routingu odłożona).
- **ChatPage UI niedokończony** (`isOwnMessage={false}` hardcoded), ProfilePage na mockach,
  AppShell z wewnętrznym „routingiem" zamiast tras (TODO w kodzie).
- **Brak ESLint/Prettier** — jedyny gate stylu to tsc + review.
- `MIN_EMBEDDING_SIMILARITY=0.8` skalibrowane na 4 zdjęciach — do rekalibracji na realnych
  danych (uczciwy komentarz w kodzie).
- Puste placeholdery: `shared-types/`, `src/modules/sightings/`, `src/common/`.

## Jak to sprzedać na rozmowie

Trzy zdania-klucze:

1. „Najpoważniejsza luka to brak checku członkostwa w REST-owej historii czatu — znam ją,
   fix to 10 linii i byłby pierwszym commitem po tej rozmowie."
2. „Rozróżniam dług świadomy (okno rewokacji czatu, brak K8s, brak sweep'a — decyzje z
   uzasadnieniem i punktem przełamania) od zaniedbań (brak testów web/, niespójna walidacja) —
   i dla obu mam plan."
3. „Kolejność roadmapy wynika z ryzyka: kontrola dostępu → odporność pipeline'ów →
   jakość (testy, dashboardy) → kosmetyka."
