import { Map } from '@/shared/components/map';
import { PinIcon } from './icons';
import type { Pet, PetStatus } from '../../types/pet.types';

const STATUS_ACCENT: Record<PetStatus, string> = {
  missing: '#dc2626',
  found: '#f97316',
  paused: '#8E8E93',
  resolved: '#22C55E',
};

interface LocationMapWidgetProps {
  pet: Pet;
  onOpenMap: () => void;
}

// Real, non-interactive Leaflet map (tiles do load; dragging/zoom/scroll/touch-zoom are all
// off) — the "Leaflet Static Mode" the spec calls for, replacing an earlier hand-drawn SVG
// placeholder that avoided tile fetches entirely. `pointer-events-none` on the map itself keeps
// the wrapping <button> as the sole tap target even though `interactive={false}` already
// disables Leaflet's own drag/zoom handlers.
export function LocationMapWidget({ pet, onOpenMap }: LocationMapWidgetProps) {
  const accent = STATUS_ACCENT[pet.status];

  return (
    <button
      type="button"
      onClick={onOpenMap}
      aria-label="Otwórz pełną mapę"
      className="relative block h-[200px] w-full overflow-hidden rounded-2xl bg-[#EDEDED]"
    >
      <Map center={pet.location} zoom={15} interactive={false} className="pointer-events-none size-full" />
      <div className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-full">
        <PinIcon color={accent} />
      </div>
    </button>
  );
}
