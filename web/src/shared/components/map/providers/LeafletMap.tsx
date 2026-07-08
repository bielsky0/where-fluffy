import { MapContainer, Marker, TileLayer } from 'react-leaflet';
import { divIcon } from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { MapProps } from '../types';

const DEFAULT_MARKER_COLOR = '#ef4444';

// Plain colored-dot divIcon instead of Leaflet's default Icon — the default marker image
// paths break under bundlers (a well-known Leaflet/webpack-and-friends gotcha, since it
// resolves icon URLs relative to a CSS file that Vite has already moved/renamed) and fixing
// it properly needs importing the PNGs and calling `Icon.Default.mergeOptions`. A divIcon
// sidesteps that entirely — no image assets, no runtime path patching.
function createMarkerIcon(color: string) {
  return divIcon({
    className: '',
    html: `<span style="display:block;width:14px;height:14px;border-radius:50%;background:${color};border:2px solid white;box-shadow:0 1px 3px rgba(0,0,0,0.4);"></span>`,
    iconSize: [14, 14],
  });
}

const defaultMarkerIcon = createMarkerIcon(DEFAULT_MARKER_COLOR);

// react-leaflet implementation of the `<Map />` facade (see ../Map.tsx). This is the only
// file in the app allowed to import from `react-leaflet`/`leaflet` — everything else goes
// through the provider-agnostic `MapProps`/`MapMarkerProps` in ../types.ts.
export function LeafletMap({ center, zoom = 13, markers = [], className, style }: MapProps) {
  return (
    <MapContainer
      center={[center.lat, center.lng]}
      zoom={zoom}
      className={className}
      style={style ?? { height: '100%', width: '100%' }}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      {markers.map((marker) => (
        <Marker
          key={marker.id}
          position={[marker.position.lat, marker.position.lng]}
          icon={marker.color ? createMarkerIcon(marker.color) : defaultMarkerIcon}
          opacity={marker.opacity ?? 1}
          eventHandlers={marker.onClick ? { click: marker.onClick } : undefined}
        />
      ))}
    </MapContainer>
  );
}
