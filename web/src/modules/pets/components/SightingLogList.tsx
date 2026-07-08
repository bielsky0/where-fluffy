import type { Sighting } from '../types/sighting';

interface SightingLogListProps {
  sightings: Sighting[];
}

export function SightingLogList({ sightings }: SightingLogListProps) {
  if (sightings.length === 0) {
    return <p>No sightings reported yet.</p>;
  }

  return (
    <ul>
      {sightings.map((sighting) => (
        <li key={sighting.id}>
          <p>{sighting.description}</p>
          {sighting.photoUrl && <img src={sighting.photoUrl} alt="" width={80} />}
          {sighting.location && (
            <small>
              {sighting.location.lat.toFixed(4)}, {sighting.location.lng.toFixed(4)}
            </small>
          )}
          <time dateTime={sighting.timestamp}>{new Date(sighting.timestamp).toLocaleString()}</time>
        </li>
      ))}
    </ul>
  );
}
