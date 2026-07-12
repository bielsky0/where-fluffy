import { Skeleton } from '@/shared/components/Skeleton';

// Pulsing placeholders for header/stat/slider/pill/map while useAppLocation is still resolving
// the visitor's origin — shown only for that initial window (see Hero.tsx), never mid-session.
export function HeroSkeleton() {
  return (
    <div className="flex flex-col gap-4 py-6">
      <Skeleton className="h-11 w-3/4" />
      <Skeleton className="h-6 w-1/2" />
      <Skeleton className="h-8 w-full max-w-sm" />
      <Skeleton className="mx-auto h-16 w-[90%] max-w-[600px] rounded-full" />
      <Skeleton className="mt-2 h-72 w-full rounded-2xl" />
    </div>
  );
}
