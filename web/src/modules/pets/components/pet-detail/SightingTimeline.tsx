import { useState, type FormEvent } from 'react';
import { useCreateSighting } from '../../api/useSightings';
import { formatTimelineTimestamp } from '../../lib/format';
import type { Sighting } from '../../types/sighting';

const ANTHRACITE = '#222222';
const MUTED_GRAY = '#8E8E93';
const HAIRLINE_BORDER = '#E5E5E5';
const CORAL = '#FF6B4A';

interface SightingTimelineProps {
  petId: string;
  sightings: Sighting[] | undefined;
  accentColor: string;
}

// Splits the flat comment stream into two visual tiers, per the spec: official, location-tagged
// sighting reports (type 'sighted'/'area_checked_empty' — these are what let volunteers map the
// animal's movement) get the full timestamped/dotted timeline treatment; plain supportive text
// (type 'general', e.g. "Trzymam kciuki!") is visually de-emphasized so it doesn't clutter the
// facts. Both types already exist on Comment.type server-side — this is a client-side grouping
// of data that was already there, not a new backend capability.
export function SightingTimeline({ petId, sightings, accentColor }: SightingTimelineProps) {
  const createSighting = useCreateSighting(petId);
  const [description, setDescription] = useState('');
  const [showGeneral, setShowGeneral] = useState(false);

  const handleAddComment = async (event: FormEvent) => {
    event.preventDefault();
    if (!description.trim()) return;
    // type: 'general' — a plain supportive comment, no GPS pin required. A location-tagged
    // sighting report goes through StickyActionBar's "Zgłoś zaobserwowanie" flow instead
    // (ReportSightingSheet), which collects a map pin as required by createCommentSchema's
    // .refine() for type: 'sighted'.
    await createSighting.mutateAsync({ description: description.trim(), type: 'general' });
    setDescription('');
  };

  const official = sightings?.filter((s) => s.type === 'sighted' || s.type === 'area_checked_empty') ?? [];
  const general = sightings?.filter((s) => s.type === 'general') ?? [];

  return (
    <div className="border-t px-5 py-5" style={{ borderColor: HAIRLINE_BORDER }}>
      <h2 className="mb-4 text-lg font-bold" style={{ color: ANTHRACITE }}>
        Historia zgłoszeń
      </h2>

      <form onSubmit={handleAddComment} className="mb-5 flex flex-col gap-2">
        <textarea
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          placeholder="Dodaj komentarz wsparcia…"
          required
          rows={2}
          className="w-full resize-none rounded-2xl border px-3.5 py-2.5 text-sm outline-none focus:border-neutral-400"
          style={{ borderColor: HAIRLINE_BORDER, color: ANTHRACITE }}
        />
        {createSighting.isPaused && (
          <p className="text-xs" style={{ color: MUTED_GRAY }}>
            Offline — zgłoszenie wyśle się automatycznie, gdy wrócisz do sieci.
          </p>
        )}
        <button
          type="submit"
          disabled={createSighting.isPending}
          className="self-end rounded-full px-5 py-2 text-sm font-bold text-white transition-transform active:scale-95 disabled:opacity-60"
          style={{ backgroundColor: CORAL }}
        >
          {createSighting.isPending ? 'Wysyłanie…' : 'Dodaj komentarz'}
        </button>
      </form>

      {official.length === 0 ? (
        <p className="text-sm" style={{ color: MUTED_GRAY }}>
          Brak zgłoszeń widzenia — bądź pierwszą osobą, która doda wskazówkę.
        </p>
      ) : (
        <ol className="relative flex flex-col gap-5 border-l" style={{ borderColor: HAIRLINE_BORDER }}>
          {official.map((sighting) => (
            <li key={sighting.id} className="relative pl-5">
              <span
                className="absolute -left-[5px] top-1 size-2.5 rounded-full border-2 border-white"
                style={{ backgroundColor: accentColor }}
                aria-hidden="true"
              />
              <p className="text-sm" style={{ color: ANTHRACITE }}>
                <span className="font-semibold">{formatTimelineTimestamp(sighting.timestamp)}</span> – {sighting.description}
              </p>
            </li>
          ))}
        </ol>
      )}

      {general.length > 0 && (
        <div className="mt-5">
          <button
            type="button"
            onClick={() => setShowGeneral((prev) => !prev)}
            className="text-xs font-semibold underline"
            style={{ color: MUTED_GRAY }}
          >
            {showGeneral ? 'Ukryj komentarze wsparcia' : `Pokaż komentarze wsparcia (${general.length})`}
          </button>
          {showGeneral && (
            <ul className="mt-3 flex flex-col gap-2.5">
              {general.map((sighting) => (
                <li key={sighting.id} className="text-xs" style={{ color: MUTED_GRAY }}>
                  {formatTimelineTimestamp(sighting.timestamp)} – {sighting.description}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
