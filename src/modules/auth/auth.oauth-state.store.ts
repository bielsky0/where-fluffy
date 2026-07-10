import { randomUUID } from 'crypto';
import type { RedisClientType } from 'redis';
import { OAuthStateStore } from './interface/auth.interface.js';

const STATE_TTL_SECONDS = 600;

// Tylko `set`/`getDel` z pełnego RedisClientType — pozwala testom wstrzyknąć ręcznie zbudowany
// mock zamiast prawdziwego klienta, tak jak createResendEmailSender przyjmuje `Pick<Resend, 'emails'>`.
type OAuthStateRedisClient = Pick<RedisClientType, 'set' | 'getDel'>;

export const createOAuthStateStore = (redisClient: OAuthStateRedisClient): OAuthStateStore => {
  const keyFor = (state: string) => `oauth:state:${state}`;

  const create = async (): Promise<string> => {
    const state = randomUUID();
    await redisClient.set(keyFor(state), '1', { EX: STATE_TTL_SECONDS });
    return state;
  };

  // GETDEL — atomowe odczyt+usunięcie, żeby ten sam nonce nie mógł zostać użyty dwukrotnie.
  const consume = async (state: string): Promise<boolean> => (await redisClient.getDel(keyFor(state))) === '1';

  return { create, consume };
};
