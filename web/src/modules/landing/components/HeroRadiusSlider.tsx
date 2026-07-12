import { useCallback, useEffect, useRef, useState, type PointerEvent } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { hapticImpact, hapticTick } from '@/shared/lib/haptics';

const MIN_KM = 1;
const MAX_KM = 50;

interface HeroRadiusSliderProps {
  radiusKm: number;
  onChange: (km: number) => void;
}

function clampKm(km: number): number {
  return Math.min(MAX_KM, Math.max(MIN_KM, Math.round(km)));
}

// Custom pointer-driven track/thumb, not a native <input type="range"> — precise control over
// the thumb's press scale-up, the floating value bubble, and a haptic tick fired once per
// crossed km (not per pixel) all need the raw pointer position, not a native range's own
// stepped value events. `onChange` fires live on every pointer move (not just on release) so the
// map's radar circle (see HeroMap.tsx) can track the drag in real time — Hero.tsx debounces the
// *query* side of that same value itself (useDebouncedCallback, 300ms), same pattern
// MapExplorerPage already uses for its bbox queries.
export function HeroRadiusSlider({ radiusKm, onChange }: HeroRadiusSliderProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [liveKm, setLiveKm] = useState(radiusKm);
  const lastTickKmRef = useRef(radiusKm);

  // Stay in sync with external changes (e.g. picking a new location resets the radius) while
  // not actively dragging — dragging owns `liveKm` exclusively until release.
  useEffect(() => {
    if (!isDragging) setLiveKm(radiusKm);
  }, [radiusKm, isDragging]);

  const kmFromClientX = useCallback((clientX: number): number => {
    const track = trackRef.current;
    if (!track) return liveKm;
    const rect = track.getBoundingClientRect();
    const ratio = (clientX - rect.left) / rect.width;
    return clampKm(MIN_KM + ratio * (MAX_KM - MIN_KM));
  }, [liveKm]);

  const handlePointerDown = (event: PointerEvent<HTMLDivElement>) => {
    event.currentTarget.setPointerCapture(event.pointerId);
    setIsDragging(true);
    hapticImpact();
    lastTickKmRef.current = liveKm;
    const km = kmFromClientX(event.clientX);
    setLiveKm(km);
    onChange(km);
  };

  const handlePointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (!isDragging) return;
    const km = kmFromClientX(event.clientX);
    if (km === liveKm) return;
    setLiveKm(km);
    onChange(km);
    if (km !== lastTickKmRef.current) {
      hapticTick();
      lastTickKmRef.current = km;
    }
  };

  const stopDragging = () => setIsDragging(false);

  const percent = ((liveKm - MIN_KM) / (MAX_KM - MIN_KM)) * 100;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between text-sm text-subtle">
        <span>Zasięg wyszukiwania</span>
        <span className="font-semibold text-ink">{radiusKm} km</span>
      </div>
      <div
        ref={trackRef}
        className="relative h-2 w-full touch-none rounded-full bg-neutral-200"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={stopDragging}
        onPointerCancel={stopDragging}
      >
        <div className="absolute inset-y-0 left-0 rounded-full bg-coral" style={{ width: `${percent}%` }} />
        <motion.div
          className="absolute top-1/2 flex size-6 items-center justify-center rounded-full bg-white shadow-lg ring-1 ring-black/10"
          style={{ left: `${percent}%`, translateX: '-50%', translateY: '-50%' }}
          animate={{ scale: isDragging ? 1.15 : 1 }}
          transition={{ duration: 0.15 }}
        >
          <span className="size-2.5 rounded-full bg-coral" />
        </motion.div>
        <AnimatePresence>
          {isDragging && (
            <motion.div
              initial={{ opacity: 0, y: 6, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 6, scale: 0.9 }}
              transition={{ type: 'spring', damping: 22, stiffness: 300 }}
              style={{ left: `${percent}%`, translateX: '-50%' }}
              className="absolute -top-10 rounded-full bg-ink px-2.5 py-1 text-xs font-semibold text-white shadow-lg"
            >
              {liveKm} km
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
