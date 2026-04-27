/**
 * Helper: 과거 날짜의 items.json 을 git history 에서 로드.
 *
 * 우리 repo 는 매일 22~23시 KST 에 `data: daily crawl <ISO>` 커밋을 남긴다.
 * 날짜 인자(YYYY-MM-DD) 를 주면 그 날 가장 마지막 daily-crawl 커밋의 items.json 을 반환.
 */
import { execSync } from "node:child_process";

export interface HistoricalItem {
  id: string;
  itemType: "gov" | "news" | "trending";
  title: string;
  titleKo?: string;
  publishedAt?: string;
  sourceName: string;
  tier: string;
  priority: string;
  score: number;
  matchedKeywords: string[];
  points?: number;
  links: Array<{ url: string; kind?: string; label?: string }>;
}

interface CommitMeta {
  hash: string;
  date: string;
  subject: string;
}

/** 날짜 → 그 날의 items.json 커밋 목록 (최신 순). 없으면 빈 배열. */
export function listCommitsForDate(dateStr: string): CommitMeta[] {
  const out = execSync(
    `git log --pretty=format:"%H|%ad|%s" --date=short -- public/data/items.json`,
    { encoding: "utf-8" },
  );
  return out
    .trim()
    .split("\n")
    .map((line) => {
      const [hash, date, ...rest] = line.split("|");
      return { hash, date, subject: rest.join("|") };
    })
    .filter((c) => c.date === dateStr);
}

/** 날짜의 가장 늦은 daily-crawl 커밋 (없으면 가장 늦은 커밋). */
export function pickCommitForDate(dateStr: string): CommitMeta | null {
  const commits = listCommitsForDate(dateStr);
  if (commits.length === 0) return null;
  const dailyCrawl = commits.find((c) => /data: daily crawl/.test(c.subject));
  return dailyCrawl ?? commits[0];
}

/** 특정 커밋에서 items.json 로드. */
export function loadItemsAtCommit(commitHash: string): HistoricalItem[] {
  try {
    const json = execSync(`git show ${commitHash}:public/data/items.json`, {
      encoding: "utf-8",
      maxBuffer: 64 * 1024 * 1024,
    });
    return JSON.parse(json) as HistoricalItem[];
  } catch (err) {
    throw new Error(
      `Failed to load items.json at ${commitHash}: ${(err as Error).message}`,
    );
  }
}

/** 한 번에: 날짜 → items.json. 인접 ±2 일 범위 합집합도 함께 반환. */
export function loadItemsForDateWindow(
  dateStr: string,
  windowDays = 2,
): { primary: HistoricalItem[]; window: HistoricalItem[]; commit: string | null } {
  const main = pickCommitForDate(dateStr);
  const primary = main ? loadItemsAtCommit(main.hash) : [];

  const seen = new Map<string, HistoricalItem>();
  for (const it of primary) seen.set(it.id, it);

  const baseDate = new Date(`${dateStr}T00:00:00Z`);
  for (let off = -windowDays; off <= windowDays; off++) {
    if (off === 0) continue;
    const d = new Date(baseDate);
    d.setUTCDate(d.getUTCDate() + off);
    const ds = d.toISOString().slice(0, 10);
    const c = pickCommitForDate(ds);
    if (!c) continue;
    try {
      for (const it of loadItemsAtCommit(c.hash)) {
        if (!seen.has(it.id)) seen.set(it.id, it);
      }
    } catch {
      // ignore — 어느 한 날 깨져도 진행
    }
  }
  return {
    primary,
    window: Array.from(seen.values()),
    commit: main?.hash ?? null,
  };
}
