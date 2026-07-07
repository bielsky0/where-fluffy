import { Prisma, type PrismaClient } from '@prisma/client';
import { CreateCommentDTO } from './dto/create-comment.dto.js';
import { CommentsRepository, CommentWithAuthor } from './interfaces/comment.interface.js';
import { mapToDomain, RawCommentRow } from './comments.mapper.js';

export const createCommentsRepository = (prisma: PrismaClient): CommentsRepository => {
  // "location" to Unsupported("geography(Point,4326)") w schema.prisma — standardowe
  // prisma.comment.create() nie zna tej kolumny (i wcześniej próbowało zamiast tego zapisać
  // nieistniejące pola "latitude"/"longitude", co zawsze wywalało się w runtime z błędem Prisma
  // "Unknown argument `latitude`"). Piszemy więc przez $queryRaw, tym samym wzorcem co
  // pets.repository.ts: ST_SetSRID/ST_MakePoint przy zapisie, ST_Y/ST_X przy odczycie, i nigdy
  // "SELECT *"/"RETURNING *" na tabeli z kolumną geography.
  const create = async (dto: CreateCommentDTO): Promise<CommentWithAuthor> => {
    const locationFragment =
      dto.latitude !== undefined && dto.longitude !== undefined
        ? Prisma.sql`ST_SetSRID(ST_MakePoint(${dto.longitude}, ${dto.latitude}), 4326)::geography`
        : Prisma.sql`NULL`;

    const [comment] = await prisma.$queryRaw<RawCommentRow[]>`
      WITH inserted AS (
        INSERT INTO "Comment" (id, message, type, "petId", "userId", location, "createdAt", "updatedAt")
        VALUES (gen_random_uuid(), ${dto.message}, ${dto.type}, ${dto.petId}, ${dto.userId}, ${locationFragment}, now(), now())
        RETURNING id, message, type, "petId", "userId", "createdAt", "updatedAt", location
      )
      SELECT inserted.id, inserted.message, inserted.type, inserted."petId", inserted."userId",
             inserted."createdAt", inserted."updatedAt",
             ST_Y(inserted.location::geometry) as lat, ST_X(inserted.location::geometry) as lng,
             u.name as "authorName"
      FROM inserted
      JOIN "User" u ON u.id = inserted."userId";
    `;
    return mapToDomain(comment);
  };

  const findByPetId = async (petId: string): Promise<CommentWithAuthor[]> => {
    const comments = await prisma.$queryRaw<RawCommentRow[]>`
      SELECT c.id, c.message, c.type, c."petId", c."userId", c."createdAt", c."updatedAt",
             ST_Y(c.location::geometry) as lat, ST_X(c.location::geometry) as lng,
             u.name as "authorName"
      FROM "Comment" c
      JOIN "User" u ON u.id = c."userId"
      WHERE c."petId" = ${petId}
      ORDER BY c."createdAt" DESC;
    `;
    return comments.map(mapToDomain);
  };

  return { create, findByPetId };
};
