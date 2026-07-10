import { createOAuthStateStore } from './auth.oauth-state.store.js';

describe('createOAuthStateStore', () => {
  const buildMockRedisClient = () => ({
    set: jest.fn(),
    getDel: jest.fn(),
  });

  it('creates a unique state and persists it with a TTL', async () => {
    const redis = buildMockRedisClient();
    redis.set.mockResolvedValue('OK');
    const store = createOAuthStateStore(redis);

    const stateA = await store.create();
    const stateB = await store.create();

    expect(stateA).not.toBe(stateB);
    expect(redis.set).toHaveBeenCalledWith(`oauth:state:${stateA}`, '1', { EX: 600 });
  });

  it('consumes a valid state exactly once (atomic GETDEL)', async () => {
    const redis = buildMockRedisClient();
    redis.getDel.mockResolvedValueOnce('1').mockResolvedValueOnce(null);
    const store = createOAuthStateStore(redis);

    const firstConsume = await store.consume('some-state');
    const secondConsume = await store.consume('some-state');

    expect(firstConsume).toBe(true);
    expect(secondConsume).toBe(false);
    expect(redis.getDel).toHaveBeenCalledWith('oauth:state:some-state');
  });

  it('rejects a state that was never created', async () => {
    const redis = buildMockRedisClient();
    redis.getDel.mockResolvedValue(null);
    const store = createOAuthStateStore(redis);

    await expect(store.consume('unknown-state')).resolves.toBe(false);
  });
});
