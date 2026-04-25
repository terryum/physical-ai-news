import * as cheerio from "cheerio";
import { CrawlerAdapter } from "./interface";
import { RawItem, SourceConfig } from "../types";

/**
 * Hugging Face Daily Papers (https://huggingface.co/papers).
 * 공식 API가 없어 HTML에서 카드를 파싱한다.
 *
 * 1차 시도: <script id="__NEXT_DATA__"> 의 props.pageProps.dailyPapers 를 읽음
 * 2차 fallback: 페이지 카드에서 anchor + upvote 텍스트 추출
 */
export const hfPapersAdapter: CrawlerAdapter = {
  async fetchItems(config: SourceConfig): Promise<RawItem[]> {
    try {
      const res = await fetch(config.url, {
        headers: {
          "User-Agent": "physical-ai-news/1.0 (+https://physical-ai-news.terryum.ai)",
          Accept: "text/html",
        },
      });
      if (!res.ok) {
        console.log(`[${config.id}] HF papers ${res.status}`);
        return [];
      }
      const html = await res.text();

      const fromNext = parseFromNextData(html, config.id);
      if (fromNext.length > 0) {
        console.log(`[${config.id}] HF papers → ${fromNext.length}건 (NEXT_DATA)`);
        return fromNext;
      }

      const fromCards = parseFromCards(html, config.id);
      console.log(`[${config.id}] HF papers → ${fromCards.length}건 (cards)`);
      return fromCards;
    } catch (err) {
      console.log(`[${config.id}] HF papers 에러:`, (err as Error).message);
      return [];
    }
  },
};

interface HfPaperLite {
  paper?: {
    id?: string;
    title?: string;
    publishedAt?: string;
    upvotes?: number;
  };
  numComments?: number;
}

function parseFromNextData(html: string, sourceId: string): RawItem[] {
  const match = html.match(
    /<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/,
  );
  if (!match) return [];
  try {
    const json = JSON.parse(match[1]);
    const list: HfPaperLite[] | undefined =
      json?.props?.pageProps?.dailyPapers ??
      json?.props?.pageProps?.papers ??
      undefined;
    if (!Array.isArray(list)) return [];

    const items: RawItem[] = [];
    for (const entry of list) {
      const p = entry.paper;
      if (!p?.id || !p?.title) continue;
      items.push({
        sourceId,
        title: p.title.trim(),
        url: `https://huggingface.co/papers/${p.id}`,
        publishedAt: p.publishedAt,
        points: p.upvotes ?? 0,
        commentCount: entry.numComments ?? 0,
        lang: "en",
      });
    }
    return items;
  } catch {
    return [];
  }
}

function parseFromCards(html: string, sourceId: string): RawItem[] {
  const $ = cheerio.load(html);
  const items: RawItem[] = [];

  // 휴리스틱: <a href="/papers/<id>"> 가 카드 제목 링크
  $('a[href^="/papers/"]').each((_i, el) => {
    const href = $(el).attr("href");
    const title = $(el).text().trim();
    if (!href || !title || title.length < 8) return;
    if (items.some((it) => it.url.endsWith(href))) return; // 중복 링크 스킵

    items.push({
      sourceId,
      title,
      url: `https://huggingface.co${href}`,
      lang: "en",
    });
  });

  return items.slice(0, 30);
}
