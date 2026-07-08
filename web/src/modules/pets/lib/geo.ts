import type { Coordinate } from '@/shared/components/map/types';

// Placeholder origin for the nearby-search until real geolocation drives it. Shared by
// MainFeedPage (its own always-on, map-independent usePets query) and MapExplorerPage (whose
// query re-centers on appliedFilters.location once the search wizard sets one) — both need the
// same fallback when no real location is known yet, so it lives here instead of being
// duplicated per page.
export const DEFAULT_CENTER: Coordinate = { lat: 52.2297, lng: 21.0122 };
