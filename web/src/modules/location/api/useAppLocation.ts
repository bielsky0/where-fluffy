import { useCallback, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '@/lib/apiClient';
import { getCurrentPosition, queryGeolocationPermission } from '@/shared/lib/geolocation';
import { FALLBACK_ORIGIN, FALLBACK_CITY_LABEL } from '@/shared/config/geo.config';
import { isLocationFresh, useLocationStore } from '../store/useLocationStore';
import type { AppLocation } from '../types/location.types';

const LOCATION_ME_QUERY_KEY = ['location', 'me'] as const;
const GPS_LABEL_QUERY_KEY = ['location', 'me', 'gps-label'] as const;

// Both location queries below are persisted across sessions by AppProviders.tsx's
// PersistQueryClientProvider (not excluded from its dehydrateOptions), so `staleTime: Infinity`
// would mean "whatever response was cached first is replayed forever, with no way to
// self-correct" — including a bad response from a since-fixed backend bug, or a one-off
// geocoding-service hiccup. A bounded staleTime still avoids re-fetching on every load (the
// common case) but guarantees eventual revalidation. 24h matches the persister's own default
// `maxAge`, so there's one cache-turnover rhythm to reason about, not two.
const LOCATION_STALE_TIME_MS = 24 * 60 * 60 * 1000;

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
    staleTime: LOCATION_STALE_TIME_MS,
    // Wait for the persisted store to rehydrate before deciding GeoIP is needed — before
    // hydration, `exact` reads null even for users who do have a persisted fix, and firing
    // GeoIP unconditionally in that split second is a wasted/discarded request. Once hydrated,
    // skip GeoIP whenever any exact fix exists, fresh or stale — a stale exact fix still beats
    // an IP-level guess.
    enabled: hasHydrated && exact === null,
  });

  // A fresh GPS fix starts with city: null (triggerExactLocation below has no reverse-geocode of
  // its own) — this fills in a friendly district/city label via the extended GET /location/me
  // (now accepting lat/lng, see src/modules/location/location.service.ts's 'gps' source branch),
  // then persists the resolved label so every consumer of `origin` (Hero, MapExplorerPage,
  // SearchModal) gets it for free with no code changes of their own. Deliberately NOT gated on
  // `exact.city === null` — that would fetch once per fresh fix and then never again, so any bad
  // response (this query's own persisted-forever bug, a geocoding hiccup, whatever) that ever
  // gets written into `exact.city` would stay stuck there permanently, since the fix's coordinates
  // themselves can stay "fresh" (isLocationFresh) for a long time without a new triggerExactLocation
  // call to reset it. Relying on the query's own `staleTime` instead means it still only fetches
  // once per (lat,lng) in the common case (same query key, cached), but revalidates in the
  // background once that cached response ages past LOCATION_STALE_TIME_MS — the actual mechanism
  // that lets a wrong cached label self-correct.
  const gpsLabelQuery = useQuery({
    queryKey: [...GPS_LABEL_QUERY_KEY, exact?.lat, exact?.lng],
    queryFn: () => apiFetch<AppLocation>(`/location/me?lat=${exact!.lat}&lng=${exact!.lng}`),
    enabled: exact !== null && exact.source === 'gps',
    staleTime: LOCATION_STALE_TIME_MS,
  });

  useEffect(() => {
    if (gpsLabelQuery.data) setExact(gpsLabelQuery.data);
  }, [gpsLabelQuery.data, setExact]);

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
