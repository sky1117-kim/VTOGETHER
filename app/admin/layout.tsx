import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/api/actions/auth'

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const user = await getCurrentUser()
  if (!user) {
    redirect('/login')
  }
  if (!user.is_admin) {
    redirect('/?admin=denied')
  }

  return (
    <div className="min-h-screen bg-gray-100">
      <header className="border-b border-gray-200 bg-white shadow-sm">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-4">
            <Link
              href="/"
              className="flex items-center gap-2 text-gray-600 transition hover:text-gray-900"
            >
              <span className="text-xl">←</span>
              <span className="font-medium">메인으로</span>
            </Link>
            <span className="text-gray-300">|</span>
            <h1 className="text-xl font-bold text-gray-900">
              V.Together 관리자
            </h1>
            <span className="text-gray-300">|</span>
            <Link
              href="/admin/events"
              className="text-sm font-medium text-gray-600 transition hover:text-gray-900"
            >
              이벤트
            </Link>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {children}
      </main>
    </div>
  )
}
