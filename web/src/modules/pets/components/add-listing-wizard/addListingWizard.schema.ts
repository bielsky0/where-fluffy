import { z } from 'zod';

// Per-step schemas, not one flat schema, because each step only ever validates its own slice of
// AddListingWizardData — the wizard keeps every other field's last-known value in Zustand
// (useAddListingWizardStore) regardless of which step is on screen, so validating the *whole*
// object on every "Dalej" press would incorrectly block step 1 on a still-empty step 4 field.
// z.object() ignores keys it doesn't declare (Zod's default, non-`.strict()` behavior), so
// running one of these against the wizard's full values object is safe.

export const reportTypeSchema = z.enum(['lost', 'found']);

// Step 1 (StepFork.tsx) — both 'lost' and 'found' map to the same Pet record, just with a
// different `status` (see CreatePetReportPayload / the backend's createPetSchema), so both tiles
// are selectable.
export const stepForkSchema = z.object({
  reportType: reportTypeSchema,
});

// Step 2 (StepPhoto.tsx) — deliberately unconstrained (a photo isn't required to file a report).
// The field is a compressed base64 data URL (see lib/compressImage.ts), not a File — encoding it
// at selection time is what lets it survive localStorage/JSON.stringify (see
// useAddListingWizardStore.ts's own comment on `photo`) and it's sent straight through as the
// backend's `photoBase64` field.
export const stepPhotoSchema = z.object({
  photo: z.string().nullable(),
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

// Step 4 (StepDetails.tsx). `name` isn't part of the original wizard spec's field list, but
// the backend's createPetSchema requires it (`name: z.string().min(2)`) for the POST /pets call
// this step ultimately drives — added here rather than silently defaulting it to something
// meaningless at submit time. `phone`/`reward`/`distinguishingMarks` mirror the same backend
// schema's own fields.
export const stepDetailsSchema = z.object({
  name: z.string().min(2, 'Podaj imię zwierzaka (min. 2 znaki)'),
  petType: petTypeSchema,
  description: z.string().min(10, 'Opisz sytuację (min. 10 znaków)').max(500),
  phone: z.string().min(9, 'Podaj numer telefonu (min. 9 cyfr)').max(20),
  reward: z.number().nonnegative().default(0),
  distinguishingMarks: z.string().max(300).optional(),
});

// Step 5 (StepReview.tsx) — pure summary/confirmation, no new fields of its own to validate.
export const stepReviewSchema = z.object({});

export const addListingWizardSchema = stepForkSchema
  .merge(stepPhotoSchema)
  .merge(stepMapPinSchema)
  .merge(stepDetailsSchema);

export type AddListingWizardFormValues = z.infer<typeof addListingWizardSchema>;

// Keyed 1-5 to match WizardStep (useAddListingWizardStore.ts) — consumed by
// AddListingWizard.tsx's per-step resolver.
export const STEP_SCHEMAS = {
  1: stepForkSchema,
  2: stepPhotoSchema,
  3: stepMapPinSchema,
  4: stepDetailsSchema,
  5: stepReviewSchema,
} as const;
