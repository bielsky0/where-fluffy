import { useState, type FormEvent } from 'react';
import { useCreatePetReport } from '../api/usePets';

interface AddReportModalProps {
  onClose: () => void;
}

function getCurrentPosition(): Promise<{ lat: number; lng: number }> {
  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(
      (position) => resolve({ lat: position.coords.latitude, lng: position.coords.longitude }),
      reject,
    );
  });
}

// Quick-action modal for the "+" button in PetsMapView.tsx. Only "Lost" actually submits —
// see the disabled "Found" tab below for why.
export function AddReportModal({ onClose }: AddReportModalProps) {
  const [name, setName] = useState('');
  const [species, setSpecies] = useState('');
  const [reward, setReward] = useState(0);
  const [locationError, setLocationError] = useState<string | null>(null);
  const createReport = useCreatePetReport();

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setLocationError(null);

    let location: { lat: number; lng: number };
    try {
      location = await getCurrentPosition();
    } catch {
      setLocationError('Location access is required to report a missing pet.');
      return;
    }

    await createReport.mutateAsync({ name, species, location, reward });
    onClose();
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.4)',
        display: 'flex',
        alignItems: 'flex-end',
        zIndex: 1000,
      }}
    >
      <div style={{ background: 'white', width: '100%', borderTopLeftRadius: 16, borderTopRightRadius: 16, padding: 24 }}>
        <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
          <button type="button" aria-pressed="true">
            Lost
          </button>
          {/* Reporting a found stray as its own record has no backend endpoint —
             pets.service.ts only exposes reportMissingPet(). This app models "found" as a
             sighting/comment against an existing missing-pet report (see PetDetailPanel.tsx),
             not a standalone creation flow — so this tab is disabled rather than faking a
             submission that has nowhere real to go. */}
          <button type="button" disabled title="Not supported yet — add a sighting on the existing pet instead">
            Found
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Pet name"
            required
          />
          <input
            value={species}
            onChange={(event) => setSpecies(event.target.value)}
            placeholder="Species"
            required
          />
          <input
            type="number"
            min={0}
            value={reward}
            onChange={(event) => setReward(Number(event.target.value))}
            placeholder="Reward"
          />

          {locationError && <p role="alert">{locationError}</p>}
          {createReport.isPaused && (
            <p>Offline — this report will send automatically once you're back online.</p>
          )}
          {createReport.isError && <p role="alert">Could not submit the report. Please try again.</p>}

          <button type="submit" disabled={createReport.isPending}>
            {createReport.isPending ? 'Submitting…' : 'Submit report'}
          </button>
          <button type="button" onClick={onClose}>
            Cancel
          </button>
        </form>
      </div>
    </div>
  );
}
