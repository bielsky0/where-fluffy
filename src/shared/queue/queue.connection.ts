import { Redis } from 'ioredis';

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

// BullMQ requires ioredis specifically (not the `redis` v6 client used everywhere else in this
// repo for pub/sub/caching/rate-limiting) — a separate connection/package, not a shared client.
// `maxRetriesPerRequest: null` and `enableReadyCheck: false` are BullMQ's own documented
// requirements for any connection it's handed; without them, blocking commands (BRPOPLPUSH-style
// polling under the hood) misbehave.
export const createQueueConnection = (): Redis =>
  new Redis(REDIS_URL, { maxRetriesPerRequest: null, enableReadyCheck: false });
