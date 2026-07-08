import type { ReactNode } from 'react';
import { cn } from '@/shared/lib/cn';

interface PageLayoutProps {
  children: ReactNode;
  className?: string;
  // AppShell's map view wants to bleed under the notch/home-indicator (a full-bleed backdrop
  // behind its own absolutely-positioned overlays) rather than get the standard safe-area
  // padding baked in here — see modules/pets/pages equivalent. Opt out per-page, not per-app.
  edgeToEdge?: boolean;
}

// Standard page chrome: fills the viewport (dvh, not vh — vh includes the mobile browser
// chrome that dvh excludes, which otherwise leaves a strip of unusable space under the
// bottom nav on iOS Safari), applies the safe-area utilities from tailwind.config.ts so fixed
// bottom bars/sheets clear the home-indicator/notch, and sets the background/foreground pair
// so every screen inherits dark-mode support for free without repeating the tokens.
export function PageLayout({ children, className, edgeToEdge = false }: PageLayoutProps) {
  return (
    <div
      className={cn(
        'min-h-dvh bg-background text-foreground',
        !edgeToEdge && 'pt-safe pb-safe pl-safe pr-safe px-4',
        className,
      )}
    >
      {children}
    </div>
  );
}
