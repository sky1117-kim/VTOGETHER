import Link from 'next/link'

export function Footer() {
  return (
    <footer className="mt-12 border-t border-white/30 bg-white/60 py-12 backdrop-blur-md">
      <div className="mx-auto max-w-7xl px-4 text-center">
        <div className="mb-4 text-2xl font-bold tracking-tight text-gray-400">
          V.Together
        </div>
        <p className="mb-2 text-sm text-gray-500">
          VNTG ESG Management Platform
        </p>
        <p className="mb-4 text-xs text-gray-400">© 2026 VNTG Corp. All rights reserved.</p>
        <Link
          href="/admin"
          className="text-xs text-gray-400 underline transition hover:text-gray-600"
        >
          관리자
        </Link>
      </div>
    </footer>
  )
}
