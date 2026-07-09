import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '@/lib/apiClient';
import { getCurrentPosition } from '@/shared/lib/geolocation';
import { FALLBACK_ORIGIN, FALLBACK_CITY_LABEL } from '@/shared/config/geo.config';
import { useLocationStore } from '../store/useLocationStore';
import type { AppLocation } from '../types/location.types';

const LOCATION_ME_QUERY_KEY = ['location', 'me'] as const;

// The single point of contact components should use for "where is the user" — step 1 (GeoIP,
// automatic on mount via GET /location/me) + step 2 (exact GPS, user-triggered) facade. `origin`
// resolves in priority order: exact GPS fix (useLocationStore, persisted) > GeoIP result > the
// static Warsaw fallback (shared/config/geo.config.ts) — same three-tier shape as the backend's
// own resolveLocationForIp (src/modules/location/location.service.ts).
export function useAppLocation() {
  const exact = useLocationStore((state) => state.exactLocation);
  const setExact = useLocationStore((state) => state.setExactLocation);

  const geoIpQuery = useQuery({
    queryKey: LOCATION_ME_QUERY_KEY,
    queryFn: () => apiFetch<AppLocation>('/location/me'),
    staleTime: Infinity,
    // No point resolving GeoIP once the user has already granted an exact fix this session.
    enabled: exact === null,
  });

  const triggerExactLocation = async (): Promise<AppLocation | null> => {
    try {
      const coords = await getCurrentPosition();
      const location: AppLocation = { lat: coords.lat, lng: coords.lng, city: null, source: 'gps' };
      setExact(location);
      return location;
    } catch {
      // Silent fallback, mirroring the backend's principle: a denied/unavailable GPS prompt
      // must not break the feed — the GeoIP-resolved (or Warsaw-fallback) origin stays in place.
      return null;
    }
  };

  const origin: AppLocation =
    exact ?? geoIpQuery.data ?? { ...FALLBACK_ORIGIN, city: FALLBACK_CITY_LABEL, source: 'fallback' };

  return { origin, isResolving: exact === null && geoIpQuery.isLoading, triggerExactLocation };
}
