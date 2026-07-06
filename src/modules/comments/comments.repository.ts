import { prisma } from "../../shared/prisma.js";
import { CreateCommentDTO } from "./dto/create-comment.dto.js";


export const create = async (dto: CreateCommentDTO) => {
  return await prisma.comment.create({
    data: {
      message: dto.message,
      type: dto.type,
      latitude: dto.latitude,
      longitude: dto.longitude,
      petId: dto.petId,
      userId: dto.userId,
    },
    include: {
      user: true, // Dołączamy autora do wyniku
    },
  });
};

export const findByPetId = async (petId: string) => {
  return await prisma.comment.findMany({
    where: { petId },
    include: {
      user: true,
    },
    orderBy: { createdAt: 'desc' }, // Najnowsze punkty widzenia na górze
  });
};