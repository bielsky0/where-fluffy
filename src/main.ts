import http from 'http';
import { createApp } from './app.js';
import { initSocket } from './shared/infrastructure/socket.js';
import { registerAllGateways } from './app.gateways.js';
import { initRedis, redisClient } from './shared/infrastructure/redis.js';

const PORT = process.env.PORT || 3000;

async function bootstrap() {
  const app = createApp();
  const server = http.createServer(app);

  try {
    console.log('============= STARTING SERVER BOOTSTRAP =============');

    // 1. Inicjalizacja klienta Redisa (dla logiki biznesowej)
    console.log('[BOOTSTRAP] Inicjalizacja Redis...');
    await initRedis();

    // 2. Tworzenie dedykowanych klientów dla Adaptera Socket.io
    // Redis Adapter wymaga niezależnych połączeń (pub/sub)
    const pubClient = redisClient.duplicate();
    const subClient = redisClient.duplicate();
    
    await Promise.all([
      pubClient.connect(),
      subClient.connect()
    ]);

    // 3. Inicjalizacja Socket.io z wstrzykniętymi klientami
    console.log('[BOOTSTRAP] Inicjalizacja Socket.io + Redis Adapter...');
    const io = initSocket(server, pubClient, subClient);

    // 4. Rejestracja bramek
    console.log('[BOOTSTRAP] Rejestracja bramek czasu rzeczywistego...');
    registerAllGateways(io);

    server.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
      console.log('=====================================================');
    });

  } catch (error) {
    console.error('[FATAL ERROR] Serwer padł podczas startu:', error);
    process.exit(1);
  }
}

bootstrap();