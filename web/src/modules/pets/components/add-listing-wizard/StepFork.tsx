import { Controller, type Control } from 'react-hook-form';
import { motion } from 'framer-motion';
import { cn } from '@/shared/lib/cn';
import type { AddListingWizardData } from '../../store/useAddListingWizardStore';

interface StepForkProps {
  control: Control<AddListingWizardData>;
  onAutoAdvance: (reportType: 'lost' | 'found') => void;
}

interface ForkTileProps {
  emoji: string;
  label: string;
  description: string;
  selected: boolean;
  disabled?: boolean;
  disabledHint?: string;
  onSelect: () => void;
}

// Airbnb-style category row: white card, a subtle 1px gray border and soft shadow at rest —
// selection adds a coral border-glow rather than swapping the whole card's fill, so the
// "selected" state reads as a highlight, not a repaint.
function ForkTile({ emoji, label, description, selected, disabled, disabledHint, onSelect }: ForkTileProps) {
  return (
    <motion.button
      type="button"
      onClick={disabled ? undefined : onSelect}
      aria-pressed={selected}
      disabled={disabled}
      title={disabled ? disabledHint : undefined}
      whileTap={disabled ? undefined : { scale: 0.99 }}
      className={cn(
        'flex w-full flex-col items-start gap-4 rounded-2xl border bg-white p-6 text-left shadow-sm transition-all',
        'disabled:cursor-not-allowed disabled:opacity-50',
        selected
          ? 'border-coral shadow-[0_0_0_3px_rgba(255,56,92,0.12)]'
          : 'border-gray-200 hover:border-gray-300 hover:shadow-md',
      )}
    >
      <span
        className={cn(
          'flex size-12 items-center justify-center rounded-full text-2xl',
          selected ? 'bg-coral/10' : 'bg-gray-100',
        )}
      >
        {emoji}
      </span>
      <div className="flex flex-col gap-1">
        <span className="text-base font-semibold text-ink">{label}</span>
        <span className="text-sm text-subtle">{disabled && disabledHint ? disabledHint : description}</span>
      </div>
    </motion.button>
  );
}

// Step 1 — the wizard's fork. Both tiles submit to the same POST /pets endpoint, just with a
// different `status` ('missing' vs 'found', see CreatePetReportPayload) — later steps swap their
// copy based on this choice (e.g. StepMapPin's "miejsce zaginięcia" vs "miejsce znalezienia").
// Single-choice, auto-advance (V2 spec): tapping a tile both records the choice AND immediately
// moves to step 2 via `onAutoAdvance` — there's no "Dalej" button on this step at all (see
// AddListingWizard.tsx, which hides its footer entirely for step 1).
export function StepFork({ control, onAutoAdvance }: StepForkProps) {
  return (
    <Controller
      name="reportType"
      control={control}
      render={({ field }) => (
        <div className="flex flex-1 flex-col gap-8 px-6 pt-2">
          <div className="flex flex-col gap-2">
            <h1 className="text-xl font-bold text-ink sm:text-2xl">Co się stało?</h1>
            <p className="text-sm text-subtle">
              Wybierz opcję, która najlepiej opisuje sytuację Twojego zwierzaka.
            </p>
          </div>
          <div className="flex flex-col gap-4">
            <ForkTile
              emoji="😿"
              label="Zgubiłem zwierzaka"
              description="Zgłoś zaginięcie i poproś okolicznych mieszkańców o pomoc w poszukiwaniach."
              selected={field.value === 'lost'}
              onSelect={() => {
                field.onChange('lost');
                onAutoAdvance('lost');
              }}
            />
            <ForkTile
              emoji="🐾"
              label="Znalazłem zwierzaka"
              description="Zgłoś znalezisko i pomóż połączyć zwierzaka z jego właścicielem."
              selected={field.value === 'found'}
              onSelect={() => {
                field.onChange('found');
                onAutoAdvance('found');
              }}
            />
          </div>
        </div>
      )}
    />
  );
}
