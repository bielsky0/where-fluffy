import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';

interface ConfettiBurstProps {
  // Bump this (ProfilePage.tsx's handleResolve does `key + 1`) to fire one burst. 0 means "never
  // fired yet" so mounting the page doesn't itself trigger confetti.
  triggerKey: number;
}

const COLORS = ['#FF6B4A', '#FFC145', '#4ADE80', '#60A5FA', '#F472B6'];
const PARTICLE_COUNT = 26;
const BURST_DURATION_MS = 1100;

interface Particle {
  id: number;
  xVw: number;
  driftVw: number;
  rotate: number;
  delay: number;
  color: string;
  tall: boolean;
}

// Pure CSS/SVG-free particle burst (no external image/canvas asset, per the page's own "no
// external assets" constraint) — each particle is a plain absolutely-positioned div animated by
// framer-motion, which is already a dependency (see PetDetailPanel.tsx's own use of it).
function buildParticles(): Particle[] {
  return Array.from({ length: PARTICLE_COUNT }, (_, i) => ({
    id: i,
    xVw: (Math.random() - 0.5) * 70,
    driftVw: (Math.random() - 0.5) * 30,
    rotate: Math.round(Math.random() * 520 - 260),
    delay: Math.random() * 0.12,
    color: COLORS[i % COLORS.length],
    tall: i % 3 === 0,
  }));
}

export function ConfettiBurst({ triggerKey }: ConfettiBurstProps) {
  const [active, setActive] = useState(false);
  const particles = useMemo(() => buildParticles(), [triggerKey]);

  useEffect(() => {
    if (triggerKey === 0) return;
    setActive(true);
    const timeout = setTimeout(() => setActive(false), BURST_DURATION_MS);
    return () => clearTimeout(timeout);
  }, [triggerKey]);

  return (
    <AnimatePresence>
      {active && (
        <div className="pointer-events-none fixed inset-0 z-[1400] overflow-hidden" aria-hidden="true">
          {particles.map((particle) => (
            <motion.span
              key={particle.id}
              initial={{
                opacity: 1,
                x: `calc(50vw + ${particle.xVw}vw)`,
                y: '30vh',
                rotate: 0,
              }}
              animate={{
                opacity: 0,
                x: `calc(50vw + ${particle.xVw + particle.driftVw}vw)`,
                y: '108vh',
                rotate: particle.rotate,
              }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.9 + particle.delay, delay: particle.delay, ease: 'easeIn' }}
              className="absolute left-0 top-0 rounded-[2px]"
              style={{
                backgroundColor: particle.color,
                width: particle.tall ? 4 : 8,
                height: particle.tall ? 12 : 6,
              }}
            />
          ))}
        </div>
      )}
    </AnimatePresence>
  );
}
