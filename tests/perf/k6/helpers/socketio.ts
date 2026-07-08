// Minimal Engine.IO v4 / Socket.io v4 wire-protocol client on top of k6/websockets.
//
// k6/websockets gives you a raw browser-style WebSocket — it has no idea Socket.io exists.
// Socket.io doesn't speak plain WS frames: every frame is prefixed with an Engine.IO packet
// type digit, and event frames additionally wrap a Socket.io packet type digit + a JSON array.
// This app's server is a stock `socket.io` v4 (see shared/infrastructure/socket.ts), so the
// framing below is exactly what it expects:
//
//   Engine.IO packet types: 0=open  2=ping  3=pong  4=message
//   Socket.io packet types (carried inside an Engine.IO "4" message): 0=connect  2=event
//
//   Server -> client on connect:  0{"sid":"...","pingInterval":25000,...}   (Engine.IO open)
//   Client -> server, join ns:    40                                        (Socket.io connect)
//   Server -> client, ack:        40{"sid":"..."}
//   Client -> server, emit:       42["join_chat",{"petId":"...","finderId":"..."}]
//   Server -> client, event:      42["chat_joined",{"roomId":"...","history":[...]}]
//   Server -> client, heartbeat:  2   (client must reply "3" or the server drops the socket
//                                      after pingTimeout — see socket.ts's `pingTimeout: 20000`)
//
// If you need broader Socket.io protocol coverage than this (binary payloads, ack callbacks,
// namespaces other than "/", auto-reconnect), reach for the xk6-sio extension instead of
// hand-rolling more of this — it embeds a real Socket.io client but requires building a custom
// k6 binary via xk6, which is why this test uses the stock k6/websockets module.
//
// k6 stabilized this module: `k6/experimental/websockets` is now `k6/websockets` (same API) as
// of current k6 releases — the experimental path still works as a deprecated alias, but the
// stable one is what @types/k6 ships types for and what new scripts should target.
//
// @types/k6 models event names as an `EventName` enum, but the k6 v2.1.0 binary this was tested
// against only exports `{ Blob, WebSocket }` from 'k6/websockets' at runtime — `EventName` is a
// type-only declaration with no matching runtime value, so importing it as a value throws
// "Cannot read property 'Open' of undefined". Plain string literals work fine; `listen()` below
// confines the cast to one spot instead of sprinkling it across every addEventListener call.
//
// CRITICAL, verified against a live server: this module is fully event-driven and does NOT
// deliver events during k6's `sleep()` — a VU that calls sleep() while waiting for onopen/
// onmessage to fire will see nothing (confirmed empirically: zero events fired across a 3s
// sleep against a real Socket.io server that was in fact responding, confirmed by
// data_received > 0). Instead, once every WS callback in the default function returns without
// calling sleep(), the VU's iteration blocks on its own until ws.close() is called from inside
// a handler — that's the actual mechanism keeping a VU "alive" for a WS test, not sleep(). Drive
// the whole flow from callbacks (see ws-load-test.ts's `finish()`), not from a polling loop.
import { WebSocket } from 'k6/websockets';
import type { MessageEvent, ErrorEvent } from 'k6/websockets';
import { WS_URL } from './config.ts';

type EventHandler = (payload: unknown) => void;
type WsEventName = 'open' | 'message' | 'error' | 'close';

export class SocketIOClient {
  private ws: WebSocket;
  private handlers = new Map<string, EventHandler[]>();
  private connectHandlers: Array<() => void> = [];
  private closed = false;
  connected = false;
  connectError: string | null = null;

  constructor(cookie: string) {
    this.ws = new WebSocket(WS_URL, null, { headers: { Cookie: cookie } });

    this.listen('message', (e) => this.handleFrame((e as MessageEvent).data as string));

    this.listen('error', (e) => {
      this.connectError = (e as ErrorEvent).error ?? 'unknown websocket error';
    });
  }

  private listen(name: WsEventName, cb: (e: MessageEvent | ErrorEvent) => void): void {
    (this.ws.addEventListener as (event: string, listener: typeof cb) => void)(name, cb);
  }

  private handleFrame(frame: string): void {
    const engineIoType = frame[0];

    if (engineIoType === '0') {
      // Engine.IO handshake complete -> now join the default Socket.io namespace.
      this.ws.send('40');
      return;
    }

    if (engineIoType === '2') {
      this.ws.send('3'); // reply to server heartbeat ping with a pong
      return;
    }

    if (engineIoType !== '4') return; // ignore upgrade/noop/other Engine.IO control packets

    const socketIoType = frame[1];
    const rest = frame.slice(2);

    if (socketIoType === '0') {
      this.connected = true; // "40{...}" — Socket.io connect ack for namespace "/"
      for (const handler of this.connectHandlers) handler();
      return;
    }

    if (socketIoType === '4') {
      this.connectError = rest || 'namespace connect_error';
      return;
    }

    if (socketIoType === '2') {
      // "42[\"event_name\", payload]"
      const parsed = JSON.parse(rest) as [string, unknown];
      const [event, payload] = parsed;
      for (const handler of this.handlers.get(event) ?? []) handler(payload);
    }
  }

  onConnect(handler: () => void): void {
    this.connectHandlers.push(handler);
  }

  on(event: string, handler: EventHandler): void {
    const existing = this.handlers.get(event) ?? [];
    existing.push(handler);
    this.handlers.set(event, existing);
  }

  emit(event: string, payload: unknown): void {
    this.ws.send(`42${JSON.stringify([event, payload])}`);
  }

  close(): void {
    if (this.closed) return;
    this.closed = true;
    this.ws.close();
  }
}
