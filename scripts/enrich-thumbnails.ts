/**
 * 일회성 스크립트: public/data/items.json 의 트렌딩 항목에 대해
 * og:image fetch 만 돌려 thumbnailUrl 을 채운다.
 *
 * 새 OG 파이프라인을 처음 도입했을 때 기존 데이터에 대해 한 번만 실행.
 * 일상적인 동작은 worker/crawl.ts 가 다음 크롤 때 자동으로 처리한다.
 *
 * 실행: npx tsx scripts/enrich-thumbnails.ts
 */
import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import { enrichTrendingThumbnails } from "../worker/pipeline/og-image";

const __dirnameCompat =
  typeof __dirname !== "undefined" ? __dirname : path.dirname(fileURLToPath(import.meta.url));

const root = path.resolve(__dirnameCompat, "..");
const dataPath = path.join(root, "public", "data", "items.json");

interface OutputItem {
  id: string;
  itemType: "gov" | "news" | "trending";
  thumbnailUrl?: string;
  links: Array<{ url: string }>;
  [k: string]: unknown;
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

  const trendingTotal = items.filter((i) => i.itemType === "trending").length;
  const haveThumb = items.filter(
    (i) => i.itemType === "trending" && i.thumbnailUrl,
  ).length;
  console.log(
    `시작: 트렌딩 ${trendingTotal}건 (이미 thumbnail 있음 ${haveThumb}건)`,
  );

  const enriched = await enrichTrendingThumbnails(items, new Map());
  const enrichedHaveThumb = enriched.filter(
    (i) => i.itemType === "trending" && i.thumbnailUrl,
  ).length;
  console.log(
    `완료: thumbnail 보유 ${haveThumb} → ${enrichedHaveThumb}건 (+${enrichedHaveThumb - haveThumb})`,
  );

  fs.writeFileSync(dataPath, JSON.stringify(enriched, null, 2), "utf-8");
  console.log(`✓ ${dataPath} 저장 완료`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
