'use client'

import type { AutosaveStatus } from '@/stores/scriptStore'

interface Props {
  status: AutosaveStatus
  isDirty: boolean
}

export function SaveIndicator({ status, isDirty }: Props) {
  if (status === 'saving') {
    return <span className="text-amber-500">Saving…</span>
  }

  if (status === 'error') {
    return <span className="text-red-500">Save failed — retrying</span>
  }

  if (status === 'saved' && !isDirty) {
    return <span className="text-green-500">Saved</span>
  }

  if (isDirty) {
    return <span className="text-amber-500">Unsaved changes</span>
  }

  return <span className="text-green-500">Saved</span>
}
