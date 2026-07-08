import { useRef, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react';
import type { BottomSheetSnap } from '../types/mapUi.types';

const SNAP_HEIGHTS: Record<BottomSheetSnap, string> = {
  collapsed: '0px',
  peek: '30%',
  full: '85%',
};

const SNAP_ORDER: BottomSheetSnap[] = ['collapsed', 'peek', 'full'];
const DRAG_THRESHOLD_PX = 40;

interface BottomSheetProps {
  snap: BottomSheetSnap;
  onSnapChange: (snap: BottomSheetSnap) => void;
  children: ReactNode;
  // Pixel gap to leave between the sheet's bottom edge and the viewport bottom — for
  // AppShell.tsx's fixed action bar, so the sheet stops above it instead of underneath it.
  // Zero z-index fighting between the two: they simply never occupy the same space.
  bottomOffset?: number;
}

// Minimal drag-to-snap bottom sheet — no gesture library, just a pointer-drag threshold on
// the handle. Rendered as an absolutely-positioned overlay on top of <MapView/> (see
// AppShell.tsx), so dragging it never touches the map's own DOM node or triggers a re-mount.
export function BottomSheet({ snap, onSnapChange, children, bottomOffset = 0 }: BottomSheetProps) {
  const dragStartY = useRef<number | null>(null);

  const handlePointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    dragStartY.current = event.clientY;
  };

  const handlePointerUp = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (dragStartY.current === null) return;
    const delta = event.clientY - dragStartY.current;
    dragStartY.current = null;

    const currentIndex = SNAP_ORDER.indexOf(snap);
    if (delta > DRAG_THRESHOLD_PX) {
      onSnapChange(SNAP_ORDER[Math.max(currentIndex - 1, 0)]);
    } else if (delta < -DRAG_THRESHOLD_PX) {
      onSnapChange(SNAP_ORDER[Math.min(currentIndex + 1, SNAP_ORDER.length - 1)]);
    }
  };

  return (
    <div
      style={{
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: bottomOffset,
        // Must beat Leaflet's own pane z-indexes (tile pane 200, marker pane 600, popup pane
        // 700) — an implicit `z-index: auto` sibling loses to those explicitly-indexed panes
        // regardless of DOM order, which otherwise hides the sheet entirely behind the map.
        zIndex: 1000,
        height: SNAP_HEIGHTS[snap],
        transition: 'height 0.2s ease-out',
        background: 'white',
        borderTopLeftRadius: 16,
        borderTopRightRadius: 16,
        boxShadow: '0 -2px 16px rgba(0,0,0,0.15)',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <div
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUp}
        style={{ padding: 12, cursor: 'grab', touchAction: 'none', flexShrink: 0 }}
      >
        <div style={{ width: 40, height: 4, borderRadius: 2, background: '#ccc', margin: '0 auto' }} />
      </div>
      <div style={{ flex: 1, overflowY: 'auto', padding: '0 16px 16px' }}>{children}</div>
    </div>
  );
}
