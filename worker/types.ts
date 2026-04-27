export interface RawItem {
  sourceId: string;
  title: string;
  url: string;
  publishedAt?: string;
  deadlineAt?: string;
  budgetKrwOk?: number;
  region?: string;
  description?: string;
  agency?: string; // 기관명
  // Trending-only
  points?: number;
  commentCount?: number;
  lang?: "ko" | "en";
  titleKo?: string;
  thumbnailUrl?: string;
}

export interface SourceConfig {
  id: string;
  name: string;
  type: "gov" | "news" | "trending";
  group: "A" | "B" | "C" | "D" | "E" | "F" | "G";
  authority: "canonical" | "discovery";
  phase: "fast" | "slow";
  url: string;
  enabled: boolean;
  [key: string]: unknown;
}
