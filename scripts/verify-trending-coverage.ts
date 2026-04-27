/**
 * 해외 트렌딩 커버리지 검증 — 과거 N개 날짜에 대해
 *  1) 외부 ground-truth 후보를 자동 수집 (HN, Reddit pullpush, arXiv)
 *  2) 각 날짜의 items.json (±2일 윈도우) 과 매칭
 *  3) HIT / HIT-WRONG-BUCKET / MISS 분류 + MISS 갭 카테고리 라벨링
 *  4) 마크다운 리포트 출력
 *
 * 실행: npx tsx scripts/verify-trending-coverage.ts 2026-04-15 2026-04-21 2026-04-25
 */
import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import YAML from "yaml";
import { loadItemsForDateWindow, type HistoricalItem } from "./sample-historical-items";

// ─────────────────────────────────────────────────────────────────────
// 설정

const __dirnameCompat =
  typeof __dirname !== "undefined"
    ? __dirname
    : path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirnameCompat, "..");

const DEFAULT_DATES = ["2026-04-15", "2026-04-21", "2026-04-25"];

// AI / Robotics / Physical AI 와 직간접적으로 관련 있는 후보만 ground-truth 로 채택
const TOPIC_KEYWORDS = [
  // 핵심 — 강한 신호
  "humanoid", "robot", "robotic", "embodied", "manipul", "dexter",
  "vla", "vision-language-action", "physical ai",
  "diffusion policy", "foundation model", "imitation",
  // 모델·랩
  "gpt", "claude", "gemini", "llama", "deepseek", "qwen", "mistral", "grok",
  "openai", "anthropic", "deepmind", "meta ai",
  // 기업
  "tesla", "figure", "1x ", "unitree", "boston dynamics", "nvidia",
  "physical intelligence", " pi ", "π0",
  // 일반 AI/ML — 약한 신호이나 그 날 화제일 가능성
  "llm", "transformer", "neural network", "self-driving", "autonomous",
  "agent", "agentic", "rlhf", "reinforcement learning",
  "ai ", " ai", "machine learning", "ml ",
];

// 우리 trending 소스에 매핑되는 ground-truth 출처 → 어떤 sourceId 로 잡혔어야 하는지
const SOURCE_MAP: Record<string, string[]> = {
  hn: ["hackernews"],
  "reddit_machinelearning": ["reddit_ml"],
  reddit_localllama: ["reddit_localllama"],
  reddit_robotics: ["reddit_robotics"],
  reddit_singularity: ["reddit_singularity"],
  arxiv_cs_ai: ["arxiv_cs_ai"],
  arxiv_cs_ro: ["arxiv_cs_ro"],
  arxiv_cs_lg: ["arxiv_cs_lg"],
  // 후보 (현재 미수집)
  reddit_futurology: [],
  reddit_artificial: [],
};

// Reddit 우리 어댑터 임계값 (worker/adapters/reddit.ts MIN_UPS).
// 어댑터 값과 sync 유지. 2026-04-27 보강에서 100 → 50 으로 완화.
const REDDIT_MIN_UPS = 50;

// HN 어댑터 키워드 — sources.yaml 에서 동적 로드. 실제 어댑터가 검색에 쓰는
// 키워드와 항상 sync 돼야 갭 분류 (HN_QUERY_FILTER) 가 정확함.
function loadHnQueryKeywords(): string[] {
  const fallback = [
    // 보강 후 (2026-04-27 기준) 폴백 — sources.yaml 못 읽을 때
    "humanoid", "robotics", "physical ai", "embodied", "manipulation",
    "llm agent", "foundation model",
    "gpt", "claude", "gemini", "openai", "anthropic", "deepmind",
    "ai agent", "ai model",
  ];
  try {
    const yamlPath = path.join(PROJECT_ROOT, "config", "sources.yaml");
    const text = fs.readFileSync(yamlPath, "utf-8");
    const sources = YAML.parse(text) as Array<{
      id: string;
      keywords?: string[];
    }>;
    const hn = sources.find((s) => s.id === "hackernews");
    const kws = hn?.keywords ?? [];
    if (kws.length === 0) return fallback;
    return kws.map((k) => k.toLowerCase());
  } catch {
    return fallback;
  }
}

const HN_QUERY_KEYWORDS = loadHnQueryKeywords();

// ─────────────────────────────────────────────────────────────────────
// Ground-truth 타입

interface GTItem {
  source: string; // hn | reddit_<sub> | arxiv_<cat>
  title: string;
  url: string;
  points: number;
  publishedAt: string; // ISO
}

// ─────────────────────────────────────────────────────────────────────
// Ground-truth fetchers (모두 무료·공개 API)

async function fetchHN(date: string, threshold = 150): Promise<GTItem[]> {
  const start = Math.floor(Date.parse(`${date}T00:00:00Z`) / 1000);
  const end = Math.floor(Date.parse(`${date}T23:59:59Z`) / 1000);
  const url =
    `https://hn.algolia.com/api/v1/search?tags=story&` +
    `numericFilters=points>${threshold},created_at_i>${start},created_at_i<${end}&` +
    `hitsPerPage=50`;
  const res = await fetch(url);
  if (!res.ok) {
    console.error(`[hn] HTTP ${res.status}`);
    return [];
  }
  const data = (await res.json()) as { hits: Array<Record<string, unknown>> };
  return data.hits.map((h): GTItem => ({
    source: "hn",
    title: String(h.title ?? ""),
    url: (h.url as string) || `https://news.ycombinator.com/item?id=${h.objectID}`,
    points: Number(h.points ?? 0),
    publishedAt: String(h.created_at ?? ""),
  }));
}

async function fetchReddit(date: string, sub: string, threshold = 50): Promise<GTItem[]> {
  // pullpush 는 게시 직후 score 만 보존해서 거의 모든 글이 0~1 점.
  // 대신 Reddit 직접 top.json?t=month/year 호출 → created_utc 로 그 날 필터.
  const start = Math.floor(Date.parse(`${date}T00:00:00Z`) / 1000);
  const end = Math.floor(Date.parse(`${date}T23:59:59Z`) / 1000);
  const today = Math.floor(Date.now() / 1000);
  const ageDays = (today - end) / 86400;
  // 30일 이내면 month, 1년 이내면 year, 그 이상이면 all
  const window = ageDays < 28 ? "month" : ageDays < 360 ? "year" : "all";
  const url = `https://www.reddit.com/r/${sub}/top.json?t=${window}&limit=100`;
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": "physical-ai-news-verify/1.0",
        Accept: "application/json",
      },
    });
    if (!res.ok) {
      console.error(`[reddit_${sub}] HTTP ${res.status}`);
      return [];
    }
    const data = (await res.json()) as {
      data: { children: Array<{ data: Record<string, unknown> }> };
    };
    const all = data.data?.children ?? [];
    const filtered: GTItem[] = [];
    for (const c of all) {
      const d = c.data;
      if (d.stickied) continue;
      const created = Number(d.created_utc ?? 0);
      if (created < start || created > end) continue;
      const score = Number(d.score ?? d.ups ?? 0);
      if (score < threshold) continue;
      filtered.push({
        source: `reddit_${sub.toLowerCase()}`,
        title: String(d.title ?? ""),
        url: (d.url as string) || `https://www.reddit.com${d.permalink}`,
        points: score,
        publishedAt: new Date(created * 1000).toISOString(),
      });
    }
    return filtered;
  } catch (err) {
    console.error(`[reddit_${sub}] error:`, (err as Error).message);
    return [];
  }
}

async function fetchArxiv(date: string, cat: string, max = 2000): Promise<GTItem[]> {
  // submittedDate 필터가 redirect 후 quote 처리되며 깨지므로 sort by date 받아 클라이언트 필터.
  // cs.AI 처럼 큰 카테고리는 하루에 100+개 제출되므로 max 를 크게.
  const url =
    `https://export.arxiv.org/api/query?` +
    `search_query=cat:${cat}&start=0&max_results=${max}&` +
    `sortBy=submittedDate&sortOrder=descending`;
  const targetDay = date; // YYYY-MM-DD
  try {
    const res = await fetch(url, { redirect: "follow" });
    if (!res.ok) {
      console.error(`[arxiv_${cat}] HTTP ${res.status}`);
      return [];
    }
    const xml = await res.text();
    const items: GTItem[] = [];
    const entryRe = /<entry>([\s\S]*?)<\/entry>/g;
    let m: RegExpExecArray | null;
    while ((m = entryRe.exec(xml))) {
      const block = m[1];
      const title = (block.match(/<title>([\s\S]*?)<\/title>/) || [])[1]
        ?.replace(/\s+/g, " ")
        .trim();
      const id = (block.match(/<id>([^<]*)<\/id>/) || [])[1];
      const published =
        (block.match(/<published>([^<]*)<\/published>/) || [])[1] ?? "";
      if (!title || !id) continue;
      if (!published.startsWith(targetDay)) continue; // 그 날 제출분만
      items.push({
        source: `arxiv_${cat.toLowerCase().replace(".", "_")}`,
        title,
        url: id,
        points: 0,
        publishedAt: published,
      });
    }
    return items;
  } catch (err) {
    console.error(`[arxiv_${cat}] error:`, (err as Error).message);
    return [];
  }
}

// ─────────────────────────────────────────────────────────────────────
// 토픽 필터 (AI/Robotics/Physical AI 만)

function isTopicMatch(title: string): boolean {
  const t = title.toLowerCase();
  return TOPIC_KEYWORDS.some((kw) => t.includes(kw));
}

// ─────────────────────────────────────────────────────────────────────
// 매칭 유틸

function urlKey(url: string): string {
  try {
    const u = new URL(url);
    const host = u.hostname.replace(/^www\./, "");
    const path = u.pathname.replace(/\/+$/, "");
    return `${host}${path}`;
  } catch {
    return url;
  }
}

const STOPWORDS = new Set([
  "a", "an", "the", "is", "are", "was", "were", "be", "been", "and", "or",
  "of", "to", "in", "on", "for", "with", "by", "from", "at", "as", "this",
  "that", "via", "using", "new", "show", "hn", "shows", "we", "our",
  "how", "why", "what", "when", "can", "will", "has", "have", "its", "it",
]);

function fingerprint(title: string): string | null {
  const norm = title
    .toLowerCase()
    .replace(/^[\[【][^\]】]*[\]】]\s*/, "")
    .replace(/[^\p{L}\p{N}\s-]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!norm) return null;
  const words = norm.split(" ").filter((w) => w && !STOPWORDS.has(w));
  if (words.length < 3) return null;
  return words.slice(0, 4).join(" ");
}

type MatchKind = "HIT" | "HIT-WRONG-BUCKET" | "MISS";

interface MatchResult {
  kind: MatchKind;
  match?: HistoricalItem;
  matchType?: "url" | "fingerprint";
}

function matchAgainstItems(gt: GTItem, items: HistoricalItem[]): MatchResult {
  const gtUrl = urlKey(gt.url);
  for (const it of items) {
    const itUrl = it.links?.[0]?.url;
    if (itUrl && urlKey(itUrl) === gtUrl) {
      return {
        kind: it.itemType === "trending" ? "HIT" : "HIT-WRONG-BUCKET",
        match: it,
        matchType: "url",
      };
    }
  }
  const gtFp = fingerprint(gt.title);
  if (gtFp) {
    for (const it of items) {
      if (fingerprint(it.title) === gtFp || fingerprint(it.titleKo ?? "") === gtFp) {
        return {
          kind: it.itemType === "trending" ? "HIT" : "HIT-WRONG-BUCKET",
          match: it,
          matchType: "fingerprint",
        };
      }
    }
  }
  return { kind: "MISS" };
}

// ─────────────────────────────────────────────────────────────────────
// MISS 갭 분류

type GapCategory =
  | "SOURCE_MISSING" // 1. 우리가 안 가져오는 출처 (sub/feed 자체 없음)
  | "HN_QUERY_FILTER" // 2. HN keyword 쿼리 매칭 안돼 후보 자체 미수집
  | "BELOW_THRESHOLD" // 3. Reddit MIN_UPS=100 등 임계 미달
  | "TIME_WINDOW" // 4. 시간 윈도우 (cron 직전·직후)
  | "KEYWORD_FILTER" // 5. T0/T1 EN 키워드 매칭 없음 → priority 묻힘
  | "DEDUP_LOSS" // 6. dedup 으로 다른 항목에 병합
  | "UNKNOWN";

function classifyMiss(gt: GTItem): { cat: GapCategory; reason: string } {
  const knownSources = SOURCE_MAP[gt.source];

  if (knownSources === undefined) {
    return { cat: "UNKNOWN", reason: `unmapped source: ${gt.source}` };
  }
  if (knownSources.length === 0) {
    return { cat: "SOURCE_MISSING", reason: `${gt.source} 는 sources.yaml 에 없음` };
  }

  // HN: keyword 쿼리 매칭 안되면 애초에 미수집
  if (gt.source === "hn") {
    const t = gt.title.toLowerCase();
    const hnHit = HN_QUERY_KEYWORDS.some((kw) => t.includes(kw));
    if (!hnHit) {
      return {
        cat: "HN_QUERY_FILTER",
        reason: `hackernews.keywords (humanoid/robotics/embodied/...) 쿼리에 매칭 안 됨`,
      };
    }
  }

  // Reddit 임계값 미달
  if (gt.source.startsWith("reddit_") && gt.points < REDDIT_MIN_UPS) {
    return {
      cat: "BELOW_THRESHOLD",
      reason: `ups=${gt.points} < MIN_UPS(${REDDIT_MIN_UPS})`,
    };
  }

  // 키워드/스코어 — title 에 T0/T1 EN 매칭이 전혀 없으면 priority=P2 로 묻힐 가능성
  const t = gt.title.toLowerCase();
  const T0_EN = [
    "humanoid", "embodied", "manipulation", "physical ai",
    "dexterous", "vla ", "vision-language-action",
  ];
  const T1_EN = [
    "robot", "robotics", "llm", "agent", "vision-language",
    "foundation model", "diffusion policy", "autonomous",
  ];
  const hasKw = [...T0_EN, ...T1_EN].some((kw) => t.includes(kw));
  if (!hasKw && gt.points < 200) {
    return {
      cat: "KEYWORD_FILTER",
      reason: "T0/T1 EN 키워드 없음 — priority=P2 로 묻힘 (또는 score=0)",
    };
  }

  // arXiv: 우리는 RSS 만 보므로 그 날 RSS 에 노출 안 됐으면 누락
  if (gt.source.startsWith("arxiv_") && gt.points === 0) {
    return {
      cat: "TIME_WINDOW",
      reason: "arXiv RSS 에 그 날 노출되지 않은 논문 (cron 시점차)",
    };
  }

  return { cat: "UNKNOWN", reason: "원인 불명 — dedup/cron 시점/score=0 의심" };
}

// ─────────────────────────────────────────────────────────────────────
// 메인

async function runForDate(date: string) {
  console.log(`\n# === ${date} ===\n`);

  // 1) Ground-truth 수집
  const [hn, ml, ll, ro, sg, fu, ar, axai, axro, axlg] = await Promise.all([
    fetchHN(date, 100),
    fetchReddit(date, "MachineLearning", 50),
    fetchReddit(date, "LocalLLaMA", 50),
    fetchReddit(date, "robotics", 30),
    fetchReddit(date, "singularity", 100),
    fetchReddit(date, "Futurology", 200), // 후보 (현재 미수집)
    fetchReddit(date, "artificial", 100), // 후보 (현재 미수집)
    fetchArxiv(date, "cs.AI"),
    fetchArxiv(date, "cs.RO"),
    fetchArxiv(date, "cs.LG"),
  ]);

  // pullpush.io rate-limit 회피: 0.3s 간격으로 재시도하지 말고 한 번만
  const all: GTItem[] = [...hn, ...ml, ...ll, ...ro, ...sg, ...fu, ...ar, ...axai, ...axro, ...axlg];

  const filtered = all.filter((g) => isTopicMatch(g.title));

  // 동일 URL 중복 제거 (소스 간)
  const uniq = new Map<string, GTItem>();
  for (const g of filtered) {
    const k = urlKey(g.url);
    const e = uniq.get(k);
    if (!e || g.points > e.points) uniq.set(k, g);
  }
  const groundTruth = Array.from(uniq.values()).sort((a, b) => b.points - a.points);

  console.log(`Ground-truth 후보: 총 ${all.length} → 토픽 필터 후 ${filtered.length} → 중복 제거 후 ${groundTruth.length}`);
  console.log(`  hn=${hn.length}  r/ML=${ml.length}  r/LocalLLaMA=${ll.length}  r/robotics=${ro.length}  r/singularity=${sg.length}`);
  console.log(`  r/Futurology=${fu.length}  r/artificial=${ar.length}  arxiv.AI=${axai.length}  arxiv.RO=${axro.length}  arxiv.LG=${axlg.length}\n`);

  // 2) items.json 로드 (당일 + ±2일)
  const { primary, window, commit } = loadItemsForDateWindow(date, 2);
  console.log(`items.json @ ${commit?.slice(0, 8) ?? "(없음)"} primary=${primary.length} window=${window.length}\n`);

  if (groundTruth.length === 0) {
    console.log("(ground-truth 없음 — 필터 너무 엄격하거나 외부 API 응답 없음)");
    return { date, total: 0, hits: 0, wrongBucket: 0, misses: 0, gaps: {} };
  }

  // 3) 매칭
  const results: Array<{ gt: GTItem; mr: MatchResult }> = groundTruth.map((gt) => ({
    gt,
    mr: matchAgainstItems(gt, window),
  }));

  const hits = results.filter((r) => r.mr.kind === "HIT");
  const wrongBucket = results.filter((r) => r.mr.kind === "HIT-WRONG-BUCKET");
  const misses = results.filter((r) => r.mr.kind === "MISS");

  // 4) MISS 갭 분류
  const gapBuckets: Record<GapCategory, Array<{ gt: GTItem; reason: string }>> = {
    SOURCE_MISSING: [],
    HN_QUERY_FILTER: [],
    BELOW_THRESHOLD: [],
    TIME_WINDOW: [],
    KEYWORD_FILTER: [],
    DEDUP_LOSS: [],
    UNKNOWN: [],
  };
  for (const m of misses) {
    const c = classifyMiss(m.gt);
    gapBuckets[c.cat].push({ gt: m.gt, reason: c.reason });
  }

  // 5) 리포트
  const total = groundTruth.length;
  const hitRate = ((hits.length / total) * 100).toFixed(1);
  console.log(`## 매칭 결과 (총 ${total})`);
  console.log(`- HIT: ${hits.length} (${hitRate}%)`);
  console.log(`- HIT-WRONG-BUCKET: ${wrongBucket.length}`);
  console.log(`- MISS: ${misses.length}\n`);

  console.log(`## MISS 갭 분포`);
  for (const cat of Object.keys(gapBuckets) as GapCategory[]) {
    const n = gapBuckets[cat].length;
    if (n > 0) console.log(`- ${cat}: ${n}`);
  }
  console.log();

  console.log(`## MISS 상세 (상위 12개, points DESC)`);
  const topMisses = misses
    .sort((a, b) => b.gt.points - a.gt.points)
    .slice(0, 12);
  for (const { gt } of topMisses) {
    const c = classifyMiss(gt);
    console.log(
      `- [${c.cat}] ${gt.source} (${gt.points}p) — ${gt.title.slice(0, 100)}\n` +
        `    ${gt.url}\n` +
        `    → ${c.reason}`,
    );
  }

  if (wrongBucket.length > 0) {
    console.log(`\n## HIT-WRONG-BUCKET 상세`);
    for (const w of wrongBucket) {
      console.log(
        `- [${w.gt.source}→${w.mr.match?.itemType}] ${w.gt.title.slice(0, 90)}\n` +
          `    items: ${w.mr.match?.title.slice(0, 90)}`,
      );
    }
  }

  return {
    date,
    total,
    hits: hits.length,
    wrongBucket: wrongBucket.length,
    misses: misses.length,
    gaps: Object.fromEntries(
      Object.entries(gapBuckets).map(([k, v]) => [k, v.length]),
    ),
  };
}

async function main() {
  const args = process.argv.slice(2).filter((a) => /^\d{4}-\d{2}-\d{2}$/.test(a));
  const dates = args.length > 0 ? args : DEFAULT_DATES;

  console.log(`# 해외 트렌딩 커버리지 검증`);
  console.log(`대상 날짜: ${dates.join(", ")}\n`);

  const summaries: Awaited<ReturnType<typeof runForDate>>[] = [];
  for (const d of dates) {
    summaries.push(await runForDate(d));
  }

  console.log(`\n# === 종합 ===\n`);
  console.log(`| 날짜 | total | HIT | wrong-bucket | MISS | hit-rate |`);
  console.log(`|---|---|---|---|---|---|`);
  for (const s of summaries) {
    const hr = s.total > 0 ? ((s.hits / s.total) * 100).toFixed(0) + "%" : "-";
    console.log(`| ${s.date} | ${s.total} | ${s.hits} | ${s.wrongBucket} | ${s.misses} | ${hr} |`);
  }

  // 갭 합산
  const totalGap: Record<string, number> = {};
  for (const s of summaries) {
    for (const [k, v] of Object.entries(s.gaps)) {
      totalGap[k] = (totalGap[k] ?? 0) + (v as number);
    }
  }
  console.log(`\n## 전체 MISS 갭 분포`);
  for (const [k, v] of Object.entries(totalGap).sort((a, b) => b[1] - a[1])) {
    if (v > 0) console.log(`- ${k}: ${v}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
