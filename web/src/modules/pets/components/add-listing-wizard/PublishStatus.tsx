import type { UseMutationResult } from '@tanstack/react-query';
import type { Pet } from '../../types/pet.types';
import type { CreatePetReportPayload } from '../../types/pet.types';

interface PublishStatusProps {
  mutation: UseMutationResult<Pet, Error, CreatePetReportPayload>;
  isFound: boolean;
}

// Offline queue UX (spec §3): once publishing has actually kicked off — directly (an
// already-logged-in user), after the shared AuthBottomSheet's deferred action fires (a guest who
// completed OTP/password/OAuth in-page), or via AddListingWizard's own resume-on-landing effect
// (a guest who completed a full-page OAuth redirect) — this renders one of four states in place
// of the wizard's step content. `isPaused` specifically means the mutation hit a network error
// and TanStack Query (networkMode: 'offlineFirst', see queryClient.ts) parked it rather than
// surfacing it as a failure — the report is safe and will resume automatically. Extracted from
// the old StepReview.tsx (V2 drops the standalone review/summary step) so every publish path
// renders the same screens, driven purely by `mutation.status`.
export function PublishStatus({ mutation, isFound }: PublishStatusProps) {
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
