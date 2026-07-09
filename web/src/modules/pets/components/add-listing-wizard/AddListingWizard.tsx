import { useForm, type Resolver } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { AnimatePresence, motion, useAnimationControls } from 'framer-motion';
import { Button } from '@/shared/ui';
import { useCreatePetReport } from '../../api/usePets';
import { PET_TYPE_LABELS } from '../../lib/petType';
import { useAddListingWizardStore, type AddListingWizardData, type WizardStep } from '../../store/useAddListingWizardStore';
import { STEP_SCHEMAS } from './addListingWizard.schema';
import { StepFork } from './StepFork';
import { StepPhoto } from './StepPhoto';
import { StepMapPin } from './StepMapPin';
import { StepDetails } from './StepDetails';

const TOTAL_STEPS = 4;

interface AddListingWizardProps {
  onClose: () => void;
}

// A single resolver instance, reading the *current* step off the store at validation time
// (rather than useForm being re-created per step) — this is what keeps RHF's own dirty-field
// tracking and values intact across back/forth navigation, per the "dirty-state management"
// requirement. z.object() schemas ignore keys they don't declare, so running e.g. stepForkSchema
// against the full multi-step values object only ever validates `reportType`.
const stepAwareResolver: Resolver<AddListingWizardData> = (values, context, options) => {
  const step = useAddListingWizardStore.getState().step;
  return zodResolver(STEP_SCHEMAS[step])(values, context, options);
};

// Production entry point for filing a new report — see the module README-style comment in
// addListingWizard.schema.ts for the backend gaps (no "found" endpoint, no photo/description
// column) this wizard deliberately works around rather than papers over.
export function AddListingWizard({ onClose }: AddListingWizardProps) {
  const step = useAddListingWizardStore((state) => state.step);
  const data = useAddListingWizardStore((state) => state.data);
  const setStep = useAddListingWizardStore((state) => state.setStep);
  const updateData = useAddListingWizardStore((state) => state.updateData);
  const resetWizard = useAddListingWizardStore((state) => state.reset);
  const createReport = useCreatePetReport();
  const dalejControls = useAnimationControls();

  const form = useForm<AddListingWizardData>({
    resolver: stepAwareResolver,
    defaultValues: data,
    mode: 'onSubmit',
  });
  const { control, register, handleSubmit, watch, formState } = form;

  // Step 1 only: "activates the Dalej button" per spec — a binary tile choice reads more clearly
  // as disabled-until-chosen than as a shake target. Steps 2-4 stay clickable and rely on the
  // shake + inline field errors below, since their fields are text/optional rather than binary.
  const reportType = watch('reportType');
  const canProceedStep1 = reportType === 'lost';

  const shakeDalej = () => {
    void dalejControls.start({ x: [0, -8, 8, -8, 8, 0], transition: { duration: 0.4 } });
  };

  const submitLostReport = async (values: AddListingWizardData) => {
    await createReport.mutateAsync({
      name: values.name,
      species: PET_TYPE_LABELS[values.petType!],
      location: values.location,
      reward: 0,
    });
    resetWizard();
    onClose();
  };

  const onDalej = handleSubmit(
    (values) => {
      updateData(values);
      if (step < TOTAL_STEPS) {
        setStep((step + 1) as WizardStep);
        return;
      }
      void submitLostReport(values);
    },
    () => shakeDalej(),
  );

  const onWstecz = () => {
    updateData(form.getValues());
    if (step === 1) {
      onClose();
      return;
    }
    setStep((step - 1) as WizardStep);
  };

  // Persists whatever's currently on screen (not just what's already been committed via
  // "Dalej") to the store before closing — same "snapshot the live form" move onWstecz already
  // makes. updateData's `set()` call is itself what writes the draft to localStorage (see
  // useAddListingWizardStore.ts's `persist` middleware), so a save mid-step never drops unsaved
  // keystrokes.
  const onSaveAndExit = () => {
    updateData(form.getValues());
    onClose();
  };

  const progressPercent = (step / TOTAL_STEPS) * 100;

  return (
    // z-[1200]: must beat both BottomNav/GuestTabBar (z-[1100], persistent across every
    // AppShell view — see AppShell.tsx) and BottomSheet (z-[1000]) — a plain z-[1000] here left
    // the sticky "Dalej" footer visible but non-interactive, completely covered by the tab
    // bar's own hit area. Discovered via manual click-through in a browser, not by inspection —
    // the footer looked fine, only clicks silently failed.
    <div role="dialog" aria-modal="true" className="fixed inset-0 z-[1200] flex flex-col bg-white">
      <header className="flex shrink-0 flex-col gap-4 px-6 pt-safe pb-4 pt-6">
        <div className="flex items-center justify-between">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onWstecz}
            className="text-ink hover:bg-gray-100 hover:text-ink"
          >
            ← Wstecz
          </Button>
          <button
            type="button"
            onClick={onSaveAndExit}
            className="text-sm font-medium text-subtle underline-offset-4 transition-colors hover:text-ink hover:underline"
          >
            Zapisz i wyjdź
          </button>
        </div>

        <div className="flex flex-col gap-2">
          <span className="text-xs font-medium text-subtle">
            Krok {step} z {TOTAL_STEPS}
          </span>
          <div
            className="h-2.5 w-full overflow-hidden rounded-full bg-gray-200"
            role="progressbar"
            aria-valuenow={step}
            aria-valuemin={1}
            aria-valuemax={TOTAL_STEPS}
          >
            <motion.div
              className="h-full rounded-full bg-coral"
              initial={false}
              animate={{ width: `${progressPercent}%` }}
              transition={{ duration: 0.3, ease: 'easeOut' }}
            />
          </div>
        </div>
      </header>

      <form onSubmit={onDalej} className="flex flex-1 flex-col overflow-hidden">
        {/* Every step-to-step transition slides in from the right and exits to the left,
            regardless of navigation direction — the "smooth slide-in from the right" high-end
            mobile push pattern. Easing reuses the same cubic-bezier as the app's own bottom
            sheet (see tailwind.config.ts's sheet-slide-up) for a consistent feel. */}
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={step}
            initial={{ opacity: 0, x: 32 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -32 }}
            transition={{ duration: 0.28, ease: [0.32, 0.72, 0, 1] }}
            className="flex flex-1 flex-col overflow-y-auto pb-4"
          >
            {step === 1 && <StepFork control={control} />}
            {step === 2 && <StepPhoto control={control} />}
            {step === 3 && <StepMapPin control={control} />}
            {step === 4 && <StepDetails register={register} errors={formState.errors} />}
          </motion.div>
        </AnimatePresence>

        {/* Sticky footer FAB — fixed regardless of step content length/scroll position, per spec. */}
        <div className="shrink-0 border-t border-gray-200 bg-white px-6 pb-safe pt-4">
          <motion.div animate={dalejControls}>
            <Button
              type="submit"
              size="lg"
              className="h-14 w-full rounded-full bg-coral text-base font-bold text-white shadow-sm hover:bg-coral-hover"
              disabled={(step === 1 && !canProceedStep1) || createReport.isPending}
            >
              {step === TOTAL_STEPS ? (createReport.isPending ? 'Wysyłanie…' : 'Opublikuj') : 'Dalej'}
            </Button>
          </motion.div>
          {createReport.isError && (
            <p role="alert" className="mt-2 text-center text-xs text-destructive">
              Nie udało się wysłać zgłoszenia. Spróbuj ponownie.
            </p>
          )}
        </div>
      </form>
    </div>
  );
}
