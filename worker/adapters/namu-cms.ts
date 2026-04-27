import * as cheerio from "cheerio";
import { CrawlerAdapter } from "./interface";
import { RawItem, SourceConfig } from "../types";

/**
 * 그룹 C: 나무엔미디어 CMS 공통 어댑터
 * - 로봇신문, 코스인코리아, CMN, 코스모닝, 뷰티누리, 장업신문
 * - 모두 동일한 CMS 구조: {baseUrl}/news/articleList.html?sc_word={keyword}&page=1
 * - cheerio로 HTML 파싱하여 기사 목록 추출
 */
export const namuCmsAdapter: CrawlerAdapter = {
  async fetchItems(config: SourceConfig): Promise<RawItem[]> {
    const baseUrl = config.url.replace(/\/$/, "");
    const searchPath = (config.search_path as string) ?? "/news/articleList.html";
    const keywords = (config.keywords as string[]) ?? [];

    if (keywords.length === 0) {
      console.log(`[${config.id}] 키워드가 없습니다 — 스킵`);
      return [];
    }

    const allItems: RawItem[] = [];
    const seenUrls = new Set<string>();

    for (const keyword of keywords) {
      try {
        const searchUrl = `${baseUrl}${searchPath}?sc_word=${encodeURIComponent(keyword)}&page=1`;
        const res = await fetch(searchUrl, {
          headers: {
            "User-Agent":
              "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          },
        });

        if (!res.ok) {
          console.log(`[${config.id}] 키워드="${keyword}" HTTP ${res.status}`);
          continue;
        }

        const html = await res.text();
        const $ = cheerio.load(html);
        let count = 0;

        // 나무엔미디어 CMS 기사 목록 구조
        const articleSelectors = [
          ".article-list-content .list-block",
          "#section-list .list-block",
          ".list-titles li",
          ".article-list ul li",
          "#user-container .type2 li",
          "section .list-block",
        ];

        let found = false;
        for (const selector of articleSelectors) {
          const elements = $(selector);
          if (elements.length === 0) continue;
          found = true;

          elements.each((_, el) => {
            const $el = $(el);
            const $a = $el.find("a[href*='/articleView']").first();
            if (!$a.length) return;

            const href = $a.attr("href") ?? "";
            const title =
              $el.find(".titles").text().trim() ||
              $el.find(".list-titles").text().trim() ||
              $a.text().trim();

            if (!isLikelyArticle(href, title)) return;

            const fullUrl = href.startsWith("http") ? href : `${baseUrl}${href}`;
            if (seenUrls.has(fullUrl)) return;
            seenUrls.add(fullUrl);

            const dateText =
              $el.find(".list-dated").text().trim() ||
              $el.find(".byline em").text().trim() ||
              $el.find(".dated").text().trim() ||
              "";

            const publishedAt = parseKoreanDate(dateText);

            const section =
              $el.find(".list-section").text().trim() ||
              $el.find(".section").text().trim() ||
              "";

            allItems.push({
              sourceId: config.id,
              title,
              url: fullUrl,
              publishedAt,
              description: section ? `[${section}]` : undefined,
            });
            count++;
          });

          break; // 첫 번째 매칭 셀렉터만 사용
        }

        if (!found) {
          // 대안: articleView 링크만 정확히 매칭 (articleList 같은 pagination 링크 제외)
          $('a[href*="/articleView"]').each((_, el) => {
            const $a = $(el);
            const href = $a.attr("href") ?? "";
            const title = $a.text().trim();
            if (!isLikelyArticle(href, title)) return;

            const fullUrl = href.startsWith("http") ? href : `${baseUrl}${href}`;
            if (seenUrls.has(fullUrl)) return;
            seenUrls.add(fullUrl);

            allItems.push({
              sourceId: config.id,
              title,
              url: fullUrl,
            });
            count++;
          });
        }

        console.log(`[${config.id}] 키워드="${keyword}" → ${count}건`);
      } catch (err) {
        console.log(`[${config.id}] 키워드="${keyword}" 에러:`, (err as Error).message);
      }
    }

    // publishedAt 누락된 항목들에 대해 상세 페이지에서 보강
    const missing = allItems.filter((it) => !it.publishedAt);
    if (missing.length > 0) {
      console.log(`[${config.id}] publishedAt 누락 ${missing.length}건 — 상세 페이지 fetch`);
      await runWithConcurrency(missing, 4, async (item) => {
        const dt = await fetchPublishedAtFromDetail(item.url);
        if (dt) item.publishedAt = dt;
      });
      const filledCount = missing.filter((it) => it.publishedAt).length;
      console.log(`[${config.id}] 상세 페이지에서 ${filledCount}/${missing.length}건 보강 성공`);
    }

    return allItems;
  },
};

/** articleView URL + 의미 있는 제목인 것만 통과 (pagination/메뉴/숫자만 제목 등 제외) */
function isLikelyArticle(href: string, title: string): boolean {
  if (!href || !title) return false;
  if (!/\/articleView/i.test(href)) return false;
  if (/articleList/i.test(href)) return false; // pagination 링크 차단
  const trimmed = title.trim();
  if (trimmed.length < 5) return false;
  if (/^[0-9]+$/.test(trimmed)) return false; // "1", "2", "3" 같은 페이지 번호
  if (/^(처음|마지막|이전|다음|prev|next|first|last)/i.test(trimmed)) return false;
  return true;
}

/** 한국어 날짜 문자열 파싱 시도 */
function parseKoreanDate(text: string): string | undefined {
  if (!text) return undefined;

  const match = text.match(/(\d{4})[.\-/](\d{1,2})[.\-/](\d{1,2})/);
  if (match) {
    const [, y, m, d] = match;
    return new Date(`${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`).toISOString();
  }

  const matchKr = text.match(/(\d{4})년\s*(\d{1,2})월\s*(\d{1,2})일/);
  if (matchKr) {
    const [, y, m, d] = matchKr;
    return new Date(`${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`).toISOString();
  }

  return undefined;
}

const DETAIL_TIMEOUT_MS = 4000;

/**
 * 기사 상세 페이지에서 발행 시각을 추출.
 * 우선순위: JSON-LD datePublished → og:article:published_time → meta itemprop="datePublished"
 */
async function fetchPublishedAtFromDetail(url: string): Promise<string | undefined> {
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), DETAIL_TIMEOUT_MS);
    const res = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Accept: "text/html",
      },
      signal: ctrl.signal,
      redirect: "follow",
    });
    clearTimeout(timer);
    if (!res.ok) return undefined;
    const html = await res.text();
    return parsePublishedAtFromHtml(html);
  } catch {
    return undefined;
  }
}

export function parsePublishedAtFromHtml(html: string): string | undefined {
  // 1) JSON-LD
  const jsonLdRe = /<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi;
  let m: RegExpExecArray | null;
  while ((m = jsonLdRe.exec(html))) {
    try {
      const parsed = JSON.parse(m[1].trim());
      const candidates = Array.isArray(parsed) ? parsed : [parsed];
      for (const c of candidates) {
        const dp = c?.datePublished ?? c?.["@graph"]?.find((g: { datePublished?: string }) => g?.datePublished)?.datePublished;
        if (typeof dp === "string") {
          const iso = toIso(dp);
          if (iso) return iso;
        }
      }
    } catch {
      // 다음 후보로
    }
  }

  // 2) meta tag fallbacks
  const metaPatterns: RegExp[] = [
    /<meta[^>]+property=["']article:published_time["'][^>]+content=["']([^"']+)["']/i,
    /<meta[^>]+name=["']article:published_time["'][^>]+content=["']([^"']+)["']/i,
    /<meta[^>]+property=["']og:article:published_time["'][^>]+content=["']([^"']+)["']/i,
    /<meta[^>]+itemprop=["']datePublished["'][^>]+content=["']([^"']+)["']/i,
    /<meta[^>]+name=["']pubdate["'][^>]+content=["']([^"']+)["']/i,
  ];
  for (const re of metaPatterns) {
    const mm = html.match(re);
    if (mm) {
      const iso = toIso(mm[1]);
      if (iso) return iso;
    }
  }

  return undefined;
}

function toIso(s: string): string | undefined {
  const t = s.trim();
  if (!t) return undefined;
  const d = new Date(t);
  if (isNaN(d.getTime())) return undefined;
  return d.toISOString();
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
        // silent
      }
    }
  });
  await Promise.all(runners);
}
