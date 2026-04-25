import type { Item } from "../../src/data/types";
import type { DigestSection } from "./types";

const HOURS_72 = 72 * 60 * 60 * 1000;
const HOURS_48 = 48 * 60 * 60 * 1000;
const DAYS_14 = 14 * 24 * 60 * 60 * 1000;

const COSMAX_TITLE_KEYWORDS = [
  "화장품",
  "코스맥스",
  "oem",
  "odm",
  "뷰티",
  "원료",
  "배합",
  "충전",
  "스마트팩토리",
  "스마트공장",
  "제조",
  "로봇",
  "자동화",
  "ai",
];

function isCosmaxRelated(item: Item): boolean {
  if (item.priority === "P0" || item.priority === "P1") {
    return true;
  }
  const titleLower = item.title.toLowerCase();
  return COSMAX_TITLE_KEYWORDS.some((kw) => titleLower.includes(kw));
}

/**
 * 어제 보낸 ID와 겹치지 않는 아이템을 우선 선택한다.
 * 최소 minFresh개는 어제와 다른 공고로 채운다.
 * 부족하면 어제 보냈던 아이템으로 나머지를 채운다.
 */
function dedup(
  candidates: Item[],
  lastSentIds: Set<string>,
  limit: number,
  minFresh: number,
): Item[] {
  const fresh: Item[] = [];
  const repeat: Item[] = [];

  for (const item of candidates) {
    if (lastSentIds.has(item.id)) {
      repeat.push(item);
    } else {
      fresh.push(item);
    }
  }

  // 새 아이템 우선, 부족하면 반복 아이템으로 채움
  const result = [...fresh.slice(0, Math.max(limit, minFresh))];
  if (result.length < limit) {
    const remaining = limit - result.length;
    result.push(...repeat.slice(0, remaining));
  }
  return result.slice(0, limit);
}

/**
 * 섹션 1: 최근 3일 내 등록된 코스맥스 관련 사업공고
 * gov, 코스맥스 관련, publishedAt 3일(72시간) 이내, 최대 5개
 */
export function filterNewGov(
  items: Item[],
  now: Date,
  lastSentIds: Set<string>,
): Item[] {
  const nowMs = now.getTime();
  const candidates = items
    .filter(
      (item) =>
        item.itemType === "gov" &&
        nowMs - new Date(item.publishedAt).getTime() < HOURS_72 &&
        isCosmaxRelated(item),
    )
    .sort(
      (a, b) =>
        new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime(),
    );

  return dedup(candidates, lastSentIds, 5, 5);
}

/**
 * 섹션 2: 마감 임박 코스맥스 관련 사업공고
 * gov, deadlineAt 14일 이내, 코스맥스 관련, 최대 7개
 * 적어도 7개 중 가능한 한 어제와 다른 공고로 채움
 */
export function filterDeadlineApproaching(
  items: Item[],
  now: Date,
  lastSentIds: Set<string>,
): Item[] {
  const nowMs = now.getTime();

  const candidates = items
    .filter((item) => {
      if (item.itemType !== "gov") return false;
      if (!item.deadlineAt) return false;
      if (item.status === "closed") return false;

      const deadlineMs = new Date(item.deadlineAt).getTime();
      if (deadlineMs <= nowMs || deadlineMs - nowMs > DAYS_14) return false;

      return isCosmaxRelated(item);
    })
    .sort((a, b) => {
      const aDeadline = new Date(a.deadlineAt!).getTime();
      const bDeadline = new Date(b.deadlineAt!).getTime();
      return aDeadline - bDeadline;
    });

  return dedup(candidates, lastSentIds, 7, 7);
}

/**
 * 섹션 3: 오늘의 주요 뉴스
 * news, P0, 최근 48시간, 최대 20개
 */
export function filterTodayNews(items: Item[], now: Date): Item[] {
  const nowMs = now.getTime();
  return items
    .filter(
      (item) =>
        item.itemType === "news" &&
        item.priority === "P0" &&
        nowMs - new Date(item.publishedAt).getTime() < HOURS_48,
    )
    .sort((a, b) => b.score - a.score)
    .slice(0, 20);
}

/**
 * 섹션 4: 해외 트렌딩
 * trending, 최근 72시간, 인기순(points), 최대 7개
 */
export function filterTrending(items: Item[], now: Date): Item[] {
  const nowMs = now.getTime();
  return items
    .filter(
      (item) =>
        item.itemType === "trending" &&
        nowMs - new Date(item.publishedAt).getTime() < HOURS_72,
    )
    .sort((a, b) => (b.points ?? 0) - (a.points ?? 0))
    .slice(0, 7);
}

/**
 * 전체 다이제스트 섹션을 생성한다.
 */
export function buildDigestSections(
  items: Item[],
  now: Date,
  lastSentIds: Set<string> = new Set(),
): DigestSection[] {
  return [
    {
      title: "새로 등록된 코스맥스 관련 사업공고",
      items: filterNewGov(items, now, lastSentIds),
      color: "#2563eb",
    },
    {
      title: "마감 임박 코스맥스 관련 사업공고",
      items: filterDeadlineApproaching(items, now, lastSentIds),
      color: "#dc2626",
    },
    {
      title: "오늘의 주요 뉴스",
      items: filterTodayNews(items, now),
      color: "#16a34a",
    },
    {
      title: "🌍 해외 트렌딩",
      items: filterTrending(items, now),
      color: "#7c3aed",
    },
  ];
}
