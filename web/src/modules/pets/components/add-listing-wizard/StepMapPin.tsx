import { useState } from 'react';
import { Controller, type Control } from 'react-hook-form';
import { motion } from 'framer-motion';
import { Map } from '@/shared/components/map';
import type { Coordinate } from '@/shared/components/map';
import { getCurrentPosition } from '@/shared/lib/geolocation';
import type { AddListingWizardData } from '../../store/useAddListingWizardStore';

interface StepMapPinProps {
  control: Control<AddListingWizardData>;
}

// Step 3 — a fixed center-screen pin over a draggable map, the standard "where the map settles
// is the location" pattern (Uber/Airbnb-style picker). `Map`'s own `center` prop is read once on
// mount only (react-leaflet limitation, see LeafletMap.tsx), so the pin's actual coordinate lives
// in RHF/Zustand via `onCenterChange`, never fed back into `center` itself.
export function StepMapPin({ control }: StepMapPinProps) {
  return (
    <Controller
      name="location"
      control={control}
      render={({ field }) => <MapPinField initialCenter={field.value} onCenterChange={field.onChange} />}
    />
  );
}

function MapPinField({
  initialCenter,
  onCenterChange,
}: {
  initialCenter: Coordinate;
  onCenterChange: (center: Coordinate) => void;
}) {
  const [mountCenter] = useState(initialCenter);
  const [focusTarget, setFocusTarget] = useState<Coordinate | null>(null);
  const [isPanning, setIsPanning] = useState(false);
  const [isLocating, setIsLocating] = useState(false);

  const handleMyLocation = async () => {
    setIsLocating(true);
    try {
      const position = await getCurrentPosition();
      setFocusTarget(position);
    } catch {
      // Permission denied/unavailable — nothing to recover, the user can still pan manually.
    } finally {
      setIsLocating(false);
    }
  };

  return (
    <div className="flex flex-1 flex-col gap-4 pt-2">
      <div className="flex flex-col gap-2 px-6">
        <h1 className="text-xl font-bold text-ink sm:text-2xl">Zaznacz lokalizację</h1>
        <p className="text-sm text-subtle">Przesuń mapę, aby ustawić dokładne miejsce zdarzenia.</p>
      </div>

      <div className="relative flex-1">
        {/* z-0 (not the default z-index:auto) is load-bearing here: Leaflet's own panes/controls
            carry explicit z-index up to 1000 (.leaflet-marker-pane, .leaflet-top/.leaflet-bottom
            — see leaflet.css), but `.leaflet-container` itself never gets a z-index, so on its
            own it never forms a stacking context. Nested inside this wizard's `z-[1200]` dialog,
            that meant Leaflet's internal 200–1000 values were being compared directly against
            our overlay siblings below (pin/gradients/button), which sit at the implicit
            z-index:auto level and always lose that comparison — the pin rendered underneath the
            map regardless of DOM order. Giving the map container its own explicit z-index
            contains all of Leaflet's internal stacking inside it, so the overlay siblings (later
            in DOM, also z-index:auto/0) paint above the whole map as one unit, as intended. */}
        <Map
          center={mountCenter}
          zoom={15}
          className="relative z-0 h-full w-full"
          focusCenter={focusTarget}
          onMoveStart={() => setIsPanning(true)}
          onCenterChange={(center) => {
            setIsPanning(false);
            onCenterChange(center);
          }}
        />

        {/* Readability gradients — keep the header title and the bottom helper pill legible
            regardless of what tile colors are directly underneath them. */}
        <div className="pointer-events-none absolute inset-x-0 top-0 z-10 h-20 bg-gradient-to-b from-black/25 to-transparent" />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 h-24 bg-gradient-to-t from-black/30 to-transparent" />

        {/* Static, centered on the viewport regardless of map movement — the map pans underneath
            it, it never moves itself. Anchored by its tip (the wrapper's translate-y-full puts
            the pin's bottom edge, not its center, on the screen's exact center point), matching
            how a real dropped pin points at a location. Bounces up while a drag is in flight
            (onMoveStart) and drops back down once it settles (onCenterChange's moveend) — a
            spring transition gives the drop its overshoot/"bounce" rather than easing flatly. */}
        <div className="pointer-events-none absolute left-1/2 top-1/2 z-10 -translate-x-1/2 -translate-y-full">
          <motion.div
            animate={{ y: isPanning ? -14 : 0, scale: isPanning ? 1.15 : 1 }}
            transition={{ type: 'spring', stiffness: 500, damping: 15 }}
            className="text-5xl drop-shadow-md"
          >
            📍
          </motion.div>
        </div>

        <button
          type="button"
          onClick={() => void handleMyLocation()}
          disabled={isLocating}
          aria-label="Wycentruj na mojej lokalizacji"
          className="absolute bottom-20 right-4 z-10 flex size-11 items-center justify-center rounded-full bg-white text-coral shadow-lg transition-transform disabled:opacity-60 active:scale-95"
        >
          <CrosshairIcon className={isLocating ? 'animate-spin' : undefined} />
        </button>

        <div className="pointer-events-none absolute inset-x-0 bottom-4 z-10 flex justify-center px-6">
          <p className="rounded-full bg-ink/90 px-4 py-2 text-center text-sm font-medium text-white shadow-md">
            Przesuń mapę, aby zaznaczyć miejsce
          </p>
        </div>
      </div>
    </div>
  );
}

function CrosshairIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" width={20} height={20} fill="none" className={className} aria-hidden="true">
      <circle cx="12" cy="12" r="6.5" stroke="currentColor" strokeWidth="2" />
      <circle cx="12" cy="12" r="1.5" fill="currentColor" />
      <path d="M12 2v4M12 18v4M2 12h4M18 12h4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}
