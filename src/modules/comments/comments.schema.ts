import { z } from 'zod';

export const createCommentSchema = z.object({
  message: z.string().min(3, 'Komentarz musi mieć co najmniej 3 znaki'),
  type: z.enum(['sighted', 'area_checked_empty', 'general']),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
}).refine((data) => {
  // Jeśli typ to 'sighted', to latitude i longitude są WYMAGANE
  if (data.type === 'sighted') {
    return data.latitude !== undefined && data.longitude !== undefined;
  }
  return true;
}, {
  message: "Współrzędne GPS (szerokość i długość) są wymagane, gdy zwierzak został widziany.",
  path: ['latitude'], // Wskazuje frontendowi, przy którym polu wyrzucić błąd
});