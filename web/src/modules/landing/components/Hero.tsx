import { lazy, Suspense, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Button } from '@/shared/ui';
import { useAppLocation } from '@/modules/location/api/useAppLocation';
import { useMapPins } from '@/modules/map/api/useMapPins';
import { useMapStats } from '@/modules/map/api/useMapStats';
import { useDebouncedCallback } from '@/shared/hooks/useDebouncedCallback';
import { useAppUIStore } from '@/modules/app/store/useAppUIStore';
import type { Coordinate } from '@/shared/components/map/types';
import type { MapPin } from '@/modules/map/types/mapPin.types';
import { HeroStats } from './HeroStats';
import { HeroRadiusSlider } from './HeroRadiusSlider';
import { HeroSearchOverlay, type StatusFilter } from './HeroSearchOverlay';
import { HeroPinPreview } from './HeroPinPreview';
import { HeroSkeleton } from './HeroSkeleton';
import { CrosshairIcon, PlusIcon, SearchIcon } from './icons';

// Lazy-loaded so react-leaflet/leaflet (and its tile requests) ship in a separate chunk fetched
// only once the landing page has already painted — see HeroMap.tsx and the bundle-isolation
// comment below. The Suspense fallback below renders the same static grid pattern this backdrop
// used before the real map existed, so there's no layout shift/blank flash while that chunk loads.
const HeroMap = lazy(() => import('./HeroMap'));

interface HeroProps {
  onGetStarted: () => void;
}

const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  visible: (delay: number) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.6, delay, ease: [0.32, 0.72, 0, 1] },
  }),
};

const DEFAULT_RADIUS_KM = 10;
const QUERY_DEBOUNCE_MS = 300;

// This section now issues real TanStack Query calls (location/pins/stats) at its top level —
// deliberately reversing this component's previous "dependency-light, no TanStack Query" design.
// That is NOT a bundle-size regression: @tanstack/react-query is already loaded globally for
// every route via AppProviders.tsx's root PersistQueryClientProvider — only the *convention* of
// this component not calling useQuery changes. react-leaflet's lazy-chunk discipline (see the
// `HeroMap` import above) is a real bundle win and stays exactly as it was: all real
// map/marker/cluster/radius-circle work lives inside that already-lazy chunk. This component
// still never imports from modules/pets, modules/chat, or modules/auth (see routes.tsx's
// bundle-isolation rule) — a marker tap shows a minimal local preview (HeroPinPreview) rather
// than reusing PetDetailPanel/usePet, and the search pill opens a landing-local full-screen
// overlay (HeroSearchOverlay) rather than reusing modules/app's SearchModal, which (unlike its
// sibling useAppUIStore.ts) pulls real value imports from modules/pets/lib. useAppUIStore *is*
// imported directly below, just for its openMapAt action — its own only modules/pets touches are
// `import type` (erased at build, zero runtime cost), same precedent already established by
// useMapPins.ts.
export function Hero({ onGetStarted }: HeroProps) {
  const { origin, isResolving, triggerExactLocation } = useAppLocation();
  const openMapAt = useAppUIStore((state) => state.openMapAt);
  const [searchCenter, setSearchCenter] = useState<Coordinate | null>(null);
  const [searchLabel, setSearchLabel] = useState<string | null>(null);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [liveRadiusKm, setLiveRadiusKm] = useState(DEFAULT_RADIUS_KM);
  const [queryRadiusKm, setQueryRadiusKm] = useState(DEFAULT_RADIUS_KM);
  const [selectedPin, setSelectedPin] = useState<MapPin | null>(null);

  const center: Coordinate = searchCenter ?? { lat: origin.lat, lng: origin.lng };
  const locationLabel = searchLabel ?? origin.city ?? 'Twoja okolica';

  const debouncedSetQueryRadius = useDebouncedCallback(setQueryRadiusKm, QUERY_DEBOUNCE_MS);
  const handleRadiusChange = (km: number) => {
    setLiveRadiusKm(km);
    debouncedSetQueryRadius(km);
  };

  // No point querying against a not-yet-resolved (fallback) center — wait until useAppLocation
  // has settled on something real, same gate the skeleton below uses.
  const queryCenter = isResolving ? null : center;
  const statsQuery = useMapStats(queryCenter, queryRadiusKm * 1000);
  const pinsQuery = useMapPins(
    queryCenter ? { mode: 'radius', center: queryCenter, radiusMeters: queryRadiusKm * 1000 } : null,
  );
  const pins = useMemo(() => pinsQuery.data ?? [], [pinsQuery.data]);

  const handleUseMyLocation = async () => {
    const location = await triggerExactLocation();
    if (location) {
      // Clear any prior manual search override — `origin` itself now reflects the fresh GPS fix
      // (useAppLocation's own store update), including its friendly label once the extended
      // GET /location/me resolves it (see useAppLocation.ts's gpsLabelQuery).
      setSearchCenter(null);
      setSearchLabel(null);
    }
  };

  // "Szukaj" in the search overlay: jump straight into the app's *map* view (STATE_C, via
  // useAppUIStore's openMapAt), centered on whatever Hero's own state currently holds — not the
  // feed AppShell defaults to — with the chosen status filter pre-applied.
  const handleSearchConfirm = (status: StatusFilter) => {
    // searchLabel is only set once a manual Photon result was picked in the overlay
    // (onSelectLocation) — its absence means locationLabel is derived from the user's own
    // resolving origin, so the map view's header should keep tracking it live (see
    // MapExplorerPage.tsx's resultsSubline and LocationFilter's own `source` doc comment).
    const source = searchLabel === null ? 'gps' : undefined;
    openMapAt({ label: locationLabel, coords: center, bbox: null, source }, status === 'all' ? null : status);
    onGetStarted();
  };

  return (
    <section className="relative isolate flex min-h-[600px] flex-col overflow-hidden bg-surface px-6 pb-14 pt-safe sm:px-10">
      <div className="flex items-center justify-end pt-6">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onGetStarted}
          className="gap-1.5 rounded-full border-coral bg-white text-coral hover:bg-coral/5"
        >
          <PlusIcon className="size-4" />
          Dodaj ogłoszenie
        </Button>
      </div>

      {isResolving ? (
        <HeroSkeleton />
      ) : (
        <>
          <motion.div
            variants={fadeUp}
            custom={0}
            initial="hidden"
            animate="visible"
            className="flex flex-col gap-4 py-6 text-center sm:text-left"
          >
            <h1 className="text-5xl font-bold leading-tight text-ink">
              Znajdź zaginionego zwierzaka w Twojej okolicy
            </h1>
            <HeroStats stats={statsQuery.data} />
          </motion.div>

          <motion.div variants={fadeUp} custom={0.1} initial="hidden" animate="visible" className="py-2">
            <HeroRadiusSlider radiusKm={liveRadiusKm} onChange={handleRadiusChange} />
          </motion.div>

          <motion.div variants={fadeUp} custom={0.2} initial="hidden" animate="visible">
            <button
              type="button"
              onClick={() => setIsSearchOpen(true)}
              className="mx-auto flex h-16 w-[90%] max-w-[600px] items-center gap-2 rounded-full bg-white py-2 pl-5 pr-2 text-left shadow-xl ring-1 ring-black/5"
            >
              <SearchIcon className="size-5 shrink-0 text-subtle" />
              <span className="flex-1 truncate text-sm text-subtle">{locationLabel}</span>
              <span
                role="button"
                tabIndex={0}
                onClick={(event) => {
                  event.stopPropagation();
                  void handleUseMyLocation();
                }}
                className="hidden shrink-0 items-center justify-center rounded-full p-2.5 text-subtle transition-colors hover:bg-surface sm:flex"
                aria-label="Użyj mojej lokalizacji"
              >
                <CrosshairIcon className="size-5" />
              </span>
              <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-coral text-white">
                <SearchIcon className="size-5" />
              </span>
            </button>
          </motion.div>

          <motion.div
            variants={fadeUp}
            custom={0.3}
            initial="hidden"
            animate="visible"
            className="relative mt-6 h-72 w-full overflow-hidden rounded-2xl"
          >
            <Suspense
              fallback={
                <div className="h-full w-full bg-surface [background-image:repeating-linear-gradient(0deg,transparent,transparent_38px,rgba(0,0,0,0.06)_38px,rgba(0,0,0,0.06)_40px),repeating-linear-gradient(90deg,transparent,transparent_38px,rgba(0,0,0,0.06)_38px,rgba(0,0,0,0.06)_40px)]" />
              }
            >
              <HeroMap
                center={center}
                radiusMeters={queryRadiusKm * 1000}
                pins={pins}
                onPinClick={setSelectedPin}
              />
            </Suspense>
            <AnimatePresence>
              {selectedPin && <HeroPinPreview pin={selectedPin} onClose={() => setSelectedPin(null)} />}
            </AnimatePresence>
          </motion.div>
        </>
      )}

      <HeroSearchOverlay
        open={isSearchOpen}
        onClose={() => setIsSearchOpen(false)}
        onSelectLocation={(coords, label) => {
          setSearchCenter(coords);
          setSearchLabel(label);
        }}
        onUseMyLocation={() => void handleUseMyLocation()}
        onSearch={handleSearchConfirm}
      />
    </section>
  );
}
