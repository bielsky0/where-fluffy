import { createAdminPetSchema, createPetSchema } from './pets.schema.js';

const validBody = {
  name: 'Rex',
  species: 'dog',
  status: 'missing' as const,
  location: { lat: 52.2297, lng: 21.0122 },
  reward: 0,
  phone: '600100200',
  photoBase64s: ['data:image/png;base64,abc'],
};

describe('createAdminPetSchema', () => {
  it('accepts a valid sourceUrl/originalContact alongside the base pet fields', () => {
    const result = createAdminPetSchema.safeParse({
      ...validBody,
      sourceUrl: 'https://facebook.com/groups/example/posts/123',
      originalContact: 'Jan Kowalski, 600 100 200',
    });

    expect(result.success).toBe(true);
  });

  it('accepts a body with sourceUrl/originalContact omitted (both optional)', () => {
    const result = createAdminPetSchema.safeParse(validBody);

    expect(result.success).toBe(true);
  });

  it('rejects a malformed sourceUrl', () => {
    const result = createAdminPetSchema.safeParse({ ...validBody, sourceUrl: 'not-a-url' });

    expect(result.success).toBe(false);
  });

  it('strips isAdminAdded if a caller sends it — not a declared field, always server-derived', () => {
    const result = createAdminPetSchema.safeParse({ ...validBody, isAdminAdded: true });

    expect(result.success).toBe(true);
    expect(result.success && (result.data as Record<string, unknown>).isAdminAdded).toBeUndefined();
  });
});

describe('createPetSchema (non-admin)', () => {
  it('strips sourceUrl/originalContact entirely if a non-admin caller sends them', () => {
    const result = createPetSchema.safeParse({
      ...validBody,
      sourceUrl: 'https://facebook.com/groups/example/posts/123',
      originalContact: 'Jan Kowalski',
    });

    expect(result.success).toBe(true);
    expect(result.success && (result.data as Record<string, unknown>).sourceUrl).toBeUndefined();
    expect(result.success && (result.data as Record<string, unknown>).originalContact).toBeUndefined();
  });
});
