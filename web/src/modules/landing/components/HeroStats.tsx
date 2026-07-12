import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useCountUp } from '@/shared/lib/useCountUp';
import type { MapStats } from '@/modules/map/api/useMapStats';

interface HeroStatsProps {
  stats: MapStats | undefined;
}

// Two distinct animations share this one number, depending on trigger. The very first value
// this component ever sees counts up smoothly from 0 (useCountUp, ease-out, ~800ms) — the
// spec's "counters initializing" sweep. Every value *after* that (a radius/search change)
// replaces the old number outright — fades down/out, new one fades in from above — rather than
// rolling the digits, so useCountUp is deliberately only consulted for that first render; once
// `settled` flips true, the raw value is shown directly through the AnimatePresence swap below.
export function HeroStats({ stats }: HeroStatsProps) {
  const hasSettledRef = useRef(false);
  const [settled, setSettled] = useState(false);
  const countUpValue = useCountUp(stats?.total ?? 0, 800);

  useEffect(() => {
    if (!hasSettledRef.current && stats && countUpValue === stats.total) {
      hasSettledRef.current = true;
      setSettled(true);
    }
  }, [countUpValue, stats]);

  if (!stats) return null;

  const displayedTotal = settled ? stats.total : countUpValue;

  return (
    <div className="flex flex-col gap-2">
      <p className="text-lg text-subtle">
        Aktualnie w Twojej okolicy:{' '}
        <span className="relative inline-block min-w-[2ch] overflow-hidden align-bottom">
          <AnimatePresence mode="popLayout" initial={false}>
            <motion.span
              key={settled ? stats.total : 'counting'}
              initial={settled ? { opacity: 0, y: -16 } : false}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 16 }}
              transition={{ duration: 0.25 }}
              className="inline-block font-bold text-coral"
            >
              {displayedTotal}
            </motion.span>
          </AnimatePresence>
        </span>{' '}
        zwierzaków
      </p>
      <div className="flex items-center justify-center gap-4 text-sm text-subtle sm:justify-start">
        <span className="flex items-center gap-1.5">
          <span className="size-2 rounded-full bg-red-500" aria-hidden="true" />
          Zaginione: <span className="font-semibold text-ink">{stats.missing}</span>
        </span>
        <span className="flex items-center gap-1.5">
          <span className="size-2 rounded-full bg-emerald-500" aria-hidden="true" />
          Widziane: <span className="font-semibold text-ink">{stats.found}</span>
        </span>
      </div>
    </div>
  );
}
