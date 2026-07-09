import type { Config } from 'tailwindcss';
import animate from 'tailwindcss-animate';
import plugin from 'tailwindcss/plugin';

// "Friendly & Accessible": warm, high-contrast, generously rounded. Colors are HSL triplets
// consumed as `hsl(var(--x) / <alpha-value>)` (see src/shared/styles/globals.css) so a single
// class like `bg-primary` works unchanged across the light/dark values swapped by the `.dark`
// class on <html> (see src/shared/theme/useTheme.ts) — the shadcn/ui convention, so anything
// pulled in later via `npx shadcn add <component>` (see components.json) drops in with zero
// palette rework.
export default {
  darkMode: ['class'],
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    // Mobile-first is Tailwind's default (unprefixed = base, `sm:`/`md:`/... = min-width
    // overrides upward) — no screens override needed for a PWA that only grows larger.
    extend: {
      colors: {
        border: 'hsl(var(--border) / <alpha-value>)',
        input: 'hsl(var(--input) / <alpha-value>)',
        ring: 'hsl(var(--ring) / <alpha-value>)',
        background: 'hsl(var(--background) / <alpha-value>)',
        foreground: 'hsl(var(--foreground) / <alpha-value>)',
        primary: {
          DEFAULT: 'hsl(var(--primary) / <alpha-value>)',
          foreground: 'hsl(var(--primary-foreground) / <alpha-value>)',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary) / <alpha-value>)',
          foreground: 'hsl(var(--secondary-foreground) / <alpha-value>)',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted) / <alpha-value>)',
          foreground: 'hsl(var(--muted-foreground) / <alpha-value>)',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent) / <alpha-value>)',
          foreground: 'hsl(var(--accent-foreground) / <alpha-value>)',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive) / <alpha-value>)',
          foreground: 'hsl(var(--destructive-foreground) / <alpha-value>)',
        },
        success: {
          DEFAULT: 'hsl(var(--success) / <alpha-value>)',
          foreground: 'hsl(var(--success-foreground) / <alpha-value>)',
        },
        card: {
          DEFAULT: 'hsl(var(--card) / <alpha-value>)',
          foreground: 'hsl(var(--card-foreground) / <alpha-value>)',
        },
        popover: {
          DEFAULT: 'hsl(var(--popover) / <alpha-value>)',
          foreground: 'hsl(var(--popover-foreground) / <alpha-value>)',
        },
        // Fixed brand literals for the add-listing wizard's Airbnb-style rebrand
        // (modules/pets/components/add-listing-wizard/) — deliberately flat hex, not HSL-var
        // tokens: that flow is spec'd to stay pure-white with a coral accent regardless of the
        // app's own light/dark theme, so it intentionally opts out of the `.dark`-swappable
        // system above rather than reusing/repurposing `--primary`. Not used outside that one
        // component tree.
        coral: {
          DEFAULT: '#FF385C',
          hover: '#E31C5F',
        },
        ink: '#222222',
        subtle: '#717171',
      },
      // Friendly brand = soft corners by default; `--radius` is the one knob that reshapes
      // every component built on these tokens (see globals.css).
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 4px)',
        sm: 'calc(var(--radius) - 8px)',
      },
      keyframes: {
        'sheet-slide-up': {
          from: { transform: 'translateY(100%)' },
          to: { transform: 'translateY(0)' },
        },
        'sheet-slide-down': {
          from: { transform: 'translateY(0)' },
          to: { transform: 'translateY(100%)' },
        },
        // Subtle "live" indicator for map markers (missing-pet last-known location) — scales
        // and fades a halo behind the pin rather than moving the pin itself, so it never
        // throws off tap targeting.
        'marker-pulse': {
          '0%, 100%': { transform: 'scale(1)', opacity: '0.6' },
          '50%': { transform: 'scale(1.6)', opacity: '0' },
        },
      },
      animation: {
        'sheet-in': 'sheet-slide-up 0.25s cubic-bezier(0.32, 0.72, 0, 1)',
        'sheet-out': 'sheet-slide-down 0.2s ease-in forwards',
        'marker-pulse': 'marker-pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      },
    },
  },
  plugins: [
    animate,
    // env(safe-area-inset-*) utilities for iOS notches/home-indicator — used by PageLayout
    // (see src/shared/ui/layout/PageLayout.tsx) so fixed bottom bars/sheets never sit under
    // the home-indicator gesture area.
    plugin(({ addUtilities }) => {
      addUtilities({
        '.pt-safe': { paddingTop: 'env(safe-area-inset-top)' },
        '.pb-safe': { paddingBottom: 'env(safe-area-inset-bottom)' },
        '.pl-safe': { paddingLeft: 'env(safe-area-inset-left)' },
        '.pr-safe': { paddingRight: 'env(safe-area-inset-right)' },
      });
    }),
  ],
} satisfies Config;
