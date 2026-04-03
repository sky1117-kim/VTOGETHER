import type { Metadata } from "next";
import { GoogleAnalytics } from "@next/third-parties/google";
import { Noto_Sans_KR } from "next/font/google";
import { SupabaseBrowserBridge } from "@/components/providers/supabase-browser-bridge";
import "./globals.css";

// 환경변수 값을 안전하게 정리해 GA 측정 ID를 반환합니다.
function getGaMeasurementId() {
  const raw = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID;
  if (typeof raw !== "string") return null;

  const trimmed = raw.trim();
  if (!trimmed) return null;

  // GA4 측정 ID 형식(G-XXXX...)이 아닐 경우 삽입하지 않습니다.
  if (!trimmed.startsWith("G-")) return null;

  return trimmed;
}

const gaMeasurementId = getGaMeasurementId();

const notoSansKr = Noto_Sans_KR({
  variable: "--font-noto-sans-kr",
  subsets: ["latin"],
  weight: ["300", "400", "500", "700"],
});

export const metadata: Metadata = {
  title: "V.Together",
  description: "ESG 경영 실천 및 조직문화 활성화를 위한 통합 임직원 참여 플랫폼",
  icons: {
    icon: "/icon.png",
    shortcut: "/icon.png",
    apple: "/icon.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko" className="overflow-x-clip">
      <body className={`${notoSansKr.variable} font-sans antialiased overflow-x-clip`}>
        <SupabaseBrowserBridge>{children}</SupabaseBrowserBridge>
        {gaMeasurementId ? <GoogleAnalytics gaId={gaMeasurementId} /> : null}
      </body>
    </html>
  );
}
