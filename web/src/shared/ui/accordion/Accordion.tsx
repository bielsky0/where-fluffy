import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { cn } from '@/shared/lib/cn';

export interface AccordionItem {
  question: string;
  answer: string;
}

interface AccordionProps {
  items: readonly AccordionItem[];
  className?: string;
}

// Local, not modules/landing/components/icons.tsx's PlusIcon: shared/ui must never depend on a
// feature module (the inverse of the landing bundle-isolation rule), so this one glyph is
// duplicated rather than imported.
function PlusIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <path d="M12 4v16M4 12h16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

// Single-open accordion — opening one item closes any other. Extracted verbatim from
// FaqSection.tsx's previous inline implementation.
export function Accordion({ items, className }: AccordionProps) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  return (
    <div
      className={cn(
        'flex flex-col divide-y divide-gray-200 rounded-2xl border border-gray-200 bg-white',
        className,
      )}
    >
      {items.map((item, index) => {
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
                  actually turns the two bars into an "×". */}
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
  );
}
