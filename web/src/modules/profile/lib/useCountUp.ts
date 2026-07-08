import { useEffect, useRef, useState } from 'react';

// Drives the hero card's stat rows: animates from whatever value it last landed on up (or down)
// to `target` whenever `target` changes, rather than restarting from 0 every time — the mount
// case (fromRef starts at 0) still gets the "counters initializing" sweep Flow 1 asks for, but a
// later +1 (ProfilePage.tsx's handleResolve incrementing "Pomogłeś") animates 7→8, not 0→8.
export function useCountUp(target: number, durationMs = 700): number {
  const [value, setValue] = useState(0);
  const fromRef = useRef(0);

  useEffect(() => {
    const from = fromRef.current;
    if (from === target) return;

    let frame: number;
    const start = performance.now();

    const tick = (now: number) => {
      const progress = Math.min((now - start) / durationMs, 1);
      const eased = 1 - (1 - progress) ** 3;
      setValue(Math.round(from + (target - from) * eased));
      if (progress < 1) {
        frame = requestAnimationFrame(tick);
      } else {
        fromRef.current = target;
      }
    };

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [target, durationMs]);

  return value;
}
