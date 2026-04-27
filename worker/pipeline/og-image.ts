import * as cheerio from "cheerio";

const USER_AGENT =
  "physical-ai-news/1.0 (+https://physical-ai-news.terryum.ai)";
const FETCH_TIMEOUT_MS = 3500;
const CONCURRENCY = 6;

interface ThumbCandidate {
  id: string;
  url: string;
}

/**
 * 트렌딩 아이템들의 OG 이미지를 fetch 해서 thumbnailUrl 을 채운다.
 *
 * - 이미 thumbnailUrl 있는 아이템: 그대로 둠 (어댑터에서 추출했거나 캐시 적용 후)
 * - cache (기존 items.json) 에 있던 id 는 캐시 값을 그대로 사용 (재 fetch 안 함)
 * - 그 외에만 fresh OG fetch (concurrency 제한, per-URL 타임아웃, 실패 silent skip)
 *
 * 반환: thumbnailUrl 이 채워진 새 배열 (input 은 변형하지 않음)
 */
export async function enrichTrendingThumbnails<
  T extends {
    id: string;
    itemType: "gov" | "news" | "trending";
    thumbnailUrl?: string;
    links: Array<{ url: string }>;
  },
>(items: T[], cache: Map<string, string>): Promise<T[]> {
  const candidates: ThumbCandidate[] = [];
  const result: T[] = items.map((item) => {
    if (item.itemType !== "trending") return item;
    if (item.thumbnailUrl) return item;
    const cached = cache.get(item.id);
    if (cached) return { ...item, thumbnailUrl: cached };
    const articleUrl = item.links?.[0]?.url;
    if (articleUrl && !isImageUrl(articleUrl)) {
      candidates.push({ id: item.id, url: articleUrl });
    }
    return item;
  });

  if (candidates.length === 0) {
    console.log(`[og-image] 0건 fetch (전부 이미 보유 또는 캐시 적중)`);
    return result;
  }

  console.log(`[og-image] ${candidates.length}건 fetch 시작 (concurrency=${CONCURRENCY})`);

  const fetched = new Map<string, string>();
  await runWithConcurrency(candidates, CONCURRENCY, async (c) => {
    const og = await fetchOgImage(c.url);
    if (og) fetched.set(c.id, og);
  });

  console.log(`[og-image] ${fetched.size}/${candidates.length}건 추출 성공`);

  // 두 번째 패스: 방금 fetch 한 결과를 result 에 반영
  return result.map((item) => {
    if (item.itemType !== "trending" || item.thumbnailUrl) return item;
    const url = fetched.get(item.id);
    return url ? { ...item, thumbnailUrl: url } : item;
  });
}

async function fetchOgImage(pageUrl: string): Promise<string | undefined> {
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
    const res = await fetch(pageUrl, {
      headers: {
        "User-Agent": USER_AGENT,
        Accept: "text/html,application/xhtml+xml",
      },
      signal: ctrl.signal,
      redirect: "follow",
    });
    clearTimeout(timer);
    if (!res.ok) return undefined;
    const ct = res.headers.get("content-type") ?? "";
    if (!ct.includes("text/html") && !ct.includes("xml")) return undefined;
    const html = await res.text();
    if (html.length < 100 || html.length > 2_000_000) return undefined;
    return parseOgImage(html, pageUrl);
  } catch {
    return undefined;
  }
}

function parseOgImage(html: string, baseUrl: string): string | undefined {
  const $ = cheerio.load(html);
  const candidates: Array<string | undefined> = [
    $('meta[property="og:image"]').attr("content"),
    $('meta[name="og:image"]').attr("content"),
    $('meta[property="og:image:secure_url"]').attr("content"),
    $('meta[name="twitter:image"]').attr("content"),
    $('meta[name="twitter:image:src"]').attr("content"),
    $('link[rel="image_src"]').attr("href"),
  ];
  for (const c of candidates) {
    const abs = absolutize(c, baseUrl);
    if (abs) return abs;
  }
  return undefined;
}

function absolutize(maybeUrl: string | undefined, baseUrl: string): string | undefined {
  if (!maybeUrl) return undefined;
  const trimmed = maybeUrl.trim();
  if (!trimmed) return undefined;
  try {
    const u = new URL(trimmed, baseUrl);
    if (u.protocol !== "http:" && u.protocol !== "https:") return undefined;
    return u.toString();
  } catch {
    return undefined;
  }
}

function isImageUrl(u: string): boolean {
  return /\.(png|jpe?g|webp|gif|avif|svg)(\?|$)/i.test(u);
}

async function runWithConcurrency<T>(
  items: T[],
  limit: number,
  worker: (item: T) => Promise<void>,
): Promise<void> {
  let cursor = 0;
  const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (cursor < items.length) {
      const idx = cursor++;
      try {
        await worker(items[idx]);
      } catch {
        // silent — 한 건 실패해도 전체 흐름 유지
      }
    }
  });
  await Promise.all(runners);
}
