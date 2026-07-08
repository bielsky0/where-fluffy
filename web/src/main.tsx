// Must be the first import — registers OTel instrumentations before fetch/document-load
// activity happens, same ordering constraint as the backend's instrumentation.ts.
import '@/lib/telemetry';
import '@/shared/styles/globals.css';

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from '@/App';
import { useThemeStore } from '@/shared/theme/useThemeStore';

// Applies the persisted/OS-preferred theme's `.dark` class before first paint — the store's
// initializer already computed `theme`, this just re-runs the same class toggle the store's
// setters perform, since module init doesn't call setTheme/toggleTheme itself.
document.documentElement.classList.toggle('dark', useThemeStore.getState().theme === 'dark');

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
