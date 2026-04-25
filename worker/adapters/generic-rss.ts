import RssParser from "rss-parser";
import { CrawlerAdapter } from "./interface";
import { RawItem, SourceConfig } from "../types";

const parser = new RssParser({
  headers: {
    "User-Agent": "physical-ai-news/1.0 (https://physical-ai-news.terryum.ai)",
  },
});

/**
 * 표준 RSS 어댑터.
 * arXiv (cs.AI/cs.RO/cs.LG), The Robot Report, IEEE Spectrum Robotics 등.
 * Google News의 redirect URL 처리는 하지 않음 (그건 google-rss.ts).
 */
export const genericRssAdapter: CrawlerAdapter = {
  async fetchItems(config: SourceConfig): Promise<RawItem[]> {
    const items: RawItem[] = [];

    try {
      const feed = await parser.parseURL(config.url);

      for (const entry of feed.items ?? []) {
        const title = entry.title?.trim();
        const link = entry.link?.trim();
        if (!title || !link) continue;

        items.push({
          sourceId: config.id,
          title,
          url: link,
          publishedAt: entry.pubDate
            ? new Date(entry.pubDate).toISOString()
            : entry.isoDate ?? undefined,
          description: entry.contentSnippet ?? entry.content ?? undefined,
          lang: "en",
        });
      }

      console.log(`[${config.id}] RSS → ${items.length}건`);
    } catch (err) {
      console.log(`[${config.id}] RSS 에러:`, (err as Error).message);
    }

    return items;
  },
};
