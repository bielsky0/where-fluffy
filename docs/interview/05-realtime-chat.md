# 05 — Realtime chat (Socket.io + Redis)

## Co to robi / Jak działa

### Przepływ

Właściciel i znalazca dostają wspólny pokój (`ChatRoom`, `@@unique([petId, ownerId, finderId])`
— jeden pokój na parę per zwierzak). Eventy:

- klient → serwer: `join_chat` (petId, finderId), `send_message` (chatRoomId, text), `disconnect`
- serwer → klient: `chat_joined` (roomId + historia), `new_message`, `error_response`, `error`

Do tego REST (`GET /chats`, `GET /chats/:roomId/messages`) na listę rozmów i historię — rzeczy,
które nie potrzebują live połączenia.

Typy eventów (`ClientToServerEvents`/`ServerToClientEvents`/`SocketData` →
`ChatIoServer`/`ChatIoSocket`) żyją w `chat/interface/chat.interface.ts` — Socket.io jest w
pełni typowany end-to-end. Mimo typów payloady WS są **walidowane Zodem w runtime** — typ
TypeScript nie wiąże obcego klienta.

### Redis adapter = gotowość do skali poziomej

`initSocket` podpina `@socket.io/redis-adapter` na parze `pubClient`/`subClient`
(zduplikowanych z głównego klienta). `io.to(room).emit(...)` publikuje przez Redis pub/sub,
więc wiadomość dociera do socketów podpiętych do **innych replik API**. Bez adaptera skala
pozioma czatu po prostu nie działa (każda replika widzi tylko swoje sockety).

### Trust boundary: SQL raz, potem Redis (najciekawszy trade-off projektu)

- `join_chat` → `chat.service.joinChatRoom`: **jedyny moment autoryzacji w SQL** — user musi być
  właścicielem peta albo wskazanym finderem; tworzy/reużywa pokój; następnie
  `grantUserAccess(userId, roomId)` = `SETEX access:<userId>:<roomId> 3600 "1"` w Redis.
- każdy `send_message` → tylko `checkUserAccess` (GET klucza w Redis). Brak klucza →
  `Error('FORBIDDEN')` → gateway mapuje na `error_response`.

Uzasadnienie: wysyłanie wiadomości to najgorętsza ścieżka — odpytywanie Postgresa o membership
przy każdej wiadomości to zbędny round-trip do najdroższego zasobu; GET w Redis to mikrosekundy.
Koszt: **okno rewokacji do 1h** (odebranie dostępu nie unieważnia klucza) i to, że Redis staje
się komponentem *bezpieczeństwa*, nie tylko cache. Każda zmiana reguł członkostwa musi dotknąć
OBU miejsc (SQL check + grant/check) — invariant zapisany w kodzie i CLAUDE.md.

### Kompozycja gatewaya — wyjątek od reguły `index.ts`

Każdy inny moduł składa cały stack eagerly w swoim `index.ts`. Ale
`createChatGateway(io, chatService, rateLimitEvents)` potrzebuje **żywego** `Server`, który
istnieje dopiero po `initSocket()` w `bootstrap()` — długo po rozwiązaniu importów. Dlatego
`chat/index.ts` składa wszystko *oprócz* gatewaya, a wywołanie następuje w `app.gateways.ts`,
gdzie `io` przychodzi jako parametr. Gateway nie zna Redis ani rate-limiter-flexible — limiter
eventów jest wstrzykiwany jako trzecia zależność (ta sama filozofia co `ChatRepository` w
serwisie).

### Dwa niuanse Socket.io, które warto znać na pamięć

1. **Race przy rejestracji listenerów**: handler `connection` rejestruje `socket.on(...)`
   **synchronicznie, przed pierwszym `await`** (a `markUserOnline` — async — poszedł na koniec).
   Wcześniej szybki klient potrafił wyemitować `join_chat` zanim listener istniał — EventEmitter
   po prostu gubi event, bez błędu. Klasyczny bug klasy „async w złym miejscu".
2. **`io.use()` vs `socket.use()` zachowują się różnie przy `next(err)`**:
   - `io.use()` (middleware handshake'u) — `next(err)` **odrzuca połączenie** (klient dostaje
     `connect_error`),
   - `socket.use()` (middleware eventów) — `next(err)` **nie rozłącza**; emituje tylko lokalny
     event `'error'` na sockecie. Gateway musi go jawnie nasłuchiwać
     (`socket.on('error', ...)` → `error_response`), inaczej zthrottlowany event znika bez
     żadnego feedbacku dla klienta.

Kolejność middleware na handshake'u: **rate limit połączeń (po IP) PRZED weryfikacją JWT** —
flood handshake'ów odbijamy zanim wydamy CPU na `jwt.verify`.

### Testowanie gatewaya bez socketów

`chat.gateway.spec.ts` nie podnosi serwera Socket.io: buduje ręczne mocki tylko tych metod
`io`/`socket`, których gateway używa (`on`/`to`/`emit`/`join`/`disconnect`/`data`), rejestruje
gateway, po czym **wyciąga zarejestrowane handlery z `mock.calls`** (typowany helper
`getRegisteredHandler`, bo Jestowe `mock.calls` jest de facto nietypowane) i wywołuje je wprost.
Weryfikuje pełny łańcuch trigger → serwis → `io.to(room).emit(...)` w milisekundach, bez
prawdziwej sieci.

## Dlaczego tak (alternatywy)

| Decyzja | Alternatywa | Uzasadnienie |
|---|---|---|
| Socket.io | goły `ws` / SSE | Socket.io daje pokoje, reconnect, fallbacky transportu, adapter Redis i typowane eventy out-of-the-box; goły `ws` = pisanie tego samemu. SSE odpada — czat jest dwukierunkowy. |
| Redis grant na hot path | SQL przy każdej wiadomości | patrz trust boundary — świadoma wymiana okna rewokacji na latencję/odciążenie DB. |
| REST na listę/historię + WS na live | wszystko po WS | Lista rozmów to zwykłe read-model z cache'owalnością HTTP; WS tylko tam, gdzie potrzebny jest push. |
| Wstrzykiwany limiter eventów | limiter w gatewayu | Gateway pozostaje czystą warstwą transportu — testowalny bez Redis. |

## Skalowanie

- Repliki API + adapter Redis = liniowe skalowanie liczby połączeń; sticky sessions na LB
  potrzebne tylko dla long-pollingu (dla czystych websocketów nie).
- Redis pub/sub to pojedynczy broadcast-bus — przy naprawdę dużej skali: sharded adapter
  (Redis Streams) albo dedykowany broker; na obecną skalę nierelewantne.
- Historia czatu: `getRoomMessages` bez paginacji — pierwszy realny limit wzrostu (patrz niżej).

## Słabości + ulepszenia

- **Okno rewokacji 1h**: usunięcie peta/zablokowanie usera nie unieważnia grantu. Fix tani:
  `DEL access:*:<roomId>` przy zdarzeniach rewokujących (delete peta, block) — zdarzenia są
  rzadkie, klucze znane.
- `getChatHistory` (REST) nie sprawdza członkostwa w pokoju — endpoint jest za `authenticate`,
  ale każdy zalogowany znający `roomId` odczyta cudzą historię. UUID jest nieodgadywalny, ale to
  security-by-obscurity; fix: ten sam check co w `joinChatRoom`.
- Brak paginacji historii wiadomości — pokój z tysiącami wiadomości = jeden wielki SELECT;
  fix: keyset pagination jak w feedzie.
- Presence (`user:<id>:status`/`socket`) zapisuje pojedynczy socketId — drugi tab nadpisuje
  pierwszy; do multi-device potrzebny SET socketów.
- Brak potwierdzeń dostarczenia/odczytu i typing indicators — świadomie poza zakresem MVP.

## Pytania, które mogą tu paść

- „Jak czat działa na 3 replikach API?" → adapter Redis; `io.to(room)` publikuje przez pub/sub,
  każda replika emituje do swoich socketów.
- „Co gdy Redis padnie?" → nowe `send_message` dostaną FORBIDDEN (brak klucza = fail-closed dla
  czatu — odwrotnie niż rate limiter, i to jest dobra para do porównania), adapter przestaje
  broadcastować między replikami; przy jednej replice czat lokalnie działa po re-join.
- „Dlaczego autoryzacja nie przy każdej wiadomości?" → trade-off latencja vs okno rewokacji,
  z planem domknięcia (aktywna inwalidacja kluczy).
- „Jak testujesz WS?" → bez socketów, przez wyciąganie handlerów z mocków; plus k6 ws-load-test
  na prawdziwym stacku (rozdział 09).
