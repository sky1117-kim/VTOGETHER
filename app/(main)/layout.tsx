import { Header } from '@/components/layout/Header'
import { Footer } from '@/components/layout/Footer'
import { Navigation } from '@/components/layout/Navigation'

export default async function MainLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="page-bg flex min-h-screen flex-col">
      <a
        href="#main-content"
        className="absolute left-4 top-4 z-[100] -translate-y-full rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white opacity-0 shadow-lg transition focus:translate-y-0 focus:opacity-100 focus:outline-none focus:ring-2 focus:ring-green-400 focus:ring-offset-2 btn-press"
      >
        본문으로 건너뛰기
      </a>
      <Header />
      <main id="main-content" className="relative flex-1 pb-16 pt-16 sm:pb-0">{children}</main>
      <Footer />
      <Navigation />
    </div>
  )
}
