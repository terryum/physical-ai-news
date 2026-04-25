import type { Item } from "../../src/data/types";
import { dDay, formatDate, getCanonicalUrl } from "./format";
import type { DigestData, DigestSection } from "./types";

export interface SubstackPost {
  title: string;
  subtitle: string;
  bodyJson: string;
}

type ProseNode = Record<string, unknown>;

type LinkMark = {
  type: "link";
  attrs: { href: string; target: string; rel: string; class: null };
};

type EmMark = { type: "em" };
type StrongMark = { type: "strong" };

function textNode(text: string, marks?: Array<LinkMark | EmMark | StrongMark>): ProseNode {
  const node: ProseNode = { type: "text", text };
  if (marks && marks.length > 0) node.marks = marks;
  return node;
}

function linkMark(href: string): LinkMark {
  return {
    type: "link",
    attrs: {
      href,
      target: "_blank",
      rel: "noopener noreferrer nofollow",
      class: null,
    },
  };
}

function paragraph(content: ProseNode[] = [], attrs?: Record<string, unknown>): ProseNode {
  const node: ProseNode = { type: "paragraph", content };
  if (attrs) node.attrs = attrs;
  return node;
}

function heading(text: string, level = 2): ProseNode {
  return {
    type: "heading",
    attrs: { level },
    content: [textNode(text)],
  };
}

function hardBreak(): ProseNode {
  return { type: "hard_break" };
}

function govRow(item: Item): ProseNode {
  const url = getCanonicalUrl(item);
  const meta = `${item.sourceName} · ${formatDate(item.publishedAt)}${
    item.budgetKrwOk ? ` · ${item.budgetKrwOk}억원` : ""
  }`;
  return paragraph([
    textNode(item.title, [linkMark(url)]),
    hardBreak(),
    textNode(meta, [{ type: "em" }]),
  ]);
}

function deadlineRow(item: Item, now: Date): ProseNode {
  const url = getCanonicalUrl(item);
  const badge = item.deadlineAt ? `[${dDay(item.deadlineAt, now)}] ` : "";
  const deadlineText = item.deadlineAt ? `마감: ${formatDate(item.deadlineAt)}` : "";
  const content: ProseNode[] = [];
  if (badge) content.push(textNode(badge, [{ type: "strong" }]));
  content.push(textNode(item.title, [linkMark(url)]));
  if (deadlineText) {
    content.push(hardBreak(), textNode(deadlineText, [{ type: "em" }]));
  }
  return paragraph(content);
}

function newsRow(item: Item): ProseNode {
  const url = getCanonicalUrl(item);
  return paragraph([
    textNode(item.title, [linkMark(url)]),
    hardBreak(),
    textNode(item.sourceName, [{ type: "em" }]),
  ]);
}

function trendingRow(item: Item): ProseNode {
  const url = getCanonicalUrl(item);
  const meta: string[] = [item.sourceName];
  if (item.points) meta.push(`▲ ${item.points}`);
  if (item.commentCount) meta.push(`💬 ${item.commentCount}`);
  return paragraph([
    textNode(item.title, [linkMark(url)]),
    hardBreak(),
    textNode(meta.join(" · "), [{ type: "em" }]),
  ]);
}

function relatedRow(title: string, url: string): ProseNode {
  return paragraph([
    textNode("└ ", [{ type: "em" }]),
    textNode(title, [linkMark(url), { type: "em" }]),
  ]);
}

function sectionNodes(section: DigestSection, now: Date, isDeadline: boolean): ProseNode[] {
  if (section.items.length === 0) return [];
  const nodes: ProseNode[] = [
    heading(`${section.title} (${section.items.length})`, 2),
  ];
  for (const item of section.items) {
    if (isDeadline) {
      nodes.push(deadlineRow(item, now));
    } else if (item.itemType === "gov") {
      nodes.push(govRow(item));
    } else if (item.itemType === "trending") {
      nodes.push(trendingRow(item));
    } else {
      nodes.push(newsRow(item));
      if (item.relatedArticles && item.relatedArticles.length > 0) {
        for (const ra of item.relatedArticles) {
          nodes.push(relatedRow(ra.title, ra.url));
        }
      }
    }
  }
  nodes.push(paragraph());
  return nodes;
}

function ctaNodes(dashboardUrl: string): ProseNode[] {
  return [
    paragraph(),
    paragraph(
      [textNode("더 많은 소식 보기 →", [linkMark(dashboardUrl)])],
      { textAlign: "center" },
    ),
    paragraph(),
    paragraph(),
  ];
}

function stripSourceTag(title: string): string {
  // 선행 소스 태그 ([더벨], 【SPECIAL&ISSUE】, [경기] 등) 제거.
  return title.replace(/^[\[【][^\]】]{1,15}[\]】]\s*/, "").trim();
}

function shortenTitle(title: string, maxLen = 18): string {
  const t = stripSourceTag(title);
  if (t.length <= maxLen) return t;
  return `${t.slice(0, maxLen).trimEnd()}…`;
}

function formatYymmdd(now: Date): string {
  const yy = String(now.getFullYear()).slice(-2);
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  return `${yy}${mm}${dd}`;
}

function pickHeadlineAndRest(sections: DigestSection[]): {
  headline: Item | null;
  rest: Item[];
} {
  // 우선순위: 뉴스 → 마감 임박 → 신규 공고. 첫 항목이 헤드라인, 나머지는 rest.
  const ordered = [
    ...(sections[2]?.items ?? []),
    ...(sections[1]?.items ?? []),
    ...(sections[0]?.items ?? []),
  ];
  return { headline: ordered[0] ?? null, rest: ordered.slice(1) };
}

function buildSubtitle(rest: Item[]): string {
  const top = rest.slice(0, 3);
  if (top.length === 0) return "오늘은 주요 항목이 없습니다";
  return top.map((i) => shortenTitle(i.title, 32)).join(", ");
}

function leadParagraph(rest: Item[]): ProseNode | null {
  // 타임라인 카드 + 이메일 본문 맨 위에 노출되는 주요 소식 목록.
  // 헤드라인은 제목에 이미 있으므로 제외. 한 문단 안에서 자연 래핑되도록
  // ` · ` 구분자로 연결 (hard_break 은 카드에서 잘림).
  const top = rest.slice(0, 3);
  if (top.length === 0) return null;
  const summary = top.map((i) => shortenTitle(i.title, 40)).join(" | ");
  return paragraph([textNode(summary, [{ type: "em" }])]);
}

export function buildSubstackPost(data: DigestData, now: Date = new Date()): SubstackPost {
  const { headline, rest } = pickHeadlineAndRest(data.sections);

  const content: ProseNode[] = [];
  const lead = leadParagraph(rest);
  if (lead) {
    content.push(lead);
    content.push(paragraph());
  }
  data.sections.forEach((section, i) => {
    content.push(...sectionNodes(section, now, i === 1));
  });
  content.push(...ctaNodes(data.dashboardUrl));

  const yymmdd = formatYymmdd(now);
  const title = headline
    ? `${yymmdd} ${stripSourceTag(headline.title)}`
    : `${yymmdd} 일일 클리핑`;
  const subtitle = buildSubtitle(rest);
  const bodyJson = JSON.stringify({ type: "doc", content });
  return { title, subtitle, bodyJson };
}
