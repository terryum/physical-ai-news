"use client";

import type { Item } from "@/data/types";
import { TrendingThumb } from "@/components/trending-thumb";

const priorityLabel: Record<string, string> = {
  P0: "필독",
  P1: "참고",
  P2: "관찰",
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

  const isP0 = item.priority === "P0";
  const deadlineUrgent = daysLeft !== null && daysLeft >= 0 && daysLeft <= 7;

  return (
    <div
      className={`group rounded-lg border border-line-default p-3 transition-colors hover:border-accent/40 ${
        item.read ? "opacity-60" : ""
      }`}
    >
      <div className="flex items-start gap-3">
        <div className="flex flex-col items-center gap-1.5 pt-0.5 shrink-0">
          <button
            type="button"
            onClick={() => onToggleRead(item.id)}
            className={`h-2.5 w-2.5 rounded-full border transition-colors ${
              item.read
                ? "border-line-strong"
                : "bg-accent border-accent"
            }`}
            title={item.read ? "읽음" : "안읽음"}
            aria-label={item.read ? "읽음 표시 해제" : "읽음 표시"}
          />
          <button
            type="button"
            onClick={() => onToggleStar(item.id)}
            className={`text-sm leading-none transition-colors ${
              item.starred ? "text-accent" : "text-text-muted hover:text-accent"
            }`}
            title={item.starred ? "별표 해제" : "별표"}
            aria-label={item.starred ? "별표 해제" : "별표"}
          >
            {item.starred ? "★" : "☆"}
          </button>
        </div>

        {isTrending && (
          <TrendingThumb
            thumbnailUrl={item.thumbnailUrl}
            sourceName={item.sourceName}
            alt={displayTitle}
          />
        )}

        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-2 flex-wrap">
            <span className="text-[10px] font-medium uppercase tracking-wide text-text-muted shrink-0">
              {typeLabel}
            </span>
            {isP0 && (
              <span className="text-[10px] font-semibold uppercase tracking-wide text-accent shrink-0">
                필독
              </span>
            )}
            <a
              href={canonicalUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm font-medium text-text-primary group-hover:text-accent leading-snug transition-colors"
            >
              {displayTitle}
            </a>
          </div>
          {isTrending && trendingLang === "ko" && item.titleKo && (
            <div className="mt-0.5 text-[11px] text-text-muted truncate" title={item.title}>
              {item.title}
            </div>
          )}

          <div className="mt-1.5 flex items-center gap-x-3 gap-y-1 flex-wrap text-xs text-text-muted">
            <span>{priorityLabel[item.priority] ?? item.priority}</span>
            <span>·</span>
            <span>{tierLabel[item.tier] ?? item.tier}</span>
            <span>·</span>
            <span>{item.sourceName}</span>
            <span>·</span>
            <span>게시 {formatDate(item.publishedAt)}</span>

            {isTrending && item.points ? <span>▲ {item.points}</span> : null}
            {isTrending && item.commentCount ? <span>💬 {item.commentCount}</span> : null}

            {isGov && item.deadlineAt && (
              <span className={deadlineUrgent ? "font-semibold text-accent" : ""}>
                마감 {formatDate(item.deadlineAt)}
                {daysLeft !== null && daysLeft >= 0 && (
                  <span className="ml-1">
                    ({daysLeft === 0 ? "오늘" : `D-${daysLeft}`})
                  </span>
                )}
                {daysLeft !== null && daysLeft < 0 && <span className="ml-1">(종료)</span>}
              </span>
            )}

            {item.budgetKrwOk && <span>{item.budgetKrwOk}억원</span>}
            {item.status && <span>{statusLabel[item.status]}</span>}
            {item.matchedCompanies.map((c) => (
              <span key={c} className="text-accent">
                #{c}
              </span>
            ))}
          </div>

          {item.relatedArticles && item.relatedArticles.length > 0 && (
            <div className="mt-2 pl-3 border-l border-line-default space-y-0.5">
              {item.relatedArticles.map((ra, idx) => (
                <div key={idx} className="flex items-baseline gap-1.5">
                  <a
                    href={ra.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-text-muted hover:text-accent transition-colors truncate"
                  >
                    {ra.title}
                  </a>
                  <span className="text-[10px] text-text-muted shrink-0">{ra.sourceName}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
