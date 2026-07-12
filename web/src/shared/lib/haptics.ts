// Progressive enhancement only — iOS Safari has no `navigator.vibrate` at all, and desktop
// browsers without a vibration motor simply no-op. Never gate a feature's correctness on this;
// it's a bonus tactile cue for touch devices that support it (Hero's radius slider).
const canVibrate = (): boolean => typeof navigator !== 'undefined' && 'vibrate' in navigator;

// Fired once per crossed km boundary while dragging the radius slider.
export function hapticTick(): void {
  if (canVibrate()) navigator.vibrate(8);
}

// Fired once when a drag gesture starts (grabbing the slider thumb) — slightly stronger than a
// tick so "I've picked this up" reads as distinct from "I've moved past a km."
export function hapticImpact(): void {
  if (canVibrate()) navigator.vibrate(15);
}
