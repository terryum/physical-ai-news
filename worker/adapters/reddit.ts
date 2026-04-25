import { CrawlerAdapter } from "./interface";
import { RawItem, SourceConfig } from "../types";

interface RedditChild {
  kind: string;
  data: {
    id: string;
    title: string;
    permalink: string;
    url?: string;
    ups?: number;
    score?: number;
    num_comments?: number;
    created_utc?: number;
    is_self?: boolean;
    stickied?: boolean;
    over_18?: boolean;
  };
}

interface RedditListing {
  data: {
    children: RedditChild[];
  };
}

const MIN_UPS = 100;
const USER_AGENT = "physical-ai-news/1.0 (https://physical-ai-news.terryum.ai)";

/**
 * Reddit JSON 어댑터.
 * config.url 은 https://www.reddit.com/r/<sub>/top.json?t=day&limit=25 형태.
 * Reddit이 GH Actions/Cloudflare IP를 403 차단할 수 있어 KR-IP VM에서만 안전.
 */
export const redditAdapter: CrawlerAdapter = {
  async fetchItems(config: SourceConfig): Promise<RawItem[]> {
    try {
      const res = await fetch(config.url, {
        headers: {
          "User-Agent": USER_AGENT,
          Accept: "application/json",
        },
      });
      if (!res.ok) {
        console.log(`[${config.id}] Reddit ${res.status} — IP 차단 가능성. KR-VM에서 재시도 필요`);
        return [];
      }
      const data = (await res.json()) as RedditListing;

      const items: RawItem[] = [];
      for (const child of data.data?.children ?? []) {
        const d = child.data;
        if (d.stickied || d.over_18) continue;
        const ups = d.ups ?? d.score ?? 0;
        if (ups < MIN_UPS) continue;

        // self post (텍스트 글)은 reddit permalink, 링크 글은 외부 url
        const link = d.is_self
          ? `https://www.reddit.com${d.permalink}`
          : d.url ?? `https://www.reddit.com${d.permalink}`;

        items.push({
          sourceId: config.id,
          title: d.title,
          url: link,
          publishedAt: d.created_utc
            ? new Date(d.created_utc * 1000).toISOString()
            : undefined,
          points: ups,
          commentCount: d.num_comments ?? 0,
          lang: "en",
        });
      }
      console.log(`[${config.id}] Reddit → ${items.length}건 (ups>=${MIN_UPS})`);
      return items;
    } catch (err) {
      console.log(`[${config.id}] Reddit 에러:`, (err as Error).message);
      return [];
    }
  },
};
