import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { NavHeader } from "@/components/nav-header";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Physical AI News",
  description: "제조 피지컬AI 정부과제·뉴스 자동 수집 대시보드",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="ko"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <NavHeader />
        <main className="mx-auto w-full max-w-4xl px-4 py-6 flex-1">
          {children}
        </main>
      </body>
    </html>
  );
}
