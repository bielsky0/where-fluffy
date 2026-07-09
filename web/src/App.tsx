import { RouterProvider } from 'react-router-dom';
import { Toaster } from 'sonner';
import { router } from '@/app/routes';
import { AppProviders } from '@/app/providers/AppProviders';
import { asyncComponent } from '@/app/asyncComponents';
import { SessionBootstrap } from '@/modules/auth/components/SessionBootstrap';

// Lazy despite being mounted unconditionally at the root: AuthBottomSheet renders nothing until
// isAuthModalOpen flips true, so there's no reason to pay for its framer-motion dependency in
// the initial/landing bundle. SessionBootstrap has no such cost (just TanStack Query, already
// eager everywhere via AppProviders), so it's a plain eager import below.
const AuthBottomSheet = asyncComponent(() => import('@/modules/auth/components/AuthBottomSheet'), null);

export function App() {
  return (
    <AppProviders>
      <SessionBootstrap />
      <RouterProvider router={router} />
      <AuthBottomSheet />
      <Toaster />
    </AppProviders>
  );
}
