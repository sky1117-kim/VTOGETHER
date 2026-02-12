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
      <Header />
      <main className="relative flex-1 pb-16 pt-16 sm:pb-0">{children}</main>
      <Footer />
      <Navigation />
    </div>
  )
}
