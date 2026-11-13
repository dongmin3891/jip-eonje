import type { Metadata } from "next";

import { Providers } from "@/components/providers";

import "./globals.css";

export const metadata: Metadata = {
  title: "SH 행복주택 전월세",
  description: "서울 SH 행복주택의 공개된 전월세 계약과 공가 안내를 한 화면에서 확인합니다.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
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
