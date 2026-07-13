# 03 — AI: embeddingi, pgvector, sidecar, pipeline asynchroniczny

## Co to robi / Jak działa

### Problem produktowy

Znalazca nie zna rasy ani imienia — widzi „rudego kota z białą łatką". Wyszukiwanie po polach
tekstowych nie działa, gdy zgłoszenie i zapytanie opisują to samo zwierzę innymi słowami (albo
wcale). Rozwiązanie: wyszukiwanie **po wyglądzie** — zdjęcia zamieniane na wektory, zapytania
tekstowe rzutowane do tej samej przestrzeni.

### Architektura pipeline'u (5 elementów)

1. **`Pet.embedding vector(768)`** (pgvector) + indeks **HNSW** (`vector_cosine_ops`) — założony
   ręcznie w raw migration, bo Prisma nie zna typu `vector` ani HNSW.
2. **Sidecar FastAPI** (`infra/ai-model/`, port wewnętrzny 8000) — serwuje dwie **wyrównane wieże
   nomic v1.5** w jednej przestrzeni 768-dim:
   - `POST /embed/image` — nomic-embed-vision-v1.5: sam pobiera URL-e zdjęć (max 5, limit 10MB/
     zdjęcie, agresywne timeouty), embeduje każde (token CLS), normalizuje L2 per zdjęcie →
     **mean-pooling** → ponowna normalizacja L2 → JEDEN wektor na zwierzaka.
   - `POST /embed/text` — nomic-embed-text-v1.5, prefiks `search_query: ` dodawany po stronie
     serwera (klient nie musi znać konwencji modelu).
3. **BullMQ** — `pets.service.ts` przy create i przy każdej zmianie zestawu zdjęć enqueue'uje job
   `EMBED_PET_DATA` (payload: samo `petId`); opcje: `attempts: 3`, exponential backoff 5s,
   `removeOnComplete: true`, `removeOnFail: false` (celowo — widoczność permanentnych porażek).
4. **`ai-worker`** — osobny proces (drugi entrypoint tego samego obrazu co `api`,
   `command: node dist/ai-worker/main.js`), własny composition root, `concurrency: 2`.
   Procesor: pobiera **świeżego** peta po id (idempotencja, last-write-wins) → brak peta = warn i
   return (nie throw — nie ma sensu retry) → brak zdjęć = **`clearEmbedding`** (pipeline jest
   vision-only; nigdy nie zostaje stary wektor) → pierwsze 5 z `photoUrls` (fallback `photoUrl`)
   → `generateImageEmbedding` (throw = retry BullMQ) → `updateEmbedding`.
5. **Odczyt**: `search` module (`GET /api/v1/search/pets`) — embeduje zapytanie tekstowe i robi
   `1 - (embedding <=> $wektor) as similarity ... ORDER BY embedding <=> $wektor` (HNSW);
   `pets/:id/similar` — CTE `WITH source AS (...)` + `CROSS JOIN`, dopasowanie krzyżowe statusów
   (`missing` ↔ `found`), próg kosinusowy **i** `ST_DWithin` (promień 15 km) jednocześnie —
   wektory + geografia w jednym zapytaniu. Każdy edge case (brak peta, NULL embedding/location)
   naturalnie zwraca 0 wierszy przez CROSS JOIN, bez brancha w JS.

### Kluczowe decyzje projektowe

- **Vision-only**: tekst (`name`/`species`/`distinguishingMarks`) NIE wchodzi do wektora. Wektor
  reprezentuje wygląd; mieszanie modalności do jednego wektora rozmywa oba sygnały. Tekst i tak
  trafia do przestrzeni przez wieżę tekstową w momencie zapytania.
- **Cała matematyka wektorowa w sidecarze** (`vector_math.py`: `l2_normalize`, `mean_pool`,
  `assert_unit_norm`) — Node nigdy nie liczy na wektorach. Kontrakt `||v|| == 1` przypięty
  pytestami odpalanymi **w `docker build`** sidecara (jego jedyny gate CI).
- **Jeden proces Uvicorn + `asyncio.Semaphore(2)`** zamiast workerów Gunicorna — każdy worker
  duplikowałby oba modele w RAM, a limit Compose to 2G. Pobieranie obrazków dzieje się **poza**
  semaforem (I/O nie blokuje slotów inferencji).
- **Migracja z Ollamy**: pierwsza wersja używała Ollamy (embeddingi tekstowe), ale jej API
  embeddings **nie przyjmuje obrazów** — stąd własny sidecar. Nie ma już env `EMBEDDING_MODEL`:
  model jest wewnętrzną sprawą sidecara, Node zna tylko kontrakt HTTP.
- **`EmbeddingProvider`** (`shared/embedding/`): `local` (fetch do sidecara, 2 szybkie retry
  300/900 ms, potem log `[CRITICAL_AI_ERROR]` i rethrow) vs **`fake`** (default w dev/CI —
  deterministyczny hash wejścia), więc cały pipeline działa bez GPU/modeli.
- **Degradacja zamiast blokady**: `api` w compose celowo NIE ma `depends_on: ai-model` — gdy
  sidecar leży, search zwraca **503** („chwilowo niedostępne"), a nie 500; reszta aplikacji
  działa. `ai-worker` czeka na `service_healthy`, bo bez modelu nie ma po co startować.
- **Backfill**: `src/scripts/backfill-embeddings.ts` re-enqueue'uje wszystkie pety przez normalną
  kolejkę (użyty raz przy migracji text→vision; reużywalny po każdej zmianie wpływającej na
  embeddingi). Jedna ścieżka przetwarzania = brak dryfu między backfillem a bieżącym ruchem.

### Gotcha: HNSW vs `prisma migrate dev`

Prisma nie zna typu indeksu HNSW, więc indeks nie jest zadeklarowany w `schema.prisma` — a wtedy
schema-diff uznaje go za **drift** i każda kolejna migracja chce go usunąć. Rozwiązanie: kolejna
migracja (pola seedingu) jawnie robi drop + recreate indeksu z komentarzem ostrzegawczym.
Kruche, ale świadome — patrz „Słabości".

## Dlaczego tak (alternatywy)

| Decyzja | Alternatywa | Uzasadnienie |
|---|---|---|
| pgvector w Postgresie | Pinecone/Qdrant/Weaviate | Wektor to kolumna encji Pet — trzymanie go przy wierszu daje jeden JOIN z geografią i statusem w jednym SQL; osobny vector-DB = synchronizacja dwóch źródeł prawdy. Przy <1M wektorów pgvector+HNSW w zupełności wystarcza. |
| Self-hosted sidecar | OpenAI/Cohere embeddings API | Koszt zerowy per request, dane (zdjęcia zwierząt użytkowników) nie wychodzą do 3rd party, pełna kontrola wersji modelu (pin `transformers>=4.49,<4.50`, bo `trust_remote_code` nomica pęka na minor bumpach). Trade-off: własny RAM/ops. |
| nomic v1.5 (dwie wieże) | CLIP | To samo podejście co CLIP (aligned image/text space); nomic wybrany za 768-dim zgodny z sensownym HNSW, otwartą licencję i dobre wyniki na małym CPU. |
| BullMQ + osobny worker | embedding synchronicznie w request | Inferencja + pobranie 5 zdjęć to sekundy — nie może blokować `POST /pets`. Kolejka daje retry, backoff i izolację awarii (padnięty sidecar nie psuje API). |
| HNSW | IVFFlat | HNSW: lepszy recall bez strojenia list/probes i bez wymogu „najpierw dane, potem indeks"; koszt builda nieistotny przy tej skali. |
| Mean-pooling 5 zdjęć → 1 wektor | wektor per zdjęcie | 1 wektor = prosty schemat (kolumna, nie tabela), tańszy indeks; trade-off: zdjęcie odstające rozmywa centroid — akceptowalne, bo zdjęcia jednego zgłoszenia są zwykle spójne. |

## Skalowanie

- **Sidecar**: skalowanie NIE przez workery Gunicorna (duplikacja modeli w RAM), tylko przez
  **repliki kontenera** za wewnętrznym LB + zwiększenie semafora, jeśli CPU pozwala; docelowo
  GPU. Kolejka już buforuje piki — throughput workera można podnieść `AI_WORKER_CONCURRENCY`.
- **HNSW**: tuning `m`/`ef_construction`/`ef_search` dopiero gdy recall/latencja tego zażąda;
  przy dużej skali — partycjonowanie po regionie albo filtr geo przed KNN.
- **Kolejka**: BullMQ na Redisie skaluje przez dodanie workerów; job niesie tylko `petId`, więc
  jest tani i bezpieczny do retry.

## Słabości + ulepszenia

- **Brak reconciliation sweep**: jeśli enqueue padnie (Redis down w momencie create), pet zostaje
  bez embeddingu **na zawsze** — dziś tylko log. Fix: okresowy job `WHERE embedding IS NULL AND
  photoUrls != '{}'` → re-enqueue; szkielet już jest (backfill script).
- **`MIN_EMBEDDING_SIMILARITY = 0.8` skalibrowane na 4 zdjęciach produktowych** — komentarz w
  kodzie uczciwie to przyznaje. Fix: zebrać realne pary matched/unmatched i wyznaczyć próg z
  krzywej precision/recall.
- **Drop+recreate HNSW w każdej migracji dotykającej Pet** — kruche; opcje: przejść na
  `migrate diff` z ignorowaniem indeksu albo czekać aż Prisma doda wsparcie HNSW.
- Brak metryk jakości wyszukiwania (CTR na wynikach, odsetek pustych wyników) — bez tego tuning
  progu jest w ciemno.

## Pytania, które mogą tu paść

- „Jak działa wyszukiwanie tekstem po zdjęciach?" → dwie wieże trenowane do wspólnej przestrzeni;
  cosine distance między wektorem zapytania a wektorem zdjęć; `<=>` w pgvector po HNSW.
- „Czemu nie liczysz embeddingu w Node?" → transformers/torch w Pythonie to naturalny ekosystem
  inference; separacja procesów izoluje RAM (2G limit) i pozwala skalować niezależnie; kontrakt
  to 2 endpointy HTTP.
- „Co gdy user usunie wszystkie zdjęcia?" → `clearEmbedding` → NULL; zapytania filtrują
  `embedding IS NOT NULL`; nigdy nie serwujemy stalego wektora.
- „Idempotencja jobów?" → job niesie tylko `petId`, procesor czyta świeży stan i robi
  bezwarunkowy UPDATE (last-write-wins) — powtórzone wykonanie jest nieszkodliwe.
- „Dlaczego 503, a nie 500, gdy sidecar leży?" → semantyka: to znana, przejściowa niedostępność
  zależności (Service Unavailable), klient może retry; 500 sugerowałoby bug.
