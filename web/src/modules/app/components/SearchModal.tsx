import { useEffect, useState, type ReactNode } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { toast } from 'sonner';
import { getCurrentPosition } from '@/shared/lib/geolocation';
import { useVirtualKeyboardVisible } from '@/shared/lib/useVirtualKeyboard';
import { cn } from '@/shared/lib/cn';
import { PET_TYPE_LABELS, type PetTypeFilter } from '@/modules/pets/lib/petType';
import { TIMEFRAME_LABELS, type TimeframeFilter } from '@/modules/pets/lib/timeframe';
import type { PetStatus } from '@/modules/pets/types/pet.types';
import { useAppUIStore, type AccordionStep } from '../store/useAppUIStore';

// Same spring across the header's sliding underline, each card's expand/collapse morph, and
// the footer's keyboard-avoidance slide — one motion "voice" for the whole modal rather than
// three slightly different ones.
const SPRING = { type: 'spring', damping: 30, stiffness: 320 } as const;

// Design tokens straight from the Airbnb-style spec this modal implements — deliberately
// hardcoded hex rather than the app's `bg-card`/`text-foreground` theme tokens (same call as
// BottomSheet.tsx/PetCard.tsx already make): this surface is a fixed light "premium" card
// stack that must look identical in light and dark mode, not something that should invert.
const ANTHRACITE = '#222222';
const MUTED_GRAY = '#8E8E93';
const HAIRLINE_BORDER = '#E5E5E5';
const LOST_RED = '#FF3B30';
const SIGHTED_YELLOW = '#FFC107';
const CORAL = '#FF6B4A';

// No backend endpoint returns search history (or does geocoding at all — see
// useAppUIStore.ts's LocationFilter comment), so these are fixed placeholder suggestions
// standing in for "local recommendations", the same "don't fake a capability we don't have"
// stance already taken by add-listing-wizard/StepFork.tsx's disabled "Znalazłem" tile.
interface DestinationSuggestion {
  label: string;
  subtitle: string;
  badgeBg: string;
  iconColor: string;
  Icon: () => JSX.Element;
}

const TIMEFRAME_OPTIONS = Object.keys(TIMEFRAME_LABELS) as TimeframeFilter[];

function CloseIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="size-4" aria-hidden="true">
      <path d="M18 6 6 18M6 6l12 12" strokeLinecap="round" />
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

function BuildingIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="size-5" aria-hidden="true">
      <rect x="6" y="3" width="12" height="18" rx="1" />
      <path d="M9 7h1.5M13.5 7H15M9 11h1.5M13.5 11H15M9 15h1.5M13.5 15H15" strokeLinecap="round" />
    </svg>
  );
}

function ParkIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="size-5" aria-hidden="true">
      <path d="M6 18c0-7 4-11 12-12-1 8-5 12-12 12Z" strokeLinejoin="round" />
      <path d="M6 18c2-2 4-4 6-9" strokeLinecap="round" />
    </svg>
  );
}

function TreeIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="size-5" aria-hidden="true">
      <path d="M12 3l5 7h-3l4 6H6l4-6H7l5-7Z" strokeLinejoin="round" />
      <path d="M12 16v5" strokeLinecap="round" />
    </svg>
  );
}

// Pastel-badge destination rows below the "W pobliżu" GPS row — each a distinct pastel tone +
// outline icon per the spec (buildings/trees/parks), never the same combination twice.
const NEIGHBORHOOD_SUGGESTIONS: DestinationSuggestion[] = [
  {
    label: 'Wrocław, Krzyki',
    subtitle: 'Wyszukaj w promieniu 3 km',
    badgeBg: '#FFF1E6',
    iconColor: '#F2994A',
    Icon: BuildingIcon,
  },
  {
    label: 'Wrocław, Stare Miasto',
    subtitle: 'Wyszukaj w promieniu 3 km',
    badgeBg: '#FDEAF0',
    iconColor: '#E8628A',
    Icon: ParkIcon,
  },
  {
    label: 'Wrocław, Psie Pole',
    subtitle: 'Wyszukaj w promieniu 3 km',
    badgeBg: '#E6F7EF',
    iconColor: '#27AE60',
    Icon: TreeIcon,
  },
];

interface AccordionCardProps {
  expanded: boolean;
  onExpand: () => void;
  headline: string;
  collapsedLeft: string;
  collapsedRight: string;
  children: ReactNode;
}

// One of the three body cards. `layout` on the root lets Framer Motion interpolate the card's
// bounding box between renders (the "auto-height" trick — no explicit height math needed), so
// when its own content flips between the collapsed bar and the expanded body, both this card
// and every sibling below it (pushed by normal flex-column flow) glide to their new position
// instead of snapping. AnimatePresence + mode="popLayout" crossfades the bar/body swap itself
// and pulls the exiting one out of layout flow immediately, so the incoming content doesn't
// wait for it to finish fading before the container starts resizing.
function AccordionCard({ expanded, onExpand, headline, collapsedLeft, collapsedRight, children }: AccordionCardProps) {
  return (
    <motion.div
      layout
      transition={SPRING}
      className="overflow-hidden rounded-[24px] bg-white shadow-[0_8px_30px_-12px_rgba(0,0,0,0.12)]"
    >
      <AnimatePresence initial={false} mode="popLayout">
        {expanded ? (
          <motion.div
            key="expanded"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.16 }}
            className="px-5 pb-5 pt-5"
          >
            <h2 className="mb-4 text-xl font-bold" style={{ color: ANTHRACITE }}>
              {headline}
            </h2>
            {children}
          </motion.div>
        ) : (
          <motion.button
            key="collapsed"
            type="button"
            onClick={onExpand}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.16 }}
            className="flex w-full items-center justify-between gap-2 px-5 py-4 text-left"
          >
            <span className="text-sm font-medium" style={{ color: MUTED_GRAY }}>
              {collapsedLeft}
            </span>
            <span className="truncate text-sm font-bold" style={{ color: ANTHRACITE }}>
              {collapsedRight}
            </span>
          </motion.button>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// STATE_B: the full-screen search & filter modal (mounted by MapExplorerPage.tsx, conditional
// on currentAppState === 'STATE_B'). Reads/writes useAppUIStore directly, same pattern as
// AuthModal.tsx / useAuthStore, since it has no meaningful props of its own. Airbnb-style
// accordion: all three cards are always mounted, exactly one (`accordionStep`) is expanded at
// a time — any collapsed card can be tapped directly to jump to it, not just "next"/"back".
export function SearchModal() {
  const accordionStep = useAppUIStore((state) => state.accordionStep);
  const draftStatus = useAppUIStore((state) => state.draftStatus);
  const draftPetType = useAppUIStore((state) => state.draftPetType);
  const draftLocation = useAppUIStore((state) => state.draftLocation);
  const draftTimeframe = useAppUIStore((state) => state.draftTimeframe);
  const closeSearch = useAppUIStore((state) => state.closeSearch);
  const goToStep = useAppUIStore((state) => state.goToStep);
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

  // "Wyczyść wszystko" resets draftLocation to null in the store — this mirrors that back into
  // the input's own local text, which only tracks in-progress typing otherwise (see
  // handleLocationInputChange) and has no other reason to resync from the store.
  useEffect(() => {
    if (draftLocation === null) setLocationInput('');
  }, [draftLocation]);

  const handleLocationInputChange = (value: string) => {
    setLocationInput(value);
    // Typed text has nowhere to be geocoded (no backend endpoint for it) — kept only as a
    // display label, and deliberately does not auto-advance (see selectDraftLocation).
    setDraftLocation(value.trim() ? { label: value.trim(), coords: null } : null);
  };

  const handleSelectSuggestion = (label: string) => {
    setLocationInput(label);
    selectDraftLocation({ label, coords: null });
  };

  const handleUseCurrentLocation = async () => {
    setIsLocating(true);
    try {
      const coords = await getCurrentPosition();
      setLocationInput('Twoja lokalizacja');
      selectDraftLocation({ label: 'Twoja lokalizacja', coords });
    } catch {
      toast('Nie udało się pobrać Twojej lokalizacji');
    } finally {
      setIsLocating(false);
    }
  };

  const petTypeLabel = draftPetType ? PET_TYPE_LABELS[draftPetType] : 'Wybierz';
  const locationLabel = draftLocation?.label ?? 'Dodaj lokalizację';
  const timeframeLabel = draftTimeframe === 'all' ? 'Dowolny czas' : TIMEFRAME_LABELS[draftTimeframe];

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
      {/* Grid keeps the toggle tabs perfectly centered regardless of the close button's own
          width — a plain flex row with justify-between would shift the tabs off-center. */}
      <header className="grid shrink-0 grid-cols-[40px_1fr_40px] items-center gap-3 p-4 pt-safe">
        <span aria-hidden="true" />
        <div className="flex items-center justify-center gap-8">
          {(['missing', 'found'] as PetStatus[]).map((status) => {
            const active = draftStatus === status;
            const label = status === 'missing' ? 'Zaginione' : 'Widziane';
            const dotColor = status === 'missing' ? LOST_RED : SIGHTED_YELLOW;
            return (
              <button
                key={status}
                type="button"
                onClick={() => setDraftStatus(status)}
                aria-pressed={active}
                className="flex flex-col items-center gap-1.5 pb-0.5"
              >
                <span className="flex items-center gap-1.5">
                  <span className="size-2 rounded-full" style={{ backgroundColor: dotColor }} aria-hidden="true" />
                  <span
                    className="text-[15px]"
                    style={{ color: active ? ANTHRACITE : MUTED_GRAY, fontWeight: active ? 700 : 500 }}
                  >
                    {label}
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
        <AccordionCard
          expanded={accordionStep === 1}
          onExpand={() => goToStep(1 as AccordionStep)}
          headline="Jakie zwierzę?"
          collapsedLeft="Zwierzę"
          collapsedRight={petTypeLabel}
        >
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
                    'flex flex-col items-center justify-center gap-3 rounded-2xl bg-white px-3 py-6 transition-all',
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
        </AccordionCard>

        <AccordionCard
          expanded={accordionStep === 2}
          onExpand={() => goToStep(2 as AccordionStep)}
          headline="Gdzie?"
          collapsedLeft="Gdzie?"
          collapsedRight={locationLabel}
        >
          <div className="flex flex-col gap-4">
            <div className="relative">
              <MagnifierIcon className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2" />
              <input
                type="text"
                value={locationInput}
                onChange={(event) => handleLocationInputChange(event.target.value)}
                onFocus={() => setIsLocationInputFocused(true)}
                onBlur={() => setIsLocationInputFocused(false)}
                placeholder="Wyszukaj dzielnicę lub ulicę"
                style={{ color: ANTHRACITE, border: `1px solid ${HAIRLINE_BORDER}` }}
                className="h-12 w-full rounded-xl bg-white pl-11 pr-4 text-sm outline-none placeholder:text-[#8E8E93] focus-visible:border-black"
              />
            </div>
            <div className="flex flex-col gap-1">
              <button
                type="button"
                onClick={handleUseCurrentLocation}
                disabled={isLocating}
                className="flex items-center gap-3 rounded-2xl px-2 py-3 text-left transition-colors hover:bg-black/[0.03] disabled:opacity-60"
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
              {NEIGHBORHOOD_SUGGESTIONS.map((suggestion) => (
                <button
                  key={suggestion.label}
                  type="button"
                  onClick={() => handleSelectSuggestion(suggestion.label)}
                  className="flex items-center gap-3 rounded-2xl px-2 py-3 text-left transition-colors hover:bg-black/[0.03]"
                >
                  <span
                    className="flex size-11 shrink-0 items-center justify-center rounded-xl"
                    style={{ backgroundColor: suggestion.badgeBg, color: suggestion.iconColor }}
                  >
                    <suggestion.Icon />
                  </span>
                  <span className="flex flex-col">
                    <span className="text-sm font-bold" style={{ color: ANTHRACITE }}>
                      {suggestion.label}
                    </span>
                    <span className="text-xs" style={{ color: MUTED_GRAY }}>
                      {suggestion.subtitle}
                    </span>
                  </span>
                </button>
              ))}
            </div>
          </div>
        </AccordionCard>

        <AccordionCard
          expanded={accordionStep === 3}
          onExpand={() => goToStep(3 as AccordionStep)}
          headline="Kiedy?"
          collapsedLeft="Kiedy?"
          collapsedRight={timeframeLabel}
        >
          <div className="flex flex-wrap gap-2">
            {TIMEFRAME_OPTIONS.map((timeframe) => {
              const selected = draftTimeframe === timeframe;
              return (
                <button
                  key={timeframe}
                  type="button"
                  onClick={() => setDraftTimeframe(timeframe)}
                  aria-pressed={selected}
                  className={cn('rounded-full px-4 py-2.5 text-sm font-semibold transition-all', selected && 'bg-black/[0.04]')}
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
        </AccordionCard>
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
    </motion.div>
  );
}
