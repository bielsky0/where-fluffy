import { z } from 'zod';

// Bez `.refine()` — baza do `.partial()` dla updatePetSchema poniżej (ZodEffects, jakim
// createPetSchema staje się po dołożeniu refine'ów, nie ma `.partial()`).
export const createPetBaseSchema = z.object({
  // Opcjonalne na poziomie schematu (Znalazca nie zna imienia) — wymagane warunkowo dla
  // status === 'missing' przez refine poniżej. Patrz addListingWizard.schema.ts na froncie,
  // gdzie ten sam podział (lost wymaga name, found nie) jest lustrzany.
  name: z.string().min(2).optional(),
  species: z.string().min(2),
  status: z.enum(['missing', 'found']).default('missing'),
  location: z.object({
    lat: z.number().min(-90).max(90),
    lng: z.number().min(-180).max(180),
  }),
  reward: z.number().nonnegative().default(0),
  // Oba opcjonalne indywidualnie — refine poniżej wymaga co najmniej jednego (Kontakt: telefon
  // LUB e-mail).
  phone: z.string().min(9).max(20).optional(),
  email: z.string().email().optional(),
  distinguishingMarks: z.string().max(300).optional(),
  // Data URL-e (base64) skompresowanych zdjęć — patrz shared/photo/cloudinary.adapter.ts. Wymagane, min. 1 zdjęcie
  // (żelazna zasada V2: brak zgłoszenia bez dokumentacji wizualnej, obie ścieżki).
  photoBase64s: z.array(z.string()).min(1, 'Dodaj co najmniej jedno zdjęcie'),
});

// Wspólne reguły biznesowe dla createPetSchema (zwykła ścieżka) i createAdminPetSchema (Content
// Seeding, poniżej) — wydzielone, bo .refine() zamienia ZodObject w ZodEffects, który nie ma
// .extend() (patrz komentarz nad createPetBaseSchema), więc createAdminPetSchema nie może po
// prostu dodać pól do już zrefinowanego createPetSchema.
const withPetRefinements = <T extends z.ZodObject<z.ZodRawShape>>(schema: T) =>
  schema
    .refine((data) => data.status !== 'missing' || Boolean(data.name), {
      message: 'Podaj imię zwierzaka',
      path: ['name'],
    })
    .refine((data) => Boolean(data.phone) || Boolean(data.email), {
      message: 'Podaj telefon lub e-mail',
      path: ['phone'],
    });

export const createPetSchema = withPetRefinements(createPetBaseSchema);

// Admin-only (Content Seeding, patrz pets.routes.ts's POST /pets/admin) — sourceUrl/
// originalContact istnieją wyłącznie na tym schemacie. `isAdminAdded` celowo NIE jest tu polem:
// jest zawsze ustawiane po stronie serwera na true w pets.controller.ts's createAdminSeeded,
// tak samo jak ownerId pochodzi tam z req.user!.id, a nie z ciała żądania.
export const createAdminPetSchema = withPetRefinements(
  createPetBaseSchema.extend({
    sourceUrl: z.string().url('Podaj prawidłowy URL źródła').optional(),
    originalContact: z.string().max(300).optional(),
  }),
);

// Edycja nigdy nie niesie `status` — zmiany statusu idą przez własny endpoint
// (updatePetStatusSchema poniżej), żeby dyskretne akcje Management Hub (Edytuj / Oznacz jako
// odnaleziony / Pauza) się nie mieszały.
export const updatePetSchema = createPetBaseSchema.omit({ status: true }).partial();

// 'paused'/'resolved' nie istnieją przy tworzeniu zgłoszenia (createPetSchema wyżej) — to stany,
// w które zgłoszenie może wejść wyłącznie przez Management Hub. 'resolved' to nowy stan "odzyskany
// właściciel" (Flow 4), celowo odrębny od 'found' — 'found' oznacza zgłoszenie widzenia przez
// znalazcę (patrz PetDetailPage.tsx's STATUS_COPY), nie to samo co odnalezienie własnego zwierzaka.
export const updatePetStatusSchema = z.object({
  status: z.enum(['missing', 'found', 'paused', 'resolved']),
});
