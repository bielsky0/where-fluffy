import type { ReactNode } from 'react';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';
import { queryClient } from '@/lib/queryClient';

interface AppProvidersProps {
  children: ReactNode;
}

// The sync variant of this persister (`@tanstack/query-sync-storage-persister`) is deprecated
// in favor of this one, which works with both sync (localStorage) and async storage behind
// the same API.
const persister = createAsyncStoragePersister({
  storage: window.localStorage,
  key: 'fluffy-query-cache',
});

// Background-sync strategy: the browser's own Background Sync API
// (ServiceWorkerRegistration.sync) has no Safari support and requires a hand-written service
// worker, which conflicts with vite-plugin-pwa's `generateSW` mode used here (vite.config.ts).
// TanStack Query's mutation pausing does the same job at the app layer instead — a mutation
// that fails while offline is *paused* (see queryClient.ts's `networkMode: 'offlineFirst'`),
// and by default TanStack Query only persists paused mutations, not settled ones
// (`shouldDehydrateMutation` defaults to `mutation.state.isPaused`). `PersistQueryClientProvider`
// writes that paused state to localStorage so an "Add Report" or "Add Sighting" submitted
// offline survives a reload/PWA relaunch, then calls `resumePausedMutations()` once rehydrated.
export function AppProviders({ children }: AppProvidersProps) {
  return (
    <PersistQueryClientProvider client={queryClient} persistOptions={{ persister }}>
      {children}
    </PersistQueryClientProvider>
  );
}
