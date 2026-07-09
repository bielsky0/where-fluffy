// Used by SearchModal.tsx (the "Use current location" search filter) — kept as its own module
// rather than inlined there in case a future caller needs the same browser API call/promise
// wrapper (the add-listing wizard doesn't: StepMapPin.tsx pins location by dragging the map
// instead of prompting for device geolocation).
export function getCurrentPosition(): Promise<{ lat: number; lng: number }> {
  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(
      (position) => resolve({ lat: position.coords.latitude, lng: position.coords.longitude }),
      reject,
    );
  });
}
