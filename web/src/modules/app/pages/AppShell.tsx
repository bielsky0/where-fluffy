import { NavLink, Outlet } from 'react-router-dom';

// Layout route mounted at /app/* (see app/routes.tsx) — renders the private-app chrome once,
// then <Outlet/> swaps in whichever module's page (pets, chat, ...) matches the nested path.
// This is where a real auth guard would live once modules/auth grows beyond a login form
// (redirect to /login if there's no session) — deliberately not faked here since the backend
// has no session-check endpoint yet, only /auth/login|register|logout.
//
// Flex column filling the viewport, nav pinned to its natural height, and the outlet wrapper
// taking the remainder via `flex: 1; min-height: 0` — that `min-height: 0` is required for a
// flex child to be allowed to shrink below its content size, which is what lets
// PetsMapView.tsx use a plain `height: 100%` instead of fragile viewport-minus-nav-height math.
export default function AppShell() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
      <nav style={{ flexShrink: 0 }}>
        <NavLink to="/app/pets">Pets</NavLink>
        <NavLink to="/app/chat">Chat</NavLink>
      </nav>
      <div style={{ flex: 1, minHeight: 0, position: 'relative' }}>
        <Outlet />
      </div>
    </div>
  );
}
