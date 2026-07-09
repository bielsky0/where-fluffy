export interface Bbox {
  minLng: number;
  minLat: number;
  maxLng: number;
  maxLat: number;
}

// Rounds to ~1.1m precision at the equator (5 decimal places) — enough to keep query keys
// stable across sub-pixel pan jitter without visibly changing which pins/results a viewport
// returns. Without this, two near-identical `moveend` events would produce two distinct React
// Query cache entries instead of hitting the same one.
export function roundBbox(bbox: Bbox, precision = 5): Bbox {
  const factor = 10 ** precision;
  return {
    minLng: Math.round(bbox.minLng * factor) / factor,
    minLat: Math.round(bbox.minLat * factor) / factor,
    maxLng: Math.round(bbox.maxLng * factor) / factor,
    maxLat: Math.round(bbox.maxLat * factor) / factor,
  };
}

// Matches the backend's `bbox=minLng,minLat,maxLng,maxLat` query param shape (src/shared/schemas/bbox.schema.ts).
export function bboxToQueryValue(bbox: Bbox): string {
  return `${bbox.minLng},${bbox.minLat},${bbox.maxLng},${bbox.maxLat}`;
}
