import Link from 'next/link'

export default function Home() {
  return (
    <main className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center space-y-6 p-8">
        <h1 className="text-3xl font-bold text-gray-900 tracking-tight">
          Screenwriting Alpha
        </h1>
        <p className="text-gray-500 max-w-md">
          Professional screenplay editor. Milestone 1 — Editor Foundation.
        </p>
        <div className="flex gap-4 justify-center">
          <Link
            href="/editor"
            className="px-6 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors"
          >
            Open Editor
          </Link>
          <Link
            href="/editor?demo=true"
            className="px-6 py-3 bg-gray-100 text-gray-700 rounded-lg font-medium hover:bg-gray-200 transition-colors"
          >
            Load Demo Script
          </Link>
        </div>
      </div>
    </main>
  )
}
