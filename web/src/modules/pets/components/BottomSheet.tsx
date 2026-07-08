import {
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
  type UIEvent as ReactUIEvent,
} from 'react';
import { motion, useAnimation, useDragControls, type PanInfo } from 'framer-motion';
import { cn } from '@/shared/lib/cn';
import type { DrawerSnap } from '../types/mapUi.types';

// Fraction of the sheet's own (fixed) height that stays visible at each snap position — see
// AppShell.tsx's STATE_C spec: ~10% / ~50% / ~92%. The sheet's rendered height never changes;
// only its `y` translateY changes, so these fractions are converted to a pixel `y` offset
// (via yFor below) rather than driving height directly — animating height doesn't play well
// with framer-motion's drag gesture, which operates on x/y motion values.
const SNAP_FRACTIONS: Record<DrawerSnap, number> = {
  collapsed: 0.1,
  half: 0.5,
  expanded: 0.95,
};

const SNAP_ORDER: DrawerSnap[] = ['collapsed', 'half', 'expanded'];
// px/s — a fast flick jumps exactly one snap point in the flick's direction, regardless of
// how far the pointer actually travelled, matching native bottom-sheet feel (e.g. iOS Maps).
const VELOCITY_THRESHOLD = 500;

interface BottomSheetProps {
  snap: DrawerSnap;
  onSnapChange: (snap: DrawerSnap) => void;
  resultCount: number;
  children: ReactNode;
  // CSS `bottom` value to leave between the sheet's bottom edge and the viewport bottom. Now
  // that BottomNav is persistent across every view (see AppShell.tsx), STATE_C passes
  // BOTTOM_NAV_CLEARANCE here so the drawer's own bottom edge sits above the nav instead of
  // underneath it; defaults to 0 for any future caller with no nav to clear.
  bottomOffset?: number | string;
  // True while MapExplorerPage's floating <PetDetailPanel/> owns the bottom of the screen (a
  // pin tap on the map, see usePetMapStore's selectedPetId) — the results list this sheet holds
  // isn't what the user is looking at anymore, so it slides fully out of view below the
  // viewport (a snap position past 'collapsed', not just another one of SNAP_FRACTIONS) rather
  // than sitting at 'collapsed' and leaving its header strip visible behind the floating card.
  // Drag is disabled while hidden — there's nothing to grab, the sheet isn't on screen.
  hidden?: boolean;
}

function formatResultCount(count: number): string {
  if (count === 0) return 'Brak wyników w okolicy';
  if (count === 1) return 'Znaleziono 1 zwierzaka';
  return `Znaleziono ${count} zwierzaków`;
}

// Draggable 3-position bottom sheet for AppShell.tsx's STATE_C (results view). The handle/header
// row is always a drag trigger (via useDragControls + dragListener={false}); the content area
// below it joins in as a second drag trigger too, but only below 'expanded' — see the content
// div's own comment for why "raise the sheet" must win over "scroll the list" at 'half', and why
// that flips back to plain scrolling once fully 'expanded'.
export function BottomSheet({
  snap,
  onSnapChange,
  resultCount,
  children,
  bottomOffset = 0,
  hidden = false,
}: BottomSheetProps) {
  const controls = useAnimation();
  const dragControls = useDragControls();
  const sheetRef = useRef<HTMLDivElement>(null);
  const [sheetHeight, setSheetHeight] = useState(0);
  // Mouse (unlike touch) fires a normal `click` after mouseup even when the mouse travelled a
  // long distance in between — there's no built-in "moved too far, suppress the click" heuristic
  // for mouse input the way there is for touch. Since a card's own onClick sits on a descendant
  // of the content div below, a drag that started on that card would otherwise both raise the
  // sheet *and* fire the card's click once the pointer lifts. `startDrag` resets this at the
  // start of every new pointer session; `onDragStart` (which only ever fires once framer's own
  // small movement threshold is exceeded) flips it true; the content div's onClickCapture then
  // swallows exactly that one resulting click, for either input device.
  const hasDraggedRef = useRef(false);

  const startDrag = (event: ReactPointerEvent) => {
    hasDraggedRef.current = false;
    dragControls.start(event);
  };

  // BUG 7: at 'expanded' the content area below is a plain scrollable list (no drag capture —
  // see that div's own comment), so a downward drag started there normally just scrolls it.
  // But once the list is scrolled all the way to its own top, there's nothing left to scroll,
  // and a further downward pull should hand off to the sheet's own drag-to-collapse gesture
  // instead of being rigidly absorbed — this is what makes it possible to drop back to 'half'
  // from within the scrolled list, matching native (iOS/Android) nested-scroll sheets.
  // scrollTopRef mirrors the list's live scroll position (read cheaply off the onScroll event
  // rather than querying the DOM on every pointermove); contentGestureRef tracks one in-flight
  // pointer session so the handoff decision is made at most once per gesture. Framer's
  // dragControls.start() doesn't require its anchor event to be the original pointerdown — the
  // handle above already starts a drag this way from its own onPointerDown — so calling it from
  // a later pointermove, once the "at top + pulling down" condition is detected, is enough to
  // seamlessly transfer the rest of the gesture to the sheet.
  const scrollTopRef = useRef(0);
  const contentGestureRef = useRef<{ startY: number; handedOff: boolean } | null>(null);

  const handleContentScroll = (event: ReactUIEvent<HTMLDivElement>) => {
    scrollTopRef.current = event.currentTarget.scrollTop;
  };

  const handleContentPointerDown = (event: ReactPointerEvent) => {
    contentGestureRef.current = { startY: event.clientY, handedOff: false };
  };

  const handleContentPointerMove = (event: ReactPointerEvent) => {
    const gesture = contentGestureRef.current;
    if (!gesture || gesture.handedOff) return;
    const draggedDown = event.clientY - gesture.startY > 8;
    if (scrollTopRef.current <= 0 && draggedDown) {
      gesture.handedOff = true;
      startDrag(event);
    }
  };

  const handleContentGestureEnd = () => {
    contentGestureRef.current = null;
  };

  useEffect(() => {
    const node = sheetRef.current;
    if (!node) return;
    const observer = new ResizeObserver(([entry]) => setSheetHeight(entry.contentRect.height));
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  const yFor = (target: DrawerSnap) => sheetHeight * (1 - SNAP_FRACTIONS[target]);

  useEffect(() => {
    if (sheetHeight === 0) return;
    // `hidden` overrides whatever `snap` is: a full sheetHeight of `y` pushes the sheet's own
    // box entirely past the viewport's bottom edge (hardware-accelerated `transform:
    // translateY(...)`, same mechanism BottomNav.tsx's `translate-y-full` uses, just driven
    // through framer's `y` motion value since this sheet is already driven that way for
    // dragging) — a plain tween, not the drag-restore spring below, since this transition isn't
    // the user settling a drag gesture.
    if (hidden) {
      controls.start({ y: sheetHeight, transition: { duration: 0.3, ease: 'easeOut' } });
      return;
    }
    controls.start({ y: yFor(snap), transition: { type: 'spring', damping: 32, stiffness: 300 } });
    // sheetHeight is intentionally included: a viewport resize (orientation change, mobile
    // browser chrome show/hide) must re-snap to the *current* snap's new pixel offset.
  }, [snap, sheetHeight, hidden]);

  const handleDragEnd = (_event: unknown, info: PanInfo) => {
    const draggedY = yFor(snap) + info.offset.y;
    const currentIndex = SNAP_ORDER.indexOf(snap);

    if (Math.abs(info.velocity.y) > VELOCITY_THRESHOLD) {
      const nextIndex =
        info.velocity.y > 0
          ? Math.max(currentIndex - 1, 0) // fast downward flick: collapse one step
          : Math.min(currentIndex + 1, SNAP_ORDER.length - 1); // fast upward flick: expand one step
      onSnapChange(SNAP_ORDER[nextIndex]);
      return;
    }

    const nearest = SNAP_ORDER.reduce((closest, candidate) =>
      Math.abs(yFor(candidate) - draggedY) < Math.abs(yFor(closest) - draggedY) ? candidate : closest,
    );
    onSnapChange(nearest);
  };

  return (
    <motion.div
      ref={sheetRef}
      drag={hidden ? false : 'y'}
      dragListener={false}
      dragControls={dragControls}
      dragConstraints={{ top: yFor('expanded'), bottom: yFor('collapsed') }}
      dragElastic={0.04}
      dragMomentum={false}
      onDragStart={() => {
        hasDraggedRef.current = true;
      }}
      onDragEnd={handleDragEnd}
      animate={controls}
      initial={false}
      style={{ bottom: bottomOffset, height: `${SNAP_FRACTIONS.expanded * 100}dvh`, touchAction: 'none' }}
      // Must beat Leaflet's own pane z-indexes (tile pane 200, marker pane 600, popup pane
      // 700) — an implicit `z-index: auto` sibling loses to those explicitly-indexed panes
      // regardless of DOM order, which otherwise hides the sheet entirely behind the map. Solid
      // white (not the theme's `--card` token, which is a warm off-white) and an extreme top
      // radius per the premium drawer spec — this surface deliberately opts out of the
      // light/dark theme tokens, same as PetCard.tsx/MainFeedPage.tsx already do.
      //
      // `transition-[bottom]` covers the one thing framer's own `animate` doesn't: `bottomOffset`
      // itself changes (BottomNav.tsx sliding away frees up its clearance — see
      // MapExplorerPage.tsx) at the same moment `snap` changes to/from 'collapsed', so without
      // an explicit transition here the CSS `bottom` jump would snap instantly while the `y`
      // spring above is still animating, reading as a small double-motion glitch.
      className={cn(
        'fixed inset-x-0 z-[1000] flex flex-col rounded-t-[32px] bg-white text-black shadow-[0_-8px_30px_-6px_rgba(0,0,0,0.18)] transition-[bottom] duration-300 ease-out',
        hidden && 'pointer-events-none',
      )}
    >
      <div
        onPointerDown={startDrag}
        className="flex shrink-0 cursor-grab flex-col items-center gap-2 pb-1 pt-3 active:cursor-grabbing"
      >
        <div className="h-1.5 w-10 rounded-full bg-neutral-300" />
        {/* Collapsed (State 1): the handle plus a centered headline is the entire visible
            content — half/expanded move the same headline into the content area below, aligned
            left (see the sibling block right after this one). */}
        {snap === 'collapsed' && (
          <p className="text-[15px] font-bold text-black">{formatResultCount(resultCount)}</p>
        )}
      </div>
      {snap !== 'collapsed' && (
        <p className="shrink-0 px-4 pb-3 text-left text-[17px] font-bold text-black">{formatResultCount(resultCount)}</p>
      )}
      {/* Collapsed (State 1) leaves this box's actual DOM height untouched (see SNAP_FRACTIONS'
          own comment on why height never changes) — only its `y` offset does — so without
          hiding it explicitly, whatever's rendered here would otherwise peek out right below
          the header the moment its content is taller than the header's own reserved space,
          contradicting "shows ONLY the drag handle and headline". `invisible` (not
          conditionally unmounting children) keeps scroll position/DOM state intact across a
          collapse — only its paint, not its layout or lifecycle, is affected.

          Gesture orchestration: below 'expanded', this area is a *second* drag trigger (same
          `dragControls`/manual-start pattern as the handle above), not a scroll container — an
          upward swipe that starts on a pet card at 'half' must raise the whole sheet, not
          scroll a list that (at 'half') shows exactly one card and has nothing to scroll
          anyway. `overflow-hidden` + `touch-none` locks out native scrolling/pull gestures so
          they can't compete with that drag. Only at 'expanded' does this flip to a plain
          scrollable list (`overflow-y-auto`, no drag capture). `onClickCapture` is the other
          half of this: framer only escalates into an actual drag once the pointer moves past
          its own small internal threshold, so a plain tap still reaches a card's onClick
          untouched — but once that threshold *is* crossed, mouse input (unlike touch) still
          fires a normal click on mouseup regardless of how far it travelled, which would
          otherwise both raise the sheet and navigate into whatever card the drag ended over
          (see `hasDraggedRef`'s own comment above).

          At 'expanded' specifically, the plain-scroll behavior above is only the default —
          `handleContentPointerMove`/`handleContentScroll` layer BUG 7's overscroll handoff on
          top of it (see those functions' own comment): once the list is scrolled to its own
          top and the user pulls down again, the gesture is handed off mid-flight to the same
          `dragControls`-driven sheet drag the handle and half/collapsed states use, dropping
          the sheet to 'half' instead of rigidly refusing to move further. */}
      <div
        onPointerDown={snap !== 'expanded' ? startDrag : handleContentPointerDown}
        onPointerMove={snap === 'expanded' ? handleContentPointerMove : undefined}
        onPointerUp={snap === 'expanded' ? handleContentGestureEnd : undefined}
        onPointerCancel={snap === 'expanded' ? handleContentGestureEnd : undefined}
        onScroll={snap === 'expanded' ? handleContentScroll : undefined}
        onClickCapture={(event) => {
          if (!hasDraggedRef.current) return;
          event.preventDefault();
          event.stopPropagation();
          hasDraggedRef.current = false;
        }}
        className={cn(
          'flex-1 px-4 pb-safe',
          snap === 'expanded' ? 'overflow-y-auto overscroll-contain' : 'touch-none overflow-hidden',
          snap === 'collapsed' && 'invisible',
        )}
      >
        {children}
      </div>
    </motion.div>
  );
}
