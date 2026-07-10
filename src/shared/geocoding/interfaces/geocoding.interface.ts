export type GeocodingService = {
  reverseGeocode: (lat: number, lng: number) => Promise<string | null>;
};
