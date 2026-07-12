import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import type { MapPin } from '@/modules/map/types/mapPin.types';

const CATEGORY_EMOJI: Record<MapPin['category'], string> = { dog: '🐶', cat: '🐱', other: '🐾' };
const STATUS_LABEL: Record<MapPin['status'], string> = { missing: 'Zaginiony', found: 'Znaleziony' };

interface HeroPinPreviewProps {
  pin: MapPin;
  onClose: () => void;
}

// Minimal marker-tap preview for the public/anonymous Hero map — deliberately not a reuse of
// modules/pets' PetDetailPanel/usePet: those live under modules/pets, which the landing bundle
// must never import (see routes.tsx's bundle-isolation comment). The CTA still routes into the
// real, unauthenticated-reachable pet detail page (/app/pets/:petId, see routes.tsx — not
// wrapped in RequireAuth, same route MainFeedPage.tsx's own card taps use) rather than just the
// generic /app shell, so "Zobacz" actually lands on the pet that was tapped.
export function HeroPinPreview({ pin, onClose }: HeroPinPreviewProps) {
  const navigate = useNavigate();

  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 24 }}
      transition={{ type: 'spring', damping: 26, stiffness: 320 }}
      className="absolute inset-x-3 bottom-3 z-[500] flex items-center gap-3 rounded-2xl bg-white p-3 shadow-xl ring-1 ring-black/5"
    >
      <span className="text-2xl" aria-hidden="true">
        {CATEGORY_EMOJI[pin.category]}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-ink">{STATUS_LABEL[pin.status]}</p>
        <p className="truncate text-xs text-subtle">Zobacz pełne zgłoszenie w aplikacji</p>
      </div>
      <button
        type="button"
        onClick={() => navigate(`/app/pets/${pin.id}`)}
        className="shrink-0 rounded-full bg-coral px-3.5 py-2 text-xs font-semibold text-white"
      >
        Zobacz
      </button>
      <button
        type="button"
        onClick={onClose}
        aria-label="Zamknij"
        className="shrink-0 px-1 text-subtle"
      >
        ✕
      </button>
    </motion.div>
  );
}
