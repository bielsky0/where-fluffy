import { cn } from '@/shared/lib/cn';

export type GuestNavAction = 'discover' | 'add' | 'login';

interface GuestTabBarProps {
  onAction: (action: GuestNavAction) => void;
  // Only 'discover' is ever derived (browsing the feed needs no session) — 'add'/'login' both
  // hand off to AuthBottomSheet before landing anywhere, so neither has a meaningful "current"
  // state of its own, same reasoning as BottomNav.tsx's activeAction.
  activeAction?: GuestNavAction;
  // Mirrors BottomNav.tsx's `hidden` — STATE_C's collapsed drawer wants the bottom strip for
  // itself regardless of session state, so AppShell.tsx passes the same computed boolean to
  // whichever of the two bars is currently mounted.
  hidden?: boolean;
}

function SearchIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="size-6" aria-hidden="true">
      <circle cx="11" cy="11" r="7" />
      <path d="m21 21-4.3-4.3" strokeLinecap="round" />
    </svg>
  );
}

function AddIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} className="size-6" aria-hidden="true">
      <path d="M12 5v14M5 12h14" strokeLinecap="round" />
    </svg>
  );
}

// Same silhouette-in-a-circle as BottomNav.tsx's ProfileIcon — "Zaloguj się" is this bar's
// stand-in for that same destination before a session exists, so it keeps the same glyph.
function LoginIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="size-6" aria-hidden="true">
      <circle cx="12" cy="12" r="9.25" />
      <circle cx="12" cy="9.75" r="3" />
      <path d="M6.3 18.3c1.3-2.7 3.5-4.15 5.7-4.15s4.4 1.45 5.7 4.15" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

const ITEMS: { id: GuestNavAction; label: string; Icon: () => JSX.Element }[] = [
  { id: 'discover', label: 'Odkrywaj', Icon: SearchIcon },
  { id: 'add', label: 'Dodaj', Icon: AddIcon },
  { id: 'login', label: 'Zaloguj się', Icon: LoginIcon },
];

// Unauthenticated counterpart to BottomNav.tsx, swapped in by AppShell.tsx whenever
// useSessionStore has no currentUser. Same three-tab, equal-weight shape and the same fixed
// bottom-of-viewport placement/z-index (z-[1100]) as BottomNav — that z-index matters here
// specifically because AuthBottomSheet.tsx sits above it (z-[1500]) while its own backdrop
// sits below it (z-[1050]): this bar's opaque white background is what keeps it legible
// against the dimmed page behind it, and being under the sheet is what lets the sheet read as
// rising up from behind it. "Odkrywaj" is the only tab that doesn't require a session — it's
// active by default and just browses, same intent as BottomNav's "Lista" — so it alone renders
// in the coral brand accent; "Dodaj" and "Zaloguj się" both hand off to AuthBottomSheet and
// stay neutral dark-gray at rest, same resting treatment BottomNav gives its own non-active tabs.
export function GuestTabBar({ onAction, activeAction, hidden = false }: GuestTabBarProps) {
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
