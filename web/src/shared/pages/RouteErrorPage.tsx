import { useRouteError } from 'react-router-dom';
import { ErrorState } from '@/shared/components/ErrorState';

// Root errorElement (see app/routes.tsx) — the last line of defense for a render-time crash
// anywhere in the route tree (e.g. a component throwing on unexpected/stale data), not a 404 or
// a query failure (those have their own NotFoundPage/ServerErrorPage). React Router unmounts the
// whole tree under the nearest errorElement on an uncaught render error, so without this every
// such crash left a blank white screen instead of a recoverable page.
export default function RouteErrorPage() {
  const error = useRouteError();
  if (import.meta.env.DEV) console.error(error);

  return (
    <ErrorState
      fullscreen
      icon="⚠️"
      title="Ups! Coś poszło nie tak"
      message="Wystąpił nieoczekiwany błąd. Spróbuj odświeżyć stronę."
      action={{ label: 'Odśwież stronę', onClick: () => window.location.reload() }}
    />
  );
}
