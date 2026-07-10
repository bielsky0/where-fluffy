import { IGeocodeResult } from './interfaces/geocode.interface.js';

type PhotonProperties = {
  name?: string;
  city?: string;
  state?: string;
  country?: string;
  // [minLon, maxLat, maxLon, minLat] — Photon's own corner order, NOT the same order as this
  // app's bboxSchema/Bbox (minLng,minLat,maxLng,maxLat, see shared/schemas/bbox.schema.ts).
  // Frequently absent for point features (a single address has no natural extent).
  extent?: [number, number, number, number];
};

type PhotonFeature = {
  geometry: { coordinates: [number, number] }; // [lon, lat]
  properties: PhotonProperties;
};

export type PhotonFeatureCollection = {
  features: PhotonFeature[];
};

function composeLabel(properties: PhotonProperties): string {
  const parts = [properties.name, properties.city, properties.state, properties.country].filter(
    (part, index, all): part is string => Boolean(part) && all.indexOf(part) === index,
  );
  return parts.join(', ');
}

function mapExtent(extent: PhotonProperties['extent']): IGeocodeResult['bbox'] {
  if (!extent) return null;
  // Reindex from Photon's [minLon, maxLat, maxLon, minLat] into this app's own
  // {minLng, minLat, maxLng, maxLat} order — getting this wrong silently produces an inverted
  // bbox (wrong map viewport), not a thrown error, so this mapping must stay explicit.
  const [minLng, maxLat, maxLng, minLat] = extent;
  return { minLng, minLat, maxLng, maxLat };
}

export function photonFeatureToDomain(feature: PhotonFeature): IGeocodeResult {
  const [lng, lat] = feature.geometry.coordinates;
  return {
    label: composeLabel(feature.properties),
    lat,
    lng,
    bbox: mapExtent(feature.properties.extent),
  };
}
