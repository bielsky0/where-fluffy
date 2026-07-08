import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type Theme = 'light' | 'dark';

interface ThemeState {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
}

function applyThemeClass(theme: Theme) {
  document.documentElement.classList.toggle('dark', theme === 'dark');
}

function getInitialTheme(): Theme {
  if (typeof window === 'undefined') return 'light';
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

// Single source of truth for light/dark: persisted like useSessionStore/usePetFilterStore, but
// also has the side effect of toggling the `.dark` class on <html> — every color in
// tailwind.config.ts is defined against CSS vars that `.dark` overrides (see globals.css), so
// this class is the only thing that actually needs to change for the whole app to re-theme.
// Call useThemeStore.getState().theme once at startup (see main.tsx) to apply the persisted/
// OS-preferred theme before first paint; ThemeToggle (shared/ui) is the only other consumer.
export const useThemeStore = create<ThemeState>()(
  persist(
    (set, get) => ({
      theme: getInitialTheme(),
      setTheme: (theme) => {
        applyThemeClass(theme);
        set({ theme });
      },
      toggleTheme: () => {
        const next = get().theme === 'dark' ? 'light' : 'dark';
        applyThemeClass(next);
        set({ theme: next });
      },
    }),
    {
      name: 'fluffy-theme',
      onRehydrateStorage: () => (state) => {
        if (state) applyThemeClass(state.theme);
      },
    },
  ),
);
