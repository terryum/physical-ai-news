"use client";

import { Badge } from "@/components/ui/badge";
import type { Item } from "@/data/types";

const priorityColors: Record<string, string> = {
  P0: "bg-red-500/15 text-red-700 dark:text-red-400 border-red-500/20",
  P1: "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/20",
  P2: "bg-gray-500/15 text-gray-600 dark:text-gray-400 border-gray-500/20",
};

const priorityLabel: Record<string, string> = {
  P0: "필독",
  P1: "참고",
  P2: "관찰",
};

const tierColors: Record<string, string> = {
  T0: "bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-500/20",
  T1: "bg-violet-500/15 text-violet-700 dark:text-violet-400 border-violet-500/20",
  T2: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/20",
  T3: "bg-slate-500/15 text-slate-600 dark:text-slate-400 border-slate-500/20",
};

const tierLabel: Record<string, string> = {
  T0: "피지컬AI",
  T1: "스마트제조",
  T2: "ODM경쟁사",
  T3: "브랜드사",
};

const statusLabel: Record<string, string> = {
  open: "접수중",
  upcoming: "예정",
  closed: "마감",
};

interface ItemRowProps {
  item: Item;
  onToggleRead: (id: string) => void;
  onToggleStar: (id: string) => void;
  trendingLang?: "ko" | "en";
}

function formatDate(iso: string) {
  const d = new Date(iso);
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")}`;
}

function daysUntil(iso: string): number {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const target = new Date(iso);
  target.setHours(0, 0, 0, 0);
  return Math.ceil((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

export function ItemRow({ item, onToggleRead, onToggleStar, trendingLang = "ko" }: ItemRowProps) {
  const canonicalUrl = item.links?.[0]?.url ?? "#";
  const isGov = item.itemType === "gov";
  const isTrending = item.itemType === "trending";
  const daysLeft = item.deadlineAt ? daysUntil(item.deadlineAt) : null;
  const typeLabel = isGov ? "공고" : isTrending ? "트렌딩" : "뉴스";
  const displayTitle =
    isTrending && trendingLang === "ko" && item.titleKo ? item.titleKo : item.title;

  return (
    <div
      className={`group rounded-lg border px-4 py-3 transition-colors hover:bg-accent/50 ${
        item.read ? "opacity-60" : ""
      }`}
    >
      <div className="flex items-start gap-3">
        {/* Read indicator + Star */}
        <div className="flex flex-col items-center gap-1 pt-0.5 shrink-0">
          <button
            onClick={() => onToggleRead(item.id)}
            className="h-2.5 w-2.5 rounded-full border-2 transition-colors"
            style={{
              backgroundColor: item.read ? "transparent" : "currentColor",
              borderColor: "currentColor",
              color: item.read
                ? "var(--color-muted-foreground)"
                : "var(--color-primary)",
            }}
            title={item.read ? "읽음" : "안읽음"}
          />
          <button
            onClick={() => onToggleStar(item.id)}
            className="text-sm leading-none transition-colors"
            title={item.starred ? "별표 해제" : "별표"}
          >
            {item.starred ? "★" : "☆"}
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          {/* Title row */}
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-5 shrink-0">
              {typeLabel}
            </Badge>
            <a
              href={canonicalUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm font-medium truncate hover:text-blue-600 dark:hover:text-blue-400 hover:underline underline-offset-2"
            >
              {displayTitle}
            </a>
          </div>
          {isTrending && trendingLang === "ko" && item.titleKo && (
            <div className="mt-0.5 text-[11px] text-muted-foreground/70 truncate" title={item.title}>
              {item.title}
            </div>
          )}

          {/* Meta row */}
          <div className="mt-1.5 flex items-center gap-2 flex-wrap">
            <Badge className={`text-[10px] px-1.5 py-0 h-5 ${priorityColors[item.priority]}`}>
              {priorityLabel[item.priority] ?? item.priority}
            </Badge>
            <Badge className={`text-[10px] px-1.5 py-0 h-5 ${tierColors[item.tier]}`}>
              {tierLabel[item.tier] ?? item.tier}
            </Badge>
            <span className="text-xs text-muted-foreground">{item.sourceName}</span>

            {/* 게시일 */}
            <span className="text-xs text-muted-foreground">
              게시 {formatDate(item.publishedAt)}
            </span>

            {/* points/comments (트렌딩만) */}
            {isTrending && (item.points || item.commentCount) ? (
              <span className="text-xs text-muted-foreground">
                {item.points ? <span className="mr-2">▲ {item.points}</span> : null}
                {item.commentCount ? <span>💬 {item.commentCount}</span> : null}
              </span>
            ) : null}

            {/* 마감일 (공고만) */}
            {isGov && item.deadlineAt && (
              <span
                className={`text-xs font-medium ${
                  daysLeft !== null && daysLeft <= 7
                    ? "text-red-600 dark:text-red-400"
                    : daysLeft !== null && daysLeft <= 14
                      ? "text-amber-600 dark:text-amber-400"
                      : "text-muted-foreground"
                }`}
              >
                마감 {formatDate(item.deadlineAt)}
                {daysLeft !== null && daysLeft >= 0 && (
                  <span className="ml-1">
                    ({daysLeft === 0 ? "오늘" : `D-${daysLeft}`})
                  </span>
                )}
                {daysLeft !== null && daysLeft < 0 && (
                  <span className="ml-1 text-muted-foreground">(종료)</span>
                )}
              </span>
            )}

            {item.budgetKrwOk && (
              <span className="text-xs text-muted-foreground">
                {item.budgetKrwOk}억원
              </span>
            )}
            {item.status && (
              <Badge
                variant="outline"
                className={`text-[10px] px-1.5 py-0 h-5 ${
                  item.status === "open"
                    ? "border-green-500/40 text-green-700 dark:text-green-400"
                    : item.status === "closed"
                      ? "border-red-500/40 text-red-600 dark:text-red-400"
                      : ""
                }`}
              >
                {statusLabel[item.status]}
              </Badge>
            )}
            {item.matchedCompanies.map((c) => (
              <span key={c} className="text-xs text-blue-600 dark:text-blue-400">
                #{c}
              </span>
            ))}
          </div>

          {/* Related articles */}
          {item.relatedArticles && item.relatedArticles.length > 0 && (
            <div className="mt-1.5 pl-2 border-l-2 border-muted-foreground/20 space-y-0.5">
              {item.relatedArticles.map((ra, idx) => (
                <div key={idx} className="flex items-baseline gap-1.5">
                  <span className="text-[10px] text-muted-foreground shrink-0">{"\u2514"}</span>
                  <a
                    href={ra.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-muted-foreground hover:text-blue-600 dark:hover:text-blue-400 hover:underline underline-offset-2 truncate"
                  >
                    {ra.title}
                  </a>
                  <span className="text-[10px] text-muted-foreground shrink-0">
                    {ra.sourceName}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
