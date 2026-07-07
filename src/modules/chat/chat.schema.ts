import { z } from 'zod';

export const MessageResponseSchema = z.object({
  id: z.uuid(),
  chatRoomId: z.uuid(),
  text: z.string().min(1).max(2000), // Dodajemy sensowne limity
  createdAt: z.string().datetime(), // Walidacja ISO String
  sender: z.object({
    id: z.uuid(),
    name: z.string().min(1).max(100),
  }),
});

export const JoinChatSchema = z.object({
  petId: z.uuid(),
  finderId: z.uuid(),
});

export const SendMessageSchema = z.object({
  chatRoomId: z.uuid(),
  text: z.string().min(1).max(2000).trim(),
});

// Automatyczne wyciągnięcie typu z schematu
export type MessageResponseDTO = z.infer<typeof MessageResponseSchema>;

