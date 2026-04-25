"use client";

import Link from "next/link";
import type { Item } from "@/data/types";
import { SubstackSubscribe } from "@/components/substack-subscribe";

// --- Digest filter logic (mirrors worker/digest/filter.ts) ---

const HOURS_72 = 72 * 60 * 60 * 1000;
const HOURS_48 = 48 * 60 * 60 * 1000;
const DAYS_14 = 14 * 24 * 60 * 60 * 1000;

const COSMAX_KEYWORDS = [
  "화장품", "코스맥스", "oem", "odm", "뷰티", "원료", "배합",
  "충전", "스마트팩토리", "스마트공장", "제조", "로봇", "자동화", "ai",
];

function isCosmaxRelated(item: Item): boolean {
  if (item.priority === "P0" || item.priority === "P1") return true;
  const t = item.title.toLowerCase();
  return COSMAX_KEYWORDS.some((kw) => t.includes(kw));
}

function filterNewGov(items: Item[], now: Date): Item[] {
  const nowMs = now.getTime();
  return items
    .filter(
      (i) =>
        i.itemType === "gov" &&
        nowMs - new Date(i.publishedAt).getTime() < HOURS_72 &&
        isCosmaxRelated(i),
    )
    .sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime())
    .slice(0, 5);
}

function filterDeadline(items: Item[], now: Date): Item[] {
  const nowMs = now.getTime();
  return items
    .filter((i) => {
      if (i.itemType !== "gov" || !i.deadlineAt || i.status === "closed") return false;
      const dl = new Date(i.deadlineAt).getTime();
      return dl > nowMs && dl - nowMs < DAYS_14 && isCosmaxRelated(i);
    })
    .sort((a, b) => new Date(a.deadlineAt!).getTime() - new Date(b.deadlineAt!).getTime())
    .slice(0, 7);
}

function filterNews(items: Item[], now: Date): Item[] {
  const nowMs = now.getTime();
  return items
    .filter(
      (i) =>
        i.itemType === "news" &&
        i.priority === "P0" &&
        nowMs - new Date(i.publishedAt).getTime() < HOURS_48,
    )
    .sort((a, b) => b.score - a.score)
    .slice(0, 20);
}

const HOURS_72_TRENDING = 72 * 60 * 60 * 1000;
function filterTrending(items: Item[], now: Date): Item[] {
  const nowMs = now.getTime();
  return items
    .filter(
      (i) =>
        i.itemType === "trending" &&
        nowMs - new Date(i.publishedAt).getTime() < HOURS_72_TRENDING,
    )
    .sort((a, b) => (b.points ?? 0) - (a.points ?? 0))
    .slice(0, 7);
}

// --- Date helpers ---

const DAYS_KO = ["일", "월", "화", "수", "목", "금", "토"] as const;

function formatDate(iso: string) {
  const d = new Date(iso);
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")}`;
}

function dDay(deadlineAt: string, now: Date): string {
  const diff = Math.ceil(
    (new Date(deadlineAt).getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
  );
  if (diff === 0) return "D-Day";
  if (diff > 0) return `D-${diff}`;
  return `D+${Math.abs(diff)}`;
}

// --- Components ---

interface DigestSection {
  title: string;
  color: string;
  items: Item[];
  linkHref: string;
  linkLabel: string;
}

function SectionHeader({ title, color, count }: { title: string; color: string; count: number }) {
  return (
    <div
      className="flex items-center gap-2 rounded-t-lg px-4 py-2.5"
      style={{ borderLeft: `4px solid ${color}`, background: "var(--color-muted)" }}
    >
      <span className="font-semibold text-sm">{title}</span>
      <span className="text-xs text-muted-foreground">({count})</span>
    </div>
  );
}

function GovRow({ item }: { item: Item }) {
  const url = item.links?.[0]?.url ?? "#";
  return (
    <div className="px-4 py-2.5 border-b border-border/50 last:border-b-0 hover:bg-accent/30 transition-colors">
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="text-sm font-medium text-foreground hover:text-blue-600 dark:hover:text-blue-400 hover:underline underline-offset-2"
      >
        {item.title}
      </a>
      <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
        <span>{item.sourceName}</span>
        <span>|</span>
        <span>{formatDate(item.publishedAt)}</span>
        {item.budgetKrwOk && (
          <>
            <span>|</span>
            <span>{item.budgetKrwOk}억원</span>
          </>
        )}
      </div>
    </div>
  );
}

function DeadlineRow({ item, now }: { item: Item; now: Date }) {
  const url = item.links?.[0]?.url ?? "#";
  const badge = item.deadlineAt ? dDay(item.deadlineAt, now) : "";
  const dNum = item.deadlineAt
    ? Math.ceil((new Date(item.deadlineAt).getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
    : 99;

  return (
    <div className="px-4 py-2.5 border-b border-border/50 last:border-b-0 hover:bg-accent/30 transition-colors">
      <div className="flex items-center gap-2">
        <span
          className="shrink-0 inline-block rounded text-[11px] font-bold px-1.5 py-0.5 text-white"
          style={{ background: dNum <= 3 ? "#dc2626" : "#f59e0b" }}
        >
          {badge}
        </span>
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm font-medium text-foreground hover:text-blue-600 dark:hover:text-blue-400 hover:underline underline-offset-2 truncate"
        >
          {item.title}
        </a>
      </div>
      <div className="mt-1 text-xs text-muted-foreground pl-[42px]">
        마감: {item.deadlineAt ? formatDate(item.deadlineAt) : ""}
      </div>
    </div>
  );
}

function TrendingRow({ item, idx }: { item: Item; idx: number }) {
  const url = item.links?.[0]?.url ?? "#";
  return (
    <div className="px-4 py-2 border-b border-border/50 last:border-b-0 hover:bg-accent/30 transition-colors">
      <div className="flex items-baseline gap-2">
        <span className="shrink-0 text-xs text-muted-foreground w-5 text-right">{idx + 1}.</span>
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm text-foreground hover:text-blue-600 dark:hover:text-blue-400 hover:underline underline-offset-2"
        >
          {item.title}
        </a>
      </div>
      <div className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground pl-7">
        <span>{item.sourceName}</span>
        {item.points ? <span>▲ {item.points}</span> : null}
        {item.commentCount ? <span>💬 {item.commentCount}</span> : null}
      </div>
    </div>
  );
}

function NewsRow({ item, idx }: { item: Item; idx: number }) {
  const url = item.links?.[0]?.url ?? "#";
  return (
    <div className="px-4 py-2 border-b border-border/50 last:border-b-0 hover:bg-accent/30 transition-colors">
      <div className="flex items-baseline gap-2">
        <span className="shrink-0 text-xs text-muted-foreground w-5 text-right">{idx + 1}.</span>
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm text-foreground hover:text-blue-600 dark:hover:text-blue-400 hover:underline underline-offset-2"
        >
          {item.title}
        </a>
      </div>
      <div className="mt-0.5 text-xs text-muted-foreground pl-7">
        {item.sourceName}
      </div>
      {item.relatedArticles && item.relatedArticles.length > 0 && (
        <div className="mt-0.5 pl-7 space-y-0.5">
          {item.relatedArticles.map((ra, i) => (
            <div key={i} className="flex items-baseline gap-1">
              <span className="text-[10px] text-muted-foreground">{"\u2514"}</span>
              <a
                href={ra.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-muted-foreground hover:text-blue-600 dark:hover:text-blue-400 hover:underline underline-offset-2 truncate"
              >
                {ra.title}
              </a>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function DigestSectionCard({ section, now }: { section: DigestSection; now: Date }) {
  if (section.items.length === 0) return null;

  const isDeadline = section.color === "#dc2626";
  const isNews = section.color === "#16a34a";
  const isTrending = section.color === "#7c3aed";

  return (
    <div className="rounded-lg border bg-card overflow-hidden">
      <SectionHeader title={section.title} color={section.color} count={section.items.length} />
      <div>
        {section.items.map((item, idx) =>
          isDeadline ? (
            <DeadlineRow key={item.id} item={item} now={now} />
          ) : isTrending ? (
            <TrendingRow key={item.id} item={item} idx={idx} />
          ) : isNews ? (
            <NewsRow key={item.id} item={item} idx={idx} />
          ) : (
            <GovRow key={item.id} item={item} />
          ),
        )}
      </div>
      <div className="px-4 py-2 bg-muted/30 border-t border-border/50">
        <Link
          href={section.linkHref}
          className="text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          {section.linkLabel} →
        </Link>
      </div>
    </div>
  );
}

// --- Main ---

interface DigestHomeProps {
  items: Item[];
  lastUpdated: string | null;
}

export function DigestHome({ items, lastUpdated }: DigestHomeProps) {
  const now = new Date();
  const dateStr = `${now.getFullYear()}.${String(now.getMonth() + 1).padStart(2, "0")}.${String(now.getDate()).padStart(2, "0")}`;
  const dayOfWeek = DAYS_KO[now.getDay()];

  const sections: DigestSection[] = [
    {
      title: "새로 등록된 코스맥스 관련 사업공고",
      color: "#2563eb",
      items: filterNewGov(items, now),
      linkHref: "/gov",
      linkLabel: "전체 공고 보기",
    },
    {
      title: "마감 임박 코스맥스 관련 사업공고",
      color: "#dc2626",
      items: filterDeadline(items, now),
      linkHref: "/gov",
      linkLabel: "전체 공고 보기",
    },
    {
      title: "오늘의 주요 뉴스",
      color: "#16a34a",
      items: filterNews(items, now),
      linkHref: "/news",
      linkLabel: "전체 뉴스 보기",
    },
    {
      title: "🌍 해외 트렌딩",
      color: "#7c3aed",
      items: filterTrending(items, now),
      linkHref: "/trending",
      linkLabel: "전체 트렌딩 보기",
    },
  ];

  const allEmpty = sections.every((s) => s.items.length === 0);

  return (
    <div className="space-y-5">
      {/* Date header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-lg font-semibold">
            {dateStr} ({dayOfWeek}) 일일 클리핑
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">
            매일 오전 8시 Substack으로 발행되는 뉴스레터와 동일한 내용입니다
          </p>
        </div>
        {lastUpdated && (
          <p className="text-xs text-muted-foreground">
            {formatLastUpdated(lastUpdated)}
          </p>
        )}
      </div>

      {/* Substack subscribe */}
      <SubstackSubscribe />

      {/* Sections */}
      {allEmpty ? (
        <div className="rounded-lg border bg-card py-16 text-center text-muted-foreground">
          오늘은 주요 항목이 없습니다.
        </div>
      ) : (
        sections.map((section) => (
          <DigestSectionCard key={section.title} section={section} now={now} />
        ))
      )}
    </div>
  );
}

function formatLastUpdated(iso: string) {
  const d = new Date(iso);
  const month = d.getMonth() + 1;
  const day = d.getDate();
  const hours = String(d.getHours()).padStart(2, "0");
  const mins = String(d.getMinutes()).padStart(2, "0");
  return `${month}/${day} ${hours}:${mins} 수집`;
}
