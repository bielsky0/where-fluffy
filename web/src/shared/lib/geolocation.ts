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

// Read-only permission check for the 'geolocation' descriptor — lets a caller decide whether
// calling getCurrentPosition() will resolve silently, trigger the native prompt, or fail, before
// calling it. Returns the live PermissionStatus (not just a string) so a caller can also attach
// a 'change' listener for revocation detection. Returns null when the Permissions API isn't
// available at all, or the 'geolocation' descriptor specifically isn't supported (older Safari)
// — callers must treat null the same as 'prompt': never assume granted, never auto-fetch.
export function queryGeolocationPermission(): Promise<PermissionStatus | null> {
  if (!('permissions' in navigator)) return Promise.resolve(null);
  return navigator.permissions.query({ name: 'geolocation' }).catch(() => null);
}
