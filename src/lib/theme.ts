export type ThemeMode = 'light' | 'dark' | 'system'

const KEY = 'wr-theme-mode'

export function applyTheme(mode: ThemeMode): void {
  if (typeof window === 'undefined') return
  const isDark =
    mode === 'dark' ||
    (mode === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)
  document.documentElement.setAttribute('data-theme', isDark ? 'dark' : 'light')
}

export function getStoredMode(): ThemeMode {
  if (typeof window === 'undefined') return 'system'
  return (localStorage.getItem(KEY) as ThemeMode) ?? 'system'
}

/** Write to localStorage and apply to DOM immediately — no React involved. */
export function setTheme(mode: ThemeMode): void {
  if (typeof window === 'undefined') return
  localStorage.setItem(KEY, mode)
  applyTheme(mode)
}
