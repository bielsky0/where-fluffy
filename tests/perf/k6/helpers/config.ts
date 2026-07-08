// Shared endpoint config for all k6 scripts in this directory.
// Override with `k6 run -e BASE_URL=https://staging.example.com ...`.

export const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';
export const API_URL = `${BASE_URL}/api/v1`;

// Socket.io's default path is /socket.io/; EIO=4 pins the Engine.IO protocol version this
// app's `socket.io` v4 server package speaks (see shared/infrastructure/socket.ts).
// transport=websocket skips Engine.IO's long-polling fallback and upgrade handshake — we only
// ever want the raw WebSocket transport for a load test.
export const WS_URL = `${BASE_URL.replace(/^http/, 'ws')}/socket.io/?EIO=4&transport=websocket`;
