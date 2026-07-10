import { useEffect, useRef } from 'react';
import { useForm, type Resolver } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { AnimatePresence, motion, useAnimationControls } from 'framer-motion';
import { Button } from '@/shared/ui';
import { useAuthStore } from '@/modules/auth/store/useAuthStore';
import { useProtectedAction } from '@/modules/auth/hooks/useProtectedAction';
import { readFreshIntent, usePendingIntentStore } from '@/modules/auth/store/usePendingIntentStore';
import { useCreatePetReport } from '../../api/usePets';
import { PET_TYPE_LABELS } from '../../lib/petType';
import type { CreatePetReportPayload } from '../../types/pet.types';
import { useAddListingWizardStore, type AddListingWizardData, type WizardStep } from '../../store/useAddListingWizardStore';
import { STEP_SCHEMAS, stepDetailsFoundSchema, stepDetailsLostSchema } from './addListingWizard.schema';
import { StepFork } from './StepFork';
import { StepPhoto } from './StepPhoto';
import { StepMapPin } from './StepMapPin';
import { StepDetails } from './StepDetails';
import { PublishStatus } from './PublishStatus';

const TOTAL_STEPS = 4;

interface AddListingWizardProps {
  onClose: () => void;
}

// A single resolver instance, reading the *current* step (and, for step 4, reportType) off the
// store at validation time — rather than useForm being re-created per step — is what keeps RHF's
// own dirty-field tracking and values intact across back/forth navigation. z.object() schemas
// ignore keys they don't declare, so running e.g. stepForkSchema against the full multi-step
// values object only ever validates `reportType`. Step 4 has no single entry in STEP_SCHEMAS
// (unlike steps 1-3) since it needs reportType to pick between stepDetailsLostSchema and
// stepDetailsFoundSchema (V2 spec's "dynamic form split") — reportType is read from `data`, not
// `values`, because it's reliably already committed by step 1's auto-advance (see StepFork.tsx)
// well before step 4 is ever reachable.
const stepAwareResolver: Resolver<AddListingWizardData> = (values, context, options) => {
  const { step, data } = useAddListingWizardStore.getState();
  const schema =
    step === 4 ? (data.reportType === 'found' ? stepDetailsFoundSchema : stepDetailsLostSchema) : STEP_SCHEMAS[step];
  return zodResolver(schema)(values, context, options);
};

// Production entry point for filing a new report (both "lost" and "found" — see StepFork.tsx).
// V2: step 1 auto-advances (no "Dalej" there), step 2's photo gallery is mandatory, step 3 gains
// address search, and step 4 (details + contact) is the wizard's last visible step — its
// "Weryfikuj i opublikuj" button either publishes immediately (already-authed user) or runs the
// same useProtectedAction/AuthBottomSheet guard used everywhere else in the app (OTP pre-filled
// with the phone/email already collected on step 4, or Google/Facebook OAuth) — there's no
// separate review/summary step and no wizard-local auth modal.
export function AddListingWizard({ onClose }: AddListingWizardProps) {
  const step = useAddListingWizardStore((state) => state.step);
  const data = useAddListingWizardStore((state) => state.data);
  const setStep = useAddListingWizardStore((state) => state.setStep);
  const updateData = useAddListingWizardStore((state) => state.updateData);
  const resetWizard = useAddListingWizardStore((state) => state.reset);
  const currentUser = useAuthStore((state) => state.currentUser);
  const isSessionLoading = useAuthStore((state) => state.isLoading);
  const runProtected = useProtectedAction();
  const createReport = useCreatePetReport();
  const dalejControls = useAnimationControls();

  const form = useForm<AddListingWizardData>({
    resolver: stepAwareResolver,
    defaultValues: data,
    mode: 'onSubmit',
  });
  const { control, register, handleSubmit, watch, formState } = form;

  const reportType = watch('reportType');
  const photos = watch('photos');
  const canProceedStep2 = photos.length > 0;

  const shakeDalej = () => {
    void dalejControls.start({ x: [0, -8, 8, -8, 8, 0], transition: { duration: 0.4 } });
  };

  const publishReport = (values: AddListingWizardData) => {
    const isFound = values.reportType === 'found';
    const payload: CreatePetReportPayload = {
      name: isFound ? undefined : values.name,
      species: PET_TYPE_LABELS[values.petType!],
      status: isFound ? 'found' : 'missing',
      location: values.location,
      reward: isFound ? 0 : values.reward,
      phone: values.phone || undefined,
      email: values.email || undefined,
      distinguishingMarks: values.distinguishingMarks || undefined,
      photoBase64s: values.photos,
    };
    // Fire-and-forget `.mutate` — the mutation itself may pause offline and resolve much later
    // (see queryClient.ts's `networkMode: 'offlineFirst'`); PublishStatus reacts to that whenever
    // it happens, independent of this call site.
    createReport.mutate(payload);
  };

  const onDalej = handleSubmit(
    (values) => {
      updateData(values);
      if (step < TOTAL_STEPS) {
        setStep((step + 1) as WizardStep);
        return;
      }
      const fullData = useAddListingWizardStore.getState().data;
      if (currentUser) {
        publishReport(fullData);
        return;
      }
      // Prefer email as the OTP identifier when both are filled (confirmed product decision).
      const identifier = fullData.email.trim() || fullData.phone.trim();
      // resumeIntent: a full-page OAuth redirect wipes this closure entirely — AppShell.tsx
      // reopens this modal on landing back, and the resume effect below replays the actual
      // publish call once this component remounts with a session and can see the intent again.
      runProtected(() => publishReport(useAddListingWizardStore.getState().data), {
        prefillIdentifier: identifier || undefined,
        resumeIntent: { kind: 'wizard-publish', returnPath: '/app' },
      });
    },
    () => shakeDalej(),
  );

  // Closes and clears the draft once the report has actually been accepted by the server —
  // deliberately not tied to any single click, since an offline-paused mutation (see
  // PublishStatus.tsx) may only resolve well after that tap, and the guest path publishes via
  // runProtected's deferred action (in-page) or the resume effect below (after an OAuth redirect).
  useEffect(() => {
    if (!createReport.isSuccess) return;
    resetWizard();
    onClose();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [createReport.isSuccess]);

  // Resume-on-landing: after a real OAuth redirect, this component remounts with no memory of
  // the in-flight publish attempt — AppShell's own effect reopens the modal once it sees a
  // 'wizard-publish' intent, and this effect is what actually replays the publish call, once a
  // session exists and the persisted draft (still on step 4) is available again. Waits for
  // isSessionLoading to resolve so it doesn't fire on the "not logged in yet" flash before
  // SessionBootstrap's GET /auth/me settles.
  const hasCheckedResumeIntent = useRef(false);
  useEffect(() => {
    if (hasCheckedResumeIntent.current || isSessionLoading) return;
    hasCheckedResumeIntent.current = true;
    if (!currentUser || step !== TOTAL_STEPS || createReport.status !== 'idle') return;
    const intent = readFreshIntent();
    if (intent?.kind !== 'wizard-publish') return;
    usePendingIntentStore.getState().clearIntent();
    publishReport(useAddListingWizardStore.getState().data);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSessionLoading, currentUser, step, createReport.status]);

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
  // Once a submission has actually been attempted — already-authed user, or guest after
  // AuthBottomSheet's deferred action fires — PublishStatus takes over the full step-4 area with
  // its own status screen (sending/queued-offline/success/error); the generic "Weryfikuj i
  // opublikuj" footer button would be redundant on top of that. Driven purely by
  // createReport.status, so it doesn't matter which path (already-authed, in-page OTP/password,
  // or an OAuth-redirect resume) triggered the publish call.
  const isPublishing = step === TOTAL_STEPS && createReport.status !== 'idle';

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
            {isPublishing ? (
              <PublishStatus mutation={createReport} isFound={reportType === 'found'} />
            ) : (
              <>
                {step === 1 && <StepFork control={control} onAutoAdvance={(value) => { updateData({ reportType: value }); setStep(2); }} />}
                {step === 2 && <StepPhoto control={control} />}
                {step === 3 && <StepMapPin control={control} reportType={reportType} />}
                {step === 4 && <StepDetails register={register} errors={formState.errors} reportType={reportType} />}
              </>
            )}
          </motion.div>
        </AnimatePresence>

        {/* Sticky footer FAB — fixed regardless of step content length/scroll position, per spec.
            No button at all on step 1 (auto-advance, see StepFork.tsx's onAutoAdvance). */}
        {!isPublishing && step !== 1 && (
          <div className="shrink-0 border-t border-gray-200 bg-white px-6 pb-safe pt-4">
            <motion.div animate={dalejControls}>
              <Button
                type="submit"
                size="lg"
                className="h-14 w-full rounded-full bg-coral text-base font-bold text-white shadow-sm hover:bg-coral-hover"
                disabled={step === 2 && !canProceedStep2}
              >
                {step === TOTAL_STEPS ? 'Weryfikuj i opublikuj' : 'Dalej'}
              </Button>
            </motion.div>
          </div>
        )}
      </form>
    </div>
  );
}
