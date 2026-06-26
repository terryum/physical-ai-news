"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ThemeToggle } from "@/components/theme-toggle";

const NAV_ITEMS = [
  { href: "/", label: "오늘의 클리핑" },
  { href: "/gov", label: "전체 공고" },
  { href: "/news", label: "전체 뉴스" },
  { href: "/trending", label: "해외 트렌딩" },
] as const;

export function NavHeader() {
  const pathname = usePathname();

  return (
    <header className="border-b border-line-default">
      <div className="mx-auto max-w-4xl px-4 md:px-6 lg:px-8">
        <div className="flex items-center justify-between gap-3 h-14">
          <Link
            href="/"
            className="flex items-baseline gap-2 min-w-0 group"
          >
            <h1 className="text-base font-semibold tracking-tight text-text-primary group-hover:text-accent transition-colors truncate">
              Physical AI News
            </h1>
            <span className="text-xs text-text-muted hidden md:inline truncate">
              제조 피지컬AI 정부과제 · 뉴스
            </span>
          </Link>
          <div className="flex items-center gap-2 shrink-0">
            <ThemeToggle />
          </div>
        </div>
        <nav className="flex gap-4 -mb-px overflow-x-auto scrollbar-hide">
          {NAV_ITEMS.map(({ href, label }) => {
            const isActive = pathname === href;
            return (
              <Link
                key={href}
                href={href}
                className={`shrink-0 py-2 text-sm transition-colors border-b-2 ${
                  isActive
                    ? "text-accent border-accent"
                    : "text-text-secondary border-transparent hover:text-accent"
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
