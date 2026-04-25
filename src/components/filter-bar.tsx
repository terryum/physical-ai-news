"use client";

import { Input } from "@/components/ui/input";
import type { Filters, SourceType, Priority, Tier, SortBy, CompanyFilter } from "@/data/types";
import { COMPANY_FILTERS } from "@/data/types";

const priorityLabel: Record<string, string> = {
  P0: "필독",
  P1: "참고",
  P2: "관찰",
};

const tierLabel: Record<string, string> = {
  T0: "피지컬AI",
  T1: "스마트제조",
  T2: "ODM경쟁사",
  T3: "브랜드사",
};

interface FilterBarProps {
  filters: Filters;
  onChange: (filters: Filters) => void;
  counts: { total: number; gov: number; news: number; trending: number };
  trendingLang?: "ko" | "en";
  onTrendingLangChange?: (lang: "ko" | "en") => void;
}

function Chip({
  selected,
  onClick,
  children,
}: {
  selected: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center justify-center rounded-md px-3 py-1 text-xs font-medium transition-colors cursor-pointer ${
        selected
          ? "bg-primary text-primary-foreground shadow-sm"
          : "bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground"
      }`}
    >
      {children}
    </button>
  );
}

export function FilterBar({
  filters,
  onChange,
  counts,
  trendingLang = "ko",
  onTrendingLangChange,
}: FilterBarProps) {
  const togglePriority = (p: Priority) => {
    const next = filters.priorities.includes(p)
      ? filters.priorities.filter((x) => x !== p)
      : [...filters.priorities, p];
    onChange({ ...filters, priorities: next });
  };

  const toggleTier = (t: Tier) => {
    const next = filters.tiers.includes(t)
      ? filters.tiers.filter((x) => x !== t)
      : [...filters.tiers, t];
    onChange({ ...filters, tiers: next });
  };

  const toggleCompany = (c: CompanyFilter) => {
    const next = filters.companies.includes(c)
      ? filters.companies.filter((x) => x !== c)
      : [...filters.companies, c];
    onChange({ ...filters, companies: next });
  };

  return (
    <div className="space-y-3 rounded-lg border bg-card p-4">
      {/* Row 1: Type + Sort + Search */}
      <div className="flex flex-wrap items-center gap-2">
        <Chip
          selected={filters.itemType === "gov"}
          onClick={() => onChange({ ...filters, itemType: "gov" })}
        >
          공고 ({counts.gov})
        </Chip>
        <Chip
          selected={filters.itemType === "news"}
          onClick={() => onChange({ ...filters, itemType: "news" })}
        >
          뉴스 ({counts.news})
        </Chip>
        <Chip
          selected={filters.itemType === "trending"}
          onClick={() => onChange({ ...filters, itemType: "trending" })}
        >
          해외 트렌딩 ({counts.trending})
        </Chip>

        <span className="w-px h-5 bg-border mx-1" />

        <Chip
          selected={filters.sortBy === "latest"}
          onClick={() => onChange({ ...filters, sortBy: "latest" })}
        >
          최신순
        </Chip>
        {filters.itemType === "gov" && (
          <Chip
            selected={filters.sortBy === "deadline"}
            onClick={() => onChange({ ...filters, sortBy: "deadline" })}
          >
            마감일순
          </Chip>
        )}
        {filters.itemType === "trending" && (
          <>
            <Chip
              selected={filters.sortBy === "popular"}
              onClick={() => onChange({ ...filters, sortBy: "popular" })}
            >
              인기순
            </Chip>
            {onTrendingLangChange && (
              <>
                <span className="w-px h-5 bg-border mx-1" />
                <Chip
                  selected={trendingLang === "ko"}
                  onClick={() => onTrendingLangChange("ko")}
                >
                  한국어
                </Chip>
                <Chip
                  selected={trendingLang === "en"}
                  onClick={() => onTrendingLangChange("en")}
                >
                  English
                </Chip>
              </>
            )}
          </>
        )}
        {filters.itemType === "gov" && filters.sortBy === "deadline" && (
          <label className="inline-flex cursor-pointer items-center gap-1.5 px-1 text-xs text-muted-foreground hover:text-foreground">
            <input
              type="checkbox"
              checked={filters.includeExpired}
              onChange={(e) =>
                onChange({ ...filters, includeExpired: e.target.checked })
              }
              className="h-3.5 w-3.5 cursor-pointer accent-primary"
            />
            마감 포함
          </label>
        )}

        <Input
          placeholder="검색..."
          value={filters.search}
          onChange={(e) => onChange({ ...filters, search: e.target.value })}
          className="h-7 w-36 text-xs md:w-48 ml-auto"
        />
      </div>

      {/* Row 2: Priority + Topic + Date */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs text-muted-foreground shrink-0">중요도</span>
        {(["P0", "P1", "P2"] as Priority[]).map((p) => (
          <Chip
            key={p}
            selected={filters.priorities.includes(p)}
            onClick={() => togglePriority(p)}
          >
            {priorityLabel[p]}
          </Chip>
        ))}

        <span className="w-px h-5 bg-border mx-1" />

        <span className="text-xs text-muted-foreground shrink-0">주제</span>
        {(["T0", "T1", "T2", "T3"] as Tier[]).map((t) => (
          <Chip
            key={t}
            selected={filters.tiers.includes(t)}
            onClick={() => toggleTier(t)}
          >
            {tierLabel[t]}
          </Chip>
        ))}

      </div>

      {/* Row 3: Company filter (뉴스일 때만) */}
      {filters.itemType === "news" && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-muted-foreground shrink-0">기업</span>
          {COMPANY_FILTERS.map((c) => (
            <Chip
              key={c}
              selected={filters.companies.includes(c)}
              onClick={() => toggleCompany(c)}
            >
              {c}
            </Chip>
          ))}
        </div>
      )}
    </div>
  );
}
