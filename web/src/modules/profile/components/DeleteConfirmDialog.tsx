import { AnimatePresence, motion } from 'framer-motion';
import type { ProfileListing } from '../types/profile.types';

const ANTHRACITE = '#222222';
const MUTED_GRAY = '#8E8E93';
const DANGER_RED = '#DC2626';

interface DeleteConfirmDialogProps {
  listing: ProfileListing | null;
  open: boolean;
  isDeleting: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

function TrashIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke={DANGER_RED} strokeWidth={1.8} className="size-8" aria-hidden="true">
      <path d="M4 7h16M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2m-9 0 1 13a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-13" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// No shadcn Dialog exists in this codebase (components.json is wired for it but nothing's been
// generated beyond Button/PageLayout/ThemeToggle) — small centered modal instead, hand-rolled to
// match the hex-token style every other component in this module already uses. Flow 5's "danger
// zone" friction: gray Cancel is visually primary/default, red "Usuń bezpowrotnie" secondary.
export function DeleteConfirmDialog({ listing, open, isDeleting, onCancel, onConfirm }: DeleteConfirmDialogProps) {
  return (
    <AnimatePresence>
      {open && listing && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={isDeleting ? undefined : onCancel}
            className="fixed inset-0 z-[1300] bg-black/50"
            aria-hidden="true"
          />
          <div className="fixed inset-0 z-[1301] flex items-center justify-center px-6">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.2 }}
              className="flex w-full max-w-sm flex-col items-center gap-4 rounded-[24px] bg-white p-6 text-center shadow-2xl"
              role="alertdialog"
              aria-modal="true"
            >
              <TrashIcon />
              <h2 className="text-lg font-bold" style={{ color: ANTHRACITE }}>
                Usunąć zgłoszenie?
              </h2>
              <p className="text-sm" style={{ color: MUTED_GRAY }}>
                Ta akcja jest nieodwracalna. Wszystkie dane, w tym historia na mapie, zostaną
                trwale skasowane.
              </p>
              <div className="mt-2 flex w-full flex-col gap-2">
                <button
                  type="button"
                  onClick={onCancel}
                  disabled={isDeleting}
                  className="rounded-full bg-neutral-100 px-5 py-3 text-sm font-bold disabled:opacity-60"
                  style={{ color: ANTHRACITE }}
                >
                  Anuluj
                </button>
                <button
                  type="button"
                  onClick={onConfirm}
                  disabled={isDeleting}
                  className="rounded-full px-5 py-3 text-sm font-bold text-white disabled:opacity-60"
                  style={{ backgroundColor: DANGER_RED }}
                >
                  {isDeleting ? 'Usuwanie…' : 'Usuń bezpowrotnie'}
                </button>
              </div>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
}
