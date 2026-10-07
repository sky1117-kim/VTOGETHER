import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { Navigation } from "@/components/layout/Navigation";
import { getCurrentUser } from "@/api/actions/auth";

export default async function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  let isAdmin = false;
  try {
    const user = await getCurrentUser();
    isAdmin = !!user?.is_admin;
  } catch {
    // 인증 비활성화 시
  }

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
      <Navigation isAdmin={isAdmin} />
    </div>
  );
}
