import { decodeFeedCursor, encodeFeedCursor } from './feed.cursor.js';

describe('feed cursor', () => {
  it('round-trips createdAt/id through encode then decode', () => {
    const createdAt = new Date('2026-01-01T10:00:00.000Z');
    const encoded = encodeFeedCursor({ createdAt, id: 'pet-1' });

    const decoded = decodeFeedCursor(encoded);

    expect(decoded).toEqual({ createdAt: createdAt.toISOString(), id: 'pet-1' });
  });

  it('returns null for a null/undefined/empty cursor', () => {
    expect(decodeFeedCursor(null)).toBeNull();
    expect(decodeFeedCursor(undefined)).toBeNull();
    expect(decodeFeedCursor('')).toBeNull();
  });

  it('throws a 400 AppError for a malformed cursor', () => {
    expect(() => decodeFeedCursor('not-valid-base64url-json')).toThrow(
      expect.objectContaining({ statusCode: 400, message: 'Nieprawidłowy parametr cursor' }),
    );
  });

  it('throws a 400 AppError when the decoded payload is missing required fields', () => {
    const badPayload = Buffer.from(JSON.stringify({ createdAt: 'not-a-date' }), 'utf8').toString('base64url');

    expect(() => decodeFeedCursor(badPayload)).toThrow(expect.objectContaining({ statusCode: 400 }));
  });
});
