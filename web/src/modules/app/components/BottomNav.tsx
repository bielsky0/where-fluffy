import { cn } from '@/shared/lib/cn';

export type NavAction = 'list' | 'report' | 'profile';

// Height reserved above BottomNav's own bottom edge (excluding the safe-area inset, which
// callers add on top via env(safe-area-inset-bottom)) — anything fixed-positioned above the
// nav (BottomSheet's drawer, MainFeedPage's scroll padding) uses this so content never sits
// underneath the now-persistent bar. Kept in lockstep with the nav's actual rendered height
// (py-2.5 row + the icon/label stack) by hand, since there's no ResizeObserver wiring it back.
export const BOTTOM_NAV_CLEARANCE = 'calc(4.5rem + env(safe-area-inset-bottom))';

interface BottomNavProps {
  onAction: (action: NavAction) => void;
  // Which tab reads as "current". Only 'list' is ever derived today (activeView === 'feed' in
  // AppShell) — 'report' opens a modal rather than a persistent view, and 'profile' has no
  // view to land on yet (see AppShell.tsx's runAction), so neither has a meaningful "active"
  // state to show; both simply render in the shared neutral/dark-gray resting style.
  activeAction?: NavAction;
  // True while BottomSheet.tsx's drawer sits at its 'collapsed' snap (AppShell.tsx computes
  // this). The collapsed drawer's header wants the entire bottom strip of the screen for
  // itself (see BottomSheet.tsx), so the nav slides fully out of view instead of leaving a
  // permanent gap underneath it. Stays mounted and only translates — never `display: none` or
  // unmounts — so both the exit and the return are the same hardware-accelerated transform,
  // not a re-mount.
  hidden?: boolean;
}

function ListIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="size-6" aria-hidden="true">
      <path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ReportIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} className="size-6" aria-hidden="true">
      <path d="M12 5v14M5 12h14" strokeLinecap="round" />
    </svg>
  );
}

// Human silhouette drawn inside its own circle outline, per spec, rather than a plain silhouette
// wrapped in a separately-styled ring container.
function ProfileIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="size-6" aria-hidden="true">
      <circle cx="12" cy="12" r="9.25" />
      <circle cx="12" cy="9.75" r="3" />
      <path d="M6.3 18.3c1.3-2.7 3.5-4.15 5.7-4.15s4.4 1.45 5.7 4.15" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

const ITEMS: { id: NavAction; label: string; Icon: () => JSX.Element }[] = [
  { id: 'list', label: 'Lista', Icon: ListIcon },
  { id: 'report', label: 'Zgłoś', Icon: ReportIcon },
  { id: 'profile', label: 'Profil', Icon: ProfileIcon },
];

// Persistent navigation backbone — anchored at the bottom of every top-level view (feed, map +
// drawer, report flow, profile). Three equal-weight, finger-friendly tabs (Airbnb's own bottom
// nav shape: no raised/floating action button) — "Lista" carries the vibrant brand accent when
// active, "Zgłoś" and "Profil" stay neutral dark-gray at rest.
export function BottomNav({ onAction, activeAction, hidden = false }: BottomNavProps) {
  return (
    <nav
      className={cn(
        'fixed inset-x-0 bottom-0 z-[1100] flex items-stretch border-t border-neutral-200 bg-white pb-safe',
        'transition-transform duration-300 ease-out will-change-transform',
        hidden && 'translate-y-full',
      )}
    >
      {ITEMS.map(({ id, label, Icon }) => {
        const active = activeAction === id;
        return (
          <button
            key={id}
            type="button"
            onClick={() => onAction(id)}
            aria-pressed={active}
            className={cn(
              'flex min-h-11 flex-1 flex-col items-center justify-center gap-1 py-2.5 text-[11px] font-semibold tracking-tight transition-colors',
              active ? 'text-rose-600' : 'text-neutral-500 active:text-neutral-700',
            )}
          >
            <Icon />
            {label}
          </button>
        );
      })}
    </nav>
  );
}
