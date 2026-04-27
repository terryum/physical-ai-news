import { RawItem } from "../types";
import {
  PHYSICAL_AI_DIRECT,
  ROBOT_AUTOMATION,
  MANUFACTURING,
  TIER_COMPANIES,
  PRODUCTION_QUALITY,
  GOV_SUPPORT,
  COSMETICS_MANUFACTURING,
  GYEONGGI_REGION,
  NON_RELEVANT_REGION,
  CONSUMER_AI_MARKETING,
  STOCK_IR,
  POLITICS_NOISE,
  T0_KEYWORDS,
  T1_KEYWORDS,
  K_HUMANOID,
  M_AX,
} from "./keywords";

export type Tier = "T0" | "T1" | "T2" | "T3";
export type Priority = "P0" | "P1" | "P2";

export interface ScoredItem extends RawItem {
  score: number;
  tier: Tier;
  priority: Priority;
  matchedKeywords: string[];
  relatedArticles?: { title: string; url: string; sourceId: string }[];
}

// 해외 트렌딩용 영어 키워드 (Tier 판별)
const T0_EN = [
  "humanoid",
  "embodied",
  "manipulation",
  "physical ai",
  "dexterous",
  "robot foundation",
  "vla ",
  "vision-language-action",
  "grasping",
];
const T1_EN = [
  "robot",
  "robotics",
  "llm",
  "agent",
  "rlhf",
  "vision-language",
  "foundation model",
  "diffusion policy",
  "autonomous",
];
const T2_EN = ["gpt", "claude", "gemini", "openai", "anthropic", "deepmind", "meta ai"];

/**
 * 해외 트렌딩 아이템 스코어링.
 * - 한국어 키워드 가중치 사용 안 함
 * - upstream popularity (HN points, Reddit ups) 기반 + 영어 키워드 tier 분류
 */
export function scoreTrendingItem(item: RawItem): ScoredItem {
  const text = `${item.title} ${item.description ?? ""}`.toLowerCase();
  const matchedKeywords: string[] = [];

  // upstream popularity → 점수 (0~50)
  const points = item.points ?? 0;
  let score = Math.min(50, Math.floor(points / 10));

  // 영어 키워드 보너스
  if (matchesAny(text, T0_EN)) {
    score += 30;
    matchedKeywords.push("physicalAI(en)");
  }
  if (matchesAny(text, T1_EN)) {
    score += 15;
    matchedKeywords.push("robotics/llm(en)");
  }

  let tier: Tier;
  if (matchesAny(text, T0_EN)) tier = "T0";
  else if (matchesAny(text, T1_EN)) tier = "T1";
  else if (matchesAny(text, T2_EN)) tier = "T2";
  else tier = "T3";

  // Priority: 점수 + tier 기반
  let priority: Priority;
  if (tier === "T0" && score >= 50) priority = "P0";
  else if ((tier === "T0" || tier === "T1") && score >= 25) priority = "P1";
  else priority = "P2";

  return {
    ...item,
    score,
    tier,
    priority,
    matchedKeywords,
  };
}

/**
 * RawItem에 대해 스코어링을 수행하고 Tier/Priority를 결정한다.
 */
export function scoreItem(item: RawItem): ScoredItem {
  const text = `${item.title} ${item.description ?? ""}`.toLowerCase();
  let score = 0;
  const matchedKeywords: string[] = [];

  // +30: 제조 피지컬AI 직접 언급
  if (matchesAny(text, PHYSICAL_AI_DIRECT)) {
    score += 30;
    matchedKeywords.push("피지컬AI직접");
  }

  // +20: (로봇 OR 자동화) AND 제조 동시
  if (matchesAny(text, ROBOT_AUTOMATION) && matchesAny(text, MANUFACTURING)) {
    score += 20;
    matchedKeywords.push("로봇+제조");
  }

  // +20: T2/T3 기업 AND (생산/품질/설비/물류/공장)
  if (matchesAny(text, TIER_COMPANIES) && matchesAny(text, PRODUCTION_QUALITY)) {
    score += 20;
    matchedKeywords.push("기업+생산");
  }

  // +25: 정부 실증/보급/지원/국책과제
  if (matchesAny(text, GOV_SUPPORT)) {
    score += 25;
    matchedKeywords.push("정부지원");
  }

  // +30: K-휴머노이드 컨소시엄 (코스맥스 가입사) — P0 도달 보장
  if (matchesAny(text, K_HUMANOID)) {
    score += 30;
    matchedKeywords.push("K휴머노이드");
  }

  // +30: KIRIA M.AX 시리즈 (서비스/제조 로봇 AX 실증) — 코스맥스 우선 모니터링
  if (matchesAny(text, M_AX)) {
    score += 30;
    matchedKeywords.push("M.AX");
  }

  // +15: 화장품 제조 키워드
  if (matchesAny(text, COSMETICS_MANUFACTURING)) {
    score += 15;
    matchedKeywords.push("화장품제조");
  }

  // +10: 경기도 지역
  if (matchesAny(text, GYEONGGI_REGION) || item.region?.includes("경기")) {
    score += 10;
    matchedKeywords.push("경기도");
  }

  // -20: 소비자용 AI / 마케팅
  if (matchesAny(text, CONSUMER_AI_MARKETING)) {
    score -= 20;
    matchedKeywords.push("소비자AI(감점)");
  }

  // -15: 주가/공시/IR 단독
  if (matchesAny(text, STOCK_IR) && !matchesAny(text, MANUFACTURING)) {
    score -= 15;
    matchedKeywords.push("주가IR(감점)");
  }

  // -30: 비관련 지역 (대구, 경북, 부산 등)
  if (matchesAny(text, NON_RELEVANT_REGION) && !matchesAny(text, GYEONGGI_REGION)) {
    score -= 30;
    matchedKeywords.push("비관련지역(감점)");
  }

  // -25: 정치/정책 뉴스 (피지컬AI 언급하지만 실질적 제조 내용 아님)
  if (matchesAny(text, POLITICS_NOISE) && !matchesAny(text, COSMETICS_MANUFACTURING)) {
    score -= 25;
    matchedKeywords.push("정치노이즈(감점)");
  }

  const tier = determineTier(text, score);
  const priority = determinePriority(tier, score);

  return {
    ...item,
    score,
    tier,
    priority,
    matchedKeywords,
  };
}

/** Tier 분류 */
function determineTier(text: string, score: number): Tier {
  // T0: 제조 피지컬AI 직접 관련
  if (matchesAny(text, T0_KEYWORDS)) return "T0";

  // T1: 스마트팩토리/제조자동화 넓은 범위
  if (matchesAny(text, T1_KEYWORDS)) return "T1";

  // T2: 점수가 양수이고 제조/로봇 키워드 포함
  if (score > 0 && (matchesAny(text, MANUFACTURING) || matchesAny(text, ROBOT_AUTOMATION))) {
    return "T2";
  }

  // T3: 나머지
  return "T3";
}

/** Priority 분류 — 한국 짧은 뉴스 제목 특성상 한두 버킷만 hit 하는 경우가 많아 임계값 한 단계 낮춤 (2026-04-27) */
function determinePriority(tier: Tier, score: number): Priority {
  // P0 (필독): T0 면 피지컬AI 직접 언급(+30) 한 건만으로도 도달, T1 은 두 버킷 매칭
  if (tier === "T0" && score >= 30) return "P0";
  if (tier === "T1" && score >= 40) return "P0";

  // P1 (참고): 관련성 있는 것들
  if ((tier === "T0" || tier === "T1") && score >= 20) return "P1";
  if (tier === "T2" && score >= 30) return "P1";

  // P2 (관찰): 나머지
  return "P2";
}

/** 텍스트에 키워드 목록 중 하나라도 포함되는지 확인 */
function matchesAny(text: string, keywords: string[]): boolean {
  return keywords.some((kw) => text.includes(kw.toLowerCase()));
}

/** 여러 아이템을 일괄 스코어링.
 * trendingSourceIds가 주어지면 해당 sourceId 항목은 trending 룰셋을 사용한다.
 */
export function scoreItems(
  items: RawItem[],
  trendingSourceIds?: Set<string>,
): ScoredItem[] {
  if (!trendingSourceIds || trendingSourceIds.size === 0) {
    return items.map(scoreItem);
  }
  return items.map((item) =>
    trendingSourceIds.has(item.sourceId)
      ? scoreTrendingItem(item)
      : scoreItem(item),
  );
}
