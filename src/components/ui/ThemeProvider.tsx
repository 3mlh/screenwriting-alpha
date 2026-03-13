'use client'

import { useEffect } from 'react'
import { applyTheme, getStoredMode } from '@/lib/theme'

export function ThemeProvider() {
  useEffect(() => {
    applyTheme(getStoredMode())

    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const handler = () => {
      if (getStoredMode() === 'system') applyTheme('system')
    }
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])

  return null
}
