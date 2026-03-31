import Link from "next/link";
import { getCurrentUser } from "@/api/actions/auth";

export async function Footer() {
  let isAdmin = false;
  try {
    const user = await getCurrentUser();
    isAdmin = !!user?.is_admin;
  } catch {
    // 인증 비활성화 시
  }

  return (
    <footer className="relative z-0 mt-12 border-t border-gray-200 bg-white py-10 pb-24 sm:pb-10">
      <div className="mx-auto max-w-7xl px-4">
        <div className="mb-6 text-2xl font-bold tracking-tight text-gray-800">
          V.Together
        </div>
        <p className="mb-1 text-sm text-gray-600">
          VNTG ESG Management Platform
        </p>
        <p className="mb-4 text-xs text-gray-500">
          © 2026 VNTG Corp. All rights reserved.
        </p>
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-xs">
          {isAdmin && (
            <Link
              href="/admin"
              className="text-gray-500 underline decoration-gray-300 transition hover:text-green-600 hover:decoration-green-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-green-500 focus-visible:ring-offset-2 rounded"
            >
              관리자
            </Link>
          )}
          <a
            href="#"
            className="text-gray-500 underline decoration-gray-300 transition hover:text-gray-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-green-500 focus-visible:ring-offset-2 rounded"
          >
            이용약관
          </a>
          <a
            href="#"
            className="text-gray-500 underline decoration-gray-300 transition hover:text-gray-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-green-500 focus-visible:ring-offset-2 rounded"
          >
            개인정보처리방침
          </a>
        </div>
      </div>
    </footer>
  );
}
