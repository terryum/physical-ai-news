import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { NavHeader } from "@/components/nav-header";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "Physical AI News",
  description: "제조 피지컬AI 정부과제·뉴스 자동 수집 대시보드",
};

const themeInitScript = `
(function() {
  try {
    var t = localStorage.getItem('theme');
    if (!t) t = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme', t);
  } catch(e) {}
})();
`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko" suppressHydrationWarning className={`${inter.variable} h-full`}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body className="min-h-full flex flex-col font-sans leading-relaxed antialiased">
        <NavHeader />
        <main className="mx-auto w-full max-w-4xl px-4 md:px-6 lg:px-8 py-10 flex-1">
          {children}
        </main>
      </body>
    </html>
  );
}
