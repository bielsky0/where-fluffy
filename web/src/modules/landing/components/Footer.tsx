// Height reserved for the fixed "+ Dodaj ogłoszenie" bar below (excluding the safe-area inset,
// added separately via pb-safe on the bar itself) — applied as the footer's own trailing
// padding so its last row never sits hidden underneath the bar. Same pattern as BottomNav.tsx's
// BOTTOM_NAV_CLEARANCE.
export const LANDING_CTA_CLEARANCE = 'calc(4.5rem + env(safe-area-inset-bottom))';

interface FooterProps {
  onAddListing: () => void;
}

// href: null items have no dedicated page yet (no About/Support/Terms/Privacy routes exist
// anywhere in the app today) — rendered as plain static text rather than a dead `href="#"` link.
const REPORTING_LINKS = [
  { label: 'Jak to działa', href: '#faq' },
  { label: 'Bezpieczeństwo', href: null },
] as const;

const ABOUT_LINKS = [
  { label: 'Misja', href: null },
  { label: 'Zespół', href: null },
  { label: 'Kontakt', href: null },
] as const;

const SUPPORT_LINKS = [
  { label: 'FAQ', href: '#faq' },
  { label: 'Regulamin', href: null },
  { label: 'Polityka prywatności', href: null },
] as const;

const COLUMNS = [
  { heading: 'Przyjmowanie zgłoszeń', links: REPORTING_LINKS },
  { heading: 'O nas', links: ABOUT_LINKS },
  { heading: 'Wsparcie', links: SUPPORT_LINKS },
] as const;

// Airbnb-style footer + the page's persistent "+ Dodaj ogłoszenie" CTA. Both live in one file
// because the fixed CTA bar's height is what LANDING_CTA_CLEARANCE compensates for in the
// footer's own trailing padding — same relationship BottomNav.tsx documents for its own bar.
export function Footer({ onAddListing }: FooterProps) {
  return (
    <>
      <footer
        className="border-t border-gray-200 bg-white px-6 pt-16 sm:px-10"
        style={{ paddingBottom: LANDING_CTA_CLEARANCE }}
      >
        <div className="mx-auto grid max-w-5xl grid-cols-1 gap-10 sm:grid-cols-3">
          {COLUMNS.map(({ heading, links }) => (
            <div key={heading} className="flex flex-col gap-3">
              <h3 className="text-sm font-bold text-ink">{heading}</h3>
              <ul className="flex flex-col gap-2">
                {links.map(({ label, href }) => (
                  <li key={label} className="text-sm text-subtle">
                    {href ? (
                      <a href={href} className="hover:text-ink">
                        {label}
                      </a>
                    ) : (
                      label
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mx-auto mt-12 flex max-w-5xl flex-col items-center gap-2 border-t border-gray-200 pt-8 text-xs text-subtle sm:flex-row sm:justify-between">
          <span>© {new Date().getFullYear()} Where&apos;s Fluffy. Wszelkie prawa zastrzeżone.</span>
        </div>
      </footer>
    </>
  );
}
