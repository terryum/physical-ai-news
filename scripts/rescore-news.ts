/**
 * 일회성 스크립트: P0/P1 임계값을 낮춘 후 기존 items.json 의 priority 를 재계산.
 *
 * 실행: npx tsx scripts/rescore-news.ts
 */
import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import { scoreItem } from "../worker/pipeline/scorer";
import type { RawItem } from "../worker/types";

const __dirnameCompat =
  typeof __dirname !== "undefined" ? __dirname : path.dirname(fileURLToPath(import.meta.url));

const root = path.resolve(__dirnameCompat, "..");
const dataPath = path.join(root, "public", "data", "items.json");

interface OutputItem {
  id: string;
  itemType: "gov" | "news" | "trending";
  title: string;
  publishedAt: string;
  sourceName: string;
  tier: string;
  priority: string;
  score: number;
  matchedKeywords: string[];
  region?: string;
  links: Array<{ url: string }>;
  [k: string]: unknown;
}

const raw = fs.readFileSync(dataPath, "utf-8");
const items = JSON.parse(raw) as OutputItem[];

let changed = 0;
const before = { P0: 0, P1: 0, P2: 0 } as Record<string, number>;
const after = { P0: 0, P1: 0, P2: 0 } as Record<string, number>;

for (const item of items) {
  // 트렌딩은 별도 룰셋 — 건드리지 않음
  if (item.itemType === "trending") continue;

  before[item.priority] = (before[item.priority] ?? 0) + 1;

  const rescored = scoreItem({
    sourceId: item.sourceName,
    title: item.title,
    url: item.links?.[0]?.url ?? "",
    region: item.region,
  } as RawItem);

  if (rescored.priority !== item.priority || rescored.tier !== item.tier) {
    changed++;
  }
  item.priority = rescored.priority;
  item.tier = rescored.tier;
  item.score = rescored.score;
  item.matchedKeywords = rescored.matchedKeywords;

  after[item.priority] = (after[item.priority] ?? 0) + 1;
}

console.log(`재스코어링: ${changed}건 priority/tier 변경`);
console.log(`Before:`, before);
console.log(`After: `, after);

fs.writeFileSync(dataPath, JSON.stringify(items, null, 2), "utf-8");
console.log(`✓ ${dataPath} 저장 완료`);
