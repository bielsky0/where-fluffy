// Shared icon set for the pet-detail page's sub-components — plain inline SVGs, same style as
// the rest of this "premium detail page" surface (see PetDetailPage.tsx's own doc comment on
// why it uses fixed hex literals rather than the app's theme-token system).

export function BackArrowIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="size-5" aria-hidden="true">
      <path d="m15 18-6-6 6-6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function ShareIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="size-[18px]" aria-hidden="true">
      <path
        d="M12 3v12M12 3l4 4M12 3 8 7M5 13v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function HeartIcon({ filled }: { filled: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill={filled ? 'currentColor' : 'none'}
      stroke="currentColor"
      strokeWidth={filled ? 0 : 2}
      className={filled ? 'size-[18px] text-rose-600' : 'size-[18px]'}
      aria-hidden="true"
    >
      <path
        d="M12 20.5s-7.5-4.6-10-9.3C.4 7.8 2 4.5 5.4 4a5 5 0 0 1 6.6 2.4A5 5 0 0 1 18.6 4c3.4.5 5 3.8 3.4 7.2-2.5 4.7-10 9.3-10 9.3Z"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function ClockIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="size-3.5" aria-hidden="true">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3.5 2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function StarIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" stroke="none" className="size-3.5" aria-hidden="true">
      <path d="M12 2.5l2.9 6 6.6.7-4.9 4.5 1.3 6.5-5.9-3.3-5.9 3.3 1.3-6.5-4.9-4.5 6.6-.7Z" />
    </svg>
  );
}

export function UserAvatarIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="size-6" aria-hidden="true">
      <circle cx="12" cy="8" r="3.5" />
      <path d="M4.5 20c1.6-3.7 5-5.5 7.5-5.5s5.9 1.8 7.5 5.5" strokeLinecap="round" />
    </svg>
  );
}

export function PinIcon({ color }: { color: string }) {
  return (
    <svg viewBox="0 0 24 24" width={28} height={28} aria-hidden="true">
      <path
        d="M12 2C7.6 2 4 5.6 4 10c0 6 8 12 8 12s8-6 8-12c0-4.4-3.6-8-8-8Z"
        fill={color}
        stroke="white"
        strokeWidth={1.5}
      />
      <circle cx="12" cy="10" r="3" fill="white" />
    </svg>
  );
}

export function MegaphoneIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="size-5" aria-hidden="true">
      <path d="M3 11v2a2 2 0 0 0 2 2h1l2 6h2l-1-6h2l8 4V5l-8 4H6a2 2 0 0 0-2 2z" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function PhoneIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="size-5" aria-hidden="true">
      <path
        d="M4 5c0-.6.4-1 1-1h3l2 5-2 1.5a11 11 0 0 0 5 5L14.5 14l5 2v3c0 .6-.4 1-1 1C10 20 4 14 4 5Z"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function CloseIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="size-5" aria-hidden="true">
      <path d="m6 6 12 12M18 6 6 18" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function CrosshairIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" width={20} height={20} fill="none" className={className} aria-hidden="true">
      <circle cx="12" cy="12" r="6.5" stroke="currentColor" strokeWidth="2" />
      <circle cx="12" cy="12" r="1.5" fill="currentColor" />
      <path d="M12 2v4M12 18v4M2 12h4M18 12h4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

export function CameraIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="size-[18px]" aria-hidden="true">
      <path
        d="M4 8a2 2 0 0 1 2-2h1l1.2-2h7.6L17 6h1a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2Z"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="12" cy="13" r="3.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
