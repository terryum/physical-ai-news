"use client";

import { Input } from "@/components/ui/input";
import type { Filters, SourceType, Priority, Tier, SortBy } from "@/data/types";

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
  counts: { total: number; gov: number; news: number };
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

export function FilterBar({ filters, onChange, counts }: FilterBarProps) {
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

        <span className="w-px h-5 bg-border mx-1" />

        <Chip
          selected={filters.sortBy === "latest"}
          onClick={() => onChange({ ...filters, sortBy: "latest" })}
        >
          최신순
        </Chip>
        <Chip
          selected={filters.sortBy === "deadline"}
          onClick={() => onChange({ ...filters, sortBy: "deadline" })}
        >
          마감일순
        </Chip>

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

        <span className="w-px h-5 bg-border mx-1" />

        <span className="text-xs text-muted-foreground shrink-0">기간</span>
        {(
          [
            ["today", "오늘"],
            ["7d", "7일"],
            ["30d", "30일"],
            ["all", "전체"],
          ] as [Filters["dateRange"], string][]
        ).map(([value, label]) => (
          <Chip
            key={value}
            selected={filters.dateRange === value}
            onClick={() => onChange({ ...filters, dateRange: value })}
          >
            {label}
          </Chip>
        ))}
      </div>
    </div>
  );
}
