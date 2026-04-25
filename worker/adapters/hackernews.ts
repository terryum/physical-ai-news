import { CrawlerAdapter } from "./interface";
import { RawItem, SourceConfig } from "../types";

interface AlgoliaHit {
  objectID: string;
  title?: string;
  story_title?: string;
  url?: string;
  story_url?: string;
  points?: number;
  num_comments?: number;
  created_at?: string;
}

interface AlgoliaResponse {
  hits: AlgoliaHit[];
}

const SEVEN_DAYS_S = 7 * 24 * 60 * 60;
const MIN_POINTS = 50;
const HITS_PER_PAGE = 50;

/**
 * Hacker News (Algolia search) — 키워드 OR 쿼리, 최근 7일 + 점수 임계값.
 */
export const hackernewsAdapter: CrawlerAdapter = {
  async fetchItems(config: SourceConfig): Promise<RawItem[]> {
    const keywords = (config.keywords as string[] | undefined) ?? [];
    if (keywords.length === 0) {
      console.log(`[${config.id}] keywords 없음 — 스킵`);
      return [];
    }

    // Algolia OR 쿼리: 키워드들을 따옴표로 감싸 OR 조합
    const query = keywords.map((k) => `"${k}"`).join(" OR ");
    const sinceTs = Math.floor(Date.now() / 1000) - SEVEN_DAYS_S;

    const url = new URL("https://hn.algolia.com/api/v1/search");
    url.searchParams.set("query", query);
    url.searchParams.set("tags", "story");
    url.searchParams.set("hitsPerPage", String(HITS_PER_PAGE));
    url.searchParams.set("numericFilters", `created_at_i>${sinceTs},points>=${MIN_POINTS}`);

    try {
      const res = await fetch(url.toString());
      if (!res.ok) {
        console.log(`[${config.id}] HN ${res.status}`);
        return [];
      }
      const data = (await res.json()) as AlgoliaResponse;

      const items: RawItem[] = [];
      for (const hit of data.hits ?? []) {
        const title = hit.title ?? hit.story_title;
        const link = hit.url ?? hit.story_url;
        if (!title || !link) continue;
        items.push({
          sourceId: config.id,
          title,
          url: link,
          publishedAt: hit.created_at,
          points: hit.points ?? 0,
          commentCount: hit.num_comments ?? 0,
          lang: "en",
        });
      }
      console.log(`[${config.id}] HN → ${items.length}건 (points>=${MIN_POINTS})`);
      return items;
    } catch (err) {
      console.log(`[${config.id}] HN 에러:`, (err as Error).message);
      return [];
    }
  },
};
