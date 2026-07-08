interface SearchBarProps {
  onOpenSearch: () => void;
}

function SearchIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="size-5 shrink-0" aria-hidden="true">
      <circle cx="11" cy="11" r="7" />
      <path d="m21 21-4.3-4.3" strokeLinecap="round" />
    </svg>
  );
}

// Floating, solid-white pill pinned to the top of the screen in STATE_A only (see
// AppShell.tsx) — the idle, pre-search invite-to-search bar. STATE_C's richer floating cluster
// (back circle + two-line capsule + filter circle + quick-filter pills) is ResultsTopBar.tsx,
// not a second mode of this component — the two shapes share little beyond "a white capsule at
// the top of the screen". STATE_B (the wizard) owns its own header.
export function SearchBar({ onOpenSearch }: SearchBarProps) {
  return (
    <div className="pointer-events-none fixed inset-x-0 top-0 z-[900] px-4 pt-safe">
      <button
        type="button"
        onClick={onOpenSearch}
        className="pointer-events-auto mt-3 flex w-full items-center gap-2 rounded-full bg-white py-3 pl-4 pr-4 text-left shadow-[0_8px_20px_-6px_rgba(0,0,0,0.25)]"
      >
        <SearchIcon />
        <span className="truncate text-sm text-neutral-400">Szukaj zwierzaka lub lokalizacji…</span>
      </button>
    </div>
  );
}
