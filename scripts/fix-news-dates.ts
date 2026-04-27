/**
 * 일회성 스크립트: 잘못된 뉴스 데이터 정리
 *
 * 1. namu-cms (jangup 등) pagination garbage 제거 — articleList.html / 짧은 숫자 제목
 * 2. publishedAt 이 크롤 시각 (=오늘) 으로 fallback 된 한국 뉴스 항목들의 발행일을
 *    상세 페이지의 JSON-LD/og:article:published_time 에서 다시 추출하여 보정
 *
 * 새 어댑터 적용 직전 한 번만 실행. 다음 cron 부터는 자동으로 처리됨.
 *
 * 실행: npx tsx scripts/fix-news-dates.ts
 */
import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import { parsePublishedAtFromHtml } from "../worker/adapters/namu-cms";

const __dirnameCompat =
  typeof __dirname !== "undefined" ? __dirname : path.dirname(fileURLToPath(import.meta.url));

const root = path.resolve(__dirnameCompat, "..");
const dataPath = path.join(root, "public", "data", "items.json");

interface OutputItem {
  id: string;
  itemType: "gov" | "news" | "trending";
  title: string;
  publishedAt: string;
  links: Array<{ url: string }>;
  [k: string]: unknown;
}

const DETAIL_TIMEOUT_MS = 5000;
const CONCURRENCY = 4;
// 크롤 시각 fallback 으로 채워졌을 가능성이 높은 임계값 (오늘 00:00 KST 이후)
const today = new Date();
today.setHours(0, 0, 0, 0);
const TODAY_THRESHOLD = today.toISOString();

function isGarbage(item: OutputItem): boolean {
  if (item.itemType !== "news") return false;
  const url = item.links?.[0]?.url ?? "";
  if (/articleList\.html/i.test(url)) return true;
  const title = item.title.trim();
  if (title.length < 5) return true;
  if (/^[0-9]+$/.test(title)) return true;
  if (/^(처음|마지막|이전|다음|prev|next|first|last)/i.test(title)) return true;
  return false;
}

async function fetchPublishedAt(url: string): Promise<string | undefined> {
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), DETAIL_TIMEOUT_MS);
    const res = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Accept: "text/html",
      },
      signal: ctrl.signal,
      redirect: "follow",
    });
    clearTimeout(timer);
    if (!res.ok) return undefined;
    const html = await res.text();
    return parsePublishedAtFromHtml(html);
  } catch {
    return undefined;
  }
}

async function runConcurrent<T>(items: T[], limit: number, worker: (item: T) => Promise<void>) {
  let cursor = 0;
  const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (cursor < items.length) {
      const idx = cursor++;
      try {
        await worker(items[idx]);
      } catch {
        // silent
      }
    }
  });
  await Promise.all(runners);
}

async function main() {
  if (!fs.existsSync(dataPath)) {
    console.error(`items.json not found: ${dataPath}`);
    process.exit(1);
  }
  const raw = fs.readFileSync(dataPath, "utf-8");
  const items = JSON.parse(raw) as OutputItem[];
  if (!Array.isArray(items)) {
    console.error("items.json is not an array");
    process.exit(1);
  }

  // 1. garbage 제거
  const garbage = items.filter(isGarbage);
  console.log(`garbage 제거: ${garbage.length}건`);
  for (const g of garbage) {
    console.log(`  - [${g.sourceName}] "${g.title}" → ${g.links?.[0]?.url ?? ""}`);
  }
  const cleaned = items.filter((it) => !isGarbage(it));

  // 2. 오늘 타임스탬프인 한국 뉴스 항목 = publishedAt fallback 의심
  const suspicious = cleaned.filter(
    (it) =>
      it.itemType === "news" &&
      typeof it.publishedAt === "string" &&
      it.publishedAt >= TODAY_THRESHOLD,
  );
  console.log(`publishedAt 의심 (오늘 크롤 시각으로 표기됨): ${suspicious.length}건`);

  // 3. 상세 페이지에서 fetch 해서 보정
  let fixed = 0;
  await runConcurrent(suspicious, CONCURRENCY, async (item) => {
    const url = item.links?.[0]?.url;
    if (!url) return;
    const dt = await fetchPublishedAt(url);
    if (dt && dt < item.publishedAt) {
      console.log(`  ✓ [${item.sourceName}] ${item.title.slice(0, 50)} : ${item.publishedAt.slice(0, 10)} → ${dt.slice(0, 10)}`);
      item.publishedAt = dt;
      fixed++;
    }
  });

  console.log(`\n완료: garbage ${garbage.length}건 제거, publishedAt ${fixed}/${suspicious.length}건 보정`);
  console.log(`저장 전 ${items.length}건 → 저장 후 ${cleaned.length}건`);

  fs.writeFileSync(dataPath, JSON.stringify(cleaned, null, 2), "utf-8");
  console.log(`✓ ${dataPath} 저장 완료`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
