// Współdzielone przez producenta (api, pets.service.ts) i konsumenta (ai-worker) — oba żyją w
// tym samym pakiecie src/, więc zwykły relatywny import, bez duplikacji.
export const EMBED_PET_DATA_JOB_NAME = 'EMBED_PET_DATA';

export type EmbedPetDataPayload = { petId: string };
