import { AnimatePresence, motion, type PanInfo } from 'framer-motion';
import type { ProfileListing } from '../types/profile.types';

const ANTHRACITE = '#222222';
const MUTED_GRAY = '#8E8E93';
const HAIRLINE_BORDER = '#E5E5E5';
const SUCCESS_GREEN = '#22C55E';
const DANGER_RED = '#DC2626';

// Drag-down-to-dismiss threshold — a simple fixed pixel/velocity check, not BottomSheet.tsx's
// full 3-snap-point resolution (collapsed/half/expanded): this sheet only has open/closed, no
// intermediate rest position, so there's nothing to resolve a drag *to* besides "did it clear
// the bar or not."
const DISMISS_OFFSET = 120;
const DISMISS_VELOCITY = 500;

interface ManagementHubSheetProps {
  listing: ProfileListing | null;
  open: boolean;
  onClose: () => void;
  onEdit: (id: string) => void;
  onMarkFound: (id: string) => void;
  onTogglePause: (id: string) => void;
  onRequestDelete: (id: string) => void;
}

function EditIcon() {
  return <span aria-hidden="true">✏️</span>;
}
function CelebrateIcon() {
  return <span aria-hidden="true">🎉</span>;
}
function PauseIcon() {
  return <span aria-hidden="true">⏸️</span>;
}
function DeleteIcon() {
  return <span aria-hidden="true">🗑️</span>;
}

interface ActionRowProps {
  icon: React.ReactNode;
  label: string;
  color: string;
  bold?: boolean;
  onClick: () => void;
}

function ActionRow({ icon, label, color, bold, onClick }: ActionRowProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full items-center gap-3 px-5 py-4 text-left text-[15px] ${bold ? 'font-bold' : 'font-medium'}`}
      style={{ color }}
    >
      {icon}
      {label}
    </button>
  );
}

// Single entry point for Flow 2's four Management Hub actions (Edit / Mark as found / Pause-or-
// Resume / Delete), opened via ListingRow.tsx's "•••" button. Deliberately not built on
// pets/components/BottomSheet.tsx — that component's 3-snap-point drag-physics machinery
// (velocity-flick, overscroll handoff) is built for the map results drawer and is over-built for
// a static action menu; this is a plain open/closed sheet with one drag-to-dismiss gesture.
export function ManagementHubSheet({
  listing,
  open,
  onClose,
  onEdit,
  onMarkFound,
  onTogglePause,
  onRequestDelete,
}: ManagementHubSheetProps) {
  const handleDragEnd = (_event: unknown, info: PanInfo) => {
    if (info.offset.y > DISMISS_OFFSET || info.velocity.y > DISMISS_VELOCITY) {
      onClose();
    }
  };

  const isPaused = listing?.status === 'paused';
  const canResolveOrPause = listing?.kind === 'missing';

  return (
    <AnimatePresence>
      {open && listing && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-[1200] bg-black/40"
            aria-hidden="true"
          />
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: '0%' }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 32, stiffness: 300 }}
            drag="y"
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0, bottom: 0.4 }}
            onDragEnd={handleDragEnd}
            className="fixed inset-x-0 bottom-0 z-[1201] flex flex-col rounded-t-[32px] bg-white pb-safe"
            role="dialog"
            aria-modal="true"
          >
            <div className="flex flex-col items-center gap-3 pb-2 pt-3">
              <div className="h-1.5 w-10 rounded-full bg-neutral-300" />
              <div className="flex w-full items-center gap-3 px-5">
                <div
                  className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-neutral-100 text-lg font-bold text-neutral-300"
                  aria-hidden="true"
                >
                  {(listing.petName ?? listing.speciesLabel).charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[15px] font-bold" style={{ color: ANTHRACITE }}>
                    {listing.petName ?? listing.speciesLabel}
                  </p>
                  <p className="text-xs" style={{ color: MUTED_GRAY }}>
                    {listing.speciesLabel}
                  </p>
                </div>
              </div>
            </div>

            <div className="flex flex-col divide-y" style={{ borderColor: HAIRLINE_BORDER }}>
              <div style={{ borderColor: HAIRLINE_BORDER }} className="border-t">
                <ActionRow icon={<EditIcon />} label="Edytuj szczegóły" color={ANTHRACITE} onClick={() => onEdit(listing.id)} />
              </div>
              {canResolveOrPause && (
                <>
                  <div style={{ borderColor: HAIRLINE_BORDER }} className="border-t">
                    <ActionRow
                      icon={<CelebrateIcon />}
                      label="Oznacz jako odnalezione"
                      color={SUCCESS_GREEN}
                      bold
                      onClick={() => onMarkFound(listing.id)}
                    />
                  </div>
                  <div style={{ borderColor: HAIRLINE_BORDER }} className="border-t">
                    <ActionRow
                      icon={<PauseIcon />}
                      label={isPaused ? 'Wznów poszukiwania' : 'Wstrzymaj poszukiwania'}
                      color={MUTED_GRAY}
                      onClick={() => onTogglePause(listing.id)}
                    />
                  </div>
                </>
              )}
              <div style={{ borderColor: HAIRLINE_BORDER }} className="border-t">
                <ActionRow icon={<DeleteIcon />} label="Usuń zgłoszenie" color={DANGER_RED} onClick={() => onRequestDelete(listing.id)} />
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
