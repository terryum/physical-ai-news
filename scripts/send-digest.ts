import "./_proxy-bootstrap";
import fs from "node:fs";
import path from "node:path";
import type { Item } from "../src/data/types";
import { buildDigestSections } from "../worker/digest/filter";
import { SubstackClient } from "../worker/digest/substack-client";
import { buildSubstackPost } from "../worker/digest/substack-body";
import type { DigestData } from "../worker/digest/types";

const DAYS_KO = ["일", "월", "화", "수", "목", "금", "토"] as const;
const DASHBOARD_URL = "https://physical-ai-news.terryum.ai";
const SENT_LOG_PATH = path.resolve("public/data/digest-sent.json");
const PREVIEW_PATH = path.resolve("digest-preview.json");

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

function resolveSubdomain(): string {
  const override = process.env.SUBSTACK_SUBDOMAIN;
  if (override) return override;
  const url = process.env.NEXT_PUBLIC_SUBSTACK_URL;
  if (!url) {
    throw new Error(
      "SUBSTACK_SUBDOMAIN 또는 NEXT_PUBLIC_SUBSTACK_URL 환경변수가 필요합니다.",
    );
  }
  const host = new URL(url).hostname;
  return host.split(".")[0];
}

async function main() {
  const args = process.argv.slice(2);
  const isDryRun = args.includes("--dry-run");
  const isPreview = args.includes("--preview");
  const noEmail = args.includes("--no-email") || process.env.SUBSTACK_SEND_EMAIL === "false";

  const now = new Date();
  console.log(`[digest] Running at ${now.toISOString()}`);

  const items = loadItems();
  const lastSentIds = loadLastSentIds();
  console.log(
    `[digest] Loaded ${items.length} items, ${lastSentIds.size} previously sent`,
  );

  const data = buildDigestData(items, now, lastSentIds);

  if (isDryRun) {
    for (const section of data.sections) {
      console.log(`\n=== ${section.title} (${section.items.length}) ===`);
      for (const item of section.items) {
        const deadline = item.deadlineAt ? ` [마감: ${item.deadlineAt}]` : "";
        const fresh = lastSentIds.has(item.id) ? " (어제 발송)" : " (신규)";
        const title = item.titleKo ?? item.title;
        console.log(`  - ${title}${deadline}${fresh}`);
      }
    }
    if (data.isEmpty) {
      console.log("\n[digest] No items. Skipping.");
    }
    return;
  }

  if (data.isEmpty) {
    console.log("[digest] No items to send. Skipping Substack publish.");
    return;
  }

  const post = buildSubstackPost(data, now);

  if (isPreview) {
    fs.writeFileSync(
      PREVIEW_PATH,
      JSON.stringify(
        { title: post.title, subtitle: post.subtitle, body: JSON.parse(post.bodyJson) },
        null,
        2,
      ),
      "utf-8",
    );
    console.log(`[digest] Preview written to ${PREVIEW_PATH}`);
    console.log(`[digest] Title: ${post.title}`);
    console.log(`[digest] Subtitle: ${post.subtitle}`);
    return;
  }

  const cookie = process.env.SUBSTACK_COOKIE;
  if (!cookie) {
    throw new Error("SUBSTACK_COOKIE 환경변수가 필요합니다.");
  }
  const subdomain = resolveSubdomain();

  console.log(`[digest] Publishing to ${subdomain}.substack.com (sendEmail=${!noEmail})`);
  console.log(`[digest] Title: ${post.title}`);

  const client = new SubstackClient(cookie);
  const profile = await client.authenticate();
  console.log(`[digest] Auth OK (user: ${profile.name}, id: ${profile.id})`);

  const result = await client.publish({
    subdomain,
    title: post.title,
    subtitle: post.subtitle,
    bodyJson: post.bodyJson,
    sendEmail: !noEmail,
  });
  console.log(`[digest] Published: ${result.url}`);

  saveLastSentIds(data.sections);
  console.log("[digest] Sent IDs saved for dedup.");
  console.log("[digest] Done.");
}

main().catch((err) => {
  console.error("[digest] Error:", err.message);
  process.exit(1);
});
