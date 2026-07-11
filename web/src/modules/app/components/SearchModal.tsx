import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { toast } from 'sonner';
import { useVirtualKeyboardVisible } from '@/shared/lib/useVirtualKeyboard';
import { cn } from '@/shared/lib/cn';
import { useLocationSearch } from '@/modules/geocode/api/useLocationSearch';
import { useAppLocation } from '@/modules/location/api/useAppLocation';
import type { GeocodeResult } from '@/modules/geocode/types/geocode.types';
import { PET_TYPE_LABELS, type PetTypeFilter } from '@/modules/pets/lib/petType';
import { TIMEFRAME_LABELS, type TimeframeFilter } from '@/modules/pets/lib/timeframe';
import type { PublicPetStatus } from '@/modules/pets/types/pet.types';
import { useAppUIStore } from '../store/useAppUIStore';

// Same spring across the header's sliding underline and the footer's keyboard-avoidance slide —
// reserved for continuous/interruptible interactions. The root<->drill-down navigation below
// uses its own SCREEN_TRANSITION instead: a full-screen slide-in is a one-shot, non-interruptible
// "new screen arrives" event, and the spec's literal "0.3s ease-out" isn't reproducible by a
// fixed spring (springs have a settle time that varies with distance, not a fixed duration).
const SPRING = { type: 'spring', damping: 30, stiffness: 320 } as const;
const SCREEN_TRANSITION = { duration: 0.3, ease: 'easeOut' } as const;

// Design tokens straight from the Airbnb-style spec this modal implements — deliberately
// hardcoded hex rather than the app's `bg-card`/`text-foreground` theme tokens (same call as
// BottomSheet.tsx/PetCard.tsx already make): this surface is a fixed light "premium" card
// stack that must look identical in light and dark mode, not something that should invert.
const ANTHRACITE = '#222222';
const MUTED_GRAY = '#8E8E93';
const HAIRLINE_BORDER = '#E5E5E5';
const LOST_RED = '#FF3B30';
const SIGHTED_YELLOW = '#FFC107';
// Sits clearly apart from both LOST_RED (warm) and SIGHTED_YELLOW on the hue wheel so "Obie"
// reads as a calm, neutral third option rather than a blend of the other two.
const BOTH_TEAL = '#3D8B8B';
const CORAL = '#FF6B4A';

const MIN_LOCATION_QUERY_LENGTH = 2;

const TIMEFRAME_OPTIONS = Object.keys(TIMEFRAME_LABELS) as TimeframeFilter[];

type StatusOption = PublicPetStatus | 'both';
const STATUS_OPTIONS: StatusOption[] = ['missing', 'both', 'found'];
const STATUS_LABELS: Record<StatusOption, string> = {
  missing: 'Zaginione',
  both: 'Obie',
  found: 'Widziane',
};
const STATUS_DOT_COLOR: Record<StatusOption, string> = {
  missing: LOST_RED,
  both: BOTH_TEAL,
  found: SIGHTED_YELLOW,
};

function CloseIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="size-4" aria-hidden="true">
      <path d="M18 6 6 18M6 6l12 12" strokeLinecap="round" />
    </svg>
  );
}

function ChevronLeftIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="size-5" aria-hidden="true">
      <path d="m15 18-6-6 6-6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function CatIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="size-8" aria-hidden="true">
      <path d="M4 9 7 4l2 4M20 9l-3-5-2 4" strokeLinecap="round" strokeLinejoin="round" />
      <rect x="4" y="9" width="16" height="11" rx="6" />
      <circle cx="9" cy="15" r="0.8" fill="currentColor" stroke="none" />
      <circle cx="15" cy="15" r="0.8" fill="currentColor" stroke="none" />
    </svg>
  );
}

function DogIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="size-8" aria-hidden="true">
      <path d="M5 9c-1.5 0-2.5 2-1.5 4l1.5 3M19 9c1.5 0 2.5 2 1.5 4l-1.5 3" strokeLinecap="round" strokeLinejoin="round" />
      <rect x="5" y="8" width="14" height="11" rx="6" />
      <circle cx="9.5" cy="14" r="0.8" fill="currentColor" stroke="none" />
      <circle cx="14.5" cy="14" r="0.8" fill="currentColor" stroke="none" />
      <path d="M11 17h2" strokeLinecap="round" />
    </svg>
  );
}

function PawIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" stroke="none" className="size-8" aria-hidden="true">
      <circle cx="7" cy="8" r="2" />
      <circle cx="12" cy="6" r="2" />
      <circle cx="17" cy="8" r="2" />
      <path d="M12 11c-3.5 0-6 2.7-6 5.2 0 1.8 1.4 3 3.2 3 1 0 1.7-.5 2.8-.5s1.8.5 2.8.5c1.8 0 3.2-1.2 3.2-3 0-2.5-2.5-5.2-6-5.2Z" />
    </svg>
  );
}

const PET_TYPE_ICONS: Record<PetTypeFilter, () => JSX.Element> = {
  cat: CatIcon,
  dog: DogIcon,
  other: PawIcon,
};

function MagnifierIcon({ className }: { className: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className={className} aria-hidden="true">
      <circle cx="11" cy="11" r="7" />
      <path d="m21 21-4.3-4.3" strokeLinecap="round" />
    </svg>
  );
}

function NavigationIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="size-5" aria-hidden="true">
      <path d="M12 2 4 20l8-4 8 4-8-18Z" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function PinIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="size-5" aria-hidden="true">
      <path d="M12 21s7-6.1 7-11.5A7 7 0 0 0 5 9.5C5 14.9 12 21 12 21Z" strokeLinejoin="round" />
      <circle cx="12" cy="9.5" r="2.2" />
    </svg>
  );
}

function ExclamationIcon({ className = 'size-3.5' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className={className} aria-hidden="true">
      <path d="M12 4v10" strokeLinecap="round" />
      <circle cx="12" cy="18.5" r="1" fill="currentColor" stroke="none" />
    </svg>
  );
}

function EyeIcon({ className = 'size-3.5' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className={className} aria-hidden="true">
      <path d="M2 12s3.5-6.5 10-6.5S22 12 22 12s-3.5 6.5-10 6.5S2 12 2 12Z" strokeLinejoin="round" />
      <circle cx="12" cy="12" r="2.5" />
    </svg>
  );
}

// The "Obie" segment's icon — a simple overlap of the lost/sighted marks (an exclamation and an
// eye, both softened) rather than inventing an unrelated third glyph, so it visually reads as
// "combination of the other two", not a fourth, unrelated status.
function BothIcon({ className = 'size-3.5' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className={className} aria-hidden="true">
      <circle cx="9" cy="12" r="6" opacity={0.55} />
      <circle cx="15" cy="12" r="6" opacity={0.55} />
    </svg>
  );
}

const STATUS_ICONS: Record<StatusOption, (props: { className?: string }) => JSX.Element> = {
  missing: ExclamationIcon,
  both: BothIcon,
  found: EyeIcon,
};

interface DrilldownHeaderProps {
  headline: string;
  onBack: () => void;
}

// Shared chrome for every full-screen drill-down (pet type / location / timeframe) — back
// chevron pops the stack back to the root screen (useAppUIStore's closeDrilldown), headline
// mirrors what AccordionCard used to render inline before the accordion->stack-nav rework.
function DrilldownHeader({ headline, onBack }: DrilldownHeaderProps) {
  return (
    <div className="flex shrink-0 items-center gap-3 p-4 pt-safe">
      <button
        type="button"
        onClick={onBack}
        aria-label="Wstecz"
        className="flex size-10 shrink-0 items-center justify-center rounded-full bg-white transition-transform active:scale-95"
        style={{ border: `1px solid ${HAIRLINE_BORDER}`, color: ANTHRACITE }}
      >
        <ChevronLeftIcon />
      </button>
      <h2 className="text-xl font-bold" style={{ color: ANTHRACITE }}>
        {headline}
      </h2>
    </div>
  );
}

interface StateRowProps {
  label: string;
  value: string;
  onClick: () => void;
}

// One of the root screen's three state-strip rows — a pure display of draft state (placeholder
// vs filled label, per useAppUIStore's draft fields) that opens the matching drill-down on tap.
// Visually identical to the old AccordionCard's collapsed bar, just without the expand-in-place
// behavior now that opening it pushes a full-screen drill-down instead.
function StateRow({ label, value, onClick }: StateRowProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center justify-between gap-2 rounded-[24px] bg-white px-5 py-4 text-left shadow-[0_8px_30px_-12px_rgba(0,0,0,0.12)] transition-transform active:scale-95"
    >
      <span className="text-sm font-medium" style={{ color: MUTED_GRAY }}>
        {label}
      </span>
      <span className="truncate text-sm font-bold" style={{ color: ANTHRACITE }}>
        {value}
      </span>
    </button>
  );
}

interface LocationScreenBodyProps {
  locationInput: string;
  onLocationInputChange: (value: string) => void;
  onLocationInputFocus: () => void;
  onLocationInputBlur: () => void;
  isLocating: boolean;
  onUseCurrentLocation: () => void;
  results: GeocodeResult[];
  isFetching: boolean;
  onSelectResult: (result: GeocodeResult) => void;
}

// Staggered fade-in for the results list — 0.05s per row, per spec — kept as its own small
// variant pair rather than touching SPRING/SCREEN_TRANSITION.
const RESULTS_LIST_VARIANTS = { visible: { transition: { staggerChildren: 0.05 } } };
const RESULT_ROW_VARIANTS = { hidden: { opacity: 0 }, visible: { opacity: 1 } };

function LocationScreenBody({
  locationInput,
  onLocationInputChange,
  onLocationInputFocus,
  onLocationInputBlur,
  isLocating,
  onUseCurrentLocation,
  results,
  isFetching,
  onSelectResult,
}: LocationScreenBodyProps) {
  const trimmedLength = locationInput.trim().length;
  const showEmptyState = trimmedLength >= MIN_LOCATION_QUERY_LENGTH && !isFetching && results.length === 0;

  return (
    <div className="flex flex-col gap-4">
      <div className="relative">
        <MagnifierIcon className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2" />
        <input
          type="text"
          value={locationInput}
          onChange={(event) => onLocationInputChange(event.target.value)}
          onFocus={onLocationInputFocus}
          onBlur={onLocationInputBlur}
          placeholder="Wyszukaj miejscowość lub ulicę"
          style={{ color: ANTHRACITE, border: `1px solid ${HAIRLINE_BORDER}` }}
          className="h-12 w-full rounded-xl bg-white pl-11 pr-4 text-sm outline-none placeholder:text-[#8E8E93] focus-visible:border-black"
        />
      </div>
      <div className="flex flex-col gap-1">
        <button
          type="button"
          onClick={onUseCurrentLocation}
          disabled={isLocating}
          className="flex items-center gap-3 rounded-2xl px-2 py-3 text-left transition-transform hover:bg-black/[0.03] active:scale-95 disabled:opacity-60"
        >
          <span
            className="flex size-11 shrink-0 items-center justify-center rounded-xl"
            style={{ backgroundColor: '#E3F2FD', color: '#1D7BE8' }}
          >
            <NavigationIcon />
          </span>
          <span className="flex flex-col">
            <span className="text-sm font-bold" style={{ color: ANTHRACITE }}>
              {isLocating ? 'Lokalizowanie…' : 'W pobliżu'}
            </span>
            <span className="text-xs" style={{ color: MUTED_GRAY }}>
              Twoja aktualna lokalizacja
            </span>
          </span>
        </button>

        {isFetching && (
          <p className="px-2 py-3 text-sm" style={{ color: MUTED_GRAY }}>
            Szukam…
          </p>
        )}
        {showEmptyState && (
          <p className="px-2 py-3 text-sm" style={{ color: MUTED_GRAY }}>
            Brak wyników
          </p>
        )}

        <motion.div initial="hidden" animate="visible" variants={RESULTS_LIST_VARIANTS} className="flex flex-col gap-1">
          {results.map((result) => (
            <motion.button
              key={`${result.lat},${result.lng}`}
              type="button"
              variants={RESULT_ROW_VARIANTS}
              onClick={() => onSelectResult(result)}
              className="flex items-center gap-3 rounded-2xl px-2 py-3 text-left transition-transform hover:bg-black/[0.03] active:scale-95"
            >
              <span
                className="flex size-11 shrink-0 items-center justify-center rounded-xl"
                style={{ backgroundColor: '#EDE9FE', color: '#7C3AED' }}
              >
                <PinIcon />
              </span>
              <span className="flex flex-col">
                <span className="text-sm font-bold" style={{ color: ANTHRACITE }}>
                  {result.label}
                </span>
              </span>
            </motion.button>
          ))}
        </motion.div>
      </div>
    </div>
  );
}

// STATE_B: the full-screen search & filter modal (mounted by MapExplorerPage.tsx, conditional
// on currentAppState === 'STATE_B'). Reads/writes useAppUIStore directly, same pattern as
// AuthModal.tsx / useAuthStore, since it has no meaningful props of its own. Stack navigation:
// the root screen (status control + 3 state-strip rows + footer) stays mounted; tapping a row
// pushes one of three full-screen drill-downs over it (modalScreen), which slides in from the
// right and pops back on commit or via its own back chevron.
export function SearchModal() {
  const modalScreen = useAppUIStore((state) => state.modalScreen);
  const draftStatus = useAppUIStore((state) => state.draftStatus);
  const draftPetType = useAppUIStore((state) => state.draftPetType);
  const draftLocation = useAppUIStore((state) => state.draftLocation);
  const draftTimeframe = useAppUIStore((state) => state.draftTimeframe);
  const closeSearch = useAppUIStore((state) => state.closeSearch);
  const openDrilldown = useAppUIStore((state) => state.openDrilldown);
  const closeDrilldown = useAppUIStore((state) => state.closeDrilldown);
  const setDraftStatus = useAppUIStore((state) => state.setDraftStatus);
  const setDraftPetType = useAppUIStore((state) => state.setDraftPetType);
  const setDraftLocation = useAppUIStore((state) => state.setDraftLocation);
  const selectDraftLocation = useAppUIStore((state) => state.selectDraftLocation);
  const setDraftTimeframe = useAppUIStore((state) => state.setDraftTimeframe);
  const clearDraftFilters = useAppUIStore((state) => state.clearDraftFilters);
  const applyFilters = useAppUIStore((state) => state.applyFilters);

  const [locationInput, setLocationInput] = useState(draftLocation?.label ?? '');
  const [isLocating, setIsLocating] = useState(false);
  const [isLocationInputFocused, setIsLocationInputFocused] = useState(false);
  const isKeyboardVisible = useVirtualKeyboardVisible();
  // Gating on focus (not just isKeyboardVisible) means "bring it back immediately when
  // blurred" doesn't have to wait on the visualViewport resize event, which can lag a beat
  // behind the blur itself.
  const hideFooter = isLocationInputFocused && isKeyboardVisible;

  const { data: locationResults = [], isFetching: isSearchingLocation } = useLocationSearch(locationInput);
  const { triggerExactLocation } = useAppLocation();

  // Bumped on every keystroke and at the start of every GPS request — the async
  // getCurrentPosition() call can take seconds, so this guards against a stale resolution
  // clobbering whatever the user has typed/tapped since (last-action-wins, not
  // last-to-resolve-wins). See useAppUIStore's LocationFilter for the shape this feeds.
  const locationRequestId = useRef(0);

  // "Wyczyść wszystko" resets draftLocation to null in the store — this mirrors that back into
  // the input's own local text, which only tracks in-progress typing otherwise (see
  // handleLocationInputChange) and has no other reason to resync from the store.
  useEffect(() => {
    if (draftLocation === null) setLocationInput('');
  }, [draftLocation]);

  const handleLocationInputChange = (value: string) => {
    locationRequestId.current += 1; // invalidates any GPS request still in flight
    setLocationInput(value);
    // Typed text drives useLocationSearch's debounced query; the draft only stores it as a
    // display label with no coords until the user commits to a real result below.
    setDraftLocation(value.trim() ? { label: value.trim(), coords: null, bbox: null } : null);
  };

  const handleSelectResult = (result: GeocodeResult) => {
    locationRequestId.current += 1; // invalidates any GPS request still in flight
    setLocationInput(result.label);
    selectDraftLocation({ label: result.label, coords: { lat: result.lat, lng: result.lng }, bbox: result.bbox });
  };

  const handleUseCurrentLocation = async () => {
    const requestId = ++locationRequestId.current;
    setIsLocating(true);
    try {
      // triggerExactLocation() (useAppLocation) both fetches via the browser's Geolocation API
      // AND persists the result into useLocationStore as a side effect — this is what makes a
      // GPS grant here also power the shared "my location" used for distance-to-pet elsewhere
      // (PetDetailPage, MapExplorerPage, MainFeedPage), not just this search filter.
      const location = await triggerExactLocation();
      // The user may have typed a new location or re-tapped GPS while this was in flight —
      // only the most recent request is allowed to win.
      if (locationRequestId.current !== requestId) return;
      if (!location) {
        toast('Nie udało się pobrać Twojej lokalizacji');
        return;
      }
      setLocationInput('Twoja lokalizacja');
      selectDraftLocation({ label: 'Twoja lokalizacja', coords: { lat: location.lat, lng: location.lng }, bbox: null });
    } finally {
      if (locationRequestId.current === requestId) setIsLocating(false);
    }
  };

  const petTypeLabel = draftPetType ? PET_TYPE_LABELS[draftPetType] : 'Wybierz';
  const locationLabel = draftLocation?.label ?? 'Dodaj lokalizację';
  const timeframeLabel = draftTimeframe === 'all' ? 'Dowolny czas' : TIMEFRAME_LABELS[draftTimeframe];

  const drilldownHeadline =
    modalScreen === 'petType' ? 'Jakie zwierzę?' : modalScreen === 'location' ? 'Gdzie?' : 'Kiedy?';

  return (
    <motion.div
      role="dialog"
      aria-modal="true"
      aria-label="Szukaj zwierzaka"
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.22, ease: [0.32, 0.72, 0, 1] }}
      className="fixed inset-0 z-[1500] flex flex-col overscroll-none"
      style={{ backgroundColor: '#F7F7F7' }}
    >
      {/* Root screen — always mounted; the drill-down layer below slides over it. */}
      {/* Grid keeps the toggle tabs perfectly centered regardless of the close button's own
          width — a plain flex row with justify-between would shift the tabs off-center. */}
      <header className="grid shrink-0 grid-cols-[40px_1fr_40px] items-center gap-3 p-4 pt-safe">
        <span aria-hidden="true" />
        <div className="flex items-center justify-center gap-6">
          {STATUS_OPTIONS.map((status) => {
            const active = draftStatus === status;
            const Icon = STATUS_ICONS[status];
            const dotColor = STATUS_DOT_COLOR[status];
            return (
              <button
                key={status}
                type="button"
                onClick={() => setDraftStatus(status)}
                aria-pressed={active}
                className="flex flex-col items-center gap-1.5 pb-0.5"
              >
                <span className="flex items-center gap-1.5">
                  <span style={{ color: active ? dotColor : MUTED_GRAY }}>
                    <Icon className="size-3.5" />
                  </span>
                  <span className="size-2 rounded-full" style={{ backgroundColor: dotColor }} aria-hidden="true" />
                  <span
                    className="text-[15px]"
                    style={{ color: active ? ANTHRACITE : MUTED_GRAY, fontWeight: active ? 700 : 500 }}
                  >
                    {STATUS_LABELS[status]}
                  </span>
                </span>
                {active ? (
                  <motion.span layoutId="search-tab-underline" transition={SPRING} className="h-[3px] w-full rounded-full bg-black" />
                ) : (
                  <span className="h-[3px] w-full" aria-hidden="true" />
                )}
              </button>
            );
          })}
        </div>
        <button
          type="button"
          onClick={closeSearch}
          aria-label="Zamknij wyszukiwanie"
          className="flex size-10 shrink-0 items-center justify-center justify-self-end rounded-full bg-white transition-colors hover:bg-black/[0.03]"
          style={{ border: `1px solid ${HAIRLINE_BORDER}`, color: ANTHRACITE }}
        >
          <CloseIcon />
        </button>
      </header>

      <div className="flex flex-1 flex-col gap-4 overflow-y-auto overscroll-contain px-4 py-4">
        <StateRow label="Zwierzę" value={petTypeLabel} onClick={() => openDrilldown('petType')} />
        <StateRow label="Gdzie?" value={locationLabel} onClick={() => openDrilldown('location')} />
        <StateRow label="Kiedy?" value={timeframeLabel} onClick={() => openDrilldown('timeframe')} />
      </div>

      <motion.div
        animate={{ y: hideFooter ? '150%' : 0 }}
        transition={SPRING}
        className="sticky bottom-0 z-10 flex shrink-0 items-center justify-between gap-3 bg-white px-5 py-4 pb-safe"
        style={{ boxShadow: '0 -8px 24px -12px rgba(0,0,0,0.12)' }}
      >
        <button
          type="button"
          onClick={clearDraftFilters}
          className="text-sm font-semibold underline decoration-1 underline-offset-4 transition-opacity hover:opacity-70"
          style={{ color: '#4A4A4A', textDecorationColor: 'rgba(74,74,74,0.35)' }}
        >
          Wyczyść wszystko
        </button>
        <button
          type="button"
          onClick={applyFilters}
          className="flex items-center gap-2 rounded-full px-7 py-3.5 text-white transition-transform active:scale-95"
          style={{ backgroundColor: CORAL, boxShadow: `0 6px 18px -6px ${CORAL}99` }}
        >
          <MagnifierIcon className="size-5" />
          <span className="text-[15px] font-bold">Szukaj</span>
        </button>
      </motion.div>

      {/* Drill-down layer — one full-screen screen at a time, sliding in from the right over the
          root screen above, per the spec's stack-navigation brief. */}
      <AnimatePresence initial={false}>
        {modalScreen !== 'root' && (
          <motion.div
            key={modalScreen}
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={SCREEN_TRANSITION}
            className="absolute inset-0 z-20 flex flex-col overscroll-none"
            style={{ backgroundColor: '#F7F7F7' }}
          >
            <DrilldownHeader headline={drilldownHeadline} onBack={closeDrilldown} />
            <div className="flex-1 overflow-y-auto overscroll-contain px-5 pb-5">
              {modalScreen === 'petType' && (
                <div className="grid grid-cols-3 gap-3">
                  {(Object.keys(PET_TYPE_LABELS) as PetTypeFilter[]).map((petType) => {
                    const Icon = PET_TYPE_ICONS[petType];
                    const selected = draftPetType === petType;
                    return (
                      <button
                        key={petType}
                        type="button"
                        onClick={() => setDraftPetType(petType)}
                        aria-pressed={selected}
                        className={cn(
                          'flex flex-col items-center justify-center gap-3 rounded-2xl bg-white px-3 py-6 transition-transform active:scale-95',
                          selected && 'bg-black/[0.04]',
                        )}
                        style={{
                          color: ANTHRACITE,
                          border: selected ? '2px solid #000000' : `1px solid ${HAIRLINE_BORDER}`,
                        }}
                      >
                        <Icon />
                        <span className="text-sm font-semibold">{PET_TYPE_LABELS[petType]}</span>
                      </button>
                    );
                  })}
                </div>
              )}

              {modalScreen === 'location' && (
                <LocationScreenBody
                  locationInput={locationInput}
                  onLocationInputChange={handleLocationInputChange}
                  onLocationInputFocus={() => setIsLocationInputFocused(true)}
                  onLocationInputBlur={() => setIsLocationInputFocused(false)}
                  isLocating={isLocating}
                  onUseCurrentLocation={handleUseCurrentLocation}
                  results={locationResults}
                  isFetching={isSearchingLocation}
                  onSelectResult={handleSelectResult}
                />
              )}

              {modalScreen === 'timeframe' && (
                <div className="flex flex-wrap gap-2">
                  {TIMEFRAME_OPTIONS.map((timeframe) => {
                    const selected = draftTimeframe === timeframe;
                    return (
                      <button
                        key={timeframe}
                        type="button"
                        onClick={() => setDraftTimeframe(timeframe)}
                        aria-pressed={selected}
                        className={cn(
                          'rounded-full px-4 py-2.5 text-sm font-semibold transition-transform active:scale-95',
                          selected && 'bg-black/[0.04]',
                        )}
                        style={{
                          color: ANTHRACITE,
                          border: selected ? '2px solid #000000' : `1px solid ${HAIRLINE_BORDER}`,
                        }}
                      >
                        {TIMEFRAME_LABELS[timeframe]}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
