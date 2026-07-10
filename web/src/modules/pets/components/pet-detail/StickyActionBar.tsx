import { useProtectedAction } from '@/modules/auth/hooks/useProtectedAction';
import { MegaphoneIcon, PhoneIcon, ShareIcon } from './icons';
import type { Pet } from '../../types/pet.types';

const HAIRLINE_BORDER = '#E5E5E5';
const CORAL = '#FF6B4A';
const ANTHRACITE = '#222222';
const MUTED_GRAY = '#8E8E93';

interface StickyActionBarProps {
  pet: Pet;
  onReportSighting: () => void;
  onShare: () => void;
}

// Three deliberately non-chat actions, per the spec — "Zgłoś zaobserwowanie" (primary),
// "Zadzwoń do właściciela" (only when a phone number was actually given at report time — Pet's
// existing nullable `phone` already models that consent, no separate profile-level flag needed),
// and "Udostępnij". Replaces the page's earlier single "Skontaktuj się" chat CTA. The reward line
// also lived here before the hero gallery got its own reward banner — kept here too (deliberate
// duplication, not a move) since it still reads naturally right beside the primary CTA.
export function StickyActionBar({ pet, onReportSighting, onShare }: StickyActionBarProps) {
  const runProtected = useProtectedAction();
  // resumeIntent: a guest who taps this, then completes a full-page OAuth redirect, needs to
  // land back on this exact pet with the sighting sheet already open — see
  // PetDetailPage.tsx's resume-on-landing effect, which reads this back via readFreshIntent().
  const handleReportClick = () =>
    runProtected(onReportSighting, {
      resumeIntent: { kind: 'report-sighting', petId: pet.id, returnPath: `/app/pets/${pet.id}` },
    });

  return (
    <div className="flex shrink-0 flex-col border-t bg-white pb-safe" style={{ borderColor: HAIRLINE_BORDER }}>
      {pet.reward > 0 && (
        <div className="flex items-center justify-between border-b px-4 py-2" style={{ borderColor: HAIRLINE_BORDER }}>
          <span className="text-xs" style={{ color: MUTED_GRAY }}>
            Nagroda za odnalezienie
          </span>
          <span className="text-base font-extrabold" style={{ color: ANTHRACITE }}>
            {pet.reward} zł
          </span>
        </div>
      )}

      <div className="flex items-center gap-2 px-4 py-3">
        <button
          type="button"
          onClick={handleReportClick}
          className="flex flex-1 items-center justify-center gap-2 rounded-full px-4 py-3 text-white transition-transform active:scale-95"
          style={{ backgroundColor: CORAL, boxShadow: `0 6px 18px -6px ${CORAL}99` }}
        >
          <MegaphoneIcon />
          <span className="text-[15px] font-bold">Zgłoś zaobserwowanie</span>
        </button>

        {pet.phone && (
          <a
            href={`tel:${pet.phone}`}
            aria-label="Zadzwoń do właściciela"
            className="flex size-12 shrink-0 items-center justify-center rounded-full border-2"
            style={{ borderColor: HAIRLINE_BORDER, color: ANTHRACITE }}
          >
            <PhoneIcon />
          </a>
        )}

        <button
          type="button"
          onClick={onShare}
          aria-label="Udostępnij"
          className="flex size-12 shrink-0 items-center justify-center rounded-full border-2"
          style={{ borderColor: HAIRLINE_BORDER, color: MUTED_GRAY }}
        >
          <ShareIcon />
        </button>
      </div>
    </div>
  );
}
