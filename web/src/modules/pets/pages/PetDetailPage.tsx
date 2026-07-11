import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { isNotFoundError } from '@/lib/apiClient';
import NotFoundPage from '@/shared/pages/NotFoundPage';
import { ServerErrorPage } from '@/shared/pages/ServerErrorPage';
import { useAppUIStore } from '@/modules/app/store/useAppUIStore';
import { readFreshIntent, usePendingIntentStore } from '@/modules/auth/store/usePendingIntentStore';
import { usePetMapStore } from '../store/usePetMapStore';
import { useAppLocation } from '@/modules/location/api/useAppLocation';
import { usePet } from '../api/usePet';
import { useSightings } from '../api/useSightings';
import { distanceMeters, formatDistance, formatRelativeTime, getPetDisplayName } from '../lib/format';
import { HeroGallery } from '../components/pet-detail/HeroGallery';
import { PhotoLightbox } from '../components/pet-detail/PhotoLightbox';
import { LocationMapWidget } from '../components/pet-detail/LocationMapWidget';
import { StickyActionBar } from '../components/pet-detail/StickyActionBar';
import { ReportSightingSheet } from '../components/pet-detail/ReportSightingSheet';
import { StoryModeOverlay } from '../components/pet-detail/StoryModeOverlay';
import { SightingTimeline } from '../components/pet-detail/SightingTimeline';
import { UserAvatarIcon, ClockIcon, StarIcon } from '../components/pet-detail/icons';
import type { Pet, PetStatus } from '../types/pet.types';

// Design tokens straight from the premium-detail-page spec this page implements — deliberately
// hardcoded hex rather than the app's `bg-card`/`text-foreground` theme tokens (same call as
// BottomSheet.tsx/PetCard.tsx already make): this is a fixed light "product detail" surface, not
// something that should invert in dark mode.
const ANTHRACITE = '#222222';
const MUTED_GRAY = '#8E8E93';
const HAIRLINE_BORDER = '#E5E5E5';

const STATUS_COPY: Record<PetStatus, { verb: string; colorClass: string; accent: string }> = {
  missing: { verb: 'Zaginął', colorClass: 'text-red-600', accent: '#dc2626' },
  found: { verb: 'Widziany', colorClass: 'text-orange-500', accent: '#f97316' },
  // Reachable via a bookmarked/shared link to a report the owner has since paused or resolved —
  // GET /pets/:petId has no status filter (see pet.types.ts's PetStatus comment).
  paused: { verb: 'Wstrzymane', colorClass: 'text-neutral-500', accent: '#8E8E93' },
  resolved: { verb: 'Odnaleziony', colorClass: 'text-green-600', accent: '#22C55E' },
};

// No `ownerId`/name join exists on PetResponseDTO — same "placeholder, not real data" precedent
// as SearchModal.tsx's MOCK_RECENT_SEARCHES, kept until the backend exposes a real reporter
// identity for a pet report (comments/sightings do carry a real `author`, the report itself does
// not).
const MOCK_REPORTER_NAME = 'Janusz';

// PetResponseDTO has no free-text description field, so "O zwierzaku" is composed only from
// fields that actually exist (name/species/status/reward/city) rather than inventing behavior or
// physical attributes no report ever collected.
const STATUS_PHRASE: Record<PetStatus, string> = {
  missing: 'zaginął',
  found: 'został ostatnio widziany',
  paused: 'zaginął (poszukiwania wstrzymane)',
  resolved: 'został odnaleziony',
};

function buildPetDescription(pet: Pet): string {
  const statusPhrase = STATUS_PHRASE[pet.status];
  const cityPhrase = pet.city ? ` w ${pet.city}` : '';
  const rewardPhrase =
    pet.reward > 0 ? ` Za pomoc w odnalezieniu przewidziana jest nagroda w wysokości ${pet.reward} zł.` : '';
  return `${getPetDisplayName(pet)} to ${pet.species}, który ${statusPhrase}${cityPhrase} ${formatRelativeTime(pet.createdAt)}.${rewardPhrase} Każda wskazówka pomaga — jeśli rozpoznajesz to zwierzę, zostaw zgłoszenie widzenia poniżej.`;
}

interface StatColumnProps {
  children: React.ReactNode;
}

function StatColumn({ children }: StatColumnProps) {
  return <div className="flex flex-1 flex-col items-center justify-center gap-1 px-2 py-3">{children}</div>;
}

export default function PetDetailPage() {
  const { petId } = useParams<{ petId: string }>();
  const navigate = useNavigate();
  const openMapAt = useAppUIStore((state) => state.openMapAt);
  const selectPet = usePetMapStore((state) => state.selectPet);
  const { origin, isResolving: isLocationResolving } = useAppLocation();

  const { data: pet, isLoading, isError, error, refetch } = usePet(petId);
  const { data: sightings } = useSightings(petId);

  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [isReportSheetOpen, setIsReportSheetOpen] = useState(false);
  const [isStoryMode, setIsStoryMode] = useState(false);

  // Resume-on-landing: a guest who tapped "Zgłoś zaobserwowanie" here, then completed a
  // full-page OAuth redirect, lands back on this same pet with no in-memory state left — the
  // sheet needs to reopen itself rather than the guest having to find the button again. See
  // StickyActionBar.tsx, which sets this intent before the redirect.
  const hasCheckedResumeIntent = useRef(false);
  useEffect(() => {
    if (hasCheckedResumeIntent.current || !pet) return;
    hasCheckedResumeIntent.current = true;
    const intent = readFreshIntent();
    if (intent?.kind === 'report-sighting' && intent.petId === pet.id) {
      setIsReportSheetOpen(true);
      usePendingIntentStore.getState().clearIntent();
    }
  }, [pet]);

  const handleBack = () => navigate(-1);

  const handleOpenMap = () => {
    if (!pet) return;
    openMapAt({ label: pet.city ?? 'Wybrana lokalizacja', coords: pet.location, bbox: null });
    selectPet(pet.id);
    navigate('/app');
  };
  const handleShare = async () => {
    if (!pet) return;
    const url = `${window.location.origin}/app/pets/${pet.id}`;
    const title = `${STATUS_COPY[pet.status].verb}: ${getPetDisplayName(pet)}`;
    if (navigator.share) {
      try {
        await navigator.share({ title, text: `${title} — pomóż w poszukiwaniach!`, url });
      } catch {
        // User cancelled the native share sheet — not an error.
      }
      return;
    }
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      // Clipboard access denied — nothing more we can do here.
    }
  };

  if (isLoading) {
    return (
      <div className="flex h-[100dvh] items-center justify-center bg-white">
        <p className="text-sm text-neutral-400">Ładowanie…</p>
      </div>
    );
  }

  if (isError) {
    return isNotFoundError(error) ? <NotFoundPage /> : <ServerErrorPage onRetry={refetch} />;
  }

  if (!pet) {
    return <NotFoundPage />;
  }

  const status = STATUS_COPY[pet.status];
  // 'found' is a finder's own stray-sighting report; missing/paused/resolved are all the owner's
  // report of their own pet (paused/resolved just being later states of the same 'missing' report).
  const reporterRole = pet.status === 'found' ? 'Osoba, która znalazła' : 'Właściciel';
  const distanceLabel = isLocationResolving ? '…' : formatDistance(distanceMeters(origin, pet.location));

  return (
    <div className="flex h-[100dvh] flex-col bg-white">
      <HeroGallery
        pet={pet}
        onBack={handleBack}
        onShare={() => void handleShare()}
        onOpenLightbox={setLightboxIndex}
        onOpenStoryMode={() => setIsStoryMode(true)}
      />

      <div className="flex-1 overflow-y-auto overscroll-contain">
        {/* Metadata block */}
        <div className="px-5 pb-5 pt-5" style={{ backgroundColor: '#FFFFFF' }}>
          <h1 className="text-2xl font-bold leading-tight" style={{ color: ANTHRACITE }}>
            {status.verb}: {getPetDisplayName(pet)}
          </h1>
          <p className="mt-1 text-sm font-medium" style={{ color: MUTED_GRAY }}>
            {pet.species} • {pet.city ?? 'Nieznana okolica'}
          </p>
          <p className="mt-0.5 text-sm font-semibold" style={{ color: ANTHRACITE }}>
            {status.verb} {distanceLabel} od Ciebie • {formatRelativeTime(pet.createdAt)}
          </p>

          <div className="mt-4 flex divide-x divide-neutral-200 rounded-2xl">
            <StatColumn>
              <span className={`text-sm font-bold ${status.colorClass}`}>{status.verb}</span>
            </StatColumn>
            <StatColumn>
              <span className="flex items-center gap-1.5 text-sm font-semibold" style={{ color: ANTHRACITE }}>
                <ClockIcon />
                {formatRelativeTime(pet.createdAt)}
              </span>
            </StatColumn>
            <StatColumn>
              <span className="flex items-center gap-1.5 text-sm font-semibold" style={{ color: ANTHRACITE }}>
                <StarIcon />
                Zweryfikowane
              </span>
            </StatColumn>
          </div>
        </div>

        {/* Owner / reporter section */}
        <div className="flex items-center gap-3 border-t px-5 py-4" style={{ borderColor: HAIRLINE_BORDER }}>
          <span
            className="flex size-12 shrink-0 items-center justify-center rounded-full bg-neutral-100"
            style={{ color: MUTED_GRAY }}
          >
            <UserAvatarIcon />
          </span>
          <div className="flex flex-col">
            <span className="text-sm font-bold" style={{ color: ANTHRACITE }}>
              Zgłoszone przez: {MOCK_REPORTER_NAME}
            </span>
            <span className="text-xs" style={{ color: MUTED_GRAY }}>
              {reporterRole} • Aktywny teraz
            </span>
          </div>
        </div>

        {/* Geolocation widget */}
        <div className="border-t px-5 py-5" style={{ borderColor: HAIRLINE_BORDER }}>
          <LocationMapWidget pet={pet} onOpenMap={handleOpenMap} />
          <p className="mt-2.5 text-xs" style={{ color: MUTED_GRAY }}>
            {status.verb}{' '}
            {pet.city
              ? `w okolicach ${pet.city}`
              : `w okolicach ${pet.location.lat.toFixed(3)}, ${pet.location.lng.toFixed(3)}`}
          </p>
        </div>

        {/* Description */}
        <div className="border-t px-5 py-5" style={{ borderColor: HAIRLINE_BORDER }}>
          <h2 className="mb-2 text-lg font-bold" style={{ color: ANTHRACITE }}>
            O zwierzaku
          </h2>
          <p className="text-sm leading-relaxed" style={{ color: '#4A4A4A' }}>
            {buildPetDescription(pet)}
          </p>
        </div>

        <SightingTimeline petId={pet.id} sightings={sightings} accentColor={status.accent} />
      </div>

      <StickyActionBar
        pet={pet}
        onReportSighting={() => setIsReportSheetOpen(true)}
        onShare={() => void handleShare()}
      />

      {lightboxIndex !== null && (
        <PhotoLightbox
          photos={pet.photoUrls}
          startIndex={lightboxIndex}
          altText={getPetDisplayName(pet)}
          onClose={() => setLightboxIndex(null)}
        />
      )}

      {isReportSheetOpen && (
        <ReportSightingSheet petId={pet.id} initialCenter={pet.location} onClose={() => setIsReportSheetOpen(false)} />
      )}

      {isStoryMode && <StoryModeOverlay pet={pet} onClose={() => setIsStoryMode(false)} />}
    </div>
  );
}
