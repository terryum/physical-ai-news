"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { Item } from "@/data/types";
import { useLocalStorage } from "@/hooks/use-local-storage";
import { TrendingThumb } from "@/components/trending-thumb";
import { TrendingHelp } from "@/components/trending-help";

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
    .filter((i) => {
      const pubMs = new Date(i.publishedAt).getTime();
      return (
        i.itemType === "gov" &&
        pubMs <= nowMs &&
        nowMs - pubMs < HOURS_72 &&
        isCosmaxRelated(i)
      );
    })
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
    .filter((i) => {
      const pubMs = new Date(i.publishedAt).getTime();
      return (
        i.itemType === "news" &&
        i.priority === "P0" &&
        pubMs <= nowMs &&
        nowMs - pubMs < HOURS_48
      );
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, 20);
}

const HOURS_72_TRENDING = 72 * 60 * 60 * 1000;
const TRENDING_LIMIT = 10;
const TRENDING_MIN_PER_BUCKET = 1;

function trendingBucket(sourceId: string): string {
  if (sourceId.startsWith("reddit_")) return "reddit";
  if (sourceId.startsWith("arxiv_")) return "arxiv";
  if (sourceId === "hackernews") return "hn";
  if (sourceId === "hf_daily_papers") return "hf";
  return "industry";
}

function filterTrending(items: Item[], now: Date): Item[] {
  const nowMs = now.getTime();
  const candidates = items
    .filter((i) => {
      const pubMs = new Date(i.publishedAt).getTime();
      return (
        i.itemType === "trending" &&
        pubMs <= nowMs &&
        nowMs - pubMs < HOURS_72_TRENDING
      );
    })
    .sort((a, b) => (b.points ?? 0) - (a.points ?? 0));

  const byBucket = new Map<string, Item[]>();
  for (const it of candidates) {
    const b = trendingBucket(it.sourceName);
    const list = byBucket.get(b) ?? [];
    list.push(it);
    byBucket.set(b, list);
  }

  const picked: Item[] = [];
  const pickedIds = new Set<string>();
  for (const list of byBucket.values()) {
    for (const it of list.slice(0, TRENDING_MIN_PER_BUCKET)) {
      picked.push(it);
      pickedIds.add(it.id);
    }
  }
  for (const it of candidates) {
    if (picked.length >= TRENDING_LIMIT) break;
    if (pickedIds.has(it.id)) continue;
    picked.push(it);
    pickedIds.add(it.id);
  }
  return picked
    .sort((a, b) => (b.points ?? 0) - (a.points ?? 0))
    .slice(0, TRENDING_LIMIT);
}

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

type SectionKind = "newgov" | "deadline" | "news" | "trending";

interface DigestSection {
  kind: SectionKind;
  title: string;
  items: Item[];
  linkHref: string;
  linkLabel: string;
}

function SectionHeader({
  title,
  count,
  rightSlot,
}: {
  title: string;
  count: number;
  rightSlot?: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-2 px-4 py-2.5 border-b border-line-default">
      <span className="inline-block w-1.5 h-1.5 rounded-full bg-accent" />
      <h2 className="text-sm font-semibold text-text-primary">{title}</h2>
      <span className="text-xs text-text-muted">({count})</span>
      {rightSlot && <div className="ml-auto">{rightSlot}</div>}
    </div>
  );
}

function LangToggle({
  lang,
  onChange,
}: {
  lang: "ko" | "en";
  onChange: (l: "ko" | "en") => void;
}) {
  return (
    <div className="flex items-center gap-0.5 rounded-full border border-line-default bg-bg-base p-0.5 text-[11px]">
      <button
        type="button"
        onClick={() => onChange("ko")}
        className={`px-2 py-0.5 rounded-full cursor-pointer transition-colors ${
          lang === "ko"
            ? "bg-accent text-white"
            : "text-text-muted hover:text-accent"
        }`}
      >
        한국어
      </button>
      <button
        type="button"
        onClick={() => onChange("en")}
        className={`px-2 py-0.5 rounded-full cursor-pointer transition-colors ${
          lang === "en"
            ? "bg-accent text-white"
            : "text-text-muted hover:text-accent"
        }`}
      >
        EN
      </button>
    </div>
  );
}

function GovRow({ item }: { item: Item }) {
  const url = item.links?.[0]?.url ?? "#";
  return (
    <div className="px-4 py-2.5 border-b border-line-default last:border-b-0 transition-colors hover:bg-bg-base/50">
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="text-sm font-medium text-text-primary hover:text-accent transition-colors"
      >
        {item.title}
      </a>
      <div className="mt-1 flex items-center gap-x-2 gap-y-0.5 flex-wrap text-xs text-text-muted">
        <span>{item.sourceName}</span>
        <span>·</span>
        <span>{formatDate(item.publishedAt)}</span>
        {item.budgetKrwOk && (
          <>
            <span>·</span>
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
  const urgent = dNum <= 3;

  return (
    <div className="px-4 py-2.5 border-b border-line-default last:border-b-0 transition-colors hover:bg-bg-base/50">
      <div className="flex items-center gap-2">
        <span
          className={`shrink-0 inline-flex items-center justify-center rounded-full text-[11px] font-semibold px-2 py-0.5 border ${
            urgent
              ? "bg-accent text-white border-accent"
              : "bg-bg-base text-accent border-accent/40"
          }`}
        >
          {badge}
        </span>
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm font-medium text-text-primary hover:text-accent transition-colors truncate"
        >
          {item.title}
        </a>
      </div>
      <div className="mt-1 text-xs text-text-muted pl-[52px]">
        마감: {item.deadlineAt ? formatDate(item.deadlineAt) : ""}
      </div>
    </div>
  );
}

function TrendingRow({ item, idx, lang }: { item: Item; idx: number; lang: "ko" | "en" }) {
  const url = item.links?.[0]?.url ?? "#";
  const showKo = lang === "ko" && item.titleKo;
  const displayTitle = showKo ? item.titleKo! : item.title;
  return (
    <div className="px-4 py-2.5 border-b border-line-default last:border-b-0 transition-colors hover:bg-bg-base/50">
      <div className="flex items-start gap-3">
        <span className="shrink-0 text-xs text-text-muted w-5 text-right pt-1">
          {idx + 1}.
        </span>
        <TrendingThumb
          thumbnailUrl={item.thumbnailUrl}
          sourceName={item.sourceName}
          alt={displayTitle}
          size="sm"
        />
        <div className="flex-1 min-w-0">
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-text-primary hover:text-accent transition-colors leading-snug"
          >
            {displayTitle}
          </a>
          {showKo && (
            <div className="mt-0.5 text-[11px] text-text-muted truncate" title={item.title}>
              {item.title}
            </div>
          )}
          <div className="mt-1 flex items-center gap-x-2 gap-y-0.5 flex-wrap text-xs text-text-muted">
            <span>{item.sourceName}</span>
            {item.points ? <span>▲ {item.points}</span> : null}
            {item.commentCount ? <span>💬 {item.commentCount}</span> : null}
          </div>
        </div>
      </div>
    </div>
  );
}

function NewsRow({ item, idx }: { item: Item; idx: number }) {
  const url = item.links?.[0]?.url ?? "#";
  return (
    <div className="px-4 py-2 border-b border-line-default last:border-b-0 transition-colors hover:bg-bg-base/50">
      <div className="flex items-baseline gap-2">
        <span className="shrink-0 text-xs text-text-muted w-5 text-right">{idx + 1}.</span>
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm text-text-primary hover:text-accent transition-colors"
        >
          {item.title}
        </a>
      </div>
      <div className="mt-0.5 text-xs text-text-muted pl-7">{item.sourceName}</div>
      {item.relatedArticles && item.relatedArticles.length > 0 && (
        <div className="mt-0.5 pl-7 space-y-0.5">
          {item.relatedArticles.map((ra, i) => (
            <div key={i} className="flex items-baseline gap-1">
              <a
                href={ra.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-text-muted hover:text-accent transition-colors truncate"
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

function DigestSectionCard({
  section,
  now,
  trendingLang,
  onTrendingLangChange,
}: {
  section: DigestSection;
  now: Date;
  trendingLang: "ko" | "en";
  onTrendingLangChange: (l: "ko" | "en") => void;
}) {
  if (section.items.length === 0) return null;

  const isDeadline = section.kind === "deadline";
  const isNews = section.kind === "news";
  const isTrending = section.kind === "trending";

  return (
    <div className="rounded-xl border border-line-default bg-bg-surface overflow-hidden">
      <SectionHeader
        title={section.title}
        count={section.items.length}
        rightSlot={
          isTrending ? (
            <div className="flex items-center gap-2">
              <LangToggle lang={trendingLang} onChange={onTrendingLangChange} />
              <TrendingHelp />
            </div>
          ) : undefined
        }
      />
      <div>
        {section.items.map((item, idx) =>
          isDeadline ? (
            <DeadlineRow key={item.id} item={item} now={now} />
          ) : isTrending ? (
            <TrendingRow key={item.id} item={item} idx={idx} lang={trendingLang} />
          ) : isNews ? (
            <NewsRow key={item.id} item={item} idx={idx} />
          ) : (
            <GovRow key={item.id} item={item} />
          ),
        )}
      </div>
      <div className="px-4 py-2 border-t border-line-default">
        <Link
          href={section.linkHref}
          className="text-xs text-text-muted hover:text-accent transition-colors"
        >
          {section.linkLabel} →
        </Link>
      </div>
    </div>
  );
}

interface DigestHomeProps {
  items: Item[];
  lastUpdated: string | null;
}

function startOfDay(d: Date): Date {
  const r = new Date(d);
  r.setHours(0, 0, 0, 0);
  return r;
}

function endOfDay(d: Date): Date {
  const r = new Date(d);
  r.setHours(23, 59, 59, 999);
  return r;
}

function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

export function DigestHome({ items, lastUpdated }: DigestHomeProps) {
  const today = startOfDay(new Date());
  const [selectedDate, setSelectedDate] = useState<Date>(today);
  const isToday = isSameDay(selectedDate, today);
  const [trendingLangStored, setTrendingLangStored, trendingLangHydrated] =
    useLocalStorage<"ko" | "en">("radar-trending-lang", "ko");
  const trendingLang = trendingLangHydrated ? trendingLangStored : "ko";

  const filterNow = useMemo(() => endOfDay(selectedDate), [selectedDate]);

  const dateStr = `${selectedDate.getFullYear()}.${String(selectedDate.getMonth() + 1).padStart(2, "0")}.${String(selectedDate.getDate()).padStart(2, "0")}`;
  const dayOfWeek = DAYS_KO[selectedDate.getDay()];
  const headerLabel = isToday ? "오늘의 클리핑" : "일일 클리핑";

  const sections: DigestSection[] = useMemo(
    () => [
      {
        kind: "newgov",
        title: "새로 등록된 코스맥스 관련 사업공고",
        items: filterNewGov(items, filterNow),
        linkHref: "/gov",
        linkLabel: "전체 공고 보기",
      },
      {
        kind: "deadline",
        title: "마감 임박 코스맥스 관련 사업공고",
        items: filterDeadline(items, filterNow),
        linkHref: "/gov",
        linkLabel: "전체 공고 보기",
      },
      {
        kind: "news",
        title: "오늘의 주요 뉴스",
        items: filterNews(items, filterNow),
        linkHref: "/news",
        linkLabel: "전체 뉴스 보기",
      },
      {
        kind: "trending",
        title: "해외 트렌딩",
        items: filterTrending(items, filterNow),
        linkHref: "/trending",
        linkLabel: "전체 트렌딩 보기",
      },
    ],
    [items, filterNow],
  );

  const allEmpty = sections.every((s) => s.items.length === 0);

  const navButton =
    "inline-flex items-center justify-center w-8 h-8 rounded-full border border-line-default bg-bg-surface text-sm text-text-secondary hover:text-accent hover:border-accent/40 transition-colors cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed";

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => setSelectedDate((d) => addDays(d, -1))}
            className={navButton}
            aria-label="하루 전"
          >
            ‹
          </button>
          <p className="text-2xl font-bold tracking-tight text-text-primary">
            {dateStr} ({dayOfWeek}) {headerLabel}
          </p>
          <button
            type="button"
            onClick={() => setSelectedDate((d) => addDays(d, 1))}
            disabled={isToday}
            className={navButton}
            aria-label="하루 후"
          >
            ›
          </button>
          {!isToday && (
            <button
              type="button"
              onClick={() => setSelectedDate(today)}
              className="ml-1 inline-flex items-center rounded-full border border-line-default bg-bg-surface px-3 h-8 text-xs text-text-secondary hover:text-accent hover:border-accent/40 transition-colors cursor-pointer"
            >
              오늘로
            </button>
          )}
        </div>
        {lastUpdated && (
          <p className="text-xs text-text-muted shrink-0">
            {formatLastUpdated(lastUpdated)}
          </p>
        )}
      </div>

      <p className="text-xs text-text-muted -mt-3">
        매일 오전 8시 Substack으로 발행되는 뉴스레터와 동일한 내용입니다
      </p>

      {allEmpty ? (
        <div className="rounded-xl border border-line-default bg-bg-surface py-16 text-center text-text-muted">
          {isToday ? "오늘은 주요 항목이 없습니다." : "이 날짜에는 항목이 없습니다."}
        </div>
      ) : (
        sections.map((section) => (
          <DigestSectionCard
            key={section.title}
            section={section}
            now={filterNow}
            trendingLang={trendingLang}
            onTrendingLangChange={setTrendingLangStored}
          />
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
