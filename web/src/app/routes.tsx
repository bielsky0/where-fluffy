import { createBrowserRouter } from 'react-router-dom';
import { asyncComponent } from '@/app/asyncComponents';
// Fine to import eagerly despite the "no lazy route may import modules/auth" rule below — that
// rule is about keeping heavy deps (framer-motion, socket.io) out of the lazy page chunks
// themselves. RequireAuth only touches useAuthStore (zustand, negligible weight) and is already
// unavoidable at this level: App.tsx eagerly mounts SessionBootstrap for the same reason.
import { RequireAuth } from '@/modules/auth/components/RequireAuth';

// Public side — no lazy-loaded route here may import from modules/pets, modules/chat, or
// modules/auth: keeping this import graph separate is what keeps the landing bundle free of
// socket.io-client/TanStack Query/map-library weight (see modules/landing/pages/LandingPage.tsx).
const LandingPage = asyncComponent(
  () => import('@/modules/landing/pages/LandingPage'),
  <p>Loading…</p>,
);
const LoginPage = asyncComponent(() => import('@/modules/auth/pages/LoginPage'), <p>Loading…</p>);
const OAuthCallbackPage = asyncComponent(
  () => import('@/modules/auth/pages/OAuthCallbackPage'),
  <p>Loading…</p>,
);

// Private side — AppShell is now the ride-hailing-style main view itself (map + bottom sheet +
// action bar), not a layout wrapping an <Outlet/> — so it's a leaf route, not a parent with
// `children`. Chat is a sibling leaf, reachable from the small link inside AppShell rather than
// nested under it. Each is still its own lazy chunk, so visiting /app doesn't download
// modules/chat's socket.io dependency (or vice versa) — and /app's Leaflet dependency stays
// out of the chat chunk too.
const AppShell = asyncComponent(() => import('@/modules/app/pages/AppShell'), <p>Loading…</p>);
const ChatPage = asyncComponent(() => import('@/modules/chat/pages/ChatPage'), <p>Loading…</p>);
const PetDetailPage = asyncComponent(
  () => import('@/modules/pets/pages/PetDetailPage'),
  <p>Loading…</p>,
);

export const router = createBrowserRouter([
  { path: '/', element: <LandingPage /> },
  { path: '/login', element: <LoginPage /> },
  // The one fixed landing target for every OAuth redirect (see auth.oauth.controller.ts) —
  // success or failure, Google or Facebook, always ends up here first before resuming/erroring.
  { path: '/auth/callback', element: <OAuthCallbackPage /> },
  { path: '/app', element: <AppShell /> },
  {
    path: '/app/chat',
    element: (
      <RequireAuth>
        <ChatPage />
      </RequireAuth>
    ),
  },
  { path: '/app/pets/:petId', element: <PetDetailPage /> },
]);
