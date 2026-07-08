import { useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Coordinate } from '@/shared/components/map/types';
import { cn } from '@/shared/lib/cn';
import { PetCard } from '@/modules/pets/components/PetCard';
import { usePets } from '@/modules/pets/api/usePets';
import { matchesPetType, type PetTypeFilter } from '@/modules/pets/lib/petType';
import { DEFAULT_CENTER } from '@/modules/pets/lib/geo';
import type { Pet } from '@/modules/pets/types/pet.types';
import { useAppUIStore } from '../store/useAppUIStore';
import { BOTTOM_NAV_CLEARANCE } from '../components/BottomNav';

type FeedCategory = 'all' | PetTypeFilter;

const CATEGORIES: { id: FeedCategory; label: string; icon: string }[] = [
  { id: 'all', label: 'Wszystko', icon: '🌍' },
  { id: 'dog', label: 'Psy', icon: '🐶' },
  { id: 'cat', label: 'Koty', icon: '🐱' },
  { id: 'other', label: 'Inne', icon: '🦔' },
];

// How far (px) the user has to scroll before the header reacts — small enough that a slight
// upward flick reveals it "immediately" (per spec), large enough that momentum-scroll jitter
// at the very top of the page doesn't flicker it.
const SCROLL_HIDE_THRESHOLD = 4;

function ChevronRightIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} className="size-3.5" aria-hidden="true">
      <path d="m9 6 6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function CardCarousel({
  title,
  pets,
  origin,
  emptyLabel,
  onSelectPet,
  onMore,
  scrollKey,
}: {
  title: string;
  pets: Pet[];
  origin: Coordinate;
  emptyLabel: string;
  onSelectPet: (petId: string) => void;
  onMore: () => void;
  // Forces the scroll container to remount (and so reset scrollLeft to 0) whenever the active
  // category changes — without this, the browser's own scroll-anchoring keeps whatever card
  // was previously in view anchored in place as siblings are added/removed by the filter,
  // which reads as the carousel randomly landing mid-scroll instead of back at the start.
  scrollKey: string;
}) {
  return (
    <section className="mb-8">
      <div className="mb-3 flex items-center justify-between px-4">
        <h2 className="text-xl font-extrabold tracking-tight text-black">{title}</h2>
        <button
          type="button"
          onClick={onMore}
          aria-label={`Zobacz więcej: ${title}`}
          className="flex size-8 shrink-0 items-center justify-center rounded-full bg-neutral-100 text-neutral-500 transition-colors active:bg-neutral-200"
        >
          <ChevronRightIcon />
        </button>
      </div>
      {pets.length === 0 ? (
        <p className="px-4 text-sm text-neutral-400">{emptyLabel}</p>
      ) : (
        <div key={scrollKey} className="flex snap-x snap-mandatory gap-3 overflow-x-auto scroll-pl-4 px-4 pb-2">
          {pets.map((pet) => (
            <PetCard
              key={pet.id}
              pet={pet}
              origin={origin}
              onClick={() => onSelectPet(pet.id)}
              className="w-[78%] max-w-[320px] shrink-0 snap-start"
            />
          ))}
        </div>
      )}
    </section>
  );
}

// The main "Airbnb style" landing view — a clean vertical feed, no map anywhere in it. Fully
// self-sufficient (own data fetching, own store wiring, zero props) — same pattern already
// used by SearchModal.tsx/AuthModal.tsx elsewhere in this app, so AppShell.tsx can mount it
// with no prop drilling. Its usePets query is entirely independent of MapExplorerPage's (see
// geo.ts) — browsing the feed never triggers, and never depends on, anything the map/search
// wizard has done, and vice versa; only one of the two pages is ever mounted at a time (see
// AppShell.tsx's activeView switch), so there's never a duplicate in-flight fetch either.
export function MainFeedPage() {
  const navigate = useNavigate();
  const openSearch = useAppUIStore((state) => state.openSearch);
  const showAllResults = useAppUIStore((state) => state.showAllResults);

  const origin = DEFAULT_CENTER;
  const { data: pets, isLoading, isError } = usePets({ ...origin, radius: 5000 });

  const [category, setCategory] = useState<FeedCategory>('all');
  const [headerHidden, setHeaderHidden] = useState(false);
  const lastScrollTop = useRef(0);

  const categoryFilteredPets = useMemo(() => {
    if (!pets) return [];
    const petType = category === 'all' ? null : category;
    return pets.filter((pet) => matchesPetType(pet, petType));
  }, [pets, category]);

  // "Pilne w okolicy" surfaces active missing-pet reports, newest first — the closest thing
  // this app has to "urgent". "Ostatnio widziane" surfaces status: 'found' pets the same way.
  // Note: pets.service.ts only ever creates status: 'missing' records today (see CLAUDE.md /
  // AddReportModal.tsx's disabled "Found" tab) — the second carousel legitimately renders
  // empty until that capability exists, it isn't a bug in this filter.
  const urgentPets = useMemo(
    () =>
      categoryFilteredPets
        .filter((pet) => pet.status === 'missing')
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
    [categoryFilteredPets],
  );
  const recentlySeenPets = useMemo(
    () =>
      categoryFilteredPets
        .filter((pet) => pet.status === 'found')
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
    [categoryFilteredPets],
  );

  // Navigates straight to PetDetailPage's own full-screen route — same "go look at this one
  // pet" intent as PetResultsList.tsx's card tap, and deliberately the same choice: not
  // usePetMapStore's selectPet, since that's what MapView's own pin taps use to surface the
  // lightweight PetDetailPanel inline in MapExplorerPage's drawer instead.
  const handleSelectPet = (petId: string) => {
    navigate(`/app/pets/${petId}`);
  };

  const handleScroll = (event: React.UIEvent<HTMLDivElement>) => {
    const { scrollTop } = event.currentTarget;
    const delta = scrollTop - lastScrollTop.current;

    if (scrollTop <= 0) {
      setHeaderHidden(false);
    } else if (delta > SCROLL_HIDE_THRESHOLD) {
      setHeaderHidden(true);
    } else if (delta < -SCROLL_HIDE_THRESHOLD) {
      setHeaderHidden(false);
    }
    lastScrollTop.current = scrollTop;
  };

  return (
    <div className="relative h-full bg-white">
      <header
        className={cn(
          'fixed inset-x-0 top-0 z-[900] flex flex-col gap-3 bg-white/95 pb-3 pt-safe backdrop-blur-md transition-transform duration-300 ease-out',
          'shadow-[0_16px_32px_-20px_rgba(0,0,0,0.18)]',
          headerHidden && '-translate-y-full',
        )}
      >
        <button
          type="button"
          onClick={openSearch}
          className="mx-4 mt-3 flex items-center gap-2 rounded-full bg-white px-4 py-3 text-left shadow-[0_8px_24px_-8px_rgba(0,0,0,0.15)]"
        >
          <span aria-hidden="true">🔍</span>
          <span className="truncate text-sm text-neutral-400">Wyszukaj rasę, miasto, ulicę…</span>
        </button>

        <div className="flex gap-2 overflow-x-auto px-4">
          {CATEGORIES.map(({ id, label, icon }) => {
            const active = category === id;
            return (
              <button
                key={id}
                type="button"
                onClick={() => setCategory(id)}
                aria-pressed={active}
                className="flex shrink-0 flex-col items-center gap-1.5"
              >
                <span
                  className={cn(
                    'flex items-center gap-1.5 rounded-full border border-neutral-200 px-3.5 py-2 text-sm transition-colors',
                    active ? 'font-bold text-black' : 'font-medium text-neutral-500',
                  )}
                >
                  <span aria-hidden="true">{icon}</span>
                  {label}
                </span>
                <span className={cn('h-0.5 w-6 rounded-full transition-colors', active ? 'bg-black' : 'bg-transparent')} />
              </button>
            );
          })}
        </div>
      </header>

      <div
        onScroll={handleScroll}
        className="h-full overflow-y-auto pt-[8.5rem]"
        style={{ paddingBottom: BOTTOM_NAV_CLEARANCE }}
      >
        {isLoading && <p className="px-4 py-8 text-center text-sm text-neutral-400">Ładowanie…</p>}
        {isError && (
          <p className="px-4 py-8 text-center text-sm text-red-600">Nie udało się wczytać zwierzaków w pobliżu.</p>
        )}

        {!isLoading && !isError && (
          <>
            <CardCarousel
              title="Pilne w okolicy"
              pets={urgentPets}
              origin={origin}
              emptyLabel="Brak pilnych zgłoszeń w wybranej kategorii."
              onSelectPet={handleSelectPet}
              onMore={showAllResults}
              scrollKey={category}
            />
            <CardCarousel
              title="Ostatnio widziane"
              pets={recentlySeenPets}
              origin={origin}
              emptyLabel="Brak niedawno widzianych zwierzaków w wybranej kategorii."
              onSelectPet={handleSelectPet}
              onMore={showAllResults}
              scrollKey={category}
            />
          </>
        )}
      </div>
    </div>
  );
}
