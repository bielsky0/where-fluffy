// Shared by AddReportModal.tsx (pinning a new report to the reporter's position) and
// SearchModal.tsx (the "Use current location" search filter) — same browser API call, same
// promise wrapper, no reason for either to hand-roll its own.
export function getCurrentPosition(): Promise<{ lat: number; lng: number }> {
  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(
      (position) => resolve({ lat: position.coords.latitude, lng: position.coords.longitude }),
      reject,
    );
  });
}
