import * as cheerio from "cheerio";
import { CrawlerAdapter } from "./interface";
import { RawItem, SourceConfig } from "../types";

/**
 * 그룹 D: 정부 사이트 HTML 파서
 * 사이트마다 URL과 HTML 구조가 다르므로 siteId별 전용 파서를 매핑.
 * 전용 파서가 없으면 범용 테이블 파서 시도.
 */
export const htmlGovAdapter: CrawlerAdapter = {
  async fetchItems(config: SourceConfig): Promise<RawItem[]> {
    // 전용 설정이 있는 사이트는 URL을 오버라이드
    const siteConfig = SITE_CONFIGS[config.id];
    const listUrl = siteConfig?.url ?? (config.list_url as string) ?? config.url;

    try {
      const res = await fetch(listUrl, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          Accept: "text/html,application/xhtml+xml",
        },
        signal: AbortSignal.timeout(10000),
      });

      if (!res.ok) {
        console.log(`[${config.id}] HTTP ${res.status} — 스킵`);
        return [];
      }

      const html = await res.text();
      const $ = cheerio.load(html);
      const baseUrl = (siteConfig?.base ?? config.url).replace(/\/$/, "");

      const parser = siteSpecificParsers[config.id];
      if (parser) {
        const items = parser($, baseUrl, config);
        console.log(`[${config.id}] 전용파서 → ${items.length}건`);
        return items;
      }

      const items = genericParser($, baseUrl, config);
      console.log(`[${config.id}] 범용파서 → ${items.length}건`);
      return items;
    } catch (err) {
      console.log(`[${config.id}] 파싱 에러:`, (err as Error).message);
      return [];
    }
  },
};

/** 사이트별 올바른 URL과 베이스 설정 */
const SITE_CONFIGS: Record<string, { url: string; base: string }> = {
  kiria: {
    url: "https://www.kiria.org/portal/info/portalInfoBusinessList.do",
    base: "https://www.kiria.org",
  },
  kiat: {
    url: "https://www.kiat.or.kr/front/board/boardContentsListAjax.do?board_id=90",
    base: "https://www.kiat.or.kr",
  },
  motie: {
    url: "https://www.motir.go.kr/kor/article/ATCLc01b2801b",
    base: "https://www.motir.go.kr",
  },
  keit: {
    url: "https://www.keit.re.kr/menu.es?mid=a10305010000",
    base: "https://www.keit.re.kr",
  },
  msit: {
    url: "https://www.msit.go.kr/bbs/list.do?sCode=user&mId=113&mPid=112",
    base: "https://www.msit.go.kr",
  },
  nia: {
    url: "https://www.nia.or.kr/site/nia_kor/ex/bbs/List.do?cbIdx=39485",
    base: "https://www.nia.or.kr",
  },
};

type SiteParser = (
  $: cheerio.CheerioAPI,
  baseUrl: string,
  config: SourceConfig
) => RawItem[];

/** 사이트별 전용 파서 */
const siteSpecificParsers: Record<string, SiteParser> = {
  // KIRIA: 테이블에 접수기간 컬럼 포함
  kiria: ($, baseUrl, config) => {
    const items: RawItem[] = [];
    $("table tbody tr").each((_, tr) => {
      const $tr = $(tr);
      const cells = $tr.find("td");
      if (cells.length < 3) return;

      const $a = cells.find("a").first();
      const title = $a.text().trim();
      if (!title) return;

      // onclick="fn_update('650')" 등에서 ID 추출
      const onclick = $a.attr("onclick") ?? "";
      const idMatch = onclick.match(/['"](\d+)['"]/);
      const url = idMatch
        ? `${baseUrl}/portal/info/portalInfoBusinessDetail.do?busiSeq=${idMatch[1]}`
        : baseUrl;

      // 접수기간 컬럼 (YYYY-MM-DD ~ YYYY-MM-DD)
      let deadlineAt: string | undefined;
      cells.each((_, td) => {
        const text = $(td).text().trim();
        const rangeMatch = text.match(/(\d{4}-\d{2}-\d{2})\s*~\s*(\d{4}-\d{2}-\d{2})/);
        if (rangeMatch) {
          deadlineAt = rangeMatch[2];
        }
      });

      // 작성일
      const dateText = cells.last().prev().text().trim();

      items.push({
        sourceId: config.id,
        title,
        url,
        publishedAt: parseDateGeneric(dateText),
        deadlineAt,
        agency: "KIRIA",
      });
    });
    return items;
  },

  // KIAT: AJAX 응답 HTML (테이블)
  kiat: ($, baseUrl, config) => {
    const items: RawItem[] = [];
    $("table tbody tr, tr").each((_, tr) => {
      const $tr = $(tr);
      const cells = $tr.find("td");
      if (cells.length < 4) return;

      const $a = cells.find("a").first();
      let title = $a.text().trim();
      if (!title) {
        // a태그가 없으면 두 번째 td에서 직접 추출
        title = cells.eq(1).text().trim();
      }
      if (!title || title.length < 5) return;

      // onclick에서 contents_id 추출
      const onclick = $a.attr("onclick") ?? cells.eq(1).find("a").attr("onclick") ?? "";
      const idMatch = onclick.match(/['"](\d+)['"]/);
      const url = idMatch
        ? `${baseUrl}/front/board/boardContentsView.do?board_id=90&contents_id=${idMatch[1]}`
        : baseUrl;

      // 공고일
      let publishedAt: string | undefined;
      // 접수기간에서 마감일 추출
      let deadlineAt: string | undefined;
      cells.each((_, td) => {
        const text = $(td).text().trim();
        // 단독 날짜 (공고일)
        const singleDate = text.match(/^(\d{4}-\d{2}-\d{2})$/);
        if (singleDate && !publishedAt) {
          publishedAt = singleDate[1];
        }
        // 범위 날짜 (접수기간)
        const rangeMatch = text.match(/(\d{4}-\d{2}-\d{2})\s*~\s*(\d{4}-\d{2}-\d{2})/);
        if (rangeMatch) {
          deadlineAt = rangeMatch[2];
        }
      });

      items.push({
        sourceId: config.id,
        title,
        url,
        publishedAt: publishedAt ? new Date(publishedAt).toISOString() : undefined,
        deadlineAt,
        agency: "KIAT",
      });
    });
    return items;
  },

  // 산업부 (motir.go.kr)
  motie: ($, baseUrl, config) => {
    const items: RawItem[] = [];
    $("table tbody tr, .board-list tbody tr, tr").each((_, tr) => {
      const $tr = $(tr);
      const cells = $tr.find("td");
      if (cells.length < 3) return;

      const $a = cells.find("a").first();
      const title = $a.text().trim();
      if (!title || title.length < 5) return;

      const onclick = $a.attr("onclick") ?? "";
      const idMatch = onclick.match(/['"]([^'"]+)['"]/);
      const href = $a.attr("href");
      const url = href && href !== "#"
        ? resolveUrl(href, baseUrl)
        : idMatch
          ? `${baseUrl}/kor/article/ATCLc01b2801b/${idMatch[1]}`
          : baseUrl;

      let publishedAt: string | undefined;
      cells.each((_, td) => {
        const text = $(td).text().trim();
        const dateMatch = text.match(/(\d{4}-\d{2}-\d{2})/);
        if (dateMatch && !publishedAt) {
          publishedAt = dateMatch[1];
        }
      });

      items.push({
        sourceId: config.id,
        title,
        url,
        publishedAt: publishedAt ? new Date(publishedAt).toISOString() : undefined,
        agency: "산업부",
      });
    });
    return items;
  },

  // SMTECH: 중소기업기술개발사업 공고
  smtech: ($, baseUrl, config) => {
    const items: RawItem[] = [];
    $("table tbody tr").each((_, tr) => {
      const $tr = $(tr);
      const $a = $tr.find("td a").first();
      const title = $a.text().trim();
      const href = $a.attr("href") ?? "";
      if (!title || !href) return;

      const url = resolveUrl(href, baseUrl);
      const cells = $tr.find("td");

      // 접수기간에서 마감일 추출
      let deadlineAt: string | undefined;
      let publishedAt: string | undefined;
      cells.each((_, td) => {
        const text = $(td).text().trim();
        const rangeMatch = text.match(/(\d{4}[.\-/]\d{2}[.\-/]\d{2})\s*~\s*(\d{4}[.\-/]\d{2}[.\-/]\d{2})/);
        if (rangeMatch) {
          deadlineAt = rangeMatch[2].replace(/\./g, "-").replace(/\//g, "-");
        }
        const dateMatch = text.match(/^(\d{4}[.\-/]\d{2}[.\-/]\d{2})$/);
        if (dateMatch && !publishedAt) {
          publishedAt = dateMatch[1].replace(/\./g, "-").replace(/\//g, "-");
        }
      });

      items.push({
        sourceId: config.id,
        title,
        url,
        publishedAt: parseDateGeneric(publishedAt ?? ""),
        deadlineAt,
        agency: "SMTECH",
      });
    });
    return items;
  },

  // NIA: 이슈분석/공지사항 게시판
  nia: ($, baseUrl, config) => {
    const items: RawItem[] = [];
    $("table tbody tr, .board_list tbody tr").each((_, tr) => {
      const $tr = $(tr);
      const $a = $tr.find("a").first();
      const title = $a.text().trim();
      const href = $a.attr("href") ?? "";
      if (!title || title.length < 5) return;

      const url = resolveUrl(href, baseUrl);
      let publishedAt: string | undefined;
      $tr.find("td").each((_, td) => {
        const text = $(td).text().trim();
        const dateMatch = text.match(/(\d{4}[.\-/]\d{2}[.\-/]\d{2})/);
        if (dateMatch && !publishedAt) {
          publishedAt = dateMatch[1];
        }
      });

      items.push({
        sourceId: config.id,
        title,
        url,
        publishedAt: parseDateGeneric(publishedAt ?? ""),
        agency: "NIA",
      });
    });
    return items;
  },
};

/** 범용 파서: 테이블 기반 공고 목록 */
function genericParser(
  $: cheerio.CheerioAPI,
  baseUrl: string,
  config: SourceConfig
): RawItem[] {
  const items: RawItem[] = [];
  const seenUrls = new Set<string>();

  $("table tbody tr").each((_, tr) => {
    const $tr = $(tr);
    const $a = $tr.find("a").first();
    const title = $a.text().trim();
    const href = $a.attr("href") ?? "";
    if (!title || title.length < 3 || !href) return;

    const url = resolveUrl(href, baseUrl);
    if (seenUrls.has(url)) return;
    seenUrls.add(url);

    let dateText = "";
    let deadlineAt: string | undefined;
    $tr.find("td").each((_, td) => {
      const t = $(td).text().trim();
      // 범위 날짜 (접수기간)
      const rangeMatch = t.match(/(\d{4}[.\-/]\d{2}[.\-/]\d{2})\s*~\s*(\d{4}[.\-/]\d{2}[.\-/]\d{2})/);
      if (rangeMatch) {
        deadlineAt = rangeMatch[2].replace(/\./g, "-").replace(/\//g, "-");
      }
      if (/^\d{4}[.\-/]\d{1,2}[.\-/]\d{1,2}$/.test(t)) {
        dateText = t;
      }
    });

    items.push({
      sourceId: config.id,
      title,
      url,
      publishedAt: parseDateGeneric(dateText),
      deadlineAt,
      agency: config.name,
    });
  });

  return items;
}

function resolveUrl(href: string, baseUrl: string): string {
  if (href.startsWith("http")) return href;
  if (href.startsWith("//")) return `https:${href}`;
  if (href.startsWith("/")) return `${baseUrl}${href}`;
  return `${baseUrl}/${href}`;
}

function parseDateGeneric(text: string): string | undefined {
  if (!text) return undefined;
  const match = text.match(/(\d{4})[.\-/](\d{1,2})[.\-/](\d{1,2})/);
  if (match) {
    const [, y, m, d] = match;
    try {
      return new Date(`${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`).toISOString();
    } catch {
      return undefined;
    }
  }
  return undefined;
}
