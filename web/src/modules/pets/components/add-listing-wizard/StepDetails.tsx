import { useEffect, useRef } from 'react';
import type { FieldErrors, UseFormRegister } from 'react-hook-form';
import { cn } from '@/shared/lib/cn';
import { PET_TYPE_LABELS, type PetTypeFilter } from '../../lib/petType';
import type { AddListingWizardData } from '../../store/useAddListingWizardStore';

interface StepDetailsProps {
  register: UseFormRegister<AddListingWizardData>;
  errors: FieldErrors<AddListingWizardData>;
}

// Dog/cat/other, in that order — same bucket set and order the search wizard already uses
// (SearchModal.tsx), reusing PET_TYPE_LABELS instead of hand-writing Polish labels a second time.
const PET_TYPE_OPTIONS: PetTypeFilter[] = ['dog', 'cat', 'other'];

// Step 4 — the wizard's last step before submit. `name` isn't in the original spec's field list
// but the backend's createPetSchema requires it (see addListingWizard.schema.ts's own comment on
// stepDetailsSchema), so it's included as the step's third field alongside pet type and
// description.
export function StepDetails({ register, errors }: StepDetailsProps) {
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

      {/* "Basic Info" — name + type sit in a single compact row, visually distinct (bordered
          card) from the large, prominent description field below. */}
      <div className="flex flex-col gap-1 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
        <div className="flex gap-4">
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

          <div className="flex w-32 flex-col gap-1.5 sm:w-36">
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
          {errors.name && <p className="flex-1 text-xs text-destructive">{errors.name.message}</p>}
          {errors.petType && <p className="w-32 text-xs text-destructive sm:w-36">Wybierz rodzaj</p>}
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
          placeholder="Kiedy i gdzie widziano zwierzaka ostatni raz? Jakieś charakterystyczne cechy?"
          className="flex-1 resize-none rounded-lg border border-gray-300 bg-white px-3.5 py-2.5 text-sm text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral"
        />
        {errors.description && <p className="text-xs text-destructive">{errors.description.message}</p>}
      </div>
    </div>
  );
}
