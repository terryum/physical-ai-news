import fs from "node:fs";
import path from "node:path";
import type { Item } from "../src/data/types";
import { buildDigestSections } from "../worker/digest/filter";
import { renderDigestHtml, buildSubject } from "../worker/digest/render";
import { sendDigest } from "../worker/digest/transport";
import type { DigestData } from "../worker/digest/types";

const DAYS_KO = ["일", "월", "화", "수", "목", "금", "토"] as const;
const DASHBOARD_URL = "https://physical-ai-news.terryum.ai";
const SENT_LOG_PATH = path.resolve("public/data/digest-sent.json");

// --- 발송 이력 관리 ---

function loadLastSentIds(): Set<string> {
  try {
    if (!fs.existsSync(SENT_LOG_PATH)) return new Set();
    const raw = JSON.parse(fs.readFileSync(SENT_LOG_PATH, "utf-8"));
    return new Set<string>(raw.ids ?? []);
  } catch {
    return new Set();
  }
}

function saveLastSentIds(sections: DigestData["sections"]): void {
  const ids = sections.flatMap((s) => s.items.map((i) => i.id));
  fs.writeFileSync(
    SENT_LOG_PATH,
    JSON.stringify({ sentAt: new Date().toISOString(), ids }, null, 2),
    "utf-8",
  );
}

// --- 데이터 로딩 ---

function loadItems(): Item[] {
  const itemsPath = path.resolve("public/data/items.json");
  if (!fs.existsSync(itemsPath)) {
    throw new Error(`items.json not found at ${itemsPath}`);
  }
  const raw = fs.readFileSync(itemsPath, "utf-8");
  return JSON.parse(raw) as Item[];
}

function buildDigestData(
  items: Item[],
  now: Date,
  lastSentIds: Set<string>,
): DigestData {
  const sections = buildDigestSections(items, now, lastSentIds);
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");

  return {
    date: `${y}.${m}.${d}`,
    dayOfWeek: DAYS_KO[now.getDay()],
    sections,
    isEmpty: sections.every((s) => s.items.length === 0),
    dashboardUrl: DASHBOARD_URL,
  };
}

async function main() {
  const args = process.argv.slice(2);
  const isDryRun = args.includes("--dry-run");
  const isPreview = args.includes("--preview");
  const toIndex = args.indexOf("--to");
  const toOverride = toIndex !== -1 ? args[toIndex + 1] : undefined;

  const now = new Date();
  console.log(`[digest] Running at ${now.toISOString()}`);

  // Load items + last sent history
  const items = loadItems();
  const lastSentIds = loadLastSentIds();
  console.log(`[digest] Loaded ${items.length} items, ${lastSentIds.size} previously sent`);

  // Build digest data
  const data = buildDigestData(items, now, lastSentIds);

  // Dry run: print filter results
  if (isDryRun) {
    for (const section of data.sections) {
      console.log(`\n=== ${section.title} (${section.items.length}) ===`);
      for (const item of section.items) {
        const deadline = item.deadlineAt ? ` [마감: ${item.deadlineAt}]` : "";
        const fresh = lastSentIds.has(item.id) ? " (어제 발송)" : " (신규)";
        console.log(`  - ${item.title}${deadline}${fresh}`);
      }
    }
    if (data.isEmpty) {
      console.log("\n[digest] No items to send. Skipping.");
    }
    return;
  }

  // Check if empty
  if (data.isEmpty) {
    console.log("[digest] No items to send. Skipping email.");
    return;
  }

  // Render HTML
  const html = renderDigestHtml(data, now);
  const subject = buildSubject(data);

  // Preview: write HTML to file
  if (isPreview) {
    const previewPath = path.resolve("digest-preview.html");
    fs.writeFileSync(previewPath, html, "utf-8");
    console.log(`[digest] Preview written to ${previewPath}`);
    console.log(`[digest] Subject: ${subject}`);
    return;
  }

  // Send email
  const recipient = toOverride || process.env.DIGEST_RECIPIENT;
  if (!recipient) {
    throw new Error(
      "No recipient specified. Use --to <email> or set DIGEST_RECIPIENT env var.",
    );
  }

  console.log(`[digest] Sending to ${recipient}...`);
  console.log(`[digest] Subject: ${subject}`);
  await sendDigest({ to: recipient, subject, html });

  // Save sent IDs for tomorrow's dedup
  saveLastSentIds(data.sections);
  console.log("[digest] Sent IDs saved for dedup.");
  console.log("[digest] Done.");
}

main().catch((err) => {
  console.error("[digest] Error:", err.message);
  process.exit(1);
});
