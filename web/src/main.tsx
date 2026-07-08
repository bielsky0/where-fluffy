// Must be the first import — registers OTel instrumentations before fetch/document-load
// activity happens, same ordering constraint as the backend's instrumentation.ts.
import '@/lib/telemetry';

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from '@/App';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
