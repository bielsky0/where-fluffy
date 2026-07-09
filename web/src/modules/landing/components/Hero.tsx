import { lazy, Suspense } from 'react';
import { motion } from 'framer-motion';
import { Button } from '@/shared/ui';
import { CrosshairIcon, PlusIcon, SearchIcon } from './icons';

// Lazy-loaded so react-leaflet/leaflet (and its tile requests) ship in a separate chunk fetched
// only once the landing page has already painted — see HeroMap.tsx and the bundle-isolation
// comment below. The Suspense fallback below renders the same static grid pattern this backdrop
// used before the real map existed, so there's no layout shift/blank flash while that chunk loads.
const HeroMap = lazy(() => import('./HeroMap'));

interface HeroProps {
  onGetStarted: () => void;
}

const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  visible: (delay: number) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.6, delay, ease: [0.32, 0.72, 0, 1] },
  }),
};

// Decorative pins scattered across the map background — plain absolutely-positioned markup, kept
// separate from the real `<Map/>` underneath (see HeroMap.tsx) rather than passed to it as
// `MapMarkerProps`: these exist purely for "social proof" (concrete, colorful dots) and must stay
// sharp/colorful while the map itself is grayscaled and blurred (see the layer-0 wrapper below) —
// piggybacking on the map's own marker system would drag them through the same CSS filter and
// into whatever chunk it loads in. Tapping the hero routes into the real interactive map via
// onGetStarted. `halo`/`dot` are stored as complete class-name literals (not built with
// `${tone}/40` template interpolation) so Tailwind's static source scanner — which just greps
// this file's raw text for candidate class strings, it doesn't evaluate JS — can actually see
// "bg-coral/40" etc. as whole substrings and generate them.
const MAP_PINS = [
  { top: '22%', left: '18%', halo: 'bg-coral/40', dot: 'bg-coral' },
  { top: '64%', left: '28%', halo: 'bg-success/40', dot: 'bg-success' },
  { top: '38%', left: '48%', halo: 'bg-ink/40', dot: 'bg-ink' },
  { top: '70%', left: '62%', halo: 'bg-coral/40', dot: 'bg-coral' },
  { top: '18%', left: '76%', halo: 'bg-success/40', dot: 'bg-success' },
] as const;

// Deliberately dependency-light at the top level: no TanStack Query, no Zustand, no socket.io —
// this component (and the LandingPage that renders it) must stay cheap enough that visiting `/`
// never pulls in the app-shell's heavier chunks (see routes.tsx's per-route dynamic imports).
// framer-motion is fine here — it's a plain peer dependency, not gated behind
// modules/pets|chat|auth. react-leaflet is the one exception, and it's kept out of this cost by
// lazy-loading it (see the `HeroMap` import above) rather than by avoiding it altogether.
//
// Four-layer "sandwich", back to front: (0) a real, non-interactive Leaflet map, grayscaled +
// blurred into a soft backdrop, (1) a white/60 overlay that softens it further into legible
// contrast, (2) headline + social-proof typography, (3) the floating rounded-full search pill.
// Layers 0+1 are one absolutely-positioned wrapper (`-z-10`); 2+3 sit in normal flow on top of
// it so the section's height is still content-driven.
export function Hero({ onGetStarted }: HeroProps) {
  return (
    <section className="relative isolate flex min-h-[600px] flex-col overflow-hidden bg-surface px-6 pb-14 pt-safe sm:px-10">
      {/* Warstwa 0: Mapa (tło, grayscale + blur) — grayscale/blur only apply to the map itself,
          not to the pins below: they're deliberately sharp and colorful ("różne kolory") to read
          as social proof against the desaturated, softened map. `pointer-events-none` + the
          `-inset-6` overhang (clipped by the section's own `overflow-hidden`) keep this purely
          decorative: no drag/scroll-zoom hijacking the page, and no light fringe at the blurred
          edges from sampling past the container's own bounds. */}
      <div aria-hidden="true" className="absolute inset-0 -z-10">
        <div className="pointer-events-none absolute -inset-6 grayscale blur-sm">
          <Suspense
            fallback={
              <div className="h-full w-full bg-surface [background-image:repeating-linear-gradient(0deg,transparent,transparent_38px,rgba(0,0,0,0.06)_38px,rgba(0,0,0,0.06)_40px),repeating-linear-gradient(90deg,transparent,transparent_38px,rgba(0,0,0,0.06)_38px,rgba(0,0,0,0.06)_40px)]" />
            }
          >
            <HeroMap />
          </Suspense>
        </div>
        {MAP_PINS.map((pin, index) => (
          <span
            key={index}
            className="absolute -translate-x-1/2 -translate-y-1/2"
            style={{ top: pin.top, left: pin.left }}
          >
            <span className={`absolute inset-0 rounded-full ${pin.halo} animate-marker-pulse`} />
            <span
              className={`relative block size-3 rounded-full shadow-md ring-2 ring-white ${pin.dot}`}
            />
          </span>
        ))}
      </div>

      {/* Warstwa 1: Overlay */}
      <div aria-hidden="true" className="absolute inset-0 -z-10 bg-white/60" />

      <div className="flex items-center justify-end pt-6">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onGetStarted}
          className="gap-1.5 rounded-full border-coral bg-white text-coral hover:bg-coral/5"
        >
          <PlusIcon className="size-4" />
          Dodaj ogłoszenie
        </Button>
      </div>

      {/* Warstwa 2: Typografia */}
      <div className="flex flex-1 flex-col justify-center gap-4 py-10 text-center sm:text-left">
        <motion.h1
          variants={fadeUp}
          custom={0}
          initial="hidden"
          animate="visible"
          className="text-5xl font-bold leading-tight text-ink"
        >
          Znajdź zaginionego zwierzaka w Twojej okolicy
        </motion.h1>
        <motion.p
          variants={fadeUp}
          custom={0.1}
          initial="hidden"
          animate="visible"
          className="mx-auto max-w-md text-lg text-subtle sm:mx-0"
        >
          Aktualnie w Twoim mieście: <span className="font-bold text-coral">14 zgłoszeń</span>,{' '}
          <span className="font-bold text-coral">3 zwierzaki</span> wróciły do domu dzisiaj.
        </motion.p>
      </div>

      {/* Warstwa 3: Pastylka wyszukiwania */}
      <motion.div
        variants={fadeUp}
        custom={0.2}
        initial="hidden"
        animate="visible"
        className="mx-auto flex h-16 w-[90%] max-w-[600px] items-center gap-2 rounded-full bg-white py-2 pl-5 pr-2 shadow-xl ring-1 ring-black/5"
      >
        <SearchIcon className="size-5 shrink-0 text-subtle" />
        <button
          type="button"
          onClick={onGetStarted}
          className="flex-1 truncate text-left text-sm text-subtle"
        >
          Wpisz miasto lub dzielnicę...
        </button>
        <button
          type="button"
          onClick={onGetStarted}
          className="hidden shrink-0 items-center justify-center rounded-full p-2.5 text-subtle transition-colors hover:bg-surface sm:flex"
          aria-label="Użyj mojej lokalizacji"
        >
          <CrosshairIcon className="size-5" />
        </button>
        <button
          type="button"
          onClick={onGetStarted}
          className="flex size-11 shrink-0 items-center justify-center rounded-full bg-coral text-white transition-colors hover:bg-coral-hover"
          aria-label="Szukaj"
        >
          <SearchIcon className="size-5" />
        </button>
      </motion.div>
    </section>
  );
}
