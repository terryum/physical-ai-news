"use client";

import { useState } from "react";

interface SourceMeta {
  initial: string;
  bg: string;
  fg: string;
}

const SOURCE_META: Record<string, SourceMeta> = {
  hackernews: { initial: "HN", bg: "#FFF7ED", fg: "#C2410C" },
  hf_daily_papers: { initial: "HF", bg: "#FEF3C7", fg: "#92400E" },
  reddit_ml: { initial: "RD", bg: "#FFE4E0", fg: "#B91C1C" },
  reddit_localllama: { initial: "RD", bg: "#FFE4E0", fg: "#B91C1C" },
  reddit_robotics: { initial: "RD", bg: "#FFE4E0", fg: "#B91C1C" },
  reddit_singularity: { initial: "RD", bg: "#FFE4E0", fg: "#B91C1C" },
  arxiv_cs_ai: { initial: "AX", bg: "#ECFDF5", fg: "#047857" },
  arxiv_cs_ro: { initial: "AX", bg: "#ECFDF5", fg: "#047857" },
  arxiv_cs_lg: { initial: "AX", bg: "#ECFDF5", fg: "#047857" },
  robot_report: { initial: "RR", bg: "#EEF2FF", fg: "#3730A3" },
  ieee_spectrum_robotics: { initial: "IS", bg: "#F0F9FF", fg: "#0369A1" },
};

const FALLBACK_META: SourceMeta = { initial: "·", bg: "#E3E8EB", fg: "#6B7280" };

function metaFor(sourceName: string): SourceMeta {
  if (SOURCE_META[sourceName]) return SOURCE_META[sourceName];
  if (sourceName.startsWith("reddit_")) return SOURCE_META.reddit_ml;
  if (sourceName.startsWith("arxiv_")) return SOURCE_META.arxiv_cs_ai;
  return FALLBACK_META;
}

interface Props {
  thumbnailUrl?: string;
  sourceName: string;
  size?: "sm" | "md";
  alt?: string;
}

/**
 * 트렌딩 항목 좌측 썸네일.
 * - thumbnailUrl 있으면 이미지, 로드 실패 시 폴백으로 자동 전환
 * - 없으면 소스 이니셜 컬러 박스 (HN/RD/AX/HF/RR/IS)
 */
export function TrendingThumb({ thumbnailUrl, sourceName, size = "md", alt }: Props) {
  const [errored, setErrored] = useState(false);
  const dim = size === "sm" ? "w-10 h-10" : "w-14 h-14";
  const radius = "rounded-md";
  const showImage = thumbnailUrl && !errored;
  const meta = metaFor(sourceName);

  if (showImage) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={thumbnailUrl}
        alt={alt ?? sourceName}
        loading="lazy"
        decoding="async"
        referrerPolicy="no-referrer"
        onError={() => setErrored(true)}
        className={`${dim} ${radius} shrink-0 object-cover border border-line-default bg-bg-surface`}
      />
    );
  }

  return (
    <div
      className={`${dim} ${radius} shrink-0 flex items-center justify-center border border-line-default text-[11px] font-semibold tracking-wide`}
      style={{ backgroundColor: meta.bg, color: meta.fg }}
      aria-label={`${sourceName} 썸네일 없음`}
    >
      {meta.initial}
    </div>
  );
}
