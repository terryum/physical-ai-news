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
    thumbnail?: string;
    preview?: {
      images?: Array<{
        source?: { url?: string; width?: number; height?: number };
        resolutions?: Array<{ url?: string; width?: number; height?: number }>;
      }>;
    };
  };
}

interface RedditListing {
  data: {
    children: RedditChild[];
  };
}

const MIN_UPS = 100;
const USER_AGENT = "physical-ai-news/1.0 (https://physical-ai-news.terryum.ai)";

// Reddit JSON 의 thumbnail 필드는 self/default/nsfw 같은 placeholder 값일 수 있음 — http URL 만 통과
function isUsableThumbnail(t: string | undefined): t is string {
  return !!t && /^https?:\/\//.test(t);
}

function extractRedditThumbnail(d: RedditChild["data"]): string | undefined {
  // 우선순위: preview 원본 → preview resolution 큰 것 → thumbnail field
  const previewSource = d.preview?.images?.[0]?.source?.url;
  if (isUsableThumbnail(previewSource)) return decodeRedditUrl(previewSource);
  const resolutions = d.preview?.images?.[0]?.resolutions ?? [];
  // 320~640px 범위에서 가장 큰 것 (썸네일 용도)
  const mid = resolutions
    .filter((r) => r.url && r.width && r.width >= 200 && r.width <= 640)
    .sort((a, b) => (b.width ?? 0) - (a.width ?? 0))[0]?.url;
  if (isUsableThumbnail(mid)) return decodeRedditUrl(mid);
  if (isUsableThumbnail(d.thumbnail)) return d.thumbnail;
  return undefined;
}

// Reddit 의 preview URL 은 HTML-encoded (&amp; → &)
function decodeRedditUrl(u: string): string {
  return u.replace(/&amp;/g, "&");
}

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
          thumbnailUrl: extractRedditThumbnail(d),
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
