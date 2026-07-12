import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { cn } from '@/shared/lib/cn';
import { useLocationSearch } from '@/modules/geocode/api/useLocationSearch';
import type { GeocodeResult } from '@/modules/geocode/types/geocode.types';
import type { Coordinate } from '@/shared/components/map/types';
import { CrosshairIcon, SearchIcon } from './icons';

// Photon (the geocoder behind useLocationSearch) can return the exact same place more than once
// (duplicate label+coords, seen in practice for administrative-boundary queries) — dedupe by
// label so the list doesn't show the same result three times, which also doubled as a React key
// collision (`${lat}-${lng}` isn't unique when two entries share coords).
function dedupeByLabel(results: GeocodeResult[]): GeocodeResult[] {
  const seen = new Set<string>();
  return results.filter((result) => {
    if (seen.has(result.label)) return false;
    seen.add(result.label);
    return true;
  });
}

export type StatusFilter = 'all' | 'missing' | 'found';

const STATUS_OPTIONS: { id: StatusFilter; label: string }[] = [
  { id: 'all', label: 'Obie' },
  { id: 'missing', label: 'Zaginione' },
  { id: 'found', label: 'Widziane' },
];

interface HeroSearchOverlayProps {
  open: boolean;
  onClose: () => void;
  onSelectLocation: (center: Coordinate, label: string) => void;
  onUseMyLocation: () => void;
  // Called once the bottom "Szukaj" button is pressed, with whichever status chip is selected —
  // Hero.tsx uses this to jump straight into the app's map view (not the feed), centered on
  // whatever location was picked, with this status pre-applied (see useAppUIStore's openMapAt).
  onSearch: (status: StatusFilter) => void;
}

// Full-screen location search, triggered by Hero's search pill acting as a trigger (per spec)
// rather than expanding in place. Deliberately a landing-local component, not a reuse of
// modules/app's SearchModal/useAppUIStore: both pull real value imports from modules/pets/lib,
// which the landing bundle must never import (see routes.tsx's bundle-isolation comment).
// Picking a result (or "use my location") applies immediately via onSelectLocation/onUseMyLocation
// — Hero's own map/pill update right away, even behind this overlay, so closing via "Anuluj"
// still leaves the picked location in place — while the bottom "Szukaj" button is the separate
// confirm action that redirects into the app, per the requested flow: choose a place, choose a
// status, then search.
export function HeroSearchOverlay({ open, onClose, onSelectLocation, onUseMyLocation, onSearch }: HeroSearchOverlayProps) {
  const [query, setQuery] = useState('');
  const [chosenLabel, setChosenLabel] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const { data: rawResults = [], isFetching } = useLocationSearch(query);
  const results = useMemo(() => dedupeByLabel(rawResults), [rawResults]);
  const trimmed = query.trim();

  // Reset so reopening the overlay always starts from a blank search rather than the last query.
  useEffect(() => {
    if (!open) {
      setQuery('');
      setChosenLabel(null);
      setStatusFilter('all');
    }
  }, [open]);

  const handleSearch = () => {
    onSearch(statusFilter);
    onClose();
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0, y: '100%' }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: '100%' }}
          transition={{ type: 'spring', damping: 28, stiffness: 300 }}
          className="fixed inset-0 z-[1000] flex flex-col bg-white pt-safe"
        >
          <div className="flex items-center gap-2 border-b border-neutral-100 px-4 py-3">
            <div className="flex flex-1 items-center gap-2 rounded-full bg-neutral-100 px-4 py-3">
              <SearchIcon className="size-4 shrink-0 text-subtle" />
              <input
                autoFocus
                value={query}
                onChange={(event) => {
                  setQuery(event.target.value);
                  setChosenLabel(null);
                }}
                placeholder="Wpisz miasto lub dzielnicę..."
                className="w-full bg-transparent text-sm text-ink outline-none placeholder:text-subtle"
              />
            </div>
            <button type="button" onClick={onClose} className="shrink-0 px-2 text-sm font-semibold text-subtle">
              Anuluj
            </button>
          </div>

          <button
            type="button"
            onClick={() => {
              setChosenLabel(null);
              setQuery('');
              onUseMyLocation();
            }}
            className="flex items-center gap-3 border-b border-neutral-100 px-4 py-4 text-left"
          >
            <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-coral/10 text-coral">
              <CrosshairIcon className="size-4" />
            </span>
            <span className="text-sm font-semibold text-ink">Użyj mojej lokalizacji</span>
          </button>

          <div className="flex-1 overflow-y-auto">
            {isFetching && <p className="px-4 py-6 text-sm text-subtle">Szukam…</p>}
            {!isFetching && trimmed.length >= 2 && results.length === 0 && (
              <p className="px-4 py-6 text-sm text-subtle">Brak wyników.</p>
            )}
            {chosenLabel && (
              <p className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-coral">
                Wybrano: {chosenLabel}
              </p>
            )}
            {results.map((result) => {
              const selected = chosenLabel === result.label;
              return (
                <button
                  key={result.label}
                  type="button"
                  onClick={() => {
                    setChosenLabel(result.label);
                    setQuery(result.label);
                    onSelectLocation({ lat: result.lat, lng: result.lng }, result.label);
                  }}
                  className={cn(
                    'block w-full border-b border-neutral-50 px-4 py-3 text-left text-sm text-ink',
                    selected && 'bg-coral/5 font-semibold',
                  )}
                >
                  {result.label}
                </button>
              );
            })}
          </div>

          <div className="border-t border-neutral-100 px-4 py-4">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-subtle">Typ zgłoszenia</p>
            <div className="mb-4 flex gap-2">
              {STATUS_OPTIONS.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => setStatusFilter(option.id)}
                  aria-pressed={statusFilter === option.id}
                  className={cn(
                    'flex-1 rounded-full border px-3 py-2 text-sm font-medium transition-colors',
                    statusFilter === option.id
                      ? 'border-coral bg-coral text-white'
                      : 'border-neutral-200 text-subtle',
                  )}
                >
                  {option.label}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={handleSearch}
              className="flex h-12 w-full items-center justify-center gap-2 rounded-full bg-coral text-sm font-semibold text-white"
            >
              <SearchIcon className="size-4" />
              Szukaj
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
