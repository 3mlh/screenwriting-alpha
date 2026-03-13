// Theme is now managed via src/lib/theme.ts (direct localStorage + DOM).
// This file is kept as a re-export shim so any stray imports don't break.
export type { ThemeMode } from '@/lib/theme'
