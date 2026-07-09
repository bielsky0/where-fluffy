import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { PlusIcon } from './icons';

const FAQ_ITEMS = [
  {
    question: 'Czy zgłoszenie zwierzaka jest płatne?',
    answer:
      'Nie. Utworzenie zgłoszenia jest całkowicie darmowe. Wierzymy, że bezpieczeństwo zwierząt nie powinno mieć ceny.',
  },
  {
    question: 'Jak działają powiadomienia?',
    answer:
      'Gdy dodasz zgłoszenie, automatycznie wysyłamy powiadomienia do użytkowników w Twojej najbliższej okolicy.',
  },
  {
    question: 'Co zrobić, gdy znajdę psa?',
    answer:
      'Zgłoś to w aplikacji. My skontaktujemy Cię z osobą, która zamieściła ogłoszenie o zaginięciu.',
  },
];

export function FaqSection() {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  return (
    <section className="bg-surface px-6 py-20">
      <div className="flex flex-col gap-6">
        <h2 className="text-2xl font-bold text-ink">Najczęściej zadawane pytania</h2>

        <div className="flex flex-col divide-y divide-gray-200 rounded-2xl border border-gray-200 bg-white">
          {FAQ_ITEMS.map((item, index) => {
            const isOpen = openIndex === index;
            return (
              <div key={item.question} className="px-6">
                <button
                  type="button"
                  onClick={() => setOpenIndex(isOpen ? null : index)}
                  aria-expanded={isOpen}
                  className="flex w-full items-center justify-between gap-4 py-5 text-left"
                >
                  <span className="text-base font-semibold text-ink">{item.question}</span>
                  {/* A "+" rotated 90° is unchanged (it's symmetric on that axis) — 45° is what
                      actually turns the two bars into an "×", matching the spec's described
                      end state rather than its literal degree count. */}
                  <motion.span
                    animate={{ rotate: isOpen ? 45 : 0 }}
                    transition={{ duration: 0.2, ease: 'easeOut' }}
                    className="flex size-8 shrink-0 items-center justify-center rounded-full bg-surface text-ink"
                  >
                    <PlusIcon className="size-4" />
                  </motion.span>
                </button>

                <AnimatePresence initial={false}>
                  {isOpen && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.25, ease: [0.32, 0.72, 0, 1] }}
                      className="overflow-hidden"
                    >
                      <p className="pb-5 text-sm text-subtle">{item.answer}</p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
