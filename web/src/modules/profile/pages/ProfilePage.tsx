import { useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { toast } from 'sonner';
import { useAuthStore } from '@/modules/auth/store/useAuthStore';
import { useLogout } from '@/modules/auth/api/useAuth';
import { useAppUIStore } from '@/modules/app/store/useAppUIStore';
import type { Pet } from '@/modules/pets/types/pet.types';
import { INITIAL_HELPED_COUNT, MOCK_ACCOUNT_CREATED_AT, getAccountAgeStat } from '../lib/mockProfileData';
import { useCountUp } from '@/shared/lib/useCountUp';
import { mapPetToListing } from '../lib/mapPetToListing';
import { generateShareImage } from '../lib/generateShareImage';
import { shareOrDownloadImage } from '../lib/shareImage';
import { useMyPets, useUpdatePetStatus, useDeletePet } from '../api/useMyPets';
import { ListingRow } from '../components/ListingRow';
import { EditListingPanel } from '../components/EditListingPanel';
import { ManagementHubSheet } from '../components/ManagementHubSheet';
import { DeleteConfirmDialog } from '../components/DeleteConfirmDialog';
import { ConfettiBurst } from '../components/ConfettiBurst';
import { CelebrationSharePrompt } from '../components/CelebrationSharePrompt';

const ANTHRACITE = '#222222';
const MUTED_GRAY = '#8E8E93';
const CANVAS = '#F7F7F7';
const HAIRLINE_BORDER = '#E5E5E5';
const CORAL = '#FF6B4A';

function SettingsIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="size-5" aria-hidden="true">
      <circle cx="12" cy="12" r="3" />
      <path
        d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function CheckBadgeIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={2.4} className="size-3.5" aria-hidden="true">
      <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function SupportIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke={CORAL} strokeWidth={1.8} className="size-6" aria-hidden="true">
      <path d="M4 13a8 8 0 0 1 16 0" strokeLinecap="round" />
      <path d="M4 13v4a2 2 0 0 0 2 2h1v-6H5a1 1 0 0 0-1 1Z" />
      <path d="M20 13v4a2 2 0 0 1-2 2h-1v-6h1a1 1 0 0 1 1 1Z" />
      <path d="M12 19v1.5a1.5 1.5 0 0 0 1.5 1.5H15" strokeLinecap="round" />
    </svg>
  );
}

function EmptyMapPinIcon() {
  return (
    <svg viewBox="0 0 64 64" fill="none" className="size-16" aria-hidden="true">
      <path
        d="M32 6C21.5 6 13 14.5 13 25c0 15 19 33 19 33s19-18 19-33C51 14.5 42.5 6 32 6Z"
        stroke="#D9D9D9"
        strokeWidth={2.5}
      />
      <circle cx="32" cy="25" r="7" stroke="#D9D9D9" strokeWidth={2.5} />
      <path d="m10 54 44-40" stroke="#D9D9D9" strokeWidth={2.5} strokeLinecap="round" />
    </svg>
  );
}

interface StatRowProps {
  value: number;
  label: string;
}

function StatRow({ value, label }: StatRowProps) {
  const animatedValue = useCountUp(value);
  return (
    <div className="flex flex-1 flex-col items-end justify-center gap-0.5 px-1 py-2.5">
      <span className="text-2xl font-extrabold tabular-nums" style={{ color: ANTHRACITE }}>
        {animatedValue}
      </span>
      <span className="text-xs font-medium" style={{ color: MUTED_GRAY }}>
        {label}
      </span>
    </div>
  );
}

// Small desaturated tile in the "Archiwum spraw" mosaic — resolved pets' first photo, or the
// same letter-monogram precedent (grayscaled) when there isn't one.
function ArchiveThumbnail({ pet }: { pet: Pet }) {
  if (pet.photoUrls[0]) {
    return <img src={pet.photoUrls[0]} alt="" className="aspect-square rounded-xl object-cover grayscale" aria-hidden="true" />;
  }
  return (
    <div
      className="flex aspect-square items-center justify-center rounded-xl bg-neutral-200 text-sm font-bold text-neutral-400 grayscale"
      aria-hidden="true"
    >
      {pet.species.charAt(0).toUpperCase()}
    </div>
  );
}

// Premium profile dashboard — mounted by AppShell.tsx as the third `activeView` alongside
// MainFeedPage/MapExplorerPage (see useAppUIStore.ts's ActiveView union). Reachable only via
// BottomNav's "Profil" tab, which is auth-gated (AppShell.tsx's runGatedAction), so `currentUser`
// is always set by the time this mounts.
export default function ProfilePage() {
  const currentUser = useAuthStore((state) => state.currentUser);
  const resetToMain = useAppUIStore((state) => state.resetToMain);
  const logout = useLogout();

  const { data: pets = [], isLoading } = useMyPets();
  const updatePetStatus = useUpdatePetStatus();
  const deletePet = useDeletePet();

  const [helpedCount, setHelpedCount] = useState(INITIAL_HELPED_COUNT);
  const [editingPetId, setEditingPetId] = useState<string | null>(null);
  const [hubListingId, setHubListingId] = useState<string | null>(null);
  const [deleteListingId, setDeleteListingId] = useState<string | null>(null);
  const [confettiKey, setConfettiKey] = useState(0);
  const [justResolvedPet, setJustResolvedPet] = useState<Pet | null>(null);

  const activePets = useMemo(() => pets.filter((pet) => pet.status !== 'resolved'), [pets]);
  const archivedPets = useMemo(() => pets.filter((pet) => pet.status === 'resolved'), [pets]);
  const activeListings = useMemo(() => activePets.map(mapPetToListing), [activePets]);

  const editingPet = pets.find((pet) => pet.id === editingPetId) ?? null;
  const hubListing = activeListings.find((listing) => listing.id === hubListingId) ?? null;
  const deleteListing = activeListings.find((listing) => listing.id === deleteListingId) ?? null;
  const accountAge = getAccountAgeStat(MOCK_ACCOUNT_CREATED_AT);

  const handleOpenHub = (id: string) => setHubListingId(id);
  const handleCloseHub = () => setHubListingId(null);
  const handleCloseEdit = () => setEditingPetId(null);

  const handleEditFromHub = (id: string) => {
    setEditingPetId(id);
    handleCloseHub();
  };

  // Flow 4: confetti burst + the row's own fade/slide-out (ListingRow's `exit`) + the remaining
  // rows sliding up (ListingRow's `layout`) all fire once useMyPets' query is invalidated and
  // re-derives `activeListings` without this pet — no manual array splicing needed anymore.
  const handleMarkFound = (id: string) => {
    updatePetStatus.mutate(
      { petId: id, status: 'resolved' },
      {
        onSuccess: (updated) => {
          setConfettiKey((key) => key + 1);
          setHelpedCount((count) => count + 1);
          setJustResolvedPet(updated);
        },
        onError: () => toast('Nie udało się zaktualizować statusu'),
      },
    );
    handleCloseHub();
  };

  const handleTogglePause = (id: string) => {
    const pet = activePets.find((entry) => entry.id === id);
    if (!pet) return;
    const nextStatus = pet.status === 'paused' ? 'missing' : 'paused';
    updatePetStatus.mutate(
      { petId: id, status: nextStatus },
      { onError: () => toast('Nie udało się zaktualizować statusu') },
    );
    handleCloseHub();
  };

  const handleRequestDelete = (id: string) => {
    setDeleteListingId(id);
    handleCloseHub();
  };

  const handleCancelDelete = () => setDeleteListingId(null);

  const handleConfirmDelete = () => {
    if (!deleteListingId) return;
    deletePet.mutate(deleteListingId, {
      onSuccess: () => {
        toast('Zgłoszenie zostało usunięte');
        setDeleteListingId(null);
      },
      onError: () => toast('Nie udało się usunąć zgłoszenia'),
    });
  };

  const handleShare = async (id: string) => {
    const pet = pets.find((entry) => entry.id === id);
    if (!pet) return;
    try {
      const blob = await generateShareImage(pet);
      await shareOrDownloadImage(blob, `${pet.name ?? 'zwierzak'}.png`, {
        title: `${pet.status === 'resolved' ? 'Odnaleziony' : 'Zaginął'}: ${pet.name ?? pet.species}`,
        text: 'Pomóż znaleźć — Where’s Fluffy',
      });
    } catch {
      toast('Nie udało się przygotować grafiki do udostępnienia');
    }
  };

  const handleLogout = async () => {
    await logout.mutateAsync();
    resetToMain();
  };

  return (
    <div className="relative h-full w-full overflow-hidden" style={{ backgroundColor: CANVAS }}>
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0, x: editingPetId ? '-100%' : '0%' }}
        transition={{ duration: 0.35, ease: 'easeOut' }}
        className="absolute inset-0 flex flex-col overflow-y-auto overscroll-contain px-4 pb-8"
        style={{ paddingTop: 'calc(1rem + env(safe-area-inset-top))' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-1 pb-4">
          <h1 className="text-[28px] font-extrabold tracking-tight" style={{ color: ANTHRACITE }}>
            Profil
          </h1>
          <button
            type="button"
            onClick={handleLogout}
            aria-label="Ustawienia i wylogowanie"
            disabled={logout.isPending}
            className="flex size-10 items-center justify-center rounded-full bg-white shadow-[0_2px_10px_-4px_rgba(0,0,0,0.25)] disabled:opacity-60"
            style={{ color: ANTHRACITE }}
          >
            <SettingsIcon />
          </button>
        </div>

        {/* Hero card */}
        <div className="flex items-center gap-4 rounded-[24px] bg-white p-5 shadow-[0_10px_30px_-12px_rgba(0,0,0,0.15)]">
          <div className="flex shrink-0 flex-col items-center gap-2 text-center">
            <div className="relative">
              <div
                className="flex size-20 items-center justify-center rounded-full text-2xl font-bold text-white"
                style={{ backgroundColor: ANTHRACITE }}
                aria-hidden="true"
              >
                {(currentUser?.name ?? '?').charAt(0).toUpperCase()}
              </div>
              <span
                className="absolute -bottom-1 -right-1 flex size-7 items-center justify-center rounded-full border-2 border-white"
                style={{ backgroundColor: CORAL }}
                aria-hidden="true"
              >
                <CheckBadgeIcon />
              </span>
            </div>
            <span
              className="rounded-full px-2.5 py-1 text-[10px] font-bold"
              style={{ backgroundColor: `${CORAL}1A`, color: CORAL }}
            >
              Zweryfikowany profil
            </span>
            <p className="text-[13px] font-bold leading-snug" style={{ color: ANTHRACITE }}>
              {currentUser?.name ?? 'Gość'}, Bielawa, Polska
            </p>
          </div>

          <div className="flex flex-1 flex-col divide-y" style={{ borderColor: HAIRLINE_BORDER, borderTopColor: 'transparent' }}>
            <div className="[&:not(:first-child)]:border-t" style={{ borderColor: HAIRLINE_BORDER }}>
              <StatRow value={pets.length} label="Zgłoszeń" />
            </div>
            <div className="border-t" style={{ borderColor: HAIRLINE_BORDER }}>
              <StatRow value={helpedCount} label="Pomogłeś" />
            </div>
            <div className="border-t" style={{ borderColor: HAIRLINE_BORDER }}>
              <StatRow value={accountAge.value} label={accountAge.label} />
            </div>
          </div>
        </div>

        {/* Dual sub-cards */}
        <div className="mt-3.5 grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => toast('Archiwum dostępne wkrótce')}
            className="flex flex-col gap-3 rounded-[24px] bg-white p-4 text-left shadow-[0_10px_30px_-14px_rgba(0,0,0,0.15)]"
          >
            <span className="text-[13px] font-bold" style={{ color: ANTHRACITE }}>
              Archiwum spraw →
            </span>
            <div className="grid grid-cols-4 gap-1.5">
              {archivedPets.map((pet) => (
                <ArchiveThumbnail key={pet.id} pet={pet} />
              ))}
            </div>
          </button>

          <button
            type="button"
            onClick={() => toast('Wsparcie dostępne wkrótce')}
            className="flex flex-col justify-between gap-3 rounded-[24px] bg-white p-4 text-left shadow-[0_10px_30px_-14px_rgba(0,0,0,0.15)]"
          >
            <span className="text-[13px] font-bold" style={{ color: ANTHRACITE }}>
              Wsparcie / Pomoc
            </span>
            <div className="flex flex-1 flex-col items-start justify-end gap-2">
              <SupportIcon />
              <span className="text-xs font-medium" style={{ color: MUTED_GRAY }}>
                Potrzebujesz pomocy? Skontaktuj się z nami.
              </span>
            </div>
          </button>
        </div>

        {/* Active listings feed */}
        <div className="mt-6 flex flex-1 flex-col">
          <h2 className="mb-1 px-1 text-base font-bold" style={{ color: ANTHRACITE }}>
            Twoje aktywne zgłoszenia
          </h2>

          {isLoading ? (
            <div className="flex flex-1 items-center justify-center py-16">
              <p className="text-sm font-medium" style={{ color: MUTED_GRAY }}>
                Ładowanie…
              </p>
            </div>
          ) : activeListings.length === 0 ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-4 py-16 text-center">
              <EmptyMapPinIcon />
              <p className="max-w-[220px] text-sm font-medium" style={{ color: MUTED_GRAY }}>
                Nie masz teraz żadnych aktywnych zgłoszeń na mapie
              </p>
            </div>
          ) : (
            <AnimatePresence initial={false}>
              {activeListings.map((listing) => (
                <ListingRow key={listing.id} listing={listing} onOpenHub={handleOpenHub} onShare={(id) => void handleShare(id)} />
              ))}
            </AnimatePresence>
          )}
        </div>
      </motion.div>

      <EditListingPanel pet={editingPet} open={editingPetId !== null} onClose={handleCloseEdit} />

      <ManagementHubSheet
        listing={hubListing}
        open={hubListingId !== null}
        onClose={handleCloseHub}
        onEdit={handleEditFromHub}
        onMarkFound={handleMarkFound}
        onTogglePause={handleTogglePause}
        onRequestDelete={handleRequestDelete}
      />

      <DeleteConfirmDialog
        listing={deleteListing}
        open={deleteListingId !== null}
        isDeleting={deletePet.isPending}
        onCancel={handleCancelDelete}
        onConfirm={handleConfirmDelete}
      />

      <ConfettiBurst triggerKey={confettiKey} />
      <CelebrationSharePrompt pet={justResolvedPet} onDismiss={() => setJustResolvedPet(null)} />
    </div>
  );
}
