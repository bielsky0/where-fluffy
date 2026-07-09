// Musi być przed wszystkim innym: instrumentation.ts (poniżej) czyta OTEL_SERVICE_NAME/
// OTEL_EXPORTER_OTLP_ENDPOINT z process.env od razu przy imporcie (patrz otel.config.ts), a bez
// tego .env nigdy nie jest ładowany przez zwykłe `npm run dev`/`tsx` — to samo rozwiązanie co
// prisma.config.ts już stosuje dla CLI Prismy.
import 'dotenv/config';

// Musi być pierwszym importem OpenTelemetry-świadomym w całym procesie — OpenTelemetry patchuje
// moduły (http, prisma, socket.io, redis) w momencie ich załadowania, więc rejestracja
// instrumentacji nie może nastąpić po tym, jak którykolwiek z nich zostanie zaimportowany
// (nawet transitywnie przez './app.js').
import { shutdownOtel } from './instrumentation.js';

import http from 'http';
import { createApp } from './app.js';
import { initSocket } from './shared/infrastructure/socket.js';
import { registerAllGateways } from './app.gateways.js';
import { initRedis, redisClient } from './shared/infrastructure/redis.js';
import { prisma } from './shared/prisma.js';
import { locationRepository } from './modules/location/index.js';

const PORT = process.env.PORT || 3000;

async function bootstrap() {
  const app = createApp();
  const server = http.createServer(app);

  try {
    console.log('============= STARTING SERVER BOOTSTRAP =============');

    // 1. Inicjalizacja klienta Redisa (dla logiki biznesowej)
    console.log('[BOOTSTRAP] Inicjalizacja Redis...');
    await initRedis();

    // 1.5. Ładowanie bazy GeoIP do pamięci (moduł location) — nigdy nie rzuca (patrz Silent
    // Fallback w location.repository.ts), więc brak pliku .mmdb w dev nie blokuje bootstrapu.
    console.log('[BOOTSTRAP] Ładowanie bazy GeoIP...');
    await locationRepository.init();

    // 2. Tworzenie dedykowanych klientów dla Adaptera Socket.io
    // Redis Adapter wymaga niezależnych połączeń (pub/sub)
    const pubClient = redisClient.duplicate();
    const subClient = redisClient.duplicate();
    
    await Promise.all([
      pubClient.connect(),
      subClient.connect()
    ]);

    // 3. Inicjalizacja Socket.io z wstrzykniętymi klientami. `redisClient` (osobno od
    // pubClient/subClient) trafia tu wyłącznie dla rate-limitera połączeń — patrz
    // shared/infrastructure/socket.ts i shared/rate-limit/rate-limiter.socket.ts.
    console.log('[BOOTSTRAP] Inicjalizacja Socket.io + Redis Adapter...');
    const io = initSocket(server, pubClient, subClient, redisClient);

    // 4. Rejestracja bramek
    console.log('[BOOTSTRAP] Rejestracja bramek czasu rzeczywistego...');
    registerAllGateways(io);

    server.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
      console.log('=====================================================');
    });

    // Graceful shutdown: zamykamy w kolejności HTTP server -> Socket.io -> Prisma -> Redis,
    // żeby nie zostawić otwartych uchwytów blokujących wyjście procesu po SIGTERM/SIGINT
    // (np. z `docker stop` albo Ctrl+C podczas dev).
    const shutdown = (signal: NodeJS.Signals) => {
      console.log(`[SHUTDOWN] Otrzymano ${signal}, zamykanie serwera...`);

      server.close(async () => {
        try {
          io.close();
          await prisma.$disconnect();
          await Promise.all([redisClient.quit(), pubClient.quit(), subClient.quit()]);
          // Na końcu, żeby spany/metryki wygenerowane przez zamykanie powyższych klientów
          // (same są zainstrumentowane) zdążyły się jeszcze wyeksportować przed exitem.
          await shutdownOtel();
          console.log('[SHUTDOWN] Zamknięto czysto.');
          process.exit(0);
        } catch (error) {
          console.error('[SHUTDOWN] Błąd podczas zamykania:', error);
          process.exit(1);
        }
      });
    };

    process.on('SIGTERM', shutdown);
    process.on('SIGINT', shutdown);
  } catch (error) {
    console.error('[FATAL ERROR] Serwer padł podczas startu:', error);
    process.exit(1);
  }
}

bootstrap();