import { useEffect, useRef } from 'react';
import type { FieldErrors, UseFormRegister } from 'react-hook-form';
import { cn } from '@/shared/lib/cn';
import { PET_TYPE_LABELS, type PetTypeFilter } from '../../lib/petType';
import type { AddListingWizardData } from '../../store/useAddListingWizardStore';

interface StepDetailsProps {
  register: UseFormRegister<AddListingWizardData>;
  errors: FieldErrors<AddListingWizardData>;
  reportType: 'lost' | 'found' | null;
}

// Dog/cat/other, in that order — same bucket set and order the search wizard already uses
// (SearchModal.tsx), reusing PET_TYPE_LABELS instead of hand-writing Polish labels a second time.
const PET_TYPE_OPTIONS: PetTypeFilter[] = ['dog', 'cat', 'other'];

// Step 4 — "Dynamiczny podział formularza" (V2 spec): fields branch on reportType (chosen in
// step 1). Lost (Właściciel): name + reward on top of the shared fields, richer description
// framing. Found (Znalazca): no name, no reward, a "state/whereabouts" description framing —
// Znalazca doesn't know the pet's history and shouldn't be made to invent one. Both paths end in
// a shared contact section (phone/email, at least one required — see addListingWizard.schema.ts's
// contactRefine) that feeds directly into OTP verification once this step's submit button
// ("Weryfikuj i opublikuj", see AddListingWizard.tsx) is tapped.
export function StepDetails({ register, errors, reportType }: StepDetailsProps) {
  const isFound = reportType === 'found';
  const descriptionRef = useRef<HTMLTextAreaElement | null>(null);
  const { ref: registerDescriptionRef, ...descriptionField } = register('description');

  // A plain `autoFocus` attribute is unreliable here: this step mounts mid-way through
  // AddListingWizard.tsx's AnimatePresence slide-in, and some browsers drop autofocus on an
  // element that isn't yet laid out/visible. Focusing imperatively once the mount settles is
  // the reliable version of the same intent.
  useEffect(() => {
    const timer = setTimeout(() => descriptionRef.current?.focus(), 50);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="flex flex-1 flex-col gap-8 px-6 pt-2">
      <div className="flex flex-col gap-2">
        <h1 className="text-xl font-bold text-ink sm:text-2xl">Szczegóły</h1>
        <p className="text-sm text-subtle">Podaj podstawowe informacje — pomogą innym szybciej rozpoznać zwierzaka.</p>
      </div>

      {/* "Basic Info" — name (lost only) + type sit in a single compact row, visually distinct
          (bordered card) from the large, prominent description field below. */}
      <div className="flex flex-col gap-1 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
        <div className="flex gap-4">
          {!isFound && (
            <div className="flex flex-1 flex-col gap-1.5">
              <label htmlFor="wizard-name" className="text-sm font-medium text-ink">
                Imię zwierzaka
              </label>
              <input
                id="wizard-name"
                type="text"
                {...register('name')}
                placeholder="np. Burek"
                className="h-11 rounded-lg border border-gray-300 bg-white px-3.5 text-sm text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral"
              />
            </div>
          )}

          <div className={cn('flex flex-col gap-1.5', isFound ? 'flex-1' : 'w-32 sm:w-36')}>
            <span className="text-sm font-medium text-ink">Rodzaj</span>
            <div className="flex flex-col gap-1.5">
              {PET_TYPE_OPTIONS.map((option) => (
                <label
                  key={option}
                  className={cn(
                    'flex h-9 cursor-pointer items-center justify-center rounded-lg border border-gray-300 text-xs font-medium text-ink transition-colors',
                    'has-[:checked]:border-coral has-[:checked]:bg-coral/10 has-[:checked]:text-coral',
                  )}
                >
                  <input type="radio" value={option} {...register('petType')} className="sr-only" />
                  {PET_TYPE_LABELS[option]}
                </label>
              ))}
            </div>
          </div>
        </div>

        <div className="flex gap-4 empty:hidden">
          {!isFound && errors.name && <p className="flex-1 text-xs text-destructive">{errors.name.message}</p>}
          {errors.petType && (
            <p className={cn('text-xs text-destructive', isFound ? 'flex-1' : 'w-32 sm:w-36')}>Wybierz rodzaj</p>
          )}
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-1.5">
        <label htmlFor="wizard-description" className="text-sm font-medium text-ink">
          Opis
        </label>
        <textarea
          id="wizard-description"
          {...descriptionField}
          ref={(element) => {
            registerDescriptionRef(element);
            descriptionRef.current = element;
          }}
          rows={5}
          placeholder={
            isFound
              ? 'W jakim stanie jest zwierzak? Gdzie dokładnie przebywa lub w którą stronę się kieruje?'
              : 'Opisz cechy charakteru zwierzaka i okoliczności zaginięcia'
          }
          className="flex-1 resize-none rounded-lg border border-gray-300 bg-white px-3.5 py-2.5 text-sm text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral"
        />
        {errors.description && <p className="text-xs text-destructive">{errors.description.message}</p>}
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="wizard-marks" className="text-sm font-medium text-ink">
          Znaki szczególne (opcjonalnie)
        </label>
        <input
          id="wizard-marks"
          type="text"
          {...register('distinguishingMarks')}
          placeholder="np. biała łatka na łapie, obroża w kropki"
          className="h-11 rounded-lg border border-gray-300 bg-white px-3.5 text-sm text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral"
        />
        {errors.distinguishingMarks && (
          <p className="text-xs text-destructive">{errors.distinguishingMarks.message}</p>
        )}
      </div>

      {!isFound && (
        <div className="flex flex-col gap-1.5">
          <label htmlFor="wizard-reward" className="text-sm font-medium text-ink">
            Nagroda (zł, opcjonalnie)
          </label>
          <input
            id="wizard-reward"
            type="number"
            min={0}
            inputMode="numeric"
            {...register('reward', { valueAsNumber: true })}
            placeholder="0"
            className="h-11 w-32 rounded-lg border border-gray-300 bg-white px-3.5 text-sm text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral sm:w-36"
          />
          {errors.reward && <p className="text-xs text-destructive">{errors.reward.message}</p>}
        </div>
      )}

      <div className="flex flex-col gap-3 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-1">
          <span className="text-sm font-medium text-ink">Dane kontaktowe</span>
          <p className="text-xs text-subtle">Podaj telefon lub e-mail — wystarczy jedno z pól.</p>
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="wizard-phone" className="text-sm font-medium text-ink">
            Telefon
          </label>
          <input
            id="wizard-phone"
            type="tel"
            inputMode="tel"
            {...register('phone')}
            placeholder="np. 600 100 200"
            className="h-11 rounded-lg border border-gray-300 bg-white px-3.5 text-sm text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="wizard-email" className="text-sm font-medium text-ink">
            E-mail
          </label>
          <input
            id="wizard-email"
            type="email"
            {...register('email')}
            placeholder="np. jan@example.com"
            className="h-11 rounded-lg border border-gray-300 bg-white px-3.5 text-sm text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral"
          />
        </div>

        {(errors.phone || errors.email) && (
          <p className="text-xs text-destructive">
            {errors.phone?.message || errors.email?.message || 'Podaj telefon lub e-mail'}
          </p>
        )}
      </div>
    </div>
  );
}
