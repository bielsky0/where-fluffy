import { PhotonConfig, photonConfig } from '../../shared/config/photon.config.js';
import { createAppError } from '../../shared/errors/app-error.js';
import { GeocodeRepository } from './interfaces/geocode.interface.js';
import { photonFeatureToDomain, PhotonFeatureCollection } from './geocode.mapper.js';

// Unlike geocoding.service.ts's reverse-geocode "Silent Fallback" (right for a background
// enrichment during pet creation), this proxy must NOT swallow failures into an empty array —
// the frontend is actively waiting on this call to show results or an error state. Timeouts and
// upstream failures are surfaced as thrown AppErrors instead, propagated through asyncHandler to
// the global error middleware like any other operational error.
export const createGeocodeRepository = (config: PhotonConfig = photonConfig): GeocodeRepository => {
  const search: GeocodeRepository['search'] = async (query) => {
    // Photon's search endpoint is the base URL itself (GET https://photon.komoot.io/api/?q=...)
    // — unlike Nominatim's /search sub-path, there's no separate "search" path segment to append.
    const url = new URL(config.PHOTON_BASE_URL);
    url.searchParams.set('q', query);
    url.searchParams.set('limit', String(config.PHOTON_RESULT_LIMIT));
    // No `lang` param: Photon's public instance only accepts default/de/en/fr (not 'pl') and
    // 400s on anything else — omitting it already returns each place's local-language name
    // (confirmed against the live API), which is what we want for Polish place names anyway.

    let response: Response;
    try {
      response = await fetch(url, {
        headers: { 'User-Agent': config.PHOTON_USER_AGENT },
        signal: AbortSignal.timeout(config.PHOTON_TIMEOUT_MS),
      });
    } catch (err) {
      const isTimeout = err instanceof Error && err.name === 'TimeoutError';
      throw createAppError(isTimeout ? 504 : 502, 'Wyszukiwarka lokalizacji jest chwilowo niedostępna.');
    }

    if (!response.ok) {
      throw createAppError(502, 'Wyszukiwarka lokalizacji zwróciła błąd.');
    }

    const body = (await response.json()) as PhotonFeatureCollection;
    return body.features.map(photonFeatureToDomain);
  };

  return { search };
};
