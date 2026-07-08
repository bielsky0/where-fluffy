import { motion } from 'framer-motion';
import { BOTTOM_NAV_CLEARANCE } from '@/modules/app/components/BottomNav';

interface MapFabButtonProps {
  onClick: () => void;
}

function MapPinIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="size-[18px]" aria-hidden="true">
      <path
        d="M12 21s-6.5-5.4-6.5-11A6.5 6.5 0 0 1 18.5 10c0 5.6-6.5 11-6.5 11Z"
        strokeLinejoin="round"
      />
      <circle cx="12" cy="10" r="2.25" />
    </svg>
  );
}

// BottomSheet.tsx's 'expanded' snap fills ~95% of the viewport, leaving no other visible anchor
// back to the map underneath it (ResultsTopBar's own back/filter circles collapse the sheet
// too, but they read as "back to results", not "show me the map") — this is a dedicated,
// unambiguous floating pill for that, mounted by MapExplorerPage.tsx only while `expanded`,
// wrapped there in <AnimatePresence/> so it also animates back out the moment the sheet leaves
// that snap. Floats just above BottomNav's own clearance (bottom offset), well above the sheet
// (z-[1150], ahead of BottomSheet's z-[1000]) — same solid, opaque black pill as Airbnb's own
// "Map" button, deliberately not a translucent one so it never competes with content scrolling
// underneath it.
export function MapFabButton({ onClick }: MapFabButtonProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12, scale: 0.92 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 12, scale: 0.92 }}
      transition={{ type: 'spring', damping: 26, stiffness: 320 }}
      style={{ bottom: `calc(${BOTTOM_NAV_CLEARANCE} + 0.75rem)` }}
      className="pointer-events-none fixed inset-x-0 z-[1150] flex justify-center"
    >
      <button
        type="button"
        onClick={onClick}
        className="pointer-events-auto flex items-center gap-2 rounded-full bg-black px-5 py-3 text-sm font-semibold text-white shadow-[0_8px_24px_-6px_rgba(0,0,0,0.5)]"
      >
        <MapPinIcon />
        Mapa
      </button>
    </motion.div>
  );
}
