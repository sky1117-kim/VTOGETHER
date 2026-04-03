import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { Navigation } from "@/components/layout/Navigation";

export default async function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="page-bg flex min-h-screen min-w-0 flex-col overflow-x-clip">
      <Header />
      <main
        id="main-content"
        className="relative min-w-0 max-w-full flex-1 overflow-x-clip pb-16 pt-16 sm:pb-0"
      >
        {children}
      </main>
      <Footer />
      <Navigation />
    </div>
  );
}
