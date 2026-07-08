import { LeafletMap } from './providers/LeafletMap';
import type { MapProps } from './types';

// Facade/adapter: the rest of the app renders `<Map />` and only ever imports types from
// ./types — never react-leaflet directly. Swapping providers (Mapbox, Google Maps, ...) means
// adding a new providers/*.tsx implementing this same MapProps contract and pointing this
// facade at it; call sites don't change.
export function Map(props: MapProps) {
  return <LeafletMap {...props} />;
}
