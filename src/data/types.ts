export type SourceType = "gov" | "news" | "trending";
export type Tier = "T0" | "T1" | "T2" | "T3";
export type Priority = "P0" | "P1" | "P2";
export type LinkKind = "canonical" | "mirror" | "apply" | "related";

export interface ItemLink {
  label: string;
  url: string;
  kind: LinkKind;
}

export interface RelatedArticle {
  title: string;
  url: string;
  sourceName: string;
}

export interface Item {
  id: string;
  itemType: SourceType;
  title: string;
  publishedAt: string; // ISO
  deadlineAt?: string;
  budgetKrwOk?: number; // 억원
  sourceName: string;
  tier: Tier;
  priority: Priority;
  score: number;
  matchedKeywords: string[];
  matchedCompanies: string[];
  region?: string;
  status?: "open" | "upcoming" | "closed";
  links: ItemLink[];
  relatedArticles?: RelatedArticle[];
  read: boolean;
  starred: boolean;
  // Trending-only metadata
  points?: number;
  commentCount?: number;
  lang?: "ko" | "en";
  titleKo?: string; // 트렌딩 한국어 번역 캐시
}

export type SortBy = "latest" | "deadline" | "popular";

export const COMPANY_FILTERS = ["코스맥스", "콜마", "아모레퍼시픽", "LG생건"] as const;
export type CompanyFilter = (typeof COMPANY_FILTERS)[number];

export interface Filters {
  itemType: SourceType;
  priorities: Priority[];
  tiers: Tier[];
  dateRange: "today" | "7d" | "30d" | "all";
  search: string;
  sortBy: SortBy;
  companies: CompanyFilter[];
  includeExpired: boolean;
  trendingLang: "ko" | "en";
}

export const DEFAULT_FILTERS: Filters = {
  itemType: "gov",
  priorities: ["P0", "P1"],
  tiers: ["T0", "T1", "T2", "T3"],
  dateRange: "all",
  search: "",
  sortBy: "latest",
  companies: [],
  includeExpired: false,
  trendingLang: "ko",
};
