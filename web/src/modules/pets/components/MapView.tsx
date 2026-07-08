import { MapContainer, Marker, TileLayer } from 'react-leaflet';
import { divIcon } from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { Pet } from '../types/pet.types';

// Plain colored-dot divIcon instead of Leaflet's default Icon — the default marker image
// paths break under bundlers (a well-known Leaflet/webpack-and-friends gotcha, since it
// resolves icon URLs relative to a CSS file that Vite has already moved/renamed) and fixing
// it properly needs importing the PNGs and calling `Icon.Default.mergeOptions`. A divIcon
// sidesteps that entirely — no image assets, no runtime path patching.
const petMarkerIcon = divIcon({
  className: '',
  html: '<span style="display:block;width:14px;height:14px;border-radius:50%;background:#ef4444;border:2px solid white;box-shadow:0 1px 3px rgba(0,0,0,0.4);"></span>',
  iconSize: [14, 14],
});

interface MapViewProps {
  pets: Pet[];
  center: { lat: number; lng: number };
  selectedPetId: string | null;
  onSelectPet: (petId: string) => void;
}

// Mounted once by PetsMapView.tsx and never unmounted while the bottom sheet opens/closes or
// a pet gets selected — that's what "map state is preserved" means here: selecting a pet only
// changes `selectedPetId` (usePetMapStore), it never remounts <MapContainer/>, so Leaflet's
// own pan/zoom state survives every sheet interaction.
export function MapView({ pets, center, selectedPetId, onSelectPet }: MapViewProps) {
  return (
    <MapContainer
      center={[center.lat, center.lng]}
      zoom={13}
      style={{ height: '100%', width: '100%' }}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      {pets.map((pet) => (
        <Marker
          key={pet.id}
          position={[pet.location.lat, pet.location.lng]}
          icon={petMarkerIcon}
          opacity={selectedPetId === null || selectedPetId === pet.id ? 1 : 0.5}
          eventHandlers={{ click: () => onSelectPet(pet.id) }}
        />
      ))}
    </MapContainer>
  );
}
