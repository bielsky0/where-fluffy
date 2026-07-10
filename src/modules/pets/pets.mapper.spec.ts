import { mapToDomain, mapToResponseDTO, RawPetRow } from './pets.mapper.js';
import { IPet } from './interfaces/pets.interface.js';

describe('mapToDomain', () => {
  const buildRawRow = (overrides: Partial<RawPetRow> = {}): RawPetRow => ({
    id: 'pet-1',
    name: 'Rex',
    species: 'dog',
    status: 'missing',
    category: 'dog',
    reward: 100,
    phone: null,
    distinguishingMarks: null,
    photoUrl: null,
    photoUrls: [],
    city: null,
    ownerId: 'owner-1',
    createdAt: new Date('2026-01-01T10:00:00.000Z'),
    updatedAt: new Date('2026-01-02T10:00:00.000Z'),
    lat: 52.2297,
    lng: 21.0122,
    ...overrides,
  });

  it('nests the flat lat/lng columns into a location object and passes other fields through', () => {
    const row = buildRawRow();

    const pet = mapToDomain(row);

    expect(pet).toEqual({
      id: row.id,
      name: row.name,
      species: row.species,
      status: 'missing',
      category: 'dog',
      reward: row.reward,
      phone: null,
      distinguishingMarks: null,
      photoUrl: null,
      photoUrls: [],
      city: null,
      ownerId: row.ownerId,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      location: { lat: row.lat, lng: row.lng },
    });
  });

  it('preserves a "found" status rather than hardcoding it', () => {
    const row = buildRawRow({ status: 'found' });

    const pet = mapToDomain(row);

    expect(pet.status).toBe('found');
  });

  it('coerces a numeric-string reward (as $queryRaw can return for numeric columns) into a real number', () => {
    const row = buildRawRow({ reward: '150' as unknown as number });

    const pet = mapToDomain(row);

    expect(pet.reward).toBe(150);
    expect(typeof pet.reward).toBe('number');
  });

  it('maps a zero reward to 0, not a falsy fallback', () => {
    const row = buildRawRow({ reward: 0 });

    const pet = mapToDomain(row);

    expect(pet.reward).toBe(0);
  });

  it('passes createdAt/updatedAt through as the same Date instances, without formatting', () => {
    const row = buildRawRow();

    const pet = mapToDomain(row);

    expect(pet.createdAt).toBe(row.createdAt);
    expect(pet.updatedAt).toBe(row.updatedAt);
  });
});

describe('mapToResponseDTO', () => {
  const buildPet = (overrides: Partial<IPet> = {}): IPet => ({
    id: 'pet-1',
    name: 'Rex',
    species: 'dog',
    category: 'dog',
    location: { lat: 52.2297, lng: 21.0122 },
    ownerId: 'owner-1',
    status: 'missing',
    reward: 100,
    phone: null,
    distinguishingMarks: null,
    photoUrl: null,
    photoUrls: [],
    city: null,
    createdAt: new Date('2026-01-01T10:00:00.000Z'),
    updatedAt: new Date('2026-01-02T10:00:00.000Z'),
    ...overrides,
  });

  it('formats createdAt as an ISO string', () => {
    const pet = buildPet();

    const dto = mapToResponseDTO(pet);

    expect(dto.createdAt).toBe(pet.createdAt.toISOString());
    expect(typeof dto.createdAt).toBe('string');
  });

  it('coerces reward and location lat/lng through Number(), even if passed as strings on the domain object', () => {
    const pet = buildPet({
      reward: '250' as unknown as number,
      location: { lat: '52.5' as unknown as number, lng: '21.5' as unknown as number },
    });

    const dto = mapToResponseDTO(pet);

    expect(dto.reward).toBe(250);
    expect(dto.location).toEqual({ lat: 52.5, lng: 21.5 });
  });

  it('does not leak ownerId or updatedAt into the response DTO', () => {
    const pet = buildPet();

    const dto = mapToResponseDTO(pet);

    expect(dto).not.toHaveProperty('ownerId');
    expect(dto).not.toHaveProperty('updatedAt');
  });

  it('round-trips a raw DB row through mapToDomain then mapToResponseDTO into the expected shape', () => {
    const rawRow: RawPetRow = {
      id: 'pet-42',
      name: 'Fluffy',
      species: 'cat',
      status: 'missing',
      category: 'cat',
      reward: 50,
      phone: null,
      distinguishingMarks: null,
      photoUrl: null,
      photoUrls: ['https://example.test/rex.jpg'],
      city: 'Kraków',
      ownerId: 'owner-42',
      createdAt: new Date('2026-03-01T12:00:00.000Z'),
      updatedAt: new Date('2026-03-01T12:00:00.000Z'),
      lat: 50.0647,
      lng: 19.945,
    };

    const dto = mapToResponseDTO(mapToDomain(rawRow));

    expect(dto).toEqual({
      id: 'pet-42',
      name: 'Fluffy',
      species: 'cat',
      status: 'missing',
      category: 'cat',
      reward: 50,
      phone: null,
      distinguishingMarks: null,
      photoUrl: null,
      photoUrls: ['https://example.test/rex.jpg'],
      city: 'Kraków',
      location: { lat: 50.0647, lng: 19.945 },
      createdAt: rawRow.createdAt.toISOString(),
    });
  });
});
