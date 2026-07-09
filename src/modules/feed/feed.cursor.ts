import { createAppError } from '../../shared/errors/app-error.js';
import { FeedCursor } from './interfaces/feed.interface.js';

export function encodeFeedCursor(item: { createdAt: Date; id: string }): string {
  const payload: FeedCursor = { createdAt: item.createdAt.toISOString(), id: item.id };
  return Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
}

// A malformed cursor is a client-input error (400) — distinct from the location module's
// "never throws" rule, which is specific to IP -> location resolution, not user-supplied
// pagination state.
export function decodeFeedCursor(raw: string | null | undefined): FeedCursor | null {
  if (!raw) return null;

  try {
    const parsed = JSON.parse(Buffer.from(raw, 'base64url').toString('utf8'));
    if (
      typeof parsed?.createdAt !== 'string' ||
      typeof parsed?.id !== 'string' ||
      Number.isNaN(Date.parse(parsed.createdAt))
    ) {
      throw new Error('malformed cursor payload');
    }
    return { createdAt: parsed.createdAt, id: parsed.id };
  } catch {
    throw createAppError(400, 'Nieprawidłowy parametr cursor');
  }
}
