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

const MIN_UPS = 50;
const TIME_WINDOWS = ["day", "week"] as const;
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
 * config.url 은 https://www.reddit.com/r/<sub>/top.json?limit=50 형태 (t 파라미터 없음).
 * 어댑터가 t=day + t=week 두 번 호출하고 ID 로 dedup — 단일 cron 누락 보강.
 * Reddit이 GH Actions/Cloudflare IP를 403 차단할 수 있어 KR-IP VM에서만 안전.
 */
export const redditAdapter: CrawlerAdapter = {
  async fetchItems(config: SourceConfig): Promise<RawItem[]> {
    const items: RawItem[] = [];
    const seenIds = new Set<string>();

    for (const window of TIME_WINDOWS) {
      let url: string;
      try {
        const u = new URL(config.url);
        u.searchParams.set("t", window);
        if (!u.searchParams.has("limit")) u.searchParams.set("limit", "50");
        url = u.toString();
      } catch {
        // URL 파싱 실패 시 그냥 query string 으로 붙임
        url = config.url + (config.url.includes("?") ? "&" : "?") + `t=${window}`;
      }

      try {
        const res = await fetch(url, {
          headers: {
            "User-Agent": USER_AGENT,
            Accept: "application/json",
          },
        });
        if (!res.ok) {
          console.log(
            `[${config.id}] Reddit ${res.status} (t=${window}) — IP 차단 가능성. KR-VM에서 재시도 필요`,
          );
          continue;
        }
        const data = (await res.json()) as RedditListing;

        for (const child of data.data?.children ?? []) {
          const d = child.data;
          if (d.stickied || d.over_18) continue;
          if (seenIds.has(d.id)) continue;
          const ups = d.ups ?? d.score ?? 0;
          if (ups < MIN_UPS) continue;
          seenIds.add(d.id);

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
      } catch (err) {
        console.log(
          `[${config.id}] Reddit 에러 (t=${window}):`,
          (err as Error).message,
        );
      }
    }

    console.log(
      `[${config.id}] Reddit → ${items.length}건 (ups>=${MIN_UPS}, t=day+week)`,
    );
    return items;
  },
};
