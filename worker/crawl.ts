import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import YAML from "yaml";
import { SourceConfig, RawItem } from "./types";
import { CrawlerAdapter } from "./adapters/interface";
import { naverNewsAdapter } from "./adapters/naver-news";
import { googleRssAdapter } from "./adapters/google-rss";
import { namuCmsAdapter } from "./adapters/namu-cms";
import { htmlGovAdapter } from "./adapters/html-gov";
import { bizinfoAdapter } from "./adapters/bizinfo";
import { scoreItems, ScoredItem } from "./pipeline/scorer";
import { dedup } from "./pipeline/dedup";
import { normalizeUrl, parseDate } from "./pipeline/normalize";

// ESM/CJS 호환 __dirname 결정
const __dirnameCompat =
  typeof __dirname !== "undefined"
    ? __dirname
    : path.dirname(fileURLToPath(import.meta.url));

// ── 어댑터 레지스트리 ──
const adapterByGroup: Record<string, CrawlerAdapter> = {
  A: naverNewsAdapter, // 네이버 뉴스 API (bizinfo/ntis는 별도 구현 필요 — 지금은 naver_news만)
  B: googleRssAdapter,
  C: namuCmsAdapter,
  D: htmlGovAdapter,
};

// 그룹 A 소스별 어댑터 매핑
const groupAAdapters: Record<string, CrawlerAdapter> = {
  naver_news: naverNewsAdapter,
  bizinfo: bizinfoAdapter,
};
const SUPPORTED_A_SOURCES = new Set(Object.keys(groupAAdapters));

/**
 * 메인 크롤 오케스트레이터
 * @param phase "fast" | "slow" | "all"
 */
export async function crawl(phase: "fast" | "slow" | "all" = "all"): Promise<void> {
  const projectRoot = path.resolve(__dirnameCompat, "..");
  const configPath = path.join(projectRoot, "config", "sources.yaml");
  const outputPath = path.join(projectRoot, "public", "data", "items.json");

  // sources.yaml 로드
  const yamlContent = fs.readFileSync(configPath, "utf-8");
  const sources: SourceConfig[] = YAML.parse(yamlContent);

  console.log(`\n========================================`);
  console.log(`Physical AI News — Crawl (phase: ${phase})`);
  console.log(`========================================`);
  console.log(`총 ${sources.length}개 소스 로드\n`);

  // ── Phase 1: fast (그룹 A, B, C, D) ──
  if (phase === "fast" || phase === "all") {
    console.log(`── Phase 1: fast 소스 실행 ──\n`);

    const fastSources = sources.filter(
      (s) => s.enabled && s.phase === "fast"
    );

    // 그룹 A에서 지원하는 소스만 필터
    const runnableFast = fastSources.filter((s) => {
      if (s.group === "A" && !SUPPORTED_A_SOURCES.has(s.id)) {
        console.log(`[${s.id}] 그룹 A 미구현 어댑터 — 스킵`);
        return false;
      }
      if (!adapterByGroup[s.group]) {
        console.log(`[${s.id}] 그룹 ${s.group} 어댑터 없음 — 스킵`);
        return false;
      }
      return true;
    });

    console.log(`실행 대상: ${runnableFast.length}개 소스\n`);

    // 병렬 실행
    const results = await Promise.allSettled(
      runnableFast.map(async (source) => {
        const adapter = source.group === "A" ? groupAAdapters[source.id] : adapterByGroup[source.group];
        try {
          const items = await adapter.fetchItems(source);
          return { sourceId: source.id, items };
        } catch (err) {
          console.log(`[${source.id}] 어댑터 실행 에러:`, (err as Error).message);
          return { sourceId: source.id, items: [] as RawItem[] };
        }
      })
    );

    // 결과 수집
    const allRawItems: RawItem[] = [];
    for (const result of results) {
      if (result.status === "fulfilled") {
        allRawItems.push(...result.value.items);
      }
    }

    console.log(`\n── 수집 완료: 총 ${allRawItems.length}건 ──\n`);

    // 정규화
    const normalized = allRawItems.map((item) => ({
      ...item,
      url: normalizeUrl(item.url),
      publishedAt: item.publishedAt ? parseDate(item.publishedAt) ?? item.publishedAt : undefined,
    }));

    // 스코어링
    const scored = scoreItems(normalized);

    // 중복 제거
    const deduped = dedup(scored);

    // 점수 내림차순 정렬
    deduped.sort((a, b) => b.score - a.score);

    console.log(`── 파이프라인 결과 ──`);
    console.log(`  정규화: ${normalized.length}건`);
    console.log(`  스코어링: ${scored.length}건`);
    console.log(`  중복제거: ${deduped.length}건\n`);

    // Item 형태로 변환하여 저장
    const outputItems = deduped.map(toOutputItem);

    // fast crawl은 전체 교체 (이전 중복이 다시 들어오는 것 방지)
    // 단, read/starred 상태는 유지
    const existingItems = loadExistingItems(outputPath);
    const readState = new Map<string, { read: boolean; starred: boolean }>();
    for (const item of existingItems) {
      if (item.read || item.starred) {
        readState.set(item.id, { read: item.read, starred: item.starred });
      }
    }
    const final = outputItems.map((item) => {
      const state = readState.get(item.id);
      if (state) return { ...item, ...state };
      return item;
    });

    // 저장
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    fs.writeFileSync(outputPath, JSON.stringify(final, null, 2), "utf-8");
    console.log(`✓ ${outputPath} 에 ${final.length}건 저장\n`);
  }

  // ── Phase 2: slow (그룹 E — Playwright 필요) ──
  if (phase === "slow" || phase === "all") {
    console.log(`── Phase 2: slow 소스 ──\n`);

    const slowSources = sources.filter(
      (s) => s.enabled && s.phase === "slow"
    );

    for (const source of slowSources) {
      console.log(`[${source.id}] TODO: Playwright 필요 — 스킵`);
    }

    console.log(`\n그룹 E 소스 ${slowSources.length}개는 Playwright 설치 후 구현 예정\n`);
  }

  console.log(`========================================`);
  console.log(`크롤 완료 (phase: ${phase})`);
  console.log(`========================================\n`);
}

/** ScoredItem을 출력용 Item 형태로 변환 */
function toOutputItem(item: ScoredItem): OutputItem {
  return {
    id: generateId(item),
    itemType: item.sourceId.includes("gov") || isGovSource(item.sourceId) ? "gov" : "news",
    title: item.title,
    publishedAt: item.publishedAt ?? new Date().toISOString(),
    deadlineAt: item.deadlineAt,
    budgetKrwOk: item.budgetKrwOk,
    sourceName: item.sourceId,
    tier: item.tier,
    priority: item.priority,
    score: item.score,
    matchedKeywords: item.matchedKeywords,
    matchedCompanies: [],
    region: item.region,
    links: [{ label: "원문", url: item.url, kind: "canonical" as const }],
    relatedArticles: item.relatedArticles?.map((ra) => ({
      title: ra.title,
      url: ra.url,
      sourceName: ra.sourceId,
    })),
    read: false,
    starred: false,
  };
}

interface OutputItem {
  id: string;
  itemType: "gov" | "news";
  title: string;
  publishedAt: string;
  deadlineAt?: string;
  budgetKrwOk?: number;
  sourceName: string;
  tier: string;
  priority: string;
  score: number;
  matchedKeywords: string[];
  matchedCompanies: string[];
  region?: string;
  links: Array<{ label: string; url: string; kind: string }>;
  relatedArticles?: Array<{ title: string; url: string; sourceName: string }>;
  read: boolean;
  starred: boolean;
}

/** 정부 소스 ID 판별 */
const GOV_SOURCE_IDS = new Set([
  "bizinfo", "ntis", "msit", "motie", "mss", "keit", "kiat", "nipa",
  "kiria", "smtech", "tipa", "nia", "gbsa", "rndia", "iris", "srome",
  "smart_factory", "iitp",
]);

function isGovSource(sourceId: string): boolean {
  return GOV_SOURCE_IDS.has(sourceId);
}

/** 간단한 ID 생성 (소스ID + URL hash) */
function generateId(item: ScoredItem): string {
  const hash = simpleHash(item.url);
  return `${item.sourceId}-${hash}`;
}

function simpleHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0; // 32bit int
  }
  return Math.abs(hash).toString(36);
}

/** 기존 items.json 로드 */
function loadExistingItems(outputPath: string): OutputItem[] {
  try {
    if (fs.existsSync(outputPath)) {
      const content = fs.readFileSync(outputPath, "utf-8");
      const parsed = JSON.parse(content);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch {
    // 파싱 실패 시 빈 배열
  }
  return [];
}

/** 기존 아이템과 새 아이템 병합 (ID 기준 중복 제거) */
function mergeItems(existing: OutputItem[], newItems: OutputItem[]): OutputItem[] {
  const map = new Map<string, OutputItem>();

  // 기존 아이템 먼저 (read/starred 상태 유지)
  for (const item of existing) {
    map.set(item.id, item);
  }

  // 새 아이템으로 덮어쓰기 (read/starred는 기존 값 유지)
  for (const item of newItems) {
    const existingItem = map.get(item.id);
    if (existingItem) {
      map.set(item.id, {
        ...item,
        read: existingItem.read,
        starred: existingItem.starred,
      });
    } else {
      map.set(item.id, item);
    }
  }

  // 점수 내림차순 정렬
  return Array.from(map.values()).sort((a, b) => b.score - a.score);
}
