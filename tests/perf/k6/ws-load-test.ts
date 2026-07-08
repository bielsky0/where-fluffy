// WebSocket load test: connect -> join_chat -> send_message against the chat module.
//
// Run from the repo root with the app + docker compose infra already up:
//   k6 run tests/perf/k6/ws-load-test.ts
//
// Requires k6 v0.54+ (native TypeScript support, no bundler step needed).

import { check } from 'k6';
import { setTimeout } from 'k6/timers';
import { Counter } from 'k6/metrics';
import { SharedArray } from 'k6/data';
import { Options } from 'k6/options';
import { registerUser, loginUser, createPet, TestUser } from './helpers/http-auth.ts';
import { SocketIOClient } from './helpers/socketio.ts';

type ChatPair = { owner: TestUser; finder: TestUser };

// 5 pairs, same reasoning as load-test.ts: /auth/login is capped at 5 req/60s per IP
// (auth.routes.ts), and only the owner in each pair needs to log in — chat.service.ts's
// joinChatRoom lets the pet's owner join with ANY finderId, so the finder just needs to exist
// as a row (for the ChatRoom.finderId FK), not be logged in. That keeps setup() at exactly 5
// login calls for 5 concurrent chat sessions.
const pairs = new SharedArray<ChatPair>('chat-pairs', () => JSON.parse(open('./data/chat-pairs.json')));

export const options: Options = {
  stages: [
    { duration: '30s', target: 50 }, // ramp-up: 0 -> 50 VUs
    { duration: '1m', target: 50 },  // steady state: hold 50 VUs
    { duration: '30s', target: 0 },  // ramp-down
  ],
  thresholds: {
    // Built-in metrics from k6/websockets (still exposed under the ws_* names — see
    // https://grafana.com/docs/k6/latest/javascript-api/k6-websockets/). ws_msgs_received counts
    // every frame (Engine.IO opens/pings included), so it's a cheap "did anything come back at
    // all" smoke check — the custom counters below assert the actual business events.
    ws_connecting: ['p(95)<1000'],
    ws_msgs_received: ['count>0'],
    chat_joined_total: ['count>0'],
    message_echoed_total: ['count>0'],
    checks: ['rate>0.99'],
  },
};

const chatJoined = new Counter('chat_joined_total');
const messageEchoed = new Counter('message_echoed_total');

type SetupData = {
  sessions: Array<{ ownerCookie: string; petId: string; finderId: string }>;
};

export function setup(): SetupData {
  const sessions = pairs.map(({ owner, finder }) => {
    const ownerId = registerUser(owner);
    const finderId = registerUser(finder);
    const { cookie: ownerCookie } = loginUser(owner.email, owner.password);
    const petId = createPet(ownerCookie, `Perf Chat Fluffy (${ownerId.slice(0, 8)})`);
    return { ownerCookie, petId, finderId };
  });

  return { sessions };
}

export default function (data: SetupData): void {
  const session = data.sessions[__VU % data.sessions.length];
  const client = new SocketIOClient(session.ownerCookie);

  let roomId: string | null = null;
  let messageAcked = false;
  let finished = false;

  // k6/websockets is event-driven, not sleep-driven: the VU iteration blocks on its own until
  // client.close() runs, so every branch of this flow (success, error_response, or timeout) has
  // to end by calling finish() exactly once — see the CRITICAL note in helpers/socketio.ts.
  const finish = (): void => {
    if (finished) return;
    finished = true;

    check(
      { connected: client.connected, roomId, messageAcked },
      {
        'socket.io handshake connected': (r) => r.connected,
        'joined a chat room': (r) => r.roomId !== null,
        'sent message was echoed back': (r) => r.messageAcked,
      },
    );

    client.close();
  };

  client.onConnect(() => {
    client.emit('join_chat', { petId: session.petId, finderId: session.finderId });
  });

  client.on('chat_joined', (payload) => {
    roomId = (payload as { roomId: string }).roomId;
    chatJoined.add(1);
    client.emit('send_message', { chatRoomId: roomId, text: `Load test ping @ ${Date.now()}` });
  });

  client.on('new_message', () => {
    messageAcked = true;
    messageEchoed.add(1);
    finish();
  });

  client.on('error_response', (payload) => {
    console.error(`[VU ${__VU}] error_response: ${JSON.stringify(payload)}`);
    finish();
  });

  // Safety net: without this, a VU that never gets a reply (dropped connection, server bug)
  // would hang forever instead of failing the iteration and moving on.
  setTimeout(finish, 5000);
}
