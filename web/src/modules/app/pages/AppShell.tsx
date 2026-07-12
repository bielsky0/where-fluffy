import { useEffect, useRef } from 'react';
import { usePetMapStore } from '@/modules/pets/store/usePetMapStore';
import { AddListingWizard } from '@/modules/pets/components/add-listing-wizard';
import { MapExplorerPage } from '@/modules/pets/pages/MapExplorerPage';
import ProfilePage from '@/modules/profile/pages/ProfilePage';
import { useAuthStore } from '@/modules/auth/store/useAuthStore';
import { useProtectedAction } from '@/modules/auth/hooks/useProtectedAction';
import { readFreshIntent } from '@/modules/auth/store/usePendingIntentStore';
import { useAppUIStore } from '@/modules/app/store/useAppUIStore';
import { BottomNav, type NavAction } from '@/modules/app/components/BottomNav';
import { GuestTabBar, type GuestNavAction } from '@/modules/app/components/GuestTabBar';
import { MainFeedPage } from './MainFeedPage';

type ActionId = NavAction;

// Pure view orchestrator — SRP is "decide which top-level view is on screen, and own the
// layout chrome that's global to all of them." Nothing else. It knows exactly one piece of
// state, `activeView` ('feed' | 'map' | 'profile'), and mounts exactly one of three fully
// self-sufficient pages for it — MainFeedPage (own data fetching, own store wiring, no props —
// see its own comment), MapExplorerPage (modules/pets/pages, same self-sufficiency, encapsulating
// STATE_A/B/C entirely), or ProfilePage (modules/profile/pages, same self-sufficiency again,
// owning its own mock listings/edit-overlay/confetti state). AppShell never selects
// `currentAppState` and never spells out 'STATE_A' | 'STATE_B' | 'STATE_C' anywhere in this
// file — that's the whole point: those are MapExplorerPage's (and SearchModal's) internal
// business, not this component's.
//
// What *does* still belong here, because it's genuinely global rather than page-specific:
//   - BottomNav (session exists) / GuestTabBar (no session) — same bottom-of-viewport chrome
//     slot, swapped on `currentUser` rather than ever rendering both; see runGuestAction for
//     why GuestTabBar's three destinations don't map 1:1 onto BottomNav's.
//   - AddListingWizard — a modal overlay, not tied to either page's own layout; only ever open
//     as a result of a session-gated tab (BottomNav's "Zgłoś" via runGatedAction, or
//     GuestTabBar's "Dodaj" via runGuestAction), so "gated by auth" is enforced at the point
//     it's opened (via useProtectedAction), not by conditionally mounting the modal itself.
//   - AuthBottomSheet itself is no longer mounted here — it lives at the true root (App.tsx) so
//     it's available on every route, not just this one; this file only ever triggers it
//     indirectly, via useProtectedAction's openAuthModal call.
//
// Note on file layout: MainFeedPage stays under modules/app/pages/ rather than moving into
// modules/landing/ — that module is the public, pre-login marketing page (routes.tsx keeps its
// bundle free of modules/pets|chat|auth on purpose, see its own comment), and MainFeedPage is
// the authenticated in-app home, with exactly those dependencies. Colocating them would either
// break that bundle-isolation guarantee or just be a same-named-folder coincidence with two
// unrelated audiences. Happy to move it under a new modules/feed/ instead if that's what was
// meant by "landing module."
//
// One deliberate exception to "AppShell never reads currentAppState" (see above): BottomNav's
// own visibility needs to know whether MapExplorerPage's results drawer is currently collapsed
// (see BottomNav.tsx's `hidden` prop) — that's still a global-chrome concern (this file already
// owns mounting BottomNav at all), just one that happens to be driven by MapExplorerPage's
// internal state. `sheetSnap` alone isn't enough (it's also whatever it was last left at while
// STATE_A/STATE_B are showing, with no drawer mounted at all), so this reads `currentAppState`
// too, narrowly, only for this one computed boolean — nothing else in this file branches on it.
export default function AppShell() {
  const activeView = useAppUIStore((state) => state.activeView);
  const currentAppState = useAppUIStore((state) => state.currentAppState);
  const resetToMain = useAppUIStore((state) => state.resetToMain);
  const showProfile = useAppUIStore((state) => state.showProfile);

  const clearSelection = usePetMapStore((state) => state.clearSelection);
  const sheetSnap = usePetMapStore((state) => state.sheetSnap);
  const setSheetSnap = usePetMapStore((state) => state.setSheetSnap);
  const openAddReport = usePetMapStore((state) => state.openAddReportModal);
  const closeAddReport = usePetMapStore((state) => state.closeAddReportModal);
  const clearLastViewedBbox = usePetMapStore((state) => state.clearLastViewedBbox);

  const isBottomNavHidden = currentAppState === 'STATE_C' && sheetSnap === 'collapsed';

  const currentUser = useAuthStore((state) => state.currentUser);
  const runProtected = useProtectedAction();

  const isAddReportOpen = usePetMapStore((state) => state.isAddReportModalOpen);

  // What each gated action actually does once a session exists. "Lista" routes home
  // (activeView: 'feed') and resets the map's own stores — resetToMain() clears
  // useAppUIStore's applied filters/wizard state and currentAppState internally (AppShell
  // never reads what it resets it *to*), while clearSelection/setSheetSnap reset
  // usePetMapStore's pet-selection and drawer position directly, since those two stores are
  // deliberately independent of each other (see usePetMapStore.ts) and coordinating them for
  // a cross-cutting "go home" action is exactly what an orchestrator is for. "Zgłoś" opens
  // AddListingWizard. "Profil" switches activeView to 'profile' (modules/profile/pages/ProfilePage)
  // via useAppUIStore's showProfile — mock stats/listings until a real profile endpoint exists
  // (see mockProfileData.ts).
  const runAction = (action: ActionId) => {
    if (action === 'list') {
      resetToMain();
      clearSelection();
      setSheetSnap('collapsed');
      clearLastViewedBbox();
    } else if (action === 'report') {
      openAddReport();
    } else if (action === 'profile') {
      showProfile();
    }
  };

  const runGatedAction = (action: ActionId) => runProtected(() => runAction(action));

  // GuestTabBar's own action set (see that file) — 'discover' and 'add' both need no session at
  // all: the frictionless-onboarding wizard (AddListingWizard.tsx) is explicitly "zero barriers"
  // up front (spec: intent + photo + location + details, no login prompt), gating auth only at
  // its own final "Opublikuj" step via useProtectedAction (Ghost Account/OTP flow) — gating it
  // here too, before the wizard even opens, would defeat that design and show AuthBottomSheet
  // twice for the same guest. 'login' is the only tab that still needs a session up front, since
  // it has nothing else to do.
  const runGuestAction = (action: GuestNavAction) => {
    if (action === 'discover' || action === 'add') {
      runAction(action === 'add' ? 'report' : 'list');
      return;
    }
    // resumeIntent: landing back on /app authenticated (after a real OAuth redirect) already
    // satisfies this — no extra action to replay, unlike wizard-publish/report-sighting below.
    runProtected(() => runAction('list'), { resumeIntent: { kind: 'app-navigate', returnPath: '/app' } });
  };

  // Resume-on-landing: a guest who reached the wizard's guest-checkout step, then completed a
  // full-page OAuth redirect, comes back here with no in-memory state at all — isAddReportOpen
  // defaults to false again. Reopen the wizard modal; AddListingWizard's own resume effect (see
  // that file) is what actually re-triggers the publish call and clears the intent, once it's
  // mounted and can read the persisted draft. Runs once per mount.
  const hasCheckedResumeIntent = useRef(false);
  useEffect(() => {
    if (hasCheckedResumeIntent.current) return;
    hasCheckedResumeIntent.current = true;
    if (readFreshIntent()?.kind === 'wizard-publish') {
      openAddReport();
    }
  }, [openAddReport]);

  const activeAction: NavAction | undefined =
    activeView === 'feed' ? 'list' : activeView === 'profile' ? 'profile' : undefined;
  const activeGuestAction: GuestNavAction | undefined = activeView === 'feed' ? 'discover' : undefined;

  return (
    <div className="relative h-dvh overflow-hidden">

      {/* TODO Change for react router */}
      {activeView === 'feed' && <MainFeedPage />}
      {activeView === 'map' && <MapExplorerPage />}
      {activeView === 'profile' && <ProfilePage />}

      {currentUser ? (
        <BottomNav onAction={runGatedAction} activeAction={activeAction} hidden={isBottomNavHidden} />
      ) : (
        <GuestTabBar onAction={runGuestAction} activeAction={activeGuestAction} hidden={isBottomNavHidden} />
      )}

      {isAddReportOpen && <AddListingWizard onClose={closeAddReport} />}
    </div>
  );
}
