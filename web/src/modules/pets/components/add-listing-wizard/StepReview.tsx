import { useWatch, type Control } from 'react-hook-form';
import type { UseMutationResult } from '@tanstack/react-query';
import { Map } from '@/shared/components/map';
import { PET_TYPE_LABELS } from '../../lib/petType';
import type { AddListingWizardData } from '../../store/useAddListingWizardStore';
import type { Pet } from '../../types/pet.types';
import type { CreatePetReportPayload } from '../../types/pet.types';

interface StepReviewProps {
  control: Control<AddListingWizardData>;
  mutation: UseMutationResult<Pet, Error, CreatePetReportPayload>;
}

// Step 5 — the wizard's final "everything is ready, one tap to publish" summary (spec: Ghost
// Account flow's conversion moment). Purely read-only; the actual "Opublikuj" action lives in
// AddListingWizard.tsx's sticky footer button (same one every other step already uses for
// "Dalej"), which on this step is wrapped in `useProtectedAction()` — so a guest sees
// AuthBottomSheet's OTP flow first, and this same handler re-fires automatically the instant
// verification succeeds, without a second tap.
export function StepReview({ control, mutation }: StepReviewProps) {
  const values = useWatch({ control });
  const isFound = values.reportType === 'found';

  // Once the mutation actually succeeds (which — thanks to TanStack Query's offlineFirst +
  // paused-mutation persistence, see queryClient.ts/AppProviders.tsx — may happen long after the
  // user tapped "Opublikuj", even after a reload if it was paused offline), there's nothing left
  // for this screen to show; AddListingWizard.tsx's own effect handles closing/resetting.
  if (mutation.status !== 'idle') {
    return <SubmitStatus mutation={mutation} isFound={isFound} />;
  }

  return (
    <div className="flex flex-1 flex-col gap-6 px-6 pt-2">
      <div className="flex flex-col gap-2">
        <h1 className="text-xl font-bold text-ink sm:text-2xl">Podsumowanie</h1>
        <p className="text-sm text-subtle">
          Sprawdź zgłoszenie przed publikacją — wystarczy jeden klik.
        </p>
      </div>

      {values.photo && (
        <div className="aspect-video w-full overflow-hidden rounded-2xl shadow-sm">
          <img src={values.photo} alt="Podgląd zdjęcia zwierzaka" className="size-full object-cover" />
        </div>
      )}

      {values.location?.lat !== undefined && values.location?.lng !== undefined && (
        <div className="h-40 w-full overflow-hidden rounded-2xl shadow-sm">
          <Map
            center={{ lat: values.location.lat, lng: values.location.lng }}
            zoom={14}
            className="size-full"
            markers={[
              {
                id: 'review-pin',
                position: { lat: values.location.lat, lng: values.location.lng },
                emoji: isFound ? '🐾' : '😿',
                freshness: isFound ? 'Znaleziono tutaj' : 'Zaginął tutaj',
                tone: isFound ? 'warning' : 'danger',
              },
            ]}
          />
        </div>
      )}

      <dl className="flex flex-col divide-y divide-gray-100 rounded-2xl border border-gray-200 bg-white shadow-sm">
        <ReviewRow label="Status" value={isFound ? 'Znalezione' : 'Zaginione'} />
        <ReviewRow label="Imię" value={values.name || '—'} />
        <ReviewRow label="Rodzaj" value={values.petType ? PET_TYPE_LABELS[values.petType] : '—'} />
        <ReviewRow label="Opis" value={values.description || '—'} />
        <ReviewRow label="Znaki szczególne" value={values.distinguishingMarks || '—'} />
        <ReviewRow label="Telefon kontaktowy" value={values.phone || '—'} />
        <ReviewRow label="Nagroda" value={values.reward ? `${values.reward} zł` : 'Brak'} />
      </dl>
    </div>
  );
}

function ReviewRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4 px-5 py-3.5">
      <dt className="text-sm text-subtle">{label}</dt>
      <dd className="max-w-[60%] text-right text-sm font-medium text-ink">{value}</dd>
    </div>
  );
}

// Offline queue UX (spec §3): once "Opublikuj" has actually been tapped, this replaces the
// summary with one of three states. `isPaused` specifically means the mutation hit a network
// error and TanStack Query (networkMode: 'offlineFirst', see queryClient.ts) parked it rather
// than surfacing it as a failure — the report is safe and will resume automatically.
function SubmitStatus({
  mutation,
  isFound,
}: {
  mutation: UseMutationResult<Pet, Error, CreatePetReportPayload>;
  isFound: boolean;
}) {
  if (mutation.isPaused) {
    return (
      <StatusScreen
        emoji="📡"
        title="Mamy Twoje zgłoszenie!"
        message="Wyślemy je automatycznie, gdy tylko złapiesz lepszy zasięg. Możesz schować telefon."
      />
    );
  }

  if (mutation.isSuccess) {
    return (
      <StatusScreen
        emoji="🎉"
        title="Zgłoszenie opublikowane!"
        message={isFound ? 'Dziękujemy — pomożesz połączyć zwierzaka z właścicielem.' : 'Powiadomimy Cię, gdy ktoś zostawi wskazówkę.'}
      />
    );
  }

  if (mutation.isError) {
    return (
      <StatusScreen
        emoji="⚠️"
        title="Coś poszło nie tak"
        message="Nie udało się wysłać zgłoszenia. Spróbuj ponownie za chwilę."
      />
    );
  }

  return <StatusScreen emoji="⏳" title="Wysyłanie…" message="Publikujemy Twoje zgłoszenie." />;
}

function StatusScreen({ emoji, title, message }: { emoji: string; title: string; message: string }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6 text-center">
      <span className="text-5xl">{emoji}</span>
      <h1 className="text-xl font-bold text-ink sm:text-2xl">{title}</h1>
      <p className="max-w-xs text-sm text-subtle">{message}</p>
    </div>
  );
}
