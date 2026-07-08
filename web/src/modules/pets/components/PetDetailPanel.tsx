import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { useCreateSighting, useSightings } from '../api/useSightings';
import { SightingLogList } from './SightingLogList';
import type { Pet } from '../types/pet.types';

interface PetDetailPanelProps {
  pet: Pet;
  onBack: () => void;
}

export function PetDetailPanel({ pet, onBack }: PetDetailPanelProps) {
  const { data: sightings, isLoading } = useSightings(pet.id);
  const createSighting = useCreateSighting(pet.id);
  const [description, setDescription] = useState('');

  const handleAddSighting = async (event: FormEvent) => {
    event.preventDefault();
    if (!description.trim()) return;

    // `type: 'general'` here — a plain log entry, no GPS pin required. A "sighted at this
    // exact spot" entry (type: 'sighted') needs location, which this quick form doesn't
    // collect yet (see AddReportModal.tsx for the geolocation-prompt pattern that would apply).
    await createSighting.mutateAsync({ description: description.trim(), type: 'general' });
    setDescription('');
  };

  return (
    <div>
      <button type="button" onClick={onBack}>
        ← Back
      </button>
      <h2>{pet.name}</h2>
      <p>
        {pet.species} — {pet.status === 'missing' ? 'Missing' : 'Found'}
      </p>
      {/* Only real, discoverable entry point into PetDetailPage's full premium layout — this
          panel itself stays the quick drawer summary (see MapExplorerPage.tsx's STATE_C). */}
      <Link to={`/app/pets/${pet.id}`}>Zobacz pełny profil →</Link>

      <h3>Sighting log</h3>
      {isLoading && <p>Loading sightings…</p>}
      {sightings && <SightingLogList sightings={sightings} />}

      <form onSubmit={handleAddSighting}>
        <textarea
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          placeholder="Describe what you saw…"
          required
        />
        {createSighting.isPaused && (
          <p>Offline — this sighting will send automatically once you're back online.</p>
        )}
        <button type="submit" disabled={createSighting.isPending}>
          {createSighting.isPending ? 'Sending…' : 'Add sighting'}
        </button>
      </form>
    </div>
  );
}
