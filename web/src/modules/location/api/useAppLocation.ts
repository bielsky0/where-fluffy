import { useCallback, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '@/lib/apiClient';
import { getCurrentPosition, queryGeolocationPermission } from '@/shared/lib/geolocation';
import { FALLBACK_ORIGIN, FALLBACK_CITY_LABEL } from '@/shared/config/geo.config';
import { isLocationFresh, useLocationStore } from '../store/useLocationStore';
import type { AppLocation } from '../types/location.types';

const LOCATION_ME_QUERY_KEY = ['location', 'me'] as const;

// The single point of contact components should use for "where is the user" — step 1 (GeoIP,
// automatic on mount via GET /location/me) + step 2 (exact GPS, persisted across sessions in
// useLocationStore and silently refreshed in the background whenever permission is already
// 'granted') facade. `origin` resolves in priority order: exact GPS fix (useLocationStore,
// persisted) > GeoIP result > the static Warsaw fallback (shared/config/geo.config.ts) — same
// three-tier shape as the backend's own resolveLocationForIp
// (src/modules/location/location.service.ts).
export function useAppLocation() {
  const exact = useLocationStore((state) => state.exactLocation);
  const hasHydrated = useLocationStore((state) => state.hasHydrated);
  const setExact = useLocationStore((state) => state.setExactLocation);

  const geoIpQuery = useQuery({
    queryKey: LOCATION_ME_QUERY_KEY,
    queryFn: () => apiFetch<AppLocation>('/location/me'),
    staleTime: Infinity,
    // Wait for the persisted store to rehydrate before deciding GeoIP is needed — before
    // hydration, `exact` reads null even for users who do have a persisted fix, and firing
    // GeoIP unconditionally in that split second is a wasted/discarded request. Once hydrated,
    // skip GeoIP whenever any exact fix exists, fresh or stale — a stale exact fix still beats
    // an IP-level guess.
    enabled: hasHydrated && exact === null,
  });

  const triggerExactLocation = useCallback(async (): Promise<AppLocation | null> => {
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
  }, [setExact]);

  // Permission lifecycle, runs once per mount. Reads via useLocationStore.getState() (not the
  // subscribed `exact`/timestamp above) so this effect's own deps can stay stable instead of
  // re-querying navigator.permissions on every store update.
  useEffect(() => {
    let status: PermissionStatus | null = null;
    const handleChange = () => {
      // Any state other than 'granted' (revoked -> 'denied', or reset -> 'prompt') means the
      // persisted GPS fix is no longer trustworthy going forward.
      if (status && status.state !== 'granted') useLocationStore.getState().clearExactLocation();
    };

    void (async () => {
      status = await queryGeolocationPermission();
      if (!status) return;
      status.addEventListener('change', handleChange);

      const { exactLocation, exactLocationTimestamp } = useLocationStore.getState();
      const isFresh = exactLocation !== null && isLocationFresh(exactLocationTimestamp);
      // Silent refresh: only ever fires when the browser will NOT show a prompt (already
      // 'granted') and only when there's something to gain (no fix yet, or it aged past the
      // freshness window). Never runs for 'prompt'/'denied' — no surprise permission dialogs.
      if (status.state === 'granted' && !isFresh) {
        void triggerExactLocation();
      }
    })();

    return () => status?.removeEventListener('change', handleChange);
  }, [triggerExactLocation]);

  const origin: AppLocation =
    exact ?? geoIpQuery.data ?? { ...FALLBACK_ORIGIN, city: FALLBACK_CITY_LABEL, source: 'fallback' };

  return {
    origin,
    // "We have nothing at all to show yet": hydration not finished, or it has and there's no
    // exact fix and GeoIP is still in flight. A background silent-GPS refresh deliberately does
    // NOT set this — `origin` already shows something correct-enough (fresh or stale-but-usable)
    // during that, per the stale-while-revalidate requirement.
    isResolving: !hasHydrated || (exact === null && geoIpQuery.isLoading),
    triggerExactLocation,
  };
}
