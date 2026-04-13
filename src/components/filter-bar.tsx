"use client";

import { Input } from "@/components/ui/input";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
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

export function FilterBar({ filters, onChange, counts }: FilterBarProps) {
  return (
    <div className="space-y-3 rounded-lg border bg-card p-4">
      {/* Row 1: Type + Sort + Search */}
      <div className="flex flex-wrap items-center gap-3">
        <ToggleGroup
          value={[filters.itemType]}
          onValueChange={(v) => {
            const val = v[v.length - 1] as SourceType | undefined;
            if (val) onChange({ ...filters, itemType: val });
          }}
          className="gap-1"
        >
          <ToggleGroupItem value="gov" size="sm" className="text-xs px-3">
            공고 ({counts.gov})
          </ToggleGroupItem>
          <ToggleGroupItem value="news" size="sm" className="text-xs px-3">
            뉴스 ({counts.news})
          </ToggleGroupItem>
        </ToggleGroup>

        <ToggleGroup
          value={[filters.sortBy]}
          onValueChange={(v) => {
            const val = v[v.length - 1] as SortBy | undefined;
            if (val) onChange({ ...filters, sortBy: val });
          }}
          className="gap-0.5"
        >
          <ToggleGroupItem value="latest" size="sm" className="text-xs px-2 h-7">
            최신순
          </ToggleGroupItem>
          <ToggleGroupItem value="deadline" size="sm" className="text-xs px-2 h-7">
            마감일순
          </ToggleGroupItem>
        </ToggleGroup>

        <Input
          placeholder="검색..."
          value={filters.search}
          onChange={(e) => onChange({ ...filters, search: e.target.value })}
          className="h-8 w-40 text-sm md:w-56"
        />
      </div>

      {/* Row 2: Priority + Topic + Date */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-muted-foreground shrink-0">중요도</span>
          <ToggleGroup
            value={filters.priorities}
            onValueChange={(v) =>
              onChange({ ...filters, priorities: v as Priority[] })
            }
            className="gap-0.5"
          >
            {(["P0", "P1", "P2"] as Priority[]).map((p) => (
              <ToggleGroupItem key={p} value={p} size="sm" className="text-xs px-2 h-7">
                {priorityLabel[p]}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </div>

        <div className="flex items-center gap-1.5">
          <span className="text-xs text-muted-foreground shrink-0">주제</span>
          <ToggleGroup
            value={filters.tiers}
            onValueChange={(v) =>
              onChange({ ...filters, tiers: v as Tier[] })
            }
            className="gap-0.5"
          >
            {(["T0", "T1", "T2", "T3"] as Tier[]).map((t) => (
              <ToggleGroupItem key={t} value={t} size="sm" className="text-xs px-2 h-7">
                {tierLabel[t]}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </div>

        <div className="flex items-center gap-1.5">
          <span className="text-xs text-muted-foreground shrink-0">기간</span>
          <ToggleGroup
            value={[filters.dateRange]}
            onValueChange={(v) => {
              const val = v[v.length - 1] as Filters["dateRange"] | undefined;
              if (val) onChange({ ...filters, dateRange: val });
            }}
            className="gap-0.5"
          >
            <ToggleGroupItem value="today" size="sm" className="text-xs px-2 h-7">
              오늘
            </ToggleGroupItem>
            <ToggleGroupItem value="7d" size="sm" className="text-xs px-2 h-7">
              7일
            </ToggleGroupItem>
            <ToggleGroupItem value="30d" size="sm" className="text-xs px-2 h-7">
              30일
            </ToggleGroupItem>
            <ToggleGroupItem value="all" size="sm" className="text-xs px-2 h-7">
              전체
            </ToggleGroupItem>
          </ToggleGroup>
        </div>
      </div>
    </div>
  );
}
