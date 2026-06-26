/**
 * 그룹 A: 기업마당 API (RSS/XML 형식)
 * endpoint: https://www.bizinfo.go.kr/uss/rss/bizinfoApi.do
 * 인증: crtfcKey 파라미터
 *
 * RSS에 마감일이 없으므로, 각 공고 상세 페이지에서 "신청기간"을 파싱하여 마감일 추출.
 */
import * as cheerio from "cheerio";
import { CrawlerAdapter } from "./interface";
import { SourceConfig, RawItem } from "../types";

const BIZINFO_KEYWORDS = [
  "AI", "로봇", "자동화", "스마트팩토리", "스마트공장",
  "제조혁신", "디지털전환", "디지털트윈",
];
const RSS_TIMEOUT_MS = 12000;

interface RssEntry {
  title: string;
  link: string;
  pubDate?: string;
  description?: string;
  author?: string;
}

function parseBizinfoRss(xml: string): RssEntry[] {
  const $ = cheerio.load(xml, { xmlMode: true });
  const entries: RssEntry[] = [];

  $("item").each((_, el) => {
    const childText = (selector: string) =>
      $(el).find(selector).first().text().trim() || undefined;
    const title = childText("title");
    const link = childText("link");
    if (!title || !link) return;
    entries.push({
      title,
      link,
      pubDate: childText("pubDate"),
      description: childText("description"),
      author: childText("author") ?? childText("dc\\:creator"),
    });
  });

  return entries;
}

async function fetchRssEntries(url: string): Promise<RssEntry[]> {
  const res = await fetch(url, {
    headers: { "User-Agent": "PhysicalAIRadar/1.0" },
    signal: AbortSignal.timeout(RSS_TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return parseBizinfoRss(await res.text());
}

/** 상세 페이지에서 신청기간의 마감일을 추출 */
async function fetchDeadline(detailUrl: string): Promise<string | undefined> {
  try {
    const res = await fetch(detailUrl, {
      headers: { "User-Agent": "PhysicalAIRadar/1.0" },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return undefined;
    const html = await res.text();
    const $ = cheerio.load(html);

    // 페이지 전체 텍스트에서 "YYYY.MM.DD ~ YYYY.MM.DD" 패턴을 찾아 마지막 날짜를 마감일로 추출
    const text = $("body").text().replace(/\s+/g, " ");
    // 모든 날짜 범위 패턴 추출
    const dateRangePattern = /(\d{4}[.\-/]\d{2}[.\-/]\d{2})\s*~\s*(\d{4}[.\-/]\d{2}[.\-/]\d{2})/g;
    let deadline: string | undefined;
    let match: RegExpExecArray | null;
    while ((match = dateRangePattern.exec(text)) !== null) {
      // 첫 번째로 발견된 범위의 끝 날짜를 마감일로 사용
      deadline = match[2].replace(/\./g, "-").replace(/\//g, "-");
      break;
    }
    return deadline;
  } catch {
    return undefined;
  }
}

export const bizinfoAdapter: CrawlerAdapter = {
  async fetchItems(config: SourceConfig): Promise<RawItem[]> {
    const apiKey = process.env.BIZINFO_API_KEY;
    if (!apiKey) {
      console.log(`[${config.id}] BIZINFO_API_KEY 환경변수 미설정 — 스킵`);
      return [];
    }

    const allItems: RawItem[] = [];
    const seenUrls = new Set<string>();

    for (const keyword of BIZINFO_KEYWORDS) {
      try {
        const url = `https://www.bizinfo.go.kr/uss/rss/bizinfoApi.do?crtfcKey=${apiKey}&dataType=rss&searchCnt=30&hashtags=${encodeURIComponent(keyword)}`;
        const entries = await fetchRssEntries(url);

        for (const entry of entries) {
          if (!entry.title || !entry.link) continue;
          if (seenUrls.has(entry.link)) continue;
          seenUrls.add(entry.link);

          allItems.push({
            sourceId: config.id,
            title: entry.title.trim(),
            url: entry.link.trim(),
            publishedAt: entry.pubDate,
            description: entry.description,
            agency: entry.author,
          });
        }

        console.log(`[${config.id}] 키워드="${keyword}" → ${entries.length}건`);
      } catch (err) {
        console.log(`[${config.id}] 키워드="${keyword}" 에러: ${(err as Error).message}`);
      }
    }

    // 상세 페이지에서 마감일 추출 (병렬, 최대 10개씩)
    console.log(`[${config.id}] 마감일 추출 중... (${allItems.length}건)`);
    const batchSize = 10;
    for (let i = 0; i < allItems.length; i += batchSize) {
      const batch = allItems.slice(i, i + batchSize);
      const deadlines = await Promise.all(
        batch.map((item) => fetchDeadline(item.url))
      );
      for (let j = 0; j < batch.length; j++) {
        if (deadlines[j]) {
          batch[j].deadlineAt = deadlines[j];
        }
      }
    }

    const withDeadline = allItems.filter((i) => i.deadlineAt).length;
    console.log(`[${config.id}] 마감일 추출 완료: ${withDeadline}/${allItems.length}건`);

    return allItems;
  },
};
