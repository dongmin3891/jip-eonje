import type { Metadata } from "next";
import type { ReactNode } from "react";

import { Providers } from "@/components/providers";

import "./globals.css";

export const metadata: Metadata = {
  title: "집언제",
  applicationName: "집언제",
  description: "서울 SH 행복주택 단지 위치와 공개된 전월세 계약을 한눈에 확인합니다.",
  openGraph: {
    title: "집언제",
    description: "서울 SH 행복주택 단지 위치와 공개된 전월세 계약을 한눈에 확인합니다.",
    type: "website",
    locale: "ko_KR",
    siteName: "집언제",
  },
  twitter: {
    card: "summary_large_image",
    title: "집언제",
    description: "서울 SH 행복주택 단지 위치와 공개된 전월세 계약을 한눈에 확인합니다.",
  },
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="ko" className="h-full antialiased">
      <head>
        <link
          rel="stylesheet"
          href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/static/pretendard.min.css"
        />
      </head>
      <body className="h-full bg-white text-neutral-900">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
