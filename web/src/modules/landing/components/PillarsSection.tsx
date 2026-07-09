import { motion } from 'framer-motion';
import { BoltIcon, HeartHandsIcon, ShieldIcon } from './icons';

const PILLARS = [
  {
    Icon: BoltIcon,
    title: 'To łatwe',
    description:
      'Utwórz zgłoszenie w kilku krokach. Nasz system sam dopasuje informacje, by jak najszybciej powiadomić sąsiadów.',
  },
  {
    Icon: HeartHandsIcon,
    title: 'To potrzebne',
    description:
      'Nic nie płacisz na początek. Budujemy społeczność, w której każdy głos ma znaczenie w poszukiwaniach.',
  },
  {
    Icon: ShieldIcon,
    title: 'Masz ochronę',
    description:
      'Spokój ducha i realna pomoc. Dzięki alertom w czasie rzeczywistym wiesz, że Twoje zgłoszenie trafia do osób w Twojej okolicy.',
  },
] as const;

// Single `whileInView` trigger on the container + `staggerChildren` is what makes this a real
// 150ms cascade (one scroll-into-view event fans out to all three cards) rather than three
// independent `whileInView`s that could each fire at a different scroll position.
const containerVariants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.15 } },
};

const cardVariants = {
  hidden: { opacity: 0, y: 24 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.32, 0.72, 0, 1] } },
};

export function PillarsSection() {
  return (
    <section className="bg-white px-6 py-20">
      <motion.div
        className="flex flex-col gap-6"
        variants={containerVariants}
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, amount: 0.3 }}
      >
        {PILLARS.map(({ Icon, title, description }) => (
          <motion.div
            key={title}
            variants={cardVariants}
            className="flex flex-col items-start gap-4 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm"
          >
            <span className="flex size-12 items-center justify-center rounded-2xl bg-coral/10 text-coral">
              <Icon className="size-6" />
            </span>
            <div className="flex flex-col gap-1.5">
              <h3 className="text-lg font-bold text-ink">{title}</h3>
              <p className="text-sm text-subtle">{description}</p>
            </div>
          </motion.div>
        ))}
      </motion.div>
    </section>
  );
}
