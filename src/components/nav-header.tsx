"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV_ITEMS = [
  { href: "/", label: "오늘의 클리핑" },
  { href: "/gov", label: "전체 공고" },
  { href: "/news", label: "전체 뉴스" },
] as const;

export function NavHeader() {
  const pathname = usePathname();

  return (
    <header className="border-b bg-card">
      <div className="mx-auto max-w-4xl px-4">
        <div className="flex items-center justify-between py-4">
          <Link href="/" className="flex items-baseline gap-2">
            <h1 className="text-lg font-bold tracking-tight">
              Physical AI News
            </h1>
            <span className="text-xs text-muted-foreground hidden sm:inline">
              제조 피지컬AI 정부과제 · 뉴스
            </span>
          </Link>
        </div>
        <nav className="flex gap-1 -mb-px">
          {NAV_ITEMS.map(({ href, label }) => {
            const isActive = pathname === href;
            return (
              <Link
                key={href}
                href={href}
                className={`px-3 py-2 text-sm font-medium border-b-2 transition-colors ${
                  isActive
                    ? "border-primary text-foreground"
                    : "border-transparent text-muted-foreground hover:text-foreground hover:border-muted-foreground/30"
                }`}
              >
                {label}
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
