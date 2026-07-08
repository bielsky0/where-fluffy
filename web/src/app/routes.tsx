import { Navigate, createBrowserRouter } from 'react-router-dom';
import { asyncComponent } from '@/app/asyncComponents';

// Public side — no lazy-loaded route here may import from modules/pets, modules/chat, or
// modules/auth: keeping this import graph separate is what keeps the landing bundle free of
// socket.io-client/TanStack Query/map-library weight (see modules/landing/pages/LandingPage.tsx).
const LandingPage = asyncComponent(
  () => import('@/modules/landing/pages/LandingPage'),
  <p>Loading…</p>,
);
const LoginPage = asyncComponent(() => import('@/modules/auth/pages/LoginPage'), <p>Loading…</p>);

// Private side — AppShell is the dashboard layout (nav + <Outlet/>); each module's page is
// still its own lazy chunk, so visiting /app/pets doesn't download modules/chat's socket.io
// dependency (or vice versa) — and, in particular, doesn't download PetsMapView's Leaflet
// dependency into the chat chunk either.
const AppShell = asyncComponent(() => import('@/modules/app/pages/AppShell'), <p>Loading…</p>);
const PetsMapView = asyncComponent(() => import('@/modules/pets/pages/PetsMapView'), <p>Loading…</p>);
const ChatPage = asyncComponent(() => import('@/modules/chat/pages/ChatPage'), <p>Loading…</p>);

export const router = createBrowserRouter([
  { path: '/', element: <LandingPage /> },
  { path: '/login', element: <LoginPage /> },
  {
    path: '/app',
    element: <AppShell />,
    children: [
      { index: true, element: <Navigate to="pets" replace /> },
      { path: 'pets', element: <PetsMapView /> },
      { path: 'chat', element: <ChatPage /> },
    ],
  },
]);
