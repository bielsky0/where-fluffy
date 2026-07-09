export type GeoIpResult = { lat: number; lng: number; city: string | null };

export type LocationRepository = {
  init: () => Promise<void>;
  lookup: (ip: string) => GeoIpResult | null;
};
