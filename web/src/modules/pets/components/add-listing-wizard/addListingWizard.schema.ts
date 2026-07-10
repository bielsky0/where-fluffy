import { z } from 'zod';

// Per-step schemas, not one flat schema, because each step only ever validates its own slice of
// AddListingWizardData — the wizard keeps every other field's last-known value in Zustand
// (useAddListingWizardStore) regardless of which step is on screen, so validating the *whole*
// object on every "Dalej" press would incorrectly block step 1 on a still-empty step 4 field.
// z.object() ignores keys it doesn't declare (Zod's default, non-`.strict()` behavior), so
// running one of these against the wizard's full values object is safe.

export const reportTypeSchema = z.enum(['lost', 'found']);

// Step 1 (StepFork.tsx) — both 'lost' and 'found' map to the same Pet record, just with a
// different `status` (see CreatePetReportPayload / the backend's createPetSchema). Kept even
// though StepFork now auto-advances (no "Dalej" submit reaches this step directly) since
// AddListingWizard.tsx's stepAwareResolver still looks it up by index.
export const stepForkSchema = z.object({
  reportType: reportTypeSchema,
});

// Step 2 (StepPhoto.tsx) — at least one photo is mandatory for both paths (V2 spec: no report
// without visual documentation). Each entry is a compressed base64 data URL (see
// lib/compressImage.ts), not a File — encoding at selection time is what lets the array survive
// localStorage/JSON.stringify (see useAddListingWizardStore.ts's own comment on `photos`), sent
// straight through as the backend's `photoBase64s` field.
export const stepPhotoSchema = z.object({
  photos: z.array(z.string()).min(1, 'Dodaj co najmniej jedno zdjęcie'),
});

const coordinateSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
});

// Step 3 (StepMapPin.tsx) — effectively always valid once the map has mounted (the store seeds
// `location` with DEFAULT_CENTER before the user ever drags), but kept as a real schema rather
// than skipped so a future caller that removes that default doesn't silently ship a null island.
export const stepMapPinSchema = z.object({
  location: coordinateSchema,
});

// Mirrors PetTypeFilter (lib/petType.ts) — reusing that type/its PET_TYPE_LABELS map instead of
// inventing a parallel enum, since the search wizard already buckets species into exactly these
// three values.
export const petTypeSchema = z.enum(['dog', 'cat', 'other']);

// Step 4 (StepDetails.tsx) — two variants, discriminated on reportType (chosen in step 1), per
// the V2 spec's "dynamic form split": a Znalazca (finder) doesn't know the pet's name and isn't
// offered a reward field, an Właściciel (owner) gets both plus a fuller description prompt. Both
// share a contact section (phone/email) requiring at least one of the two — mirrors the backend's
// createPetSchema.refine() (src/modules/pets/pets.schema.ts). Applied via a plain function (not a
// generic helper) since Zod's `.refine()` return type doesn't unify cleanly across two
// differently-shaped `z.ZodObject`s through a shared generic wrapper.
const requiresPhoneOrEmail = (value: { phone: string; email: string }) =>
  value.phone.trim().length > 0 || value.email.trim().length > 0;
const CONTACT_REFINE_OPTIONS = { message: 'Podaj telefon lub e-mail', path: ['phone'] };

const baseDetailsFields = {
  petType: petTypeSchema,
  distinguishingMarks: z.string().max(300).optional(),
  phone: z.string().max(20).optional().default(''),
  email: z.string().email('Nieprawidłowy adres e-mail').optional().or(z.literal('')).default(''),
};

export const stepDetailsLostSchema = z
  .object({
    ...baseDetailsFields,
    name: z.string().min(2, 'Podaj imię zwierzaka (min. 2 znaki)'),
    description: z
      .string()
      .min(10, 'Opisz cechy charakteru i okoliczności zaginięcia (min. 10 znaków)')
      .max(500),
    reward: z.number().nonnegative().default(0),
  })
  .refine(requiresPhoneOrEmail, CONTACT_REFINE_OPTIONS);

export const stepDetailsFoundSchema = z
  .object({
    ...baseDetailsFields,
    description: z
      .string()
      .min(10, 'Opisz stan i miejsce, w którym jest zwierzak (min. 10 znaków)')
      .max(500),
  })
  .refine(requiresPhoneOrEmail, CONTACT_REFINE_OPTIONS);

// Keyed 1-4 to match WizardStep (useAddListingWizardStore.ts) — consumed by
// AddListingWizard.tsx's per-step resolver. Step 4 isn't in this map since it needs the current
// reportType to pick a variant (stepDetailsLostSchema vs stepDetailsFoundSchema) — the resolver
// handles that step specially.
export const STEP_SCHEMAS = {
  1: stepForkSchema,
  2: stepPhotoSchema,
  3: stepMapPinSchema,
} as const;
