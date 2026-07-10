import { useState } from 'react';
import { motion } from 'framer-motion';
import { Map } from '@/shared/components/map';
import type { Coordinate } from '@/shared/components/map';
import { getCurrentPosition } from '@/shared/lib/geolocation';
import { useCreateSighting } from '../../api/useSightings';
import { CloseIcon, CrosshairIcon } from './icons';

const ANTHRACITE = '#222222';
const HAIRLINE_BORDER = '#E5E5E5';
const CORAL = '#FF6B4A';
const MUTED_GRAY = '#8E8E93';
const MAX_DESCRIPTION_LENGTH = 300;

interface ReportSightingSheetProps {
  petId: string;
  initialCenter: Coordinate;
  onClose: () => void;
}

// Quick "I just saw this animal" form — a fixed-center-pin-over-draggable-map picker (same
// pattern as add-listing-wizard/StepMapPin.tsx) plus an optional short description. No photo
// step (explicitly out of scope, see the pet-detail plan's "Targeted Parity" decision) — this is
// meant to be fast, not a full report. Submits type: 'sighted' with the picked location, which
// createCommentSchema's `.refine()` requires — unlike the timeline's own plain-text "general"
// comment box, which has no location.
export function ReportSightingSheet({ petId, initialCenter, onClose }: ReportSightingSheetProps) {
  const [pinCenter, setPinCenter] = useState<Coordinate>(initialCenter);
  const [isPanning, setIsPanning] = useState(false);
  const [isLocating, setIsLocating] = useState(false);
  const [focusTarget, setFocusTarget] = useState<Coordinate | null>(null);
  const [description, setDescription] = useState('');
  const createSighting = useCreateSighting(petId);

  const handleMyLocation = async () => {
    setIsLocating(true);
    try {
      const position = await getCurrentPosition();
      setFocusTarget(position);
      setPinCenter(position);
    } catch {
      // Permission denied/unavailable — nothing to recover, the user can still pan manually.
    } finally {
      setIsLocating(false);
    }
  };

  const handleSubmit = async () => {
    await createSighting.mutateAsync({
      description: description.trim() || 'Zwierzę zostało zauważone w tym miejscu',
      type: 'sighted',
      location: pinCenter,
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[1200] flex flex-col bg-white">
      <div className="flex items-center justify-between border-b px-4 py-3 pt-safe" style={{ borderColor: HAIRLINE_BORDER }}>
        <h2 className="text-base font-bold" style={{ color: ANTHRACITE }}>
          Zgłoś zaobserwowanie
        </h2>
        <button
          type="button"
          onClick={onClose}
          aria-label="Zamknij"
          className="flex size-9 items-center justify-center rounded-full bg-neutral-100"
          style={{ color: ANTHRACITE }}
        >
          <CloseIcon />
        </button>
      </div>

      <div className="relative flex-1">
        <Map
          center={initialCenter}
          zoom={15}
          // z-0 (not the default z-index:auto) is load-bearing — see StepMapPin.tsx's own doc
          // comment: without it, `.leaflet-container` never forms its own stacking context, and
          // Leaflet's internal panes (z-index up to ~1000) leak out and paint above the pin/
          // button siblings below even though those already carry z-10.
          className="relative z-0 size-full"
          focusCenter={focusTarget}
          onMoveStart={() => setIsPanning(true)}
          onCenterChange={(center) => {
            setIsPanning(false);
            setPinCenter(center);
          }}
        />

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
          className="absolute bottom-4 right-4 z-10 flex size-11 items-center justify-center rounded-full bg-white shadow-lg transition-transform disabled:opacity-60 active:scale-95"
          style={{ color: CORAL }}
        >
          <CrosshairIcon className={isLocating ? 'animate-spin' : undefined} />
        </button>

        <div className="pointer-events-none absolute inset-x-0 top-3 z-10 flex justify-center px-6">
          <p className="rounded-full bg-black/70 px-4 py-2 text-center text-sm font-medium text-white shadow-md">
            Przesuń mapę, aby zaznaczyć, gdzie widziałeś/aś zwierzaka
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-3 border-t px-4 py-4 pb-safe" style={{ borderColor: HAIRLINE_BORDER }}>
        <textarea
          value={description}
          onChange={(event) => setDescription(event.target.value.slice(0, MAX_DESCRIPTION_LENGTH))}
          placeholder="Opcjonalnie: co robił, w którą stronę biegł…"
          rows={2}
          maxLength={MAX_DESCRIPTION_LENGTH}
          className="w-full resize-none rounded-2xl border px-3.5 py-2.5 text-sm outline-none focus:border-neutral-400"
          style={{ borderColor: HAIRLINE_BORDER, color: ANTHRACITE }}
        />
        {createSighting.isPaused && (
          <p className="text-xs" style={{ color: MUTED_GRAY }}>
            Offline — zgłoszenie wyśle się automatycznie, gdy wrócisz do sieci.
          </p>
        )}
        <button
          type="button"
          onClick={() => void handleSubmit()}
          disabled={createSighting.isPending}
          className="w-full rounded-full px-5 py-3.5 text-[15px] font-bold text-white transition-transform active:scale-95 disabled:opacity-60"
          style={{ backgroundColor: CORAL }}
        >
          {createSighting.isPending ? 'Wysyłanie…' : 'Wyślij zgłoszenie'}
        </button>
      </div>
    </div>
  );
}
