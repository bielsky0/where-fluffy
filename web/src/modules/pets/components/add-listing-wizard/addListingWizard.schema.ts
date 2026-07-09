import { z } from 'zod';

// Per-step schemas, not one flat schema, because each step only ever validates its own slice of
// AddListingWizardData — the wizard keeps every other field's last-known value in Zustand
// (useAddListingWizardStore) regardless of which step is on screen, so validating the *whole*
// object on every "Dalej" press would incorrectly block step 1 on a still-empty step 4 field.
// z.object() ignores keys it doesn't declare (Zod's default, non-`.strict()` behavior), so
// running one of these against the wizard's full values object is safe.

export const reportTypeSchema = z.enum(['lost', 'found']);

// Step 1 (StepFork.tsx) — only 'lost' is actually selectable today; 'found' has no backend
// endpoint to submit to (see CreatePetReportPayload's own comment), so that tile is disabled
// rather than validated against here (see StepFork.tsx's own comment on the disabled tile).
export const stepForkSchema = z.object({
  reportType: reportTypeSchema,
});

// Step 2 (StepPhoto.tsx) — deliberately unconstrained. A photo is a nice-to-have, not required
// to file a report, and (see useAddListingWizardStore.ts) it's local-only anyway: the backend's
// CreatePetDTO has no field to receive it yet.
export const stepPhotoSchema = z.object({
  photo: z.instanceof(File).nullable(),
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
// pets.schema.ts's createPetSchema requires it (`name: z.string().min(2)`) for the POST /pets
// call this step ultimately drives — added here rather than silently defaulting it to something
// meaningless at submit time.
export const stepDetailsSchema = z.object({
  name: z.string().min(2, 'Podaj imię zwierzaka (min. 2 znaki)'),
  petType: petTypeSchema,
  description: z.string().min(10, 'Opisz sytuację (min. 10 znaków)').max(500),
});

export const addListingWizardSchema = stepForkSchema
  .merge(stepPhotoSchema)
  .merge(stepMapPinSchema)
  .merge(stepDetailsSchema);

export type AddListingWizardFormValues = z.infer<typeof addListingWizardSchema>;

// Keyed 1-4 to match WizardStep (useAddListingWizardStore.ts) — consumed by
// AddListingWizard.tsx's per-step resolver.
export const STEP_SCHEMAS = {
  1: stepForkSchema,
  2: stepPhotoSchema,
  3: stepMapPinSchema,
  4: stepDetailsSchema,
} as const;
