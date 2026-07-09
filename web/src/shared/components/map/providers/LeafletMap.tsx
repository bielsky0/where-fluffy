import { useEffect } from 'react';
import { MapContainer, Marker, TileLayer, useMap, useMapEvent } from 'react-leaflet';
import { divIcon } from 'leaflet';
import MarkerClusterGroup from 'react-leaflet-cluster';
import 'leaflet/dist/leaflet.css';
import 'leaflet.markercluster/dist/MarkerCluster.css';
import 'leaflet.markercluster/dist/MarkerCluster.Default.css';
import type { Coordinate, MapMarkerProps, MapProps } from '../types';

const TONE_ACCENT: Record<MapMarkerProps['tone'], string> = {
  danger: '#dc2626',
  warning: '#f97316',
};

// Airbnb-style horizontal pill divIcon instead of Leaflet's default dropped-pin Icon — sidesteps
// the well-known Leaflet/bundler gotcha where the default Icon's image paths resolve relative to
// a CSS file Vite has already moved/renamed, and (being plain HTML) lets the pill's width follow
// its own text content rather than a fixed icon size.
//
// `iconSize: [0, 0]` + `iconAnchor: [0, 0]` puts Leaflet's positioning wrapper's top-left exactly
// at the marker's lat/lng point with zero built-in offset; the inner span's own
// `translate(-50%, -100%)` then does the actual anchoring, centering the pill horizontally and
// sitting its bottom edge on that point — the standard technique for a variable-width Leaflet
// divIcon, since Leaflet has no notion of "size to content" for iconSize itself.
function createPetMarkerIcon({ emoji, freshness, tone, selected }: MapMarkerProps) {
  const accent = TONE_ACCENT[tone];
  const html = `
    <span style="
      display:inline-flex;align-items:center;gap:5px;
      background:#ffffff;border-radius:9999px;padding:6px 12px;
      box-shadow:0 4px 14px -2px rgba(0,0,0,0.3);
      border:${selected ? `2px solid ${accent}` : '1px solid rgba(0,0,0,0.06)'};
      white-space:nowrap;font:700 12px/1 system-ui,-apple-system,sans-serif;
      transform:translate(-50%,-100%) scale(${selected ? 1.1 : 1});
      transform-origin:bottom center;
    ">
      <span style="font-size:15px;line-height:1;">${emoji}</span>
      <span style="color:${accent};">${freshness}</span>
    </span>`;

  return divIcon({ className: '', html, iconSize: [0, 0], iconAnchor: [0, 0] });
}

// Imperative pan-to-selection, mounted inside <MapContainer/> so it can reach the Leaflet
// map instance via useMap() — MapContainer's own `center` prop only applies once, on mount
// (a well-known react-leaflet limitation), so re-centering on a later selection has to go
// through flyTo instead of just changing a prop.
function FlyToFocus({ target }: { target: Coordinate | null | undefined }) {
  const map = useMap();

  useEffect(() => {
    if (!target) return;
    map.flyTo([target.lat, target.lng], map.getZoom(), { duration: 0.6 });
  }, [target?.lat, target?.lng]);

  return null;
}

// Reports the map's own center once panning settles, for callers that opted into
// `onCenterChange` (see ../types.ts). `moveend` (not `move`) so this fires once per gesture
// rather than on every intermediate frame.
function CenterTracker({ onCenterChange }: { onCenterChange: MapProps['onCenterChange'] }) {
  useMapEvent('moveend', (event) => {
    const center = event.target.getCenter();
    onCenterChange?.({ lat: center.lat, lng: center.lng });
  });
  return null;
}

// Reports the moment a pan gesture begins, for callers that opted into `onMoveStart` (see
// ../types.ts) — paired with CenterTracker's `moveend` above.
function MoveStartTracker({ onMoveStart }: { onMoveStart: MapProps['onMoveStart'] }) {
  useMapEvent('movestart', () => onMoveStart?.());
  return null;
}

// Reports the map's viewport rectangle once panning/zooming settles, for callers that opted
// into `onBoundsChange` (see ../types.ts) — same `moveend` event as CenterTracker, kept as its
// own tracker/component since not every caller needs the full bounds (react-leaflet's
// useMapEvent has no built-in way to share one subscription across two hook call sites, so this
// mounts as a sibling <MoveendTracker/>-style component instead, exactly like CenterTracker).
function BoundsTracker({ onBoundsChange }: { onBoundsChange: MapProps['onBoundsChange'] }) {
  useMapEvent('moveend', (event) => {
    const bounds = event.target.getBounds();
    onBoundsChange?.({
      minLng: bounds.getWest(),
      minLat: bounds.getSouth(),
      maxLng: bounds.getEast(),
      maxLat: bounds.getNorth(),
    });
  });
  return null;
}

// react-leaflet implementation of the `<Map />` facade (see ../Map.tsx). This is the only
// file in the app allowed to import from `react-leaflet`/`leaflet` — everything else goes
// through the provider-agnostic `MapProps`/`MapMarkerProps` in ../types.ts.
export function LeafletMap({
  center,
  zoom = 13,
  markers = [],
  className,
  style,
  focusCenter,
  onCenterChange,
  onMoveStart,
  onBoundsChange,
}: MapProps) {
  return (
    <MapContainer
      center={[center.lat, center.lng]}
      zoom={zoom}
      className={className}
      style={style ?? { height: '100%', width: '100%' }}
      // Canvas renderer instead of the default SVG/DOM one — with clustering active this mostly
      // matters for the un-clustered individual/spiderfied markers at max zoom (see CLAUDE.md's
      // 60fps guide), which would otherwise still be one DOM node each.
      preferCanvas
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <FlyToFocus target={focusCenter} />
      {onCenterChange && <CenterTracker onCenterChange={onCenterChange} />}
      {onMoveStart && <MoveStartTracker onMoveStart={onMoveStart} />}
      {onBoundsChange && <BoundsTracker onBoundsChange={onBoundsChange} />}
      {/* chunkedLoading: true — react-leaflet-cluster/leaflet.markercluster splits marker
          insertion into requestAnimationFrame-sized batches instead of processing thousands of
          pins in one blocking pass (see CLAUDE.md's 60fps guide). The group itself is mounted
          via @react-leaflet/core's createPathComponent, which already adds/removes the
          underlying L.MarkerClusterGroup from the map on mount/unmount — no extra manual
          cleanup effect needed here. */}
      <MarkerClusterGroup chunkedLoading>
        {markers.map((marker) => (
          <Marker
            key={marker.id}
            position={[marker.position.lat, marker.position.lng]}
            icon={createPetMarkerIcon(marker)}
            opacity={marker.opacity ?? 1}
            eventHandlers={marker.onClick ? { click: marker.onClick } : undefined}
          />
        ))}
      </MarkerClusterGroup>
    </MapContainer>
  );
}
