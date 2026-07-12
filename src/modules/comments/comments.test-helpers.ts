// Współdzielone fixture'y/mocki dla comments.service.spec.ts i comments.controller.spec.ts.
// Nazwa celowo NIE pasuje do wzorca *.spec.ts / *.test.ts, więc Jest jej nie traktuje
// jako osobnej suity testów.
import { CommentsRepository, CommentWithAuthor } from './interfaces/comment.interface.js';
import { IPet, PetRepository } from '../pets/interfaces/pets.interface.js';
import { CreateCommentDTO } from './dto/create-comment.dto.js';

export const buildMockCommentsRepository = (): jest.Mocked<CommentsRepository> => ({
  create: jest.fn(),
  findByPetId: jest.fn(),
});

export const buildMockPetRepository = (): jest.Mocked<PetRepository> => ({
  findById: jest.fn(),
  save: jest.fn(),
  findNearLocation: jest.fn(),
  updateEmbedding: jest.fn(),
  findByOwnerId: jest.fn(),
  update: jest.fn(),
  updateStatus: jest.fn(),
  deleteById: jest.fn(),
  findSimilar: jest.fn(),
});

export const buildPet = (overrides: Partial<IPet> = {}): IPet => ({
  id: 'pet-1',
  name: 'Rex',
  species: 'dog',
  category: 'dog',
  location: { lat: 52.2297, lng: 21.0122 },
  ownerId: 'owner-1',
  status: 'missing',
  reward: 100,
  phone: null,
  email: null,
  distinguishingMarks: null,
  photoUrl: null,
  photoUrls: [],
  city: null,
  sourceUrl: null,
  originalContact: null,
  isAdminAdded: false,
  createdAt: new Date('2026-01-01T10:00:00.000Z'),
  updatedAt: new Date('2026-01-02T10:00:00.000Z'),
  ...overrides,
});

export const buildComment = (overrides: Partial<CommentWithAuthor> = {}): CommentWithAuthor => ({
  id: 'comment-1',
  message: 'Widziałem go koło parku',
  type: 'sighted',
  latitude: 52.2297,
  longitude: 21.0122,
  petId: 'pet-1',
  userId: 'user-1',
  createdAt: new Date('2026-01-01T10:00:00.000Z'),
  updatedAt: new Date('2026-01-01T10:00:00.000Z'),
  author: { id: 'user-1', name: 'Jane Doe' },
  ...overrides,
});

export const buildCreateCommentDto = (overrides: Partial<CreateCommentDTO> = {}): CreateCommentDTO => ({
  message: 'Widziałem go koło parku',
  type: 'sighted',
  latitude: 52.2297,
  longitude: 21.0122,
  petId: 'pet-1',
  userId: 'user-1',
  ...overrides,
});
