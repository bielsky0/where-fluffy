import { useEffect, useRef, useState, type RefObject } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { PetCard } from '@/modules/pets/components/PetCard';
import type { Coordinate } from '@/shared/components/map/types';
import { useFeedInfinite } from '../api/useFeedInfinite';
import type { FeedQueryParams } from '../types/feed.types';

interface FeedListProps {
  query: FeedQueryParams;
  origin: Coordinate;
  // Points at MainFeedPage's own top-level scroll container (the div with onScroll/header-hide
  // logic) rather than owning a nested scrollable div — @tanstack/react-virtual is designed to
  // "window" against an ancestor scroll container, and nesting a second scrollbar under the
  // urgent carousel would be a broken double-scrollbar UX, not a real virtualized page feed.
  scrollContainerRef: RefObject<HTMLDivElement | null>;
  onSelectPet: (petId: string) => void;
}

const ESTIMATED_ROW_HEIGHT = 340; // portrait PetCard (aspect-[16/9] image + 3-line metadata) + gap

export function FeedList({ query, origin, scrollContainerRef, onSelectPet }: FeedListProps) {
  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading, isError } = useFeedInfinite(query);
  const items = data?.pages.flatMap((page) => page.items) ?? [];

  const wrapperRef = useRef<HTMLDivElement>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const [inView, setInView] = useState(false);
  // How far (px) the top of this component sits below the top of the shared scroll container's
  // content — the urgent carousel + heading render above it in the same scroll container, so the
  // virtualizer needs this offset (scrollMargin) or its visible-range math would assume this
  // component starts at scrollTop 0.
  const [scrollMargin, setScrollMargin] = useState(0);

  useEffect(() => {
    const scrollEl = scrollContainerRef.current;
    const wrapperEl = wrapperRef.current;
    if (!scrollEl || !wrapperEl) return;

    const updateScrollMargin = () => {
      const scrollRect = scrollEl.getBoundingClientRect();
      const wrapperRect = wrapperEl.getBoundingClientRect();
      setScrollMargin(wrapperRect.top - scrollRect.top + scrollEl.scrollTop);
    };
    updateScrollMargin();

    // Re-measure whenever content above this component resizes (e.g. the urgent carousel
    // finishing its loading state) — a stale scrollMargin would make virtualized rows render at
    // the wrong offset once scrolled.
    const resizeObserver = new ResizeObserver(updateScrollMargin);
    resizeObserver.observe(scrollEl);
    return () => resizeObserver.disconnect();
  }, [scrollContainerRef]);

  const rowVirtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => scrollContainerRef.current,
    estimateSize: () => ESTIMATED_ROW_HEIGHT,
    overscan: 5,
    scrollMargin,
  });

  // Tracks sentinel visibility only — does NOT itself decide to fetch (see the effect below).
  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;
    const observer = new IntersectionObserver(([entry]) => setInView(entry.isIntersecting), { rootMargin: '400px' });
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, []);

  // Mandatory triple-gate, kept as its own effect (not inlined into the observer callback):
  // IntersectionObserver only fires on threshold *crossings*, so if the sentinel stays
  // continuously in view across multiple quick page-loads, the observer callback alone would
  // only fire once. Re-running this effect whenever isFetchingNextPage flips back to false
  // (while inView/hasNextPage are still true) is what lets a short viewport keep paging without
  // requiring the user to scroll away and back.
  useEffect(() => {
    if (inView && hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
  }, [inView, hasNextPage, isFetchingNextPage, fetchNextPage]);

  if (isLoading) return <p className="px-4 py-8 text-center text-sm text-neutral-400">Ładowanie…</p>;
  if (isError) return <p className="px-4 py-8 text-center text-sm text-red-600">Nie udało się wczytać ogłoszeń.</p>;
  if (items.length === 0) {
    return <p className="px-4 py-8 text-center text-sm text-neutral-400">Brak ogłoszeń w wybranej kategorii.</p>;
  }

  return (
    <div ref={wrapperRef} className="relative px-4" style={{ height: rowVirtualizer.getTotalSize() }}>
      {rowVirtualizer.getVirtualItems().map((virtualRow) => {
        const pet = items[virtualRow.index];
        return (
          <div
            key={pet.id}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              transform: `translateY(${virtualRow.start - scrollMargin}px)`,
            }}
          >
            <PetCard pet={pet} origin={origin} onClick={() => onSelectPet(pet.id)} className="w-full pb-4" />
          </div>
        );
      })}
      <div
        ref={sentinelRef}
        className="absolute h-px w-full"
        style={{ transform: `translateY(${rowVirtualizer.getTotalSize() - scrollMargin}px)` }}
      />
      {isFetchingNextPage && <p className="py-4 text-center text-sm text-neutral-400">Ładowanie kolejnych…</p>}
    </div>
  );
}
