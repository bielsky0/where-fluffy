import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
    },
    mutations: {
      // A mutation that fails because the device is offline gets *paused*, not errored, and
      // resumes automatically once back online — combined with the persister in
      // providers/AppProviders.tsx, this is the "background sync" mechanism behind
      // AddReportModal.tsx / PetDetailPanel.tsx's add-sighting form (see that file's comment
      // for why we use this instead of the browser's own Background Sync API).
      //
      // `retry` must be > 0 here: TanStack Query only checks online status (and pauses) when
      // it's about to run a *retry* attempt. With the library's own default of `retry: 0`,
      // a mutation that fails while offline goes straight to `isError` and never becomes
      // `isPaused` at all — confirmed by driving this exact scenario in a real browser before
      // relying on it; the "it pauses when offline" behavior does not exist without this.
      networkMode: 'offlineFirst',
      retry: 3,
    },
  },
});
