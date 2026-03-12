import Link from 'next/link'

export default function Home() {
  return (
    <main className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center space-y-6 p-8">
        <h1 className="text-3xl font-bold text-gray-900 tracking-tight">
          Screenwriting Alpha
        </h1>
        <p className="text-gray-500 max-w-md">
          Professional screenplay editor. Structured block data. No formatting lock-in.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link
            href="/app"
            className="px-6 py-3 bg-gray-900 text-white rounded-lg font-medium hover:bg-gray-800 transition-colors"
          >
            Sign in
          </Link>
          <Link
            href="/editor?demo=true"
            className="px-6 py-3 bg-gray-100 text-gray-700 rounded-lg font-medium hover:bg-gray-200 transition-colors"
          >
            Try demo (no account)
          </Link>
        </div>
      </div>
    </main>
  )
}
