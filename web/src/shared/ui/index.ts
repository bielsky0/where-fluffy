// Single entry point for the reusable component library — every consumer imports from
// '@/shared/ui', never reaching into a component's own subfolder
// (e.g. '@/shared/ui/button/Button'). This is what makes the library's internal layout
// (one folder per component) safe to reshuffle later without touching call sites.
//
// Add one line here per component folder as the library grows — shadcn's own CLI
// (`npx shadcn add <component>`, see components.json) writes new components straight into
// this directory; the only manual step left is re-exporting them here.
export * from './button';
export * from './layout';
export * from './theme-toggle';
