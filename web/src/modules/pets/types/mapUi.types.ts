// Shared between store/usePetMapStore.ts and components/BottomSheet.tsx so neither has to
// import the other's file just for this one type.
export type BottomSheetSnap = 'collapsed' | 'peek' | 'full';
