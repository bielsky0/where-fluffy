# 11 — Przewidywane pytania i odpowiedzi

Odpowiedzi celowo w formie „jak to powiedzieć", nie wypracowania. Schemat dobrej odpowiedzi
senior+: **problem → decyzja → trade-off → co bym zmienił przy innej skali**.

## A. Architektura

**1. Dlaczego Express z ręcznymi warstwami, a nie NestJS?**
Potrzebowałem trzech rzeczy z NestJS: warstw, DI i testowalności. Zbudowałem je fabrykami i
interfejsami w ~100 liniach infrastruktury, bez dekoratorów i `reflect-metadata`. Zysk: pełna
kontrola i zrozumienie każdej warstwy; koszt: konwencje pilnowane dyscypliną, nie frameworkiem.
W zespole 15 osób wybrałbym NestJS właśnie dla wymuszenia konwencji.

**2. Czemu funkcje-fabryki zamiast klas?**
Domknięcie nad zależnościami daje to samo co constructor injection, bez `this`, bez dziedziczenia.
Mock w teście to obiekt literalny. To nie ideologia — to najmniejszy mechanizm, który daje szwy
testowe.

**3. Jak wygląda przepływ requestu?**
Caddy (TLS) → Express: pino-http → helmet → cors → json(5mb) → cookieParser → globalny rate
limiter → router `/api/v1` → `validate(schema)` na trasie → controller → service → repository →
odpowiedź; każdy błąd (throw/reject) ląduje w jednym `error.middleware`.

**4. Monorepo? Jak spięte są frontend i backend?**
Sibling directories bez narzędzia monorepo — dwa niezależne package.json, spinane Compose'em.
Przy pierwszym współdzielonym pakiecie (typy DTO — placeholder `shared-types/` już istnieje)
wszedłbym w pnpm workspaces.

**5. Co się dzieje przy SIGTERM?**
`server.close()` → io → kolejka BullMQ + jej połączenie → Prisma → trzy klienty Redis → OTel na
końcu (żeby spany shutdownu się wyeksportowały) → exit(0). Bez zamknięcia każdego klienta proces
nigdy nie kończy się sam — kontener dostawałby SIGKILL po timeoucie.

## B. Baza danych i geo

**6. Dlaczego PostGIS, a nie np. Redis GEO albo Elasticsearch?**
Lokalizacja to atrybut transakcyjnych encji — trzymanie jej w tej samej bazie daje spójność bez
synchronizacji drugiego storage'u. GiST + `ST_DWithin` obsłuży miliony wierszy; drugi silnik to
koszt operacyjny bez zysku na tej skali.

**7. geography czy geometry i dlaczego?**
`geography` — obliczenia po elipsoidzie, `ST_DWithin` w metrach działa poprawnie w dowolnym
miejscu globu bez reprojekcji. `geometry` jest szybsza, ale wymaga lokalnego SRID; dla aplikacji
ogólnokrajowej wybrałem poprawność.

**8. Prisma nie wspiera geography — jak to rozwiązałeś?**
Kolumna jako `Unsupported`, cały dostęp raw SQL-em przez `$queryRaw` (tagged templates =
parametryzacja). Jawne listy kolumn (nigdy `SELECT *` — Prisma nie zdeserializuje surowej
geography), `ST_X/ST_Y` jako aliasy. Cztery gotchas znalezione testami integracyjnymi — [pełna
lista w rozdziale 02](02-baza-danych-postgis.md).

**9. Dlaczego keyset pagination, a nie OFFSET?**
OFFSET czyta i odrzuca wiersze (koszt rośnie ze stroną) i przesuwa okno przy równoległych
insertach — użytkownik widzi duplikaty. Keyset: `("createdAt", id) < (cursor)` po indeksie,
stabilny i O(log n). Kursor to base64url `{createdAt, id}`, bezstanowy; `id` w kluczu jest
tie-breakiem — bez niego dwa wiersze z tym samym timestampem psują determinizm (złapane
realnym flakiem w testach).

**10. Po co PgBouncer, skoro go nie używasz?**
Stoi przygotowany na moment, w którym repliki API pomnożą pool Prismy ponad `max_connections`.
Przepięcie to zmiana URL-a, nie kodu. Migracje i tak zawsze bezpośrednio do db — wymagają
session mode.

## C. AI / embeddingi

**11. Jak działa wyszukiwanie tekstem po zdjęciach?**
Dwie wieże nomic v1.5 (vision + text) wytrenowane do wspólnej przestrzeni 768-dim. Zdjęcia peta
→ wektor (CLS per zdjęcie, normalizacja, mean-pool, normalizacja); zapytanie tekstowe → wektor tą
samą przestrzenią; pgvector liczy cosine distance po indeksie HNSW. Tekst „rudy kot" jest po
prostu blisko wektorów zdjęć rudych kotów.

**12. Dlaczego embeddingi tylko z obrazów, bez pól tekstowych?**
Wektor reprezentuje wygląd. Mieszanie tekstu i obrazu w jeden wektor rozmywa oba sygnały —
a tekst i tak uczestniczy w dopasowaniu, bo zapytanie przechodzi przez wieżę tekstową. Zwierzę
bez zdjęć ma embedding czyszczony do NULL — nigdy stary.

**13. Dlaczego własny sidecar, a nie OpenAI API / Ollama?**
Ollama była pierwsza — jej API embeddings nie przyjmuje obrazów, więc wypadła przy przejściu na
vision. OpenAI: koszt per request i wysyłanie zdjęć użytkowników do 3rd party. Sidecar: zero
kosztów zmiennych, kontrola wersji modelu (piny w requirements — `trust_remote_code` nomica
pęka na minor bumpach transformers), pełna prywatność.

**14. Jak skalujesz sidecar? Czemu nie Gunicorn workers?**
Każdy worker duplikuje oba modele w RAM — przy limicie 2G to niewykonalne. Jeden Uvicorn +
`asyncio.Semaphore(2)` na inferencję (download zdjęć poza semaforem). Skalowanie = repliki
kontenera za LB, docelowo GPU.

**15. Co się dzieje, gdy sidecar leży?**
API startuje bez niego (celowo brak `depends_on`), search zwraca 503 — „usługa chwilowo
niedostępna", nie 500-bug. Worker retry'uje joby (3 próby, backoff), nieudane zostają w kolejce
(`removeOnFail: false`) do wglądu. Luka: enqueue przy niedostępnym Redis — tylko log, plan to
reconciliation sweep.

**16. HNSW czy IVFFlat?**
HNSW: lepszy recall bez strojenia i działa dobrze na pustej/rosnącej tabeli (IVFFlat wymaga
zbudowania na istniejących danych). Koszt builda przy tej skali pomijalny. Gotcha: Prisma nie
zna HNSW, indeks żyje w raw migration i trzeba go chronić przed schema-diffem.

## D. Realtime

**17. Jak czat skaluje się na wiele instancji?**
Adapter Redis dla Socket.io: `io.to(room).emit` publikuje przez pub/sub, każda replika emituje
do swoich socketów. Sticky sessions potrzebne tylko dla fallbacku long-polling.

**18. Jak autoryzujesz wysyłanie wiadomości?**
SQL raz przy `join_chat` (owner/finder peta), potem grant `SETEX access:<user>:<room> 3600` w
Redis; `send_message` sprawdza tylko ten klucz. Hot path bez round-tripu do Postgresa; koszt:
okno rewokacji do 1h — domknąłbym je aktywną inwalidacją kluczy przy zdarzeniach rewokujących.

**19. Największy bug, jaki złapałeś w warstwie WS?**
Race: handler `connection` robił najpierw async `markUserOnline`, a `socket.on(...)` rejestrował
po `await` — szybki klient emitował `join_chat` zanim listener istniał i EventEmitter gubił
event bez śladu. Fix: rejestracja listenerów synchronicznie, side-effecty na końcu.

**20. Różnica między io.use a socket.use?**
`io.use` = middleware handshake'u, `next(err)` odrzuca połączenie. `socket.use` = middleware
eventów, `next(err)` NIE rozłącza — emituje lokalny event `'error'`, który trzeba jawnie
obsłużyć, inaczej zthrottlowany event znika bez feedbacku. Rate limit połączeń stoi w `io.use`
PRZED weryfikacją JWT — tania obrona przed floodem zanim wydamy CPU na verify.

## E. Bezpieczeństwo

**21. Dlaczego JWT w cookie, a nie w localStorage?**
httpOnly = XSS nie ukradnie tokenu; sameSite lax + CORS z konkretnym originem ogranicza CSRF.
Bonus: handshake WS niesie cookie za darmo — jedna ścieżka auth dla HTTP i WS.

**22. Jak wylogowujesz / rewokujesz JWT?**
Czyszczę cookie; token formalnie żyje do TTL (1 dzień). Świadomy trade-off stateless auth.
Przy wymogu twardej rewokacji: krótki access token + refresh token z rotacją albo denylista
jti w Redis.

**23. Co się stanie, gdy Redis padnie?**
Zależy od podsystemu — i to rozróżnienie jest celowe: rate limitery **fail-open** (Error ≠
RateLimiterRes → przepuszczamy, dostępność > limit), czat **fail-closed** (brak klucza grantu =
FORBIDDEN), kolejka embeddingów — enqueue się nie uda (log, pet bez wektora do czasu sweep'a),
adapter WS przestaje broadcastować między replikami. Sesje HTTP działają dalej — JWT jest
stateless.

**24. Brute force na login / OTP?**
Warstwowo, z kluczem dobranym do chronionej wartości: login 5/60s per **IP** z blokadą 300 s
(chronimy serwer przed jednym adresem); OTP request 3/60s i verify 5/60s per **email z body**
(chronimy skrzynkę jednego odbiorcy przed spamem i 6-cyfrowy kod przed zgadywaniem — botnet
z wielu IP nie pomoże); do tego globalny 100/60s i bcrypt spowalniający offline cracking.
Wstrzykiwany `resolveKey` w fabryce limitera istnieje właśnie po to.

**25. Jakie znasz słabości bezpieczeństwa swojego projektu?**
Wymieniam sam: REST-owa historia czatu bez checku członkostwa (fix: ten sam check co przy
join), okno rewokacji grantu czatu (1h), OTP z Math.random zamiast crypto, brak rewokacji JWT
przed TTL. [Pełna lista z priorytetami w rozdziale 10](10-slabosci-i-roadmapa.md).

## F. Frontend

**26. Dlaczego mapa i lista to dwa osobne zapytania?**
Różne kształty danych: mapa potrzebuje WSZYSTKICH punktów viewportu, ale lekkich
(`{id,lat,lng,status}`, cap 2000); lista — stron pełnych DTO (keyset). Wspólny klucz —
debounced (350 ms) i zaokrąglony bbox — synchronizuje je bez sprzęgania; scroll listy nie
re-renderuje pinów.

**27. Jak działa offline?**
Persist TanStack Query do localStorage + `networkMode: 'offlineFirst'` + `retry: 3` (retry > 0
jest warunkiem pauzowania zamiast błędu — zweryfikowane empirycznie). Zapauzowana mutacja
przeżywa restart PWA i wychodzi po powrocie sieci. Z persystencji wykluczony `['auth','me']` —
sesja zawsze weryfikowana o cookie.

**28. Czemu zdjęcia jako base64 w JSON, a nie multipart?**
Draft kreatora (ze zdjęciami) musi przeżyć localStorage i pełny redirect OAuth — base64 jest
trywialnie serializowalny. Kompresja canvas do ~1080 px/JPEG 0.8 przed zapisem; narzut +33%
zaakceptowany. Upload do Cloudinary robi backend — frontend nie zna credentiali.

**29. Jak przeżywasz redirect OAuth w środku akcji użytkownika?**
Closures giną przy opuszczeniu strony, więc intencje są serializowane jako dane do localStorage
(TTL 15 min): `{type: 'wizard-publish', ...}`. Po powrocie z callbacku aplikacja odtwarza
intencję — użytkownik wraca dokładnie do publikacji zgłoszenia.

**30. Zustand i TanStack Query — jak dzielisz odpowiedzialności?**
Twarda granica: TQ = stan serwerowy (cache, staleness, refetch), Zustand = wyłącznie stan UI
(aktywny widok, snap arkusza, draft filtrów). Store nigdy nie fetchuje; hook API nigdy nie
trzyma stanu UI. To zapobiega dublowaniu cache'a serwera w stanie globalnym.

## G. Observability / ops

**31. Jak debugujesz wolny endpoint na produkcji?**
Tempo: trace z waterfallem (Express → span Prismy pokazuje konkretne zapytanie) → tracesToLogs:
logi tego trace'a (pino mixin dokleja trace_id automatycznie) → tracesToMetrics/exemplars:
incydent czy wzorzec. Jedno kliknięcie między sygnałami — spięte w prowizji Grafany.

**32. Skąd wiesz, że twoje observability w ogóle działa?**
Mam na to test: smoke test strzela w endpoint i asertuje świeży trace w Tempo, skorelowany log
w Loki i świeżą próbkę metryki w Prometheus (range-vector, żeby nie oszukał lookback). Pipeline
telemetrii traktuję jak feature — z testem regresji.

**33. Push czy pull metryk?**
Push OTLP → Alloy → remote_write do Prometheusa. Jeden protokół dla traces/metrics/logs, appka
zna jeden endpoint, brak portu /metrics na każdej replice. Trade-off wobec klasycznego pull —
świadomy.

**34. Dlaczego nie Kubernetes?**
Jeden host, kilkanaście kontenerów — compose + prod overlay daje 90% wartości przy ułamku
złożoności. Punkt przełamania: multi-node, autoscaling, zero-downtime. Architektura aplikacji
(stateless API, Redis adapter) jest już na to gotowa — to zmiana platformy, nie kodu.

**35. Jak wygląda deploy?**
Push na main → CI (tsc, unit, integration na testcontainers) → SSH na serwer → git pull →
compose up --build → `prisma migrate deploy` (bezpośrednio do db, nie przez bouncer). Znam
słabość: brak rollbacku — plan to registry + tagowane obrazy.

## H. „Co byś zmienił / czego się nauczyłeś"

**36. Co byś zrobił inaczej, zaczynając od zera?**
(a) Testy web/ od początku — dopisywanie później jest droższe; (b) vitest zamiast jest (ESM
bez obejść); (c) kontrakt DTO w `shared-types/` od razu, żeby front i back nie dublowały
typów; (d) ESLint/Prettier od pierwszego commita — dziś jedynym gatem stylu jest tsc.

**37. Największa lekcja techniczna z projektu?**
Typy nie zastępują testów integracyjnych: kod pisał nieistniejące pola do Prismy, przechodził
`tsc --noEmit` (XOR-owy typ `data` wyłącza excess-property check) i wybuchał w runtime. Od tego
czasu: wszystko co raw-SQL/ORM-edge testuję na prawdziwej bazie.

**38. Co przy 100x ruchu? (pytanie-esej — mieć strukturę)**
Po kolei, wąskie gardła w kolejności ujawniania się: (1) połączenia DB → wpiąć PgBouncer (już
stoi); (2) odczyty geo/feed → read-repliki + indeks częściowy na status; (3) piny mapy →
server-side clustering / vector tiles; (4) sidecar AI → repliki + GPU, kolejka już buforuje;
(5) WS → sharded adapter; (6) observability → tail-sampling. Podkreślić: **mierzyć przed
optymalizacją** — od tego mam RED metrics.

**39. Które decyzje są świadomym długiem, a które zaniedbaniem?**
Dług świadomy z uzasadnieniem: okno rewokacji czatu, brak K8s, brak sweep'a, CJS w Jest.
Zaniedbania do naprawy: brak checku członkostwa w historii czatu, brak testów web/, niespójna
walidacja nearby. Umiejętność tego rozróżnienia to esencja roli senior+.

**40. Dlaczego ten projekt pokazuje poziom architekta, a nie tylko kodera?**
Bo większość decyzji ma nazwany trade-off i punkt przełamania: degradacja zamiast twardych
zależności (api vs ai-model), granice zaufania (Redis grant, SSH tunnel dla Studio), polityki
awarii per podsystem (fail-open limiter vs fail-closed chat), ewolucja udokumentowana w
migracjach i historii gita (Ollama→sidecar, Jaeger→Tempo, offset→keyset). Architektura to nie
diagram — to spójny zestaw decyzji z uzasadnieniami.
