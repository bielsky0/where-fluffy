import http from 'http';
import { createApp } from './app.js';
import { initSocket } from './shared/infrastructure/socket.js';
import { registerAllGateways } from './app.gateways.js';

const PORT = process.env.PORT || 3000;

async function bootstrap() {
  // 1. Generujemy instancję Expressa z Twojej fabryki
  const app = createApp();
  
  // 2. Owijamy ją w natywny serwer HTTP (wymagane przez Socket.io)
  const server = http.createServer(app);

  try {
    console.log('============= STARTING SERVER BOOTSTRAP =============');

    // 3. Inicjalizujemy warstwę Socket.io (połączenie z Redisem i handshake JWT)
    console.log('[BOOTSTRAP] Inicjalizacja Socket.io + Redis Adapter...');
    const io = await initSocket(server);

    // 4. Rejestrujemy wszystkie bramki WebSocketów (w tym nasz ChatGateway)
    console.log('[BOOTSTRAP] Rejestracja bramek czasu rzeczywistego...');
    registerAllGateways(io);

    // 5. Odpalamy serwer sieciowy
    // ⚠️ PAMIĘTAJ: Słuchamy na obiekcie 'server', nie na 'app'!
    server.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
      console.log(`🔗 REST API Base URL: http://localhost:${PORT}/api/v1`);
      console.log('=====================================================');
    });

  } catch (error) {
    console.error('=====================================================');
    console.error('[FATAL ERROR] Serwer padł podczas procedury startowej:');
    console.error(error);
    console.error('=====================================================');
    process.exit(1);
  }
}

// Uruchomienie aplikacji
bootstrap();