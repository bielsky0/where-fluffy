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
import { useAppUIStore, type AccordionStep } from '../store/useAppUIStore';

// Same spring across the header's sliding underline and the footer's keyboard-avoidance slide —
// reserved for continuous/interruptible interactions.
const SPRING = { type: 'spring', damping: 30, stiffness: 320 } as const;

// Design tokens straight from the Airbnb-style spec this modal implements — deliberately
// hardcoded hex rather than the app's `bg-card`/`text-foreground` theme tokens (same call as
// BottomSheet.tsx/PetCard.tsx already make): this surface is a fixed light "premium" card
// stack that must look identical in light and dark mode, not something that should invert.
const ANTHRACITE = '#222222';
const MUTED_GRAY = '#8E8E93';
const HAIRLINE_BORDER = '#E5E5E5';
// Numerically identical to tailwind.config.ts's coral.DEFAULT/coral.hover — kept as local hex
// literals (not a `bg-coral` utility class) because the CTA's box-shadow needs JS-level hex
// string interpolation below; duplicated intentionally, not independently chosen, for
// consistency with this codebase's other "Airbnb-style surfaces" (PillarsSection.tsx,
// add-listing-wizard/).
const CORAL = '#FF385C';

const MIN_LOCATION_QUERY_LENGTH = 2;

const TIMEFRAME_OPTIONS = Object.keys(TIMEFRAME_LABELS) as TimeframeFilter[];
const PET_TYPE_OPTIONS = Object.keys(PET_TYPE_LABELS) as PetTypeFilter[];

type StatusOption = PublicPetStatus | 'both';
const STATUS_OPTIONS: StatusOption[] = ['missing', 'both', 'found'];
const STATUS_LABELS: Record<StatusOption, string> = {
  missing: 'Zaginione',
  both: 'Obie',
  found: 'Widziane',
};

function CloseIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="size-4" aria-hidden="true">
      <path d="M18 6 6 18M6 6l12 12" strokeLinecap="round" />
    </svg>
  );
}

function CatIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="size-5" aria-hidden="true">
      <path d="M4 9 7 4l2 4M20 9l-3-5-2 4" strokeLinecap="round" strokeLinejoin="round" />
      <rect x="4" y="9" width="16" height="11" rx="6" />
      <circle cx="9" cy="15" r="0.8" fill="currentColor" stroke="none" />
      <circle cx="15" cy="15" r="0.8" fill="currentColor" stroke="none" />
    </svg>
  );
}

function DogIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="size-5" aria-hidden="true">
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
    <svg viewBox="0 0 24 24" fill="currentColor" stroke="none" className="size-5" aria-hidden="true">
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

// Pastel squircle background/icon-color pairs, in the same spirit as the location step's
// existing blue (GPS)/purple (search result) rows — each species gets its own hue since they're
// never shown alongside the location step's colors simultaneously (only one accordion card is
// expanded at a time).
const PET_TYPE_COLORS: Record<PetTypeFilter, { bg: string; color: string }> = {
  cat: { bg: '#FFF3E0', color: '#FB8C00' },
  dog: { bg: '#E8F5E9', color: '#43A047' },
  other: { bg: '#FCE4EC', color: '#EC407A' },
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

// Timeframe's shared icon — one glyph reused across all 3 rows, differentiated by label text
// only, the same way PinIcon is reused across every Photon result row.
function ClockIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="size-5" aria-hidden="true">
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5V12l3 2" strokeLinecap="round" strokeLinejoin="round" />
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

interface StatusTabsProps {
  active: StatusOption;
  onSelect: (status: StatusOption) => void;
}

// Equal-width icon-above-text columns per the spec — replaces the old inline icon+dot+text row.
// Active: bold black text + fully-saturated black icon + sliding underline. Inactive: faded gray,
// no underline. Monochrome by design (no more per-status colored dot) — status recognition
// elsewhere in the app (map pins, badges) stays color-coded; this tab strip doesn't.
function StatusTabs({ active, onSelect }: StatusTabsProps) {
  return (
    <div className="grid grid-cols-3 items-start gap-2">
      {STATUS_OPTIONS.map((status) => {
        const isActive = active === status;
        const Icon = STATUS_ICONS[status];
        return (
          <button
            key={status}
            type="button"
            onClick={() => onSelect(status)}
            aria-pressed={isActive}
            className="flex flex-col items-center gap-2 pb-1"
          >
            <span style={{ color: isActive ? ANTHRACITE : MUTED_GRAY }}>
              <Icon className="size-7" />
            </span>
            <span
              className="text-[13px]"
              style={{ color: isActive ? ANTHRACITE : MUTED_GRAY, fontWeight: isActive ? 700 : 500 }}
            >
              {STATUS_LABELS[status]}
            </span>
            {isActive ? (
              <motion.span layoutId="search-tab-underline" transition={SPRING} className="h-[3px] w-full rounded-full bg-black" />
            ) : (
              <span className="h-[3px] w-full" aria-hidden="true" />
            )}
          </button>
        );
      })}
    </div>
  );
}

interface AccordionCardProps {
  isExpanded: boolean;
  headline: string;
  collapsedLabel: string;
  collapsedValue: string;
  onExpand: () => void;
  children?: React.ReactNode;
}

// The core structural piece of the accordion: exactly one of these renders expanded (full white
// card with a headline + body) at a time, the other two render collapsed (thin pill row). This
// is always the same root motion.div regardless of isExpanded — never a motion.button swapped
// in for a motion.div — because Framer's `layout` FLIP animation needs the same DOM node to
// persist across the state change to interpolate its old/new bounding box; swapping element
// types unmounts+remounts instead, which snaps instantly and was throwing off the *other* two
// cards' own layout projection too (the reported "bottom rows jump" bug). Collapsed vs. expanded
// content crossfades via AnimatePresence inside, instead of the element-type swap doing the work.
function AccordionCard({ isExpanded, headline, collapsedLabel, collapsedValue, onExpand, children }: AccordionCardProps) {
  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (isExpanded) return;
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onExpand();
    }
  };

  return (
    <motion.div
      layout
      transition={{ layout: { duration: 0.3, ease: [0.32, 0.72, 0, 1] } }}
      onClick={isExpanded ? undefined : onExpand}
      onKeyDown={handleKeyDown}
      role={isExpanded ? undefined : 'button'}
      tabIndex={isExpanded ? undefined : 0}
      className={cn(
        'w-full bg-white',
        isExpanded
          ? 'rounded-[28px] p-8 shadow-[0_12px_40px_-12px_rgba(0,0,0,0.18)]'
          : 'flex items-center justify-between gap-2 rounded-[20px] px-6 py-4 text-left shadow-[0_4px_16px_-8px_rgba(0,0,0,0.12)] transition-transform active:scale-[0.98]',
      )}
    >
      <AnimatePresence mode="wait" initial={false}>
        {isExpanded ? (
          <motion.div key="expanded" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}>
            <h2 className="mb-6 text-2xl font-extrabold" style={{ color: ANTHRACITE }}>
              {headline}
            </h2>
            {children}
          </motion.div>
        ) : (
          <motion.div
            key="collapsed"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="flex w-full items-center justify-between gap-2"
          >
            <span className="text-sm font-medium" style={{ color: MUTED_GRAY }}>
              {collapsedLabel}
            </span>
            <span className="truncate text-sm font-bold" style={{ color: ANTHRACITE }}>
              {collapsedValue}
            </span>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

interface OptionRowProps {
  icon: React.ReactNode;
  iconBg: string;
  iconColor: string;
  title: string;
  subtitle?: string;
  onClick: () => void;
  selected?: boolean;
  disabled?: boolean;
}

// Extracted squircle-pastel-icon-box list row — previously duplicated inline twice inside the
// location step (GPS row, Photon result rows); now also used by the pet-type and timeframe
// steps' option lists so the pattern isn't duplicated a third/fourth/fifth time.
function OptionRow({ icon, iconBg, iconColor, title, subtitle, onClick, selected, disabled }: OptionRowProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={selected}
      className={cn(
        'flex w-full items-center gap-3 rounded-2xl px-3 py-4 text-left transition-transform hover:bg-black/[0.03] active:scale-[0.98] disabled:opacity-60',
        selected && 'bg-black/[0.04]',
      )}
      style={selected ? { border: '1.5px solid #000000' } : { border: '1.5px solid transparent' }}
    >
      <span className="flex size-11 shrink-0 items-center justify-center rounded-xl" style={{ backgroundColor: iconBg, color: iconColor }}>
        {icon}
      </span>
      <span className="flex flex-col">
        <span className="text-sm font-bold" style={{ color: ANTHRACITE }}>
          {title}
        </span>
        {subtitle && (
          <span className="text-xs" style={{ color: MUTED_GRAY }}>
            {subtitle}
          </span>
        )}
      </span>
    </button>
  );
}

interface LocationStepBodyProps {
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

// Staggered fade-in for the results list — 0.05s per row, per spec.
const RESULTS_LIST_VARIANTS = { visible: { transition: { staggerChildren: 0.05 } } };
const RESULT_ROW_VARIANTS = { hidden: { opacity: 0 }, visible: { opacity: 1 } };

function LocationStepBody({
  locationInput,
  onLocationInputChange,
  onLocationInputFocus,
  onLocationInputBlur,
  isLocating,
  onUseCurrentLocation,
  results,
  isFetching,
  onSelectResult,
}: LocationStepBodyProps) {
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
        <OptionRow
          icon={<NavigationIcon />}
          iconBg="#E3F2FD"
          iconColor="#1D7BE8"
          title={isLocating ? 'Lokalizowanie…' : 'W pobliżu'}
          subtitle="Twoja aktualna lokalizacja"
          onClick={onUseCurrentLocation}
          disabled={isLocating}
        />

        {isFetching && (
          <p className="px-3 py-3 text-sm" style={{ color: MUTED_GRAY }}>
            Szukam…
          </p>
        )}
        {showEmptyState && (
          <p className="px-3 py-3 text-sm" style={{ color: MUTED_GRAY }}>
            Brak wyników
          </p>
        )}

        <motion.div initial="hidden" animate="visible" variants={RESULTS_LIST_VARIANTS} className="flex flex-col gap-1">
          {results.map((result) => (
            <motion.div key={`${result.lat},${result.lng}`} variants={RESULT_ROW_VARIANTS}>
              <OptionRow
                icon={<PinIcon />}
                iconBg="#EDE9FE"
                iconColor="#7C3AED"
                title={result.label}
                onClick={() => onSelectResult(result)}
              />
            </motion.div>
          ))}
        </motion.div>
      </div>
    </div>
  );
}

// STATE_B: the search & filter modal (mounted by MapExplorerPage.tsx, conditional on
// currentAppState === 'STATE_B'). Reads/writes useAppUIStore directly, same pattern as
// AuthBottomSheet.tsx / useAuthStore, since it has no meaningful props of its own. Renders as a
// centered card over a dimmed backdrop (DeleteConfirmDialog.tsx's two-sibling-layer pattern),
// containing an in-place accordion: exactly one of the three steps (Zwierzę/Gdzie?/Kiedy?) is
// expanded at a time, the other two collapse to thin pill rows in the same scroll region —
// there's no more full-screen drill-down navigation.
export function SearchModal() {
  const expandedStep = useAppUIStore((state) => state.expandedStep);
  const draftStatus = useAppUIStore((state) => state.draftStatus);
  const draftPetType = useAppUIStore((state) => state.draftPetType);
  const draftLocation = useAppUIStore((state) => state.draftLocation);
  const draftTimeframe = useAppUIStore((state) => state.draftTimeframe);
  const closeSearch = useAppUIStore((state) => state.closeSearch);
  const expandStep = useAppUIStore((state) => state.expandStep);
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
      selectDraftLocation({ label: 'Twoja lokalizacja', coords: { lat: location.lat, lng: location.lng }, bbox: null, source: 'gps' });
    } finally {
      if (locationRequestId.current === requestId) setIsLocating(false);
    }
  };

  const petTypeLabel = draftPetType ? PET_TYPE_LABELS[draftPetType] : 'Wybierz';
  const locationLabel = draftLocation?.label ?? 'Dodaj lokalizację';
  const timeframeLabel = draftTimeframe === 'all' ? 'Dowolny czas' : TIMEFRAME_LABELS[draftTimeframe];

  const expand = (step: AccordionStep) => () => expandStep(step);

  return (
    <motion.div
      role="dialog"
      aria-modal="true"
      aria-label="Szukaj zwierzaka"
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.22, ease: [0.32, 0.72, 0, 1] }}
      // Full-screen, not a centered modal-over-backdrop — SearchModal replaces the whole
      // viewport while open (same as MapExplorerPage's other STATE_* views), so there's no
      // "outside the card" to dim/tap-to-dismiss; closing only happens via the X button or
      // Wyczyść/Szukaj in the footer.
      className="fixed inset-0 z-[1500] flex flex-col overscroll-none"
      style={{ backgroundColor: '#F7F7F7' }}
    >
      {/* Grid keeps the tabs perfectly centered regardless of the close button's own width —
          a plain flex row with justify-between would shift the tabs off-center. paddingTop is
          set inline (not the pt-safe utility) because pt-safe and p-5 both set the same CSS
          property — on a device with no notch, env(safe-area-inset-top) is 0, and whichever
          class wins the cascade would silently zero out the intended 20px padding, leaving the
          close button flush against the very top edge. max() guarantees at least 20px always,
          growing only on notched devices. */}
      <header
        className="grid shrink-0 grid-cols-[40px_1fr_40px] items-start gap-3 px-5 pb-5"
        style={{ paddingTop: 'max(1.25rem, env(safe-area-inset-top))' }}
      >
        <span aria-hidden="true" />
        <StatusTabs active={draftStatus} onSelect={setDraftStatus} />
        <button
          type="button"
          onClick={closeSearch}
          aria-label="Zamknij wyszukiwanie"
          className="flex size-10 shrink-0 items-center justify-center justify-self-end rounded-full bg-white transition-colors hover:bg-black/[0.03]"
          style={{ border: `1px solid ${HAIRLINE_BORDER}`, color: ANTHRACITE, boxShadow: '0 2px 8px -2px rgba(0,0,0,0.15)' }}
        >
          <CloseIcon />
        </button>
      </header>

      <motion.div layout className="flex flex-1 flex-col gap-6 overflow-y-auto overscroll-contain px-5 py-6">
            <AccordionCard
              isExpanded={expandedStep === 'petType'}
              headline="Jakie zwierzę?"
              collapsedLabel="Zwierzę"
              collapsedValue={petTypeLabel}
              onExpand={expand('petType')}
            >
              <div className="flex flex-col gap-1">
                {PET_TYPE_OPTIONS.map((petType) => {
                  const Icon = PET_TYPE_ICONS[petType];
                  const colors = PET_TYPE_COLORS[petType];
                  return (
                    <OptionRow
                      key={petType}
                      icon={<Icon />}
                      iconBg={colors.bg}
                      iconColor={colors.color}
                      title={PET_TYPE_LABELS[petType]}
                      selected={draftPetType === petType}
                      onClick={() => setDraftPetType(petType)}
                    />
                  );
                })}
              </div>
            </AccordionCard>

            <AccordionCard
              isExpanded={expandedStep === 'location'}
              headline="Gdzie?"
              collapsedLabel="Gdzie?"
              collapsedValue={locationLabel}
              onExpand={expand('location')}
            >
              <LocationStepBody
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
            </AccordionCard>

            <AccordionCard
              isExpanded={expandedStep === 'timeframe'}
              headline="Kiedy?"
              collapsedLabel="Kiedy?"
              collapsedValue={timeframeLabel}
              onExpand={expand('timeframe')}
            >
              <div className="flex flex-col gap-1">
                {TIMEFRAME_OPTIONS.map((timeframe) => (
                  <OptionRow
                    key={timeframe}
                    icon={<ClockIcon />}
                    iconBg="#FFF8E1"
                    iconColor="#F9A825"
                    title={TIMEFRAME_LABELS[timeframe]}
                    selected={draftTimeframe === timeframe}
                    onClick={() => setDraftTimeframe(timeframe)}
                  />
                ))}
              </div>
            </AccordionCard>
          </motion.div>

      {/* Pinned to the screen's bottom purely by being the last flex child. Slides down out of
          view (clipped by the viewport itself) while the location input has focus and the
          on-screen keyboard is up. paddingBottom is set inline (not the pb-safe utility)
          for the same reason as the header's paddingTop above — py-4 and pb-safe both set
          padding-bottom, and on a non-notched device env(safe-area-inset-bottom) is 0, so
          whichever wins the cascade was zeroing out the intended 16px and leaving Szukaj flush
          against the very bottom edge. max() keeps at least 16px always. */}
      <motion.div
        animate={{ y: hideFooter ? '150%' : 0 }}
        transition={SPRING}
        className="flex shrink-0 items-center justify-between gap-3 bg-white px-5 pt-4"
        style={{ boxShadow: '0 -8px 24px -12px rgba(0,0,0,0.12)', paddingBottom: 'max(1rem, env(safe-area-inset-bottom))' }}
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
          className="flex items-center gap-2 rounded-full px-7 py-3.5 text-white transition-transform active:scale-95 active:brightness-90"
          style={{ backgroundColor: CORAL, boxShadow: `0 6px 18px -6px ${CORAL}99` }}
        >
          <MagnifierIcon className="size-5" />
          <span className="text-[15px] font-bold">Szukaj</span>
        </button>
      </motion.div>
    </motion.div>
  );
}
