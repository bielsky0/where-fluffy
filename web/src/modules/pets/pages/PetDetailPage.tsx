import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { usePets } from '../api/usePets';
import { useSightings } from '../api/useSightings';
import { DEFAULT_CENTER } from '../lib/geo';
import { formatRelativeTime, formatTimelineTimestamp } from '../lib/format';
import type { Pet, PetStatus } from '../types/pet.types';

// Design tokens straight from the premium-detail-page spec this page implements —
// deliberately hardcoded hex rather than the app's `bg-card`/`text-foreground` theme tokens
// (same call as SearchModal.tsx/BottomSheet.tsx already make): this is a fixed light "product
// detail" surface, not something that should invert in dark mode.
const ANTHRACITE = '#222222';
const MUTED_GRAY = '#8E8E93';
const HAIRLINE_BORDER = '#E5E5E5';
const CORAL = '#FF6B4A';

const STATUS_COPY: Record<PetStatus, { verb: string; colorClass: string; accent: string }> = {
  missing: { verb: 'Zaginął', colorClass: 'text-red-600', accent: '#dc2626' },
  found: { verb: 'Widziany', colorClass: 'text-orange-500', accent: '#f97316' },
};

// No `ownerId`/name join exists on PetResponseDTO (see pet.types.ts's own comment on why it's
// hand-mirrored rather than shared) — same "placeholder, not real data" precedent as
// SearchModal.tsx's MOCK_RECENT_SEARCHES, kept until the backend exposes a real reporter
// identity for a pet report (comments/sightings do carry a real `author`, the report itself
// does not).
const MOCK_REPORTER_NAME = 'Janusz';

// PetResponseDTO has no free-text description field, so "O zwierzaku" is composed only from
// fields that actually exist (name/species/status/reward) rather than inventing behavior or
// physical attributes no report ever collected.
function buildPetDescription(pet: Pet): string {
  const statusPhrase = pet.status === 'missing' ? 'zaginął' : 'został ostatnio widziany';
  const rewardPhrase = pet.reward > 0 ? ` Za pomoc w odnalezieniu przewidziana jest nagroda w wysokości ${pet.reward} zł.` : '';
  return `${pet.name} to ${pet.species}, który ${statusPhrase} ${formatRelativeTime(pet.createdAt)}.${rewardPhrase} Każda wskazówka pomaga — jeśli rozpoznajesz to zwierzę, zostaw zgłoszenie widzenia poniżej.`;
}

function BackArrowIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="size-5" aria-hidden="true">
      <path d="m15 18-6-6 6-6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ShareIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="size-[18px]" aria-hidden="true">
      <path
        d="M12 3v12M12 3l4 4M12 3 8 7M5 13v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function HeartIcon({ filled }: { filled: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill={filled ? 'currentColor' : 'none'}
      stroke="currentColor"
      strokeWidth={filled ? 0 : 2}
      className={filled ? 'size-[18px] text-rose-600' : 'size-[18px]'}
      aria-hidden="true"
    >
      <path
        d="M12 20.5s-7.5-4.6-10-9.3C.4 7.8 2 4.5 5.4 4a5 5 0 0 1 6.6 2.4A5 5 0 0 1 18.6 4c3.4.5 5 3.8 3.4 7.2-2.5 4.7-10 9.3-10 9.3Z"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ClockIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="size-3.5" aria-hidden="true">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3.5 2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function StarIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" stroke="none" className="size-3.5" aria-hidden="true">
      <path d="M12 2.5l2.9 6 6.6.7-4.9 4.5 1.3 6.5-5.9-3.3-5.9 3.3 1.3-6.5-4.9-4.5 6.6-.7Z" />
    </svg>
  );
}

function UserAvatarIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="size-6" aria-hidden="true">
      <circle cx="12" cy="8" r="3.5" />
      <path d="M4.5 20c1.6-3.7 5-5.5 7.5-5.5s5.9 1.8 7.5 5.5" strokeLinecap="round" />
    </svg>
  );
}

function ChatBubbleIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="size-5" aria-hidden="true">
      <path
        d="M4 12c0-4.4 3.8-8 8.5-8S21 7.6 21 12s-3.8 8-8.5 8c-1 0-1.9-.2-2.8-.5L4 21l1.4-4.1C4.5 15.6 4 13.9 4 12Z"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function PinIcon({ color }: { color: string }) {
  return (
    <svg viewBox="0 0 24 24" width={28} height={28} aria-hidden="true">
      <path
        d="M12 2C7.6 2 4 5.6 4 10c0 6 8 12 8 12s8-6 8-12c0-4.4-3.6-8-8-8Z"
        fill={color}
        stroke="white"
        strokeWidth={1.5}
      />
      <circle cx="12" cy="10" r="3" fill="white" />
    </svg>
  );
}

// Full-bleed image carousel, always touching the device's top/left/right edges (no page
// header above it — see PetDetailPage's own layout). PetResponseDTO has no photo field at all
// (same gap PetCard.tsx's own PetImage placeholder already documents), so this renders a fixed
// set of neutral placeholder slides rather than pointing <img> at a URL that doesn't exist —
// the "1 / 3" pagination pill reflects that placeholder count, not a real photo total.
const HERO_SLIDE_COUNT = 3;

function HeroCarousel({ pet, onBack }: { pet: Pet; onBack: () => void }) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [favorited, setFavorited] = useState(false);

  const handleScroll = (event: React.UIEvent<HTMLDivElement>) => {
    const { scrollLeft, clientWidth } = event.currentTarget;
    if (clientWidth === 0) return;
    setActiveIndex(Math.round(scrollLeft / clientWidth));
  };

  return (
    <div className="relative h-[42vh] w-full shrink-0 bg-neutral-100">
      <div
        onScroll={handleScroll}
        className="flex h-full w-full snap-x snap-mandatory overflow-x-auto scroll-smooth overscroll-contain"
      >
        {Array.from({ length: HERO_SLIDE_COUNT }, (_, index) => (
          <div
            key={index}
            className="flex h-full w-full shrink-0 snap-start items-center justify-center bg-neutral-100"
            aria-hidden={index !== activeIndex}
          >
            <span className="text-8xl font-bold text-neutral-300">{pet.name.charAt(0).toUpperCase()}</span>
          </div>
        ))}
      </div>

      <div className="absolute inset-x-0 top-0 flex items-center justify-between p-4 pt-safe">
        <button
          type="button"
          onClick={onBack}
          aria-label="Wstecz"
          className="flex size-10 items-center justify-center rounded-full bg-white text-black shadow-[0_4px_14px_-4px_rgba(0,0,0,0.35)]"
        >
          <BackArrowIcon />
        </button>
        <div className="flex items-center gap-2">
          <button
            type="button"
            aria-label="Udostępnij"
            className="flex size-10 items-center justify-center rounded-full bg-white text-black shadow-[0_4px_14px_-4px_rgba(0,0,0,0.35)]"
          >
            <ShareIcon />
          </button>
          <button
            type="button"
            onClick={() => setFavorited((prev) => !prev)}
            aria-pressed={favorited}
            aria-label={favorited ? 'Usuń z ulubionych' : 'Dodaj do ulubionych'}
            className="flex size-10 items-center justify-center rounded-full bg-white text-black shadow-[0_4px_14px_-4px_rgba(0,0,0,0.35)]"
          >
            <HeartIcon filled={favorited} />
          </button>
        </div>
      </div>

      <div className="absolute bottom-3 right-3 rounded-full bg-black/60 px-2.5 py-1 text-xs font-semibold text-white backdrop-blur-sm">
        {activeIndex + 1} / {HERO_SLIDE_COUNT}
      </div>
    </div>
  );
}

interface StatColumnProps {
  children: React.ReactNode;
}

function StatColumn({ children }: StatColumnProps) {
  return <div className="flex flex-1 flex-col items-center justify-center gap-1 px-2 py-3">{children}</div>;
}

// A stylized SVG placeholder, not a real tile-fetching map — this widget's job is "show a
// radius around a point," and pulling in the real Leaflet <Map/> (shared/components/map) would
// mean fetching OpenStreetMap tiles over the network, which the "no external URLs/assets"
// constraint on this page rules out. The real interactive map lives on MapExplorerPage; this is
// deliberately just a glanceable preview.
function LocationMapWidget({ pet }: { pet: Pet }) {
  const accent = STATUS_COPY[pet.status].accent;
  return (
    <div className="relative h-[200px] w-full overflow-hidden rounded-2xl bg-[#EDEDED]">
      <svg viewBox="0 0 400 200" className="absolute inset-0 size-full" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
        <rect width="400" height="200" fill="#EDEDED" />
        <g stroke="#D9D9D9" strokeWidth="2">
          <line x1="0" y1="55" x2="400" y2="55" />
          <line x1="0" y1="150" x2="400" y2="150" />
          <line x1="85" y1="0" x2="85" y2="200" />
          <line x1="225" y1="0" x2="225" y2="200" />
          <line x1="330" y1="0" x2="330" y2="200" />
        </g>
        <circle cx="200" cy="100" r="72" fill={accent} fillOpacity="0.18" />
        <circle cx="200" cy="100" r="72" fill="none" stroke={accent} strokeOpacity="0.45" strokeWidth="1.5" />
      </svg>
      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-full">
        <PinIcon color={accent} />
      </div>
    </div>
  );
}

export default function PetDetailPage() {
  const { petId } = useParams<{ petId: string }>();
  const navigate = useNavigate();

  // There is no GET /pets/:id endpoint (only /pets/nearby, see CLAUDE.md) — this reuses the
  // same nearby query MainFeedPage already runs (same params, so the same TanStack Query
  // cache entry) and finds the requested pet client-side, rather than inventing a single-pet
  // fetch the backend doesn't support.
  const { data: pets, isLoading, isError } = usePets({ ...DEFAULT_CENTER, radius: 5000 });
  const pet = pets?.find((candidate) => candidate.id === petId) ?? null;

  const { data: sightings } = useSightings(petId);

  const handleBack = () => navigate(-1);

  // Starting a specific chat room requires {petId, finderId} (see chat.service.ts's
  // joinChatRoom) — finderId isn't resolvable from a Pet alone (no owner/finder identity is
  // exposed on PetResponseDTO), so this opens the chat list rather than faking a join into a
  // room that doesn't exist yet.
  const handleContact = () => navigate('/app/chat');

  if (isLoading) {
    return (
      <div className="flex h-[100dvh] items-center justify-center bg-white">
        <p className="text-sm text-neutral-400">Ładowanie…</p>
      </div>
    );
  }

  if (isError || !pet) {
    return (
      <div className="flex h-[100dvh] flex-col items-center justify-center gap-3 bg-white px-6 text-center">
        <p className="text-sm text-neutral-400">Nie udało się znaleźć tego zgłoszenia.</p>
        <button type="button" onClick={handleBack} className="text-sm font-semibold underline" style={{ color: ANTHRACITE }}>
          Wróć
        </button>
      </div>
    );
  }

  const status = STATUS_COPY[pet.status];
  const reporterRole = pet.status === 'missing' ? 'Właściciel' : 'Osoba, która znalazła';

  return (
    <div className="flex h-[100dvh] flex-col bg-white">
      <HeroCarousel pet={pet} onBack={handleBack} />

      <div className="flex-1 overflow-y-auto overscroll-contain">
        {/* Metadata block */}
        <div className="px-5 pb-5 pt-5" style={{ backgroundColor: '#FFFFFF' }}>
          <h1 className="text-2xl font-bold leading-tight" style={{ color: ANTHRACITE }}>
            {status.verb}: {pet.name}
          </h1>
          <p className="mt-1 text-sm font-medium" style={{ color: MUTED_GRAY }}>
            {pet.species} • Warszawa, Śródmieście
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
          <LocationMapWidget pet={pet} />
          <p className="mt-2.5 text-xs" style={{ color: MUTED_GRAY }}>
            {status.verb} w okolicach {pet.location.lat.toFixed(3)}, {pet.location.lng.toFixed(3)}
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

        {/* Sighting timeline */}
        <div className="border-t px-5 py-5" style={{ borderColor: HAIRLINE_BORDER }}>
          <h2 className="mb-4 text-lg font-bold" style={{ color: ANTHRACITE }}>
            Historia zgłoszeń
          </h2>
          {!sightings || sightings.length === 0 ? (
            <p className="text-sm" style={{ color: MUTED_GRAY }}>
              Brak zgłoszeń widzenia — bądź pierwszą osobą, która doda wskazówkę.
            </p>
          ) : (
            <ol className="relative flex flex-col gap-5 border-l" style={{ borderColor: HAIRLINE_BORDER }}>
              {sightings.map((sighting) => (
                <li key={sighting.id} className="relative pl-5">
                  <span
                    className="absolute -left-[5px] top-1 size-2.5 rounded-full border-2 border-white"
                    style={{ backgroundColor: status.accent }}
                    aria-hidden="true"
                  />
                  <p className="text-sm" style={{ color: ANTHRACITE }}>
                    <span className="font-semibold">{formatTimelineTimestamp(sighting.timestamp)}</span> – {sighting.description}
                  </p>
                </li>
              ))}
            </ol>
          )}
        </div>
      </div>

      {/* Sticky footer action bar */}
      <div
        className="flex shrink-0 items-center justify-between gap-3 border-t bg-white px-5 py-4 pb-safe"
        style={{ borderColor: HAIRLINE_BORDER }}
      >
        <div className="flex flex-col">
          <span className="text-xs" style={{ color: MUTED_GRAY }}>
            Nagroda za odnalezienie
          </span>
          <span className="text-2xl font-extrabold" style={{ color: '#000000' }}>
            {pet.reward > 0 ? `${pet.reward} zł` : 'Brak nagrody'}
          </span>
        </div>
        <button
          type="button"
          onClick={handleContact}
          className="flex items-center gap-2 rounded-full px-7 py-3.5 text-white transition-transform active:scale-95"
          style={{ backgroundColor: CORAL, boxShadow: `0 6px 18px -6px ${CORAL}99` }}
        >
          <ChatBubbleIcon />
          <span className="text-[15px] font-bold">Skontaktuj się</span>
        </button>
      </div>
    </div>
  );
}
