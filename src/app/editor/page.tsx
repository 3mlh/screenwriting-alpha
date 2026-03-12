import { Suspense } from 'react'
import { EditorPageClient } from './EditorPageClient'

export default function EditorPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-gray-100" />}>
      <EditorPageClient />
    </Suspense>
  )
}
