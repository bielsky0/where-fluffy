import { cn } from '@/shared/lib/cn';

// Pulsing pale-gray placeholder shape — used while Hero's live data (location, stats, pins) is
// still resolving. Deliberately a single generic primitive (bg color/shape driven entirely by
// className) rather than named variants — callers compose size/radius themselves.
export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden="true" className={cn('animate-pulse rounded-md bg-neutral-200/80', className)} />;
}
