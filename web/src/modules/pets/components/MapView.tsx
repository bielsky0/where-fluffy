import { useEffect, useRef, useState } from 'react';
import { Map } from '@/shared/components/map';
import type { BoundsRect, Coordinate } from '@/shared/components/map/types';
import { PET_STATUS_LABEL } from '../lib/petStatus';
import type { MapPin } from '@/modules/map/types/mapPin.types';

interface MapViewProps {
  pins: MapPin[];
  center: { lat: number; lng: number };
  selectedPetId: string | null;
  onSelectPet: (petId: string) => void;
  // Threaded straight through to <Map/>'s own onBoundsChange (see providers/LeafletMap.tsx's
  // BoundsTracker) — MapExplorerPage.tsx uses this to drive its debounced bbox-keyed fetches.
  onBoundsChange?: (bounds: BoundsRect) => void;
}

// GET /map/pins deliberately returns only {id, lat, lng, status} — no species, no createdAt (the
// dual-query architecture's whole point is that this payload stays minimal, see CLAUDE.md) — so
// pins can no longer show a per-species emoji or a relative-time freshness label the way the old
// single-endpoint version did. A generic paw stands in for the emoji; the status label (still
// derivable from `status` alone) stands in for freshness. Richer per-pet detail (species, photo,
// exact time) still shows in PetCard/PetDetailPanel, which read the full feed DTO.
const PIN_EMOJI = '🐾';

// Mounted once by AppShell.tsx and never unmounted while the search modal/results drawer
// opens or closes or a pin gets selected — that's what "map state is preserved" means here:
// selecting a pin only changes `selectedPetId` (usePetMapStore), it never remounts <Map/>, so
// the underlying provider's own pan/zoom state survives every state/drawer transition.
export function MapView({ pins, center, selectedPetId, onSelectPet, onBoundsChange }: MapViewProps) {
  const selectedPin = pins.find((pin) => pin.id === selectedPetId) ?? null;

  // Tracked locally rather than derived as `selectedPin ? pinCoords : center` — that fallback
  // made *deselecting* a pin manufacture a "target changed" (pin coords -> center coords) even
  // when `center` itself never moved, so LeafletMap.tsx's FlyToFocus flew the map back to
  // center on every popup close. Only update for the two legitimate reasons: `center` genuinely
  // changing value (GPS resolving, explicit search recenter — MapContainer's `center` prop only
  // applies once on mount, see LeafletMap.tsx, so this is what actually pans an already-mounted
  // map), or a pin getting newly selected. Closing a popup updates neither, so no fly happens —
  // the map just stays where it is.
  const [focusCenter, setFocusCenter] = useState<Coordinate | null>(null);
  const prevCenterRef = useRef(center);

  useEffect(() => {
    if (center.lat === prevCenterRef.current.lat && center.lng === prevCenterRef.current.lng) return;
    prevCenterRef.current = center;
    setFocusCenter(center);
  }, [center]);

  // Keyed on `selectedPin?.id`, not `selectedPin` itself — `pins` is a fresh array/object on
  // every query resolution, so keying on the object would re-fly to the same pin on every
  // refetch instead of only on an actual new selection.
  useEffect(() => {
    if (selectedPin) setFocusCenter({ lat: selectedPin.lat, lng: selectedPin.lng });
  }, [selectedPin?.id]);

  return (
    <Map
      center={center}
      zoom={13}
      focusCenter={focusCenter}
      onBoundsChange={onBoundsChange}
      markers={pins.map((pin) => ({
        id: pin.id,
        position: { lat: pin.lat, lng: pin.lng },
        opacity: selectedPetId === null || selectedPetId === pin.id ? 1 : 0.5,
        onClick: () => onSelectPet(pin.id),
        emoji: PIN_EMOJI,
        freshness: PET_STATUS_LABEL[pin.status],
        tone: pin.status === 'missing' ? 'danger' : 'warning',
        selected: pin.id === selectedPetId,
      }))}
    />
  );
}
