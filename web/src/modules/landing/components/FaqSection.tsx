import { Accordion } from '@/shared/ui';

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
] as const;

// id="faq" is the scroll anchor Footer.tsx's "FAQ" links point at.
export function FaqSection() {
  return (
    <section id="faq" className="bg-surface px-6 py-20">
      <div className="flex flex-col gap-6">
        <h2 className="text-2xl font-bold text-ink">Najczęściej zadawane pytania</h2>
        <Accordion items={FAQ_ITEMS} />
      </div>
    </section>
  );
}
