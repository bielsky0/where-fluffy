import { useEffect, useRef } from 'react';

// Stable-identity debounced wrapper — the returned function's reference never changes across
// renders (unlike a plain `useCallback(debounce(fn, ms), [fn])`, which would still churn
// whenever `fn` itself is recreated), so callers that pass it into an event subscription (e.g.
// react-leaflet's useMapEvent) don't re-subscribe on every render. The wrapped callback itself
// is always read fresh via a ref, so it never goes stale.
export function useDebouncedCallback<Args extends unknown[]>(
  callback: (...args: Args) => void,
  delayMs: number,
): (...args: Args) => void {
  const callbackRef = useRef(callback);
  callbackRef.current = callback;

  const timeoutRef = useRef<ReturnType<typeof setTimeout>>();
  useEffect(() => () => clearTimeout(timeoutRef.current), []);

  const debouncedRef = useRef((...args: Args) => {
    clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => callbackRef.current(...args), delayMs);
  });

  return debouncedRef.current;
}
