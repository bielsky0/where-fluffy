import { useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { CloseIcon } from './icons';

const MIN_SCALE = 1;
const MAX_SCALE = 4;
const DOUBLE_TAP_SCALE = 2.5;
const DOUBLE_TAP_WINDOW_MS = 300;

interface PointerPoint {
  x: number;
  y: number;
}

interface ZoomState {
  scale: number;
  tx: number;
  ty: number;
}

// Hand-built pinch-zoom via raw Pointer Events — no zoom/lightbox library exists anywhere in
// this app (deliberately, matching its "no third-party UI kit for one-off widgets" pattern), so
// this tracks up to two simultaneous pointers itself: two active pointers drives a pinch (scale
// from the change in distance between them), one active pointer pans when already zoomed in,
// and a double-tap toggles between 1x and a fixed zoomed level — the standard native-gallery
// gesture set.
function ZoomableImage({ src, alt }: { src: string; alt: string }) {
  const [zoom, setZoom] = useState<ZoomState>({ scale: MIN_SCALE, tx: 0, ty: 0 });
  const pointers = useRef(new Map<number, PointerPoint>());
  const pinchStart = useRef<{ distance: number; scale: number } | null>(null);
  const panStart = useRef<{ x: number; y: number; tx: number; ty: number } | null>(null);
  const lastTap = useRef<number>(0);

  const pointerDistance = () => {
    const [a, b] = [...pointers.current.values()];
    return Math.hypot(a.x - b.x, a.y - b.y);
  };

  const handlePointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    event.currentTarget.setPointerCapture(event.pointerId);
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });

    if (pointers.current.size === 2) {
      pinchStart.current = { distance: pointerDistance(), scale: zoom.scale };
      panStart.current = null;
    } else if (pointers.current.size === 1) {
      const now = Date.now();
      if (now - lastTap.current < DOUBLE_TAP_WINDOW_MS) {
        setZoom((prev) => (prev.scale > MIN_SCALE ? { scale: MIN_SCALE, tx: 0, ty: 0 } : { scale: DOUBLE_TAP_SCALE, tx: 0, ty: 0 }));
        lastTap.current = 0;
      } else {
        lastTap.current = now;
      }
      panStart.current = { x: event.clientX, y: event.clientY, tx: zoom.tx, ty: zoom.ty };
    }
  };

  const handlePointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!pointers.current.has(event.pointerId)) return;
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });

    if (pointers.current.size === 2 && pinchStart.current) {
      const nextScale = Math.min(
        MAX_SCALE,
        Math.max(MIN_SCALE, pinchStart.current.scale * (pointerDistance() / pinchStart.current.distance)),
      );
      setZoom((prev) => ({ ...prev, scale: nextScale }));
    } else if (pointers.current.size === 1 && panStart.current && zoom.scale > MIN_SCALE) {
      const dx = event.clientX - panStart.current.x;
      const dy = event.clientY - panStart.current.y;
      setZoom((prev) => ({ ...prev, tx: panStart.current!.tx + dx, ty: panStart.current!.ty + dy }));
    }
  };

  const handlePointerUp = (event: ReactPointerEvent<HTMLDivElement>) => {
    pointers.current.delete(event.pointerId);
    if (pointers.current.size < 2) pinchStart.current = null;
    if (pointers.current.size === 0) {
      panStart.current = null;
      setZoom((prev) => (prev.scale <= MIN_SCALE ? { scale: MIN_SCALE, tx: 0, ty: 0 } : prev));
    }
  };

  return (
    <div
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      className="flex h-full w-full shrink-0 snap-center touch-none items-center justify-center overflow-hidden"
    >
      <img
        src={src}
        alt={alt}
        draggable={false}
        className="max-h-full max-w-full select-none object-contain"
        style={{
          transform: `translate(${zoom.tx}px, ${zoom.ty}px) scale(${zoom.scale})`,
          transition: pointers.current.size > 0 ? 'none' : 'transform 0.2s ease-out',
        }}
      />
    </div>
  );
}

interface PhotoLightboxProps {
  photos: string[];
  startIndex: number;
  altText: string;
  onClose: () => void;
}

export function PhotoLightbox({ photos, startIndex, altText, onClose }: PhotoLightboxProps) {
  // Seeds the scroll-snap track at the requested starting photo — a plain callback ref so the
  // jump happens the instant the track mounts, before the browser paints it, rather than in a
  // useEffect (which would paint index 0 first, then visibly snap over).
  const trackRef = (track: HTMLDivElement | null) => {
    if (track && startIndex > 0) {
      track.scrollLeft = startIndex * track.clientWidth;
    }
  };

  return (
    <div className="fixed inset-0 z-[1300] flex flex-col bg-black">
      <div className="flex justify-end p-4 pt-safe">
        <button
          type="button"
          onClick={onClose}
          aria-label="Zamknij"
          className="flex size-10 items-center justify-center rounded-full bg-white/10 text-white"
        >
          <CloseIcon />
        </button>
      </div>

      <div ref={trackRef} className="flex flex-1 snap-x snap-mandatory overflow-x-auto">
        {photos.map((src, index) => (
          <ZoomableImage key={src} src={src} alt={`${altText} — zdjęcie ${index + 1}`} />
        ))}
      </div>

      {photos.length > 1 && (
        <p className="pb-safe pb-4 text-center text-xs text-white/60">
          Przesuń, aby zobaczyć kolejne zdjęcie • uszczypnij, aby przybliżyć
        </p>
      )}
    </div>
  );
}
