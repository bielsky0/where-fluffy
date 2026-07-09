import { useEffect, useRef, useState, type RefObject } from 'react';
import { useNavigate } from 'react-router-dom';
import { useVirtualizer } from '@tanstack/react-virtual';
import type { Coordinate } from '@/shared/components/map/types';
import { PetCard } from './PetCard';
import type { Pet } from '../types/pet.types';

interface PetResultsListProps {
  pets: Pet[];
  origin: Coordinate;
  selectedPetId: string | null;
  // Passed straight through to each PetCard — MapExplorerPage.tsx sets this to a landscape
  // ratio at BottomSheet.tsx's 'half' snap (which slices `pets` down to a single card, see its
  // own `visibleResultsPets` comment), so that one card's image stops over-extending past the
  // half-screen budget; left undefined (PetCard's own portrait default) at every other snap.
  imageAspectClassName?: string;
  // BottomSheet.tsx's own content div — its `overflow-y-auto`/gesture-handoff logic makes it the
  // *real* scroll container this list must window against (see BottomSheet's `contentRef` doc
  // comment). This list renders as that div's only child (no heading/carousel above it, unlike
  // FeedList.tsx's shared MainFeedPage container), so no scrollMargin bookkeeping is needed.
  scrollContainerRef: RefObject<HTMLDivElement>;
  fetchNextPage: () => void;
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
}

// Portrait PetCard (default image ratio + 3-line metadata) + gap — this drawer's default card
// ratio differs from FeedList.tsx's landscape one, hence the different estimate.
const ESTIMATED_ROW_HEIGHT = 420;

// Content of the results drawer (BottomSheet.tsx) in AppShell.tsx's STATE_C. Deliberately no
// filter controls here — those live entirely in SearchModal.tsx's wizard now; this only
// renders whatever `pets` it's given.
//
// Tapping a card navigates straight to PetDetailPage (its own full-screen route) rather than
// calling usePetMapStore's selectPet — selectPet is what MapView's own pin taps still use to
// show the lightweight PetDetailPanel inline in this same drawer; deliberately not reusing that
// here, since setting selectedPetId would make the drawer land back on PetDetailPanel (instead
// of this list) if the user later taps the browser/OS back button off of PetDetailPage.
//
// Virtualized via @tanstack/react-virtual, mirroring FeedList.tsx's pattern exactly — windowing
// against the ancestor `scrollContainerRef` (BottomSheet's content div) rather than owning a
// second nested scroll container, which would break that div's own overscroll drag-handoff.
export function PetResultsList({
  pets,
  origin,
  selectedPetId,
  imageAspectClassName,
  scrollContainerRef,
  fetchNextPage,
  hasNextPage,
  isFetchingNextPage,
}: PetResultsListProps) {
  const navigate = useNavigate();
  const wrapperRef = useRef<HTMLDivElement>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const [inView, setInView] = useState(false);

  const rowVirtualizer = useVirtualizer({
    count: pets.length,
    getScrollElement: () => scrollContainerRef.current,
    estimateSize: () => ESTIMATED_ROW_HEIGHT,
    overscan: 5,
    gap: 16,
  });

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;
    const observer = new IntersectionObserver(([entry]) => setInView(entry.isIntersecting), { rootMargin: '400px' });
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, []);

  // Same mandatory triple-gate as FeedList.tsx's own effect — see its comment for why this
  // can't just live inside the IntersectionObserver callback.
  useEffect(() => {
    if (inView && hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
  }, [inView, hasNextPage, isFetchingNextPage, fetchNextPage]);

  if (pets.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">
        Brak zwierzaków spełniających wybrane filtry.
      </p>
    );
  }

  return (
    <div ref={wrapperRef} className="relative" style={{ height: rowVirtualizer.getTotalSize() }}>
      {rowVirtualizer.getVirtualItems().map((virtualRow) => {
        const pet = pets[virtualRow.index];
        return (
          <div
            key={pet.id}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              transform: `translateY(${virtualRow.start}px)`,
            }}
          >
            <PetCard
              pet={pet}
              origin={origin}
              selected={pet.id === selectedPetId}
              onClick={() => navigate(`/app/pets/${pet.id}`)}
              className="w-full pb-4"
              imageAspectClassName={imageAspectClassName}
            />
          </div>
        );
      })}
      <div
        ref={sentinelRef}
        className="absolute h-px w-full"
        style={{ transform: `translateY(${rowVirtualizer.getTotalSize()}px)` }}
      />
      {isFetchingNextPage && <p className="py-4 text-center text-sm text-muted-foreground">Ładowanie kolejnych…</p>}
    </div>
  );
}
