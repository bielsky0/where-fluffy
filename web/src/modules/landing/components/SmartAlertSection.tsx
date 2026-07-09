import { motion } from 'framer-motion';
import { CheckIcon, ShieldIcon } from './icons';

const FEATURES = [
  'Weryfikacja zgłoszeń – dbamy o to, by każda wiadomość była prawdziwa',
  'Powiadomienia push – lokalne alerty dla Twoich sąsiadów',
  'Wsparcie społeczności – całodobowa gotowość do pomocy',
];

// "Premium protection" card — the one section that deliberately breaks from the white/surface
// backgrounds elsewhere on the page (bg-ink, white text) to read as a distinct, higher-trust
// tier, the same way Airbnb's own "Verified"/host-guarantee panels do.
export function SmartAlertSection() {
  return (
    <section className="bg-surface px-6 py-20">
      <div className="flex flex-col gap-8 rounded-2xl bg-ink p-8 text-white shadow-lg">
        <motion.span
          className="flex size-14 items-center justify-center rounded-2xl bg-white/10 text-coral"
          animate={{ scale: [1, 1.05, 1] }}
          transition={{ duration: 2.2, repeat: Infinity, ease: 'easeInOut' }}
        >
          <ShieldIcon className="size-7" />
        </motion.span>

        <h2 className="text-2xl font-bold">SmartAlert dla Twojego zwierzaka</h2>

        <ul className="flex flex-col gap-4">
          {FEATURES.map((feature) => (
            <li key={feature} className="flex items-start gap-3">
              <CheckIcon className="mt-0.5 size-5 shrink-0 text-coral" />
              <span className="text-sm text-white/80">{feature}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
