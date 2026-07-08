import { AnimatePresence, motion } from 'framer-motion';
import { cn } from '@/shared/lib/cn';

interface QuickPill {
  id: string;
  label: string;
}

interface ResultsTopBarProps {
  headline: string;
  subline: string;
  // Drives the filter⇄chevron-down crossfade (spec: State 3/expanded only) and what tapping
  // the right-hand circle does — collapse the sheet back down, vs. open the full filter modal.
  sheetExpanded: boolean;
  onBack: () => void;
  onOpenSearch: () => void;
  onCollapseSheet: () => void;
  pills: readonly QuickPill[];
  activePillIds: ReadonlySet<string>;
  onTogglePill: (id: string) => void;
}

function BackIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="size-5" aria-hidden="true">
      <path d="M19 12H5M12 19l-7-7 7-7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function SlidersIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="size-5" aria-hidden="true">
      <line x1="4" y1="6" x2="20" y2="6" strokeLinecap="round" />
      <circle cx="14" cy="6" r="2" fill="currentColor" stroke="none" />
      <line x1="4" y1="12" x2="20" y2="12" strokeLinecap="round" />
      <circle cx="9" cy="12" r="2" fill="currentColor" stroke="none" />
      <line x1="4" y1="18" x2="20" y2="18" strokeLinecap="round" />
      <circle cx="16" cy="18" r="2" fill="currentColor" stroke="none" />
    </svg>
  );
}

function ChevronDownIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="size-5" aria-hidden="true">
      <path d="m6 9 6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

const FLOATING_SHADOW = 'shadow-[0_8px_20px_-6px_rgba(0,0,0,0.25)]';

// STATE_C's floating overlay (MapExplorerPage.tsx) — three fully decoupled solid-white layers
// (back circle / two-line search capsule / filter circle) plus a scroll-snapping quick-filter
// pill row underneath, per the premium results-view spec. Deliberately its own component rather
// than a third SearchBar.tsx mode: SearchBar's STATE_A idle bar is one plain single-line
// button, this is a three-part cluster with its own crossfade and pill-row state wiring —
// forcing both shapes through one component would mean more branching than sharing.
export function ResultsTopBar({
  headline,
  subline,
  sheetExpanded,
  onBack,
  onOpenSearch,
  onCollapseSheet,
  pills,
  activePillIds,
  onTogglePill,
}: ResultsTopBarProps) {
  return (
    // z-[1050]: above BottomSheet's z-[1000] (below BottomNav's z-[1100]) — at the expanded
    // (95vh) snap the sheet's own box extends up nearly to the top of the screen, taller than
    // this overlay's own real height, so without outranking it here the sheet would both visibly
    // cover and (being painted later) intercept clicks on the back/capsule/filter row, exactly
    // the "filter icon collapses the expanded sheet" interaction the spec calls for.
    //
    // The whole header zone (back button, search capsule, filter icon, category pill row) is a
    // single opaque `bg-white` panel with its own `shadow-sm`, not a `pointer-events-none`
    // transparent wrapper around individually-floating chips — previously the gutters between
    // those chips (and the row underneath them) had no backdrop of their own, so scrolled list
    // text from PetResultsList.tsx could bleed through visually once the sheet reached
    // 'expanded'. Being opaque, this wrapper is also `pointer-events-auto` now: a tap that lands
    // on the panel's own blank space (between chips) must be absorbed here, not silently fall
    // through to whatever's invisibly underneath it.
    <div className="pointer-events-auto fixed inset-x-0 top-0 z-[1050] flex flex-col bg-white px-4 pb-3 pt-safe shadow-sm">
      <div className="mt-3 flex items-center gap-2.5">
        <button
          type="button"
          onClick={onBack}
          aria-label="Wróć do widoku głównego"
          className={cn(
            'flex size-11 shrink-0 items-center justify-center rounded-full bg-white text-black',
            FLOATING_SHADOW,
          )}
        >
          <BackIcon />
        </button>

        <button
          type="button"
          onClick={onOpenSearch}
          // Deliberately plain `bg-white`, never `bg-white/NN` — this floats directly over
          // BottomSheet.tsx's own content (the sheet can reach nearly full-viewport height at
          // 'expanded'), so any translucency here would let scrolled list text bleed through
          // and read as overlapping/illegible typography underneath the headline/subline.
          className={cn(
            'flex min-w-0 flex-1 flex-col items-start rounded-full bg-white px-5 py-2 text-left',
            FLOATING_SHADOW,
          )}
        >
          <span className="truncate text-[15px] font-semibold leading-tight text-black">{headline}</span>
          <span className="truncate text-[12.5px] font-medium leading-tight text-neutral-400">{subline}</span>
        </button>

        <button
          type="button"
          onClick={sheetExpanded ? onCollapseSheet : onOpenSearch}
          aria-label={sheetExpanded ? 'Zwiń listę wyników' : 'Filtry'}
          className={cn(
            'relative flex size-11 shrink-0 items-center justify-center rounded-full bg-white text-black',
            FLOATING_SHADOW,
          )}
        >
          <AnimatePresence mode="wait" initial={false}>
            <motion.span
              key={sheetExpanded ? 'chevron' : 'sliders'}
              initial={{ opacity: 0, rotate: -60, scale: 0.6 }}
              animate={{ opacity: 1, rotate: 0, scale: 1 }}
              exit={{ opacity: 0, rotate: 60, scale: 0.6 }}
              transition={{ duration: 0.2, ease: 'easeInOut' }}
              className="absolute inset-0 flex items-center justify-center"
            >
              {sheetExpanded ? <ChevronDownIcon /> : <SlidersIcon />}
            </motion.span>
          </AnimatePresence>
        </button>
      </div>

      {/* Collapses to zero height (not just opacity) the moment the sheet passes 'half' heading
          toward 'expanded' — this row now lives inside the opaque header panel above (see the
          panel's own comment), not floating transparently over the map, so keeping its height
          reserved while invisible would just leave a dead gap of solid white at the bottom of
          the panel instead of letting the panel itself shrink back down to the back/search/
          filter row's own height. `overflow-y-hidden` keeps the pills from spilling out of that
          shrinking box mid-animation while leaving their own horizontal scroll
          (`overflow-x-auto`) unaffected; `marginTop` collapses in step with `height` since the
          gap between the two rows previously came from the parent's own `gap-2.5` (removed
          above) — without also animating it to 0 here, the panel would still hold onto a fixed
          10px sliver of empty space when the row is fully collapsed. `pointer-events-none` stops
          the (still-technically-present, zero-height) row from eating taps meant for whatever's
          now underneath the panel. */}
      <motion.div
        initial={false}
        animate={{ opacity: sheetExpanded ? 0 : 1, height: sheetExpanded ? 0 : 'auto', marginTop: sheetExpanded ? 0 : 10 }}
        transition={{ duration: 0.2, ease: 'easeInOut' }}
        aria-hidden={sheetExpanded}
        className={cn(
          'pointer-events-auto flex gap-2 overflow-x-auto overflow-y-hidden snap-x snap-mandatory scroll-px-4 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden',
          sheetExpanded && 'pointer-events-none',
        )}
      >
        {pills.map((pill) => {
          const active = activePillIds.has(pill.id);
          return (
            <button
              key={pill.id}
              type="button"
              onClick={() => onTogglePill(pill.id)}
              aria-pressed={active}
              className={cn(
                'shrink-0 snap-start whitespace-nowrap rounded-full border px-3.5 py-1.5 text-[13px] font-semibold shadow-[0_2px_8px_-3px_rgba(0,0,0,0.15)] transition-colors',
                active ? 'border-black bg-black text-white' : 'border-neutral-200 bg-white text-neutral-700',
              )}
            >
              {pill.label}
            </button>
          );
        })}
      </motion.div>
    </div>
  );
}
