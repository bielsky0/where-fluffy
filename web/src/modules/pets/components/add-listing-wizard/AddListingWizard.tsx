import { useEffect } from 'react';
import { useForm, type Resolver } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { AnimatePresence, motion, useAnimationControls } from 'framer-motion';
import { Button } from '@/shared/ui';
import { useProtectedAction } from '@/modules/auth/hooks/useProtectedAction';
import { useCreatePetReport } from '../../api/usePets';
import { PET_TYPE_LABELS } from '../../lib/petType';
import type { CreatePetReportPayload } from '../../types/pet.types';
import { useAddListingWizardStore, type AddListingWizardData, type WizardStep } from '../../store/useAddListingWizardStore';
import { STEP_SCHEMAS } from './addListingWizard.schema';
import { StepFork } from './StepFork';
import { StepPhoto } from './StepPhoto';
import { StepMapPin } from './StepMapPin';
import { StepDetails } from './StepDetails';
import { StepReview } from './StepReview';

const TOTAL_STEPS = 5;

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

// Production entry point for filing a new report (both "lost" and "found" — see StepFork.tsx),
// including the Ghost Account guest flow: step 5's "Opublikuj" is wrapped in useProtectedAction,
// so a guest is routed through AuthBottomSheet's OTP verification first, and the same publish
// closure re-fires automatically the instant that succeeds (see useProtectedAction.ts).
export function AddListingWizard({ onClose }: AddListingWizardProps) {
  const step = useAddListingWizardStore((state) => state.step);
  const data = useAddListingWizardStore((state) => state.data);
  const setStep = useAddListingWizardStore((state) => state.setStep);
  const updateData = useAddListingWizardStore((state) => state.updateData);
  const resetWizard = useAddListingWizardStore((state) => state.reset);
  const createReport = useCreatePetReport();
  const protectedPublish = useProtectedAction();
  const dalejControls = useAnimationControls();

  const form = useForm<AddListingWizardData>({
    resolver: stepAwareResolver,
    defaultValues: data,
    mode: 'onSubmit',
  });
  const { control, register, handleSubmit, watch, formState } = form;

  // Step 1 only: "activates the Dalej button" per spec — a binary tile choice reads more clearly
  // as disabled-until-chosen than as a shake target. Steps 2-5 stay clickable and rely on the
  // shake + inline field errors below, since their fields are text/optional rather than binary.
  const reportType = watch('reportType');
  const canProceedStep1 = reportType === 'lost' || reportType === 'found';

  const shakeDalej = () => {
    void dalejControls.start({ x: [0, -8, 8, -8, 8, 0], transition: { duration: 0.4 } });
  };

  const publishReport = (values: AddListingWizardData) => {
    const payload: CreatePetReportPayload = {
      name: values.name,
      species: PET_TYPE_LABELS[values.petType!],
      status: values.reportType === 'found' ? 'found' : 'missing',
      location: values.location,
      reward: values.reward,
      phone: values.phone,
      distinguishingMarks: values.distinguishingMarks || undefined,
      photoBase64: values.photo || undefined,
    };
    // Fire-and-forget `.mutate` (not `.mutateAsync`) — this closure is exactly what
    // useProtectedAction stores as `pendingAction` (a plain `() => void`), resumed automatically
    // once a guest finishes the OTP flow. The mutation itself may pause offline and resolve much
    // later (see queryClient.ts's `networkMode: 'offlineFirst'`); StepReview.tsx and the
    // isSuccess effect below react to that whenever it happens, independent of this call site.
    createReport.mutate(payload);
  };

  const onDalej = handleSubmit(
    (values) => {
      // `values` here is zodResolver's *parsed output* for the current step's own schema only
      // (see addListingWizard.schema.ts's STEP_SCHEMAS) — e.g. on step 5, stepReviewSchema is
      // `z.object({})`, so `values` comes back as `{}`, stripped of every other field. That's
      // fine for the `updateData` merge below (it only ever patches in what this step actually
      // owns), but publishing must read the *full* accumulated draft, not this step-scoped
      // subset — hence `useAddListingWizardStore.getState().data` (synchronously up to date
      // right after `updateData`'s `set()` call) rather than `values` itself.
      updateData(values);
      if (step < TOTAL_STEPS) {
        setStep((step + 1) as WizardStep);
        return;
      }
      const fullData = useAddListingWizardStore.getState().data;
      protectedPublish(() => publishReport(fullData));
    },
    () => shakeDalej(),
  );

  // Closes and clears the draft once the report has actually been accepted by the server —
  // deliberately not tied to the "Opublikuj" click itself, since an offline-paused mutation (see
  // StepReview.tsx's SubmitStatus) may only resolve well after that tap.
  useEffect(() => {
    if (!createReport.isSuccess) return;
    resetWizard();
    onClose();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [createReport.isSuccess]);

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
  // Once a submission has actually been attempted, StepReview.tsx takes over the full step-5
  // area with its own status screen (sending/queued-offline/success/error) — the generic
  // "Opublikuj" footer button would be redundant on top of that.
  const isSubmitting = step === TOTAL_STEPS && createReport.status !== 'idle';

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
            {step === 3 && <StepMapPin control={control} reportType={reportType} />}
            {step === 4 && <StepDetails register={register} errors={formState.errors} />}
            {step === 5 && <StepReview control={control} mutation={createReport} />}
          </motion.div>
        </AnimatePresence>

        {/* Sticky footer FAB — fixed regardless of step content length/scroll position, per spec. */}
        {!isSubmitting && (
          <div className="shrink-0 border-t border-gray-200 bg-white px-6 pb-safe pt-4">
            <motion.div animate={dalejControls}>
              <Button
                type="submit"
                size="lg"
                className="h-14 w-full rounded-full bg-coral text-base font-bold text-white shadow-sm hover:bg-coral-hover"
                disabled={step === 1 && !canProceedStep1}
              >
                {step === TOTAL_STEPS ? 'Opublikuj' : 'Dalej'}
              </Button>
            </motion.div>
          </div>
        )}
      </form>
    </div>
  );
}
