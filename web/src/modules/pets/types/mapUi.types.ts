// Shared between store/usePetMapStore.ts and components/BottomSheet.tsx so neither has to
// import the other's file just for this one type. Named after the 3-position drawer spec
// (AppShell.tsx's STATE_C): collapsed = ~10% viewport height, half = ~50%, expanded = ~92%.
export type DrawerSnap = 'collapsed' | 'half' | 'expanded';
