import { createBrowserRouter } from 'react-router-dom';
import { asyncComponent } from '@/app/asyncComponents';

// Public side — no lazy-loaded route here may import from modules/pets, modules/chat, or
// modules/auth: keeping this import graph separate is what keeps the landing bundle free of
// socket.io-client/TanStack Query/map-library weight (see modules/landing/pages/LandingPage.tsx).
const LandingPage = asyncComponent(
  () => import('@/modules/landing/pages/LandingPage'),
  <p>Loading…</p>,
);
const LoginPage = asyncComponent(() => import('@/modules/auth/pages/LoginPage'), <p>Loading…</p>);

// Private side — AppShell is now the ride-hailing-style main view itself (map + bottom sheet +
// action bar), not a layout wrapping an <Outlet/> — so it's a leaf route, not a parent with
// `children`. Chat is a sibling leaf, reachable from the small link inside AppShell rather than
// nested under it. Each is still its own lazy chunk, so visiting /app doesn't download
// modules/chat's socket.io dependency (or vice versa) — and /app's Leaflet dependency stays
// out of the chat chunk too.
const AppShell = asyncComponent(() => import('@/modules/app/pages/AppShell'), <p>Loading…</p>);
const ChatPage = asyncComponent(() => import('@/modules/chat/pages/ChatPage'), <p>Loading…</p>);

export const router = createBrowserRouter([
  { path: '/', element: <LandingPage /> },
  { path: '/login', element: <LoginPage /> },
  { path: '/app', element: <AppShell /> },
  { path: '/app/chat', element: <ChatPage /> },
]);
