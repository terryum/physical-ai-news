export type SourceType = "gov" | "news";
export type Tier = "T0" | "T1" | "T2" | "T3";
export type Priority = "P0" | "P1" | "P2";
export type LinkKind = "canonical" | "mirror" | "apply" | "related";

export interface ItemLink {
  label: string;
  url: string;
  kind: LinkKind;
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
  read: boolean;
  starred: boolean;
}

export type SortBy = "latest" | "deadline";

export interface Filters {
  itemType: SourceType;
  priorities: Priority[];
  tiers: Tier[];
  dateRange: "today" | "7d" | "30d" | "all";
  search: string;
  sortBy: SortBy;
}

export const DEFAULT_FILTERS: Filters = {
  itemType: "gov",
  priorities: ["P0", "P1"],
  tiers: ["T0", "T1", "T2", "T3"],
  dateRange: "30d",
  search: "",
  sortBy: "latest",
};
