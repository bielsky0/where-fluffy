import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { toast } from 'sonner';
import type { Pet } from '@/modules/pets/types/pet.types';
import { generateShareImage } from '../lib/generateShareImage';
import { shareOrDownloadImage } from '../lib/shareImage';

const ANTHRACITE = '#222222';
const MUTED_GRAY = '#8E8E93';
const CORAL = '#FF6B4A';

interface CelebrationSharePromptProps {
  pet: Pet | null;
  onDismiss: () => void;
}

// Flow 4's post-confetti "Podziel się dobrymi wieściami" step — a small bottom-anchored card,
// not a full modal, so it doesn't block the celebration or force an interaction. Shown alongside
// ConfettiBurst (same trigger — ProfilePage.tsx's justResolvedPet), gated separately so the
// prompt can outlive the (much shorter) confetti animation.
export function CelebrationSharePrompt({ pet, onDismiss }: CelebrationSharePromptProps) {
  const [isGenerating, setIsGenerating] = useState(false);

  const handleShare = async () => {
    if (!pet) return;
    setIsGenerating(true);
    try {
      const blob = await generateShareImage(pet);
      await shareOrDownloadImage(blob, `${pet.name ?? 'zwierzak'}-odnaleziony.png`, {
        title: `Odnaleziony: ${pet.name ?? pet.species}`,
        text: 'Świetne wieści — odnaleźliśmy się dzięki Where’s Fluffy!',
      });
    } catch {
      toast('Nie udało się przygotować grafiki do udostępnienia');
    } finally {
      setIsGenerating(false);
      onDismiss();
    }
  };

  return (
    <AnimatePresence>
      {pet && (
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 40 }}
          transition={{ type: 'spring', damping: 28, stiffness: 300 }}
          className="fixed inset-x-4 bottom-24 z-[1400] flex items-center gap-3 rounded-[24px] bg-white p-4 shadow-[0_10px_30px_-8px_rgba(0,0,0,0.25)]"
        >
          <div className="flex-1">
            <p className="text-sm font-bold" style={{ color: ANTHRACITE }}>
              Podziel się dobrymi wieściami
            </p>
            <p className="text-xs" style={{ color: MUTED_GRAY }}>
              Pokaż wszystkim, że {pet.name ?? 'zwierzak'} jest już bezpieczny.
            </p>
          </div>
          <button
            type="button"
            onClick={onDismiss}
            aria-label="Zamknij"
            className="shrink-0 text-xs font-semibold"
            style={{ color: MUTED_GRAY }}
          >
            Później
          </button>
          <button
            type="button"
            onClick={() => void handleShare()}
            disabled={isGenerating}
            className="shrink-0 rounded-full px-4 py-2 text-xs font-bold text-white disabled:opacity-60"
            style={{ backgroundColor: CORAL }}
          >
            {isGenerating ? '…' : 'Udostępnij'}
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
