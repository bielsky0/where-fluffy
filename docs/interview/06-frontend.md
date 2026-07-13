# 06 — Frontend (React + Vite + Leaflet + TanStack Query)

## Co to robi / Jak działa

### Fundament

React 18 + Vite + TypeScript, mobile-first PWA (`vite-plugin-pwa`, `autoUpdate`). Struktura
lustrzana do backendu: `web/src/modules/<domena>/` z podfolderami `api/` (hooki TanStack Query),
`components/`, `pages/`, `store/` (Zustand), `types/`, `lib/`. Warstwa `shared/` na fasadę mapy,
prymitywy UI (shadcn-style, Tailwind), hooki i utils.

**Twarda dyscyplina podziału stanu**: TanStack Query = cały stan serwerowy; Zustand = wyłącznie
stan UI. Store nigdy nie robi fetchy; hook API nigdy nie trzyma stanu UI. To eliminuje klasyczną
patologię „Redux z połową cache'a serwera w sobie".

### Map explorer — dual-query architecture (gwóźdź programu)

Jedna mapa, dwa niezależne zapytania keyowane **tym samym bboxem**:

- `useMapPins` → `GET /api/v1/map/pins?bbox=...` — minimalne `{id, lat, lng, status}`, bez
  paginacji, twardy cap `PINS_LIMIT=2000`; karmi wyłącznie klastrowanie markerów Leaflet.
- `useFeedInfiniteBbox` → `GET /pets/feed?bbox=...` — pełne DTO, kursor keyset; karmi paginowaną
  szufladę wyników.

Dlaczego nie jeden endpoint: mapa potrzebuje **wszystkich** punktów w viewport (lekkich),
szuflada — **stron** ciężkich rekordów. Jeden endpoint musiałby zwracać pełne DTO bez paginacji
(za ciężko) albo paginowane piny (mapa z dziurami). Rozdzielenie = scroll szuflady nie
re-fetchuje ani nie re-renderuje pinów.

Mechanika bboxa: Leaflet `moveend` → `useDebouncedCallback` (350 ms; funkcja o stabilnej
tożsamości przez ref, żeby subskrypcja `useMapEvent` się nie przepinała) → `roundBbox` (5 miejsc
po przecinku ≈ 1 m) → bbox staje się częścią `queryKey` obu hooków. Zaokrąglanie = stabilne
klucze mimo subpikselowego jittera mapy; debounce = seria gestów to jedno zapytanie.
`placeholderData: keepPreviousData` — stare piny wiszą podczas fetcha, mapa nie mruga.

Strona składa się z 4 warstw: mapa (zawsze zamontowana) → kontrolki zależne od stanu
(SearchBar / SearchModal / ResultsTopBar) → BottomSheet z listą → pływający PetDetailPanel po
tapnięciu pinu.

### BottomSheet + wirtualizacja — najbardziej „ręczny" kawałek UI

- **BottomSheet**: 3 snapy (0.1/0.5/0.95 wysokości), framer-motion `useDragControls`, drag przez
  `translateY`, flick threshold 500 px/s. Poniżej pełnego rozwinięcia content jest drag-triggerem
  arkusza; przy pełnym — zwykły `overflow-y-auto` z ręcznym **overscroll handoff**: pociągnięcie
  w dół przy `scrollTop === 0` oddaje gest z powrotem do przeciągania arkusza.
- **PetResultsList**: `@tanstack/react-virtual` okienkuje wiersze **bezpośrednio na divie
  contentu BottomSheet** (współdzielony `contentRef`) — nie na własnym zagnieżdżonym scrollerze.
  Powód: drugi `overflow-y-auto` w środku po cichu zabiłby logikę handoffu (scrollTop zewnętrznego
  elementu nigdy by się nie ruszył). Infinite scroll przez `IntersectionObserver`-owy sentinel
  (`rootMargin: 400px`) z potrójną bramką `inView && hasNextPage && !isFetchingNextPage`.

### Offline-first mutations (zamiennik Background Sync API)

`PersistQueryClientProvider` + persister na localStorage (`fluffy-query-cache`). Mutacje mają
`networkMode: 'offlineFirst'` i `retry: 3` — **retry > 0 jest load-bearing**: TanStack pauzuje
mutację przy utracie sieci tylko w trakcie próby retry; z `retry: 0` mutacja by się wywaliła
zamiast zapauzować (zweryfikowane w realnej przeglądarce, nie z dokumentacji). Zapauzowane
mutacje są persystowane → zgłoszenie zwierzaka złożone offline wychodzi po powrocie sieci,
**nawet po zabiciu i ponownym otwarciu PWA**. Z dehydracji wykluczony jest `['auth','me']` —
sesja zawsze re-weryfikowana o cookie, nigdy odtwarzana z dysku.

### Auth na froncie

- Cookie httpOnly → `apiFetch` zawsze z `credentials: 'include'`; żaden token nie dotyka JS.
- **`SessionBootstrap`** — jedyny caller `GET /auth/me` i jedyny writer `useAuthStore`; reszta
  aplikacji tylko czyta store. Jedno źródło prawdy o sesji.
- **Dwa rodzaje guardów**: `RequireAuth` (nawigacyjny, tylko `/app/chat` — nie przekierowuje na
  `/login`, tylko otwiera AuthBottomSheet nad skeletonem) i `useProtectedAction` (akcyjny —
  wykonuje akcję albo odkłada ją jako `pendingAction` i otwiera sheet).
- **`usePendingIntentStore`** — perełka: closure `pendingAction` nie przeżyje pełnego redirectu
  OAuth (opuszczamy stronę), więc intencje są **serializowane** do localStorage (TTL 15 min)
  jako dane (`{type: 'wizard-publish' | 'report-sighting', petId?...}`) i odtwarzane po powrocie
  z `/auth/callback`. Użytkownik, który w połowie publikacji zgłoszenia loguje się Googlem,
  wraca prosto do publikacji.

### Kreator zgłoszenia (add-listing wizard)

4 kroki (typ → zdjęcia → pinezka na mapie → szczegóły), react-hook-form + Zod.
**`stepAwareResolver`**: jeden formularz, jeden resolver, który w momencie walidacji czyta ze
store'a bieżący krok (i typ zgłoszenia dla dyskryminowanego schematu kroku 4) — RHF nie jest
przebudowywany per krok, więc dirty-tracking przeżywa cofanie się. Draft (łącznie ze zdjęciami!)
persystowany w localStorage z wersjonowaniem i `migrate` (v1→v2).

**Zdjęcia**: `compressImage` — `createImageBitmap` → canvas (max szerokość 1080) →
`toDataURL('image/jpeg', 0.8)` → base64. Frontend wysyła `photoBase64s` w JSON; **upload do
Cloudinary robi backend**. Dlaczego base64, nie multipart: zdjęcia muszą przeżyć localStorage
(draft + OAuth redirect), a JSON z base64 jest trywialnie serializowalny; koszt +33% rozmiaru
zaakceptowany po kompresji do ~1080px. Kompresja sekwencyjna (nie Promise.all) — mniej janku
głównego wątku.

### Code-splitting z regułą izolacji bundli

Każda strona lazy przez helper `asyncComponent`. Jawna reguła (w komentarzach w
`routes.tsx`): **żadna publiczna trasa nie może importować z `modules/pets|chat|auth`** — landing
page nie ciągnie Leafleta, socket.io-clienta ani TanStack Query do swojego chunka. Do tego
fasada mapy: `shared/components/map/Map.tsx` to jedyny publiczny interfejs, a
`providers/LeafletMap.tsx` — jedyny plik z importem `leaflet`/`react-leaflet` (podmiana
providera mapy nie dotyka call site'ów).

### Detale Leaflet warte wspomnienia

- `react-leaflet-cluster` z `chunkedLoading` (wstawianie markerów batchowane po rAF — 60 fps przy
  2000 pinów), `MapContainer preferCanvas`.
- Markery jako custom `divIcon` (pill w stylu Airbnb) — omija słynny problem domyślnych ikon
  Leaflet + bundlery.
- `MapContainer center` aplikuje się tylko raz → imperatywne komponenty-pomocnicy w środku
  (`FlyToFocus`, `BoundsTracker`...); re-fly keyowane po `selectedPin?.id`, nie po obiekcie
  (piny to świeża tablica po każdym fetchu — referencja zawsze „nowa").

## Dlaczego tak (alternatywy)

| Decyzja | Alternatywa | Uzasadnienie |
|---|---|---|
| TanStack Query + Zustand | Redux (Toolkit + RTK Query) | TQ rozwiązuje cache serwera lepiej (stale-while-revalidate, persist, pauza offline); Zustand pokrywa resztę bez boilerplate'u. Redux dublowałby cache. |
| Leaflet | Mapbox GL / Google Maps | Zero kosztów licencyjnych, OSM/CARTO tiles, wystarczający feature set; fasada pozwala na migrację, gdyby potrzebny był wektorowy rendering. |
| Vite | CRA / Next.js | CRA martwe; Next niepotrzebny — aplikacja jest za auth, SEO dotyczy tylko landing/preview (do tego jest moduł `seo` z OG-tagami dla botów, po stronie API). |
| base64 w JSON | multipart/FormData | patrz wyżej — persistowalność draftu i przeżycie OAuth redirect wygrywają z narzutem 33%. |
| persist TQ | Background Sync API | BG Sync ma słabe wsparcie (brak iOS Safari) i trudny debug; persist + paused mutations daje ten sam efekt w 100% przeglądarek. |

## Skalowanie / wydajność

- 2000 pinów: klastrowanie + canvas + chunked loading; powyżej — server-side clustering
  (`ST_ClusterKMeans`/supercluster) albo vector tiles.
- Wirtualizacja listy trzyma DOM na stałym poziomie niezależnie od liczby wyników.
- Persist całego cache do localStorage jest synchroniczny — przy dużym cache przejść na
  IndexedDB persister (async).

## Słabości + ulepszenia

- `AppShell` robi wewnętrzny „routing" (feed/map/profile) przez `useAppUIStore.activeView`
  zamiast tras — brak deep-linków i historii wstecz dla widoków; w kodzie wisi TODO na
  przejście na react-router.
- `ChatPage` jest niedokończony: surowy markup, `isOwnMessage={false}` zahardkodowane.
- ProfilePage częściowo na mock data (czeka na endpointy backendu).
- **Zero testów w `web/`** — priorytet: testy hooków (`useMapPins` klucze/rounding) i logiki
  wizarda (stepAwareResolver) w Vitest + Testing Library.
- Sightings odpytywane pollingiem co 60 s — naturalny kandydat na rozszerzenie WS, gdy powstanie
  drugi gateway.

## Pytania, które mogą tu paść

- „Dlaczego dwa zapytania dla jednej mapy?" → różne kształty danych i różne strategie paginacji;
  wspólny klucz (bbox) synchronizuje je bez sprzęgania.
- „Jak unikasz lawiny requestów przy przesuwaniu mapy?" → debounce 350 ms + rounding bboxa w
  kluczu + `keepPreviousData` + AbortSignal TanStacka anulujący wyprzedzone requesty.
- „Czemu nie Next.js/SSR?" → produkt jest mapowo-interaktywny i za auth; SEO potrzebne tylko dla
  share-linków — rozwiązane OG-shellem po stronie API (moduł seo), bez kosztu SSR całej aplikacji.
- „Jak działa formularz wielokrokowy z walidacją per krok?" → jeden RHF + stepAwareResolver
  czytający krok ze store'a w czasie walidacji.
