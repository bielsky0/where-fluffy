import { ErrorState } from '@/shared/components/ErrorState';

interface ServerErrorPageProps {
  onRetry: () => void;
}

// Not a route — there's no dedicated URL for "the API is down". Rendered inline by a page in
// place of its normal content whenever a query fails for any reason other than a 404 (a 5xx
// ApiError, or a plain network failure/offline device).
export function ServerErrorPage({ onRetry }: ServerErrorPageProps) {
  return (
    <ErrorState
      fullscreen
      icon="📡"
      title="Ups! Coś poszło nie tak"
      message="Nie udało się połączyć z serwerem. Sprawdź swoje połączenie z internetem i spróbuj ponownie."
      action={{ label: 'Spróbuj ponownie', onClick: onRetry }}
    />
  );
}
