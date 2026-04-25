import { ScoredItem } from "./scorer";
import { normalizeTitle, normalizeUrl } from "./normalize";

/**
 * 중복 제거 (3단계)
 * 1. 정규화된 제목 완전 일치 → 병합
 * 2. 핵심 주어+키워드 동일 → 유사 기사 그루핑 (같은 사건/인물)
 * 3. URL 도메인 동일 → 병합
 */
export function dedup(items: ScoredItem[]): ScoredItem[] {
  // 1단계: 정규화된 제목으로 그룹핑 (완전 일치)
  const titleGroups = new Map<string, ScoredItem[]>();

  for (const item of items) {
    const key = normalizeTitle(item.title);
    if (!key) continue;
    const existing = titleGroups.get(key);
    if (existing) {
      existing.push(item);
    } else {
      titleGroups.set(key, [item]);
    }
  }

  // 완전 일치 병합
  const afterExact: ScoredItem[] = [];
  for (const [, group] of titleGroups) {
    afterExact.push(mergeGroup(group));
  }

  // 2단계: 유사 기사 그루핑 (핵심어 기반)
  // 같은 주체(인물/회사) + 같은 토픽의 기사들을 하나로 묶음
  const afterSimilar = groupSimilarArticles(afterExact);

  // 3단계: URL 중복 제거 (relatedArticles 보존)
  // 도메인-only URL(파서가 ID 추출에 실패한 케이스)은 제목으로 키를 분리해
  // 멀쩡한 항목들이 한 건으로 압축되는 사고를 방지한다.
  const urlMap = new Map<string, ScoredItem>();
  for (const item of afterSimilar) {
    const nUrl = normalizeUrl(item.url);
    const key = isDomainOnlyUrl(nUrl)
      ? `${nUrl}#${normalizeTitle(item.title)}`
      : nUrl;
    const existing = urlMap.get(key);
    if (!existing || item.score > existing.score) {
      if (existing && item.score > existing.score && existing.relatedArticles?.length) {
        item.relatedArticles = item.relatedArticles ?? [];
        for (const ra of existing.relatedArticles) {
          if (item.relatedArticles.length < 2) {
            item.relatedArticles.push(ra);
          }
        }
      }
      urlMap.set(key, item);
    }
  }

  return Array.from(urlMap.values());
}

function isDomainOnlyUrl(url: string): boolean {
  try {
    const u = new URL(url);
    return (u.pathname === "/" || u.pathname === "") && !u.search;
  } catch {
    return false;
  }
}

/**
 * 유사 기사 그루핑 + 크로스소스 부스트.
 * 같은 entity 또는 같은 fingerprint를 공유하면 한 그룹으로 묶고,
 * 그룹 내 서로 다른 sourceId 수가 N개일 때 (N-1) × CROSS_SOURCE_BOOST 점수를 가산한다.
 */
const CROSS_SOURCE_BOOST = 15;

const ENTITY_PATTERNS = [
  // 한국 — 인물/기업
  "정의선", "현대차", "현대자동차",
  "엔비디아", "nvidia", "젠슨황",
  "삼성전자", "LG전자", "SK",
  "테슬라", "tesla", "일론머스크",
  "보스턴다이나믹스", "boston dynamics", "figure", "1x", "unitree",
  "코스맥스", "한국콜마", "아모레퍼시픽", "LG생활건강", "코스메카",
  "구글", "google", "딥마인드", "deepmind",
  "오픈ai", "openai", "앤쓰로픽", "anthropic",
  // 글로벌 AI — 모델/제품/연구자
  "gpt-5", "gpt-4", "claude", "gemini", "llama", "deepseek", "qwen",
  "mistral", "grok",
  "rt-2", "rt-x", "vla", "octo", "pi-zero", "π0",
  "perplexity", "cursor", "devin",
  "karpathy", "lecun", "sutton", "hinton",
  "humanoid", "manipulation", "embodied",
];

function groupSimilarArticles(items: ScoredItem[]): ScoredItem[] {
  const groupMap = new Map<string, ScoredItem[]>();
  const ungrouped: ScoredItem[] = [];

  for (const item of items) {
    const titleLower = item.title.toLowerCase();
    const entities = ENTITY_PATTERNS.filter((e) =>
      titleLower.includes(e.toLowerCase()),
    );

    let key: string | undefined;
    const dateKey = item.publishedAt ? item.publishedAt.slice(0, 10) : "nodate";

    if (entities.length > 0) {
      key = `entity:${entities[0].toLowerCase()}:${dateKey}`;
    } else {
      // entity가 없으면 제목 fingerprint로 매칭 (같은 논문/사건이 여러 소스에 등장하는 경우)
      const fp = titleFingerprint(item.title);
      if (fp) key = `fp:${fp}`;
    }

    if (key) {
      const existing = groupMap.get(key);
      if (existing) existing.push(item);
      else groupMap.set(key, [item]);
    } else {
      ungrouped.push(item);
    }
  }

  const result: ScoredItem[] = [...ungrouped];
  for (const [, group] of groupMap) {
    result.push(mergeGroup(group));
  }

  return result;
}

/**
 * 제목 핵심구 fingerprint — 같은 논문/사건이 여러 소스에 나올 때 매칭용.
 * 정규화된 제목의 처음 의미 있는 4단어를 합친다 (불용어/태그 제외).
 */
const STOPWORDS = new Set([
  "a", "an", "the", "is", "are", "was", "were", "be", "been", "and", "or",
  "of", "to", "in", "on", "for", "with", "by", "from", "at", "as", "this",
  "that", "via", "using", "new", "show", "hn", "shows", "we", "our",
]);

function titleFingerprint(title: string): string | null {
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

/**
 * 같은 그룹의 아이템을 하나로 병합 — 점수 최고 기준 + 크로스소스 부스트 가산.
 * 그룹 내 서로 다른 sourceId 수가 1보다 크면 (uniqSources - 1) × BOOST를 score에 더한다.
 */
function mergeGroup(group: ScoredItem[]): ScoredItem {
  if (group.length === 1) return group[0];

  group.sort((a, b) => b.score - a.score);
  const parent = { ...group[0] };
  const related: { title: string; url: string; sourceId: string }[] = [];
  const sourceIds = new Set<string>([parent.sourceId]);

  for (let i = 1; i < group.length; i++) {
    const child = group[i];
    sourceIds.add(child.sourceId);
    if (!parent.publishedAt && child.publishedAt) parent.publishedAt = child.publishedAt;
    if (!parent.budgetKrwOk && child.budgetKrwOk) parent.budgetKrwOk = child.budgetKrwOk;
    if (!parent.deadlineAt && child.deadlineAt) parent.deadlineAt = child.deadlineAt;
    if (!parent.description && child.description) parent.description = child.description;
    if (!parent.region && child.region) parent.region = child.region;
    if (!parent.points && child.points) parent.points = child.points;
    if (!parent.commentCount && child.commentCount) parent.commentCount = child.commentCount;
    const childKeywords = child.matchedKeywords ?? [];
    for (const kw of childKeywords) {
      if (!parent.matchedKeywords.includes(kw)) parent.matchedKeywords.push(kw);
    }
    if (related.length < 2 && child.url !== parent.url) {
      related.push({ title: child.title, url: child.url, sourceId: child.sourceId });
    }
  }

  if (related.length > 0) parent.relatedArticles = related;

  if (sourceIds.size > 1) {
    parent.score += (sourceIds.size - 1) * CROSS_SOURCE_BOOST;
    parent.matchedKeywords.push(`크로스소스+${sourceIds.size}`);
  }

  return parent;
}
