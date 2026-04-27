"use client";

import { useEffect, useRef, useState } from "react";

interface SourceEntry {
  name: string;
  desc: string;
}

const SOURCES: SourceEntry[] = [
  { name: "Hacker News", desc: "기술 커뮤니티 — Algolia API top stories" },
  { name: "Hugging Face Daily Papers", desc: "매일 큐레이션된 AI 논문" },
  { name: "r/MachineLearning", desc: "Reddit 머신러닝 서브레딧 top" },
  { name: "r/LocalLLaMA", desc: "Reddit 로컬 LLM 서브레딧 top" },
  { name: "r/robotics", desc: "Reddit 로봇공학 서브레딧 top" },
  { name: "r/singularity", desc: "Reddit AI/특이점 서브레딧 top" },
  { name: "arXiv cs.AI / cs.RO / cs.LG", desc: "AI/Robotics/Learning 카테고리 신규 논문 RSS" },
  { name: "The Robot Report", desc: "로봇 산업 뉴스 RSS" },
  { name: "IEEE Spectrum Robotics", desc: "IEEE 로봇 분야 RSS" },
];

export function TrendingHelp() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    function onEsc(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    document.addEventListener("keydown", onEsc);
    return () => {
      document.removeEventListener("mousedown", onClickOutside);
      document.removeEventListener("keydown", onEsc);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-7 h-7 rounded-full border border-line-default flex items-center justify-center text-text-muted hover:text-accent transition-colors text-xs font-semibold"
        aria-label="트렌딩 소스 및 점수 설명"
        aria-expanded={open}
      >
        ?
      </button>
      {open && (
        <div
          role="dialog"
          className="absolute right-0 top-full mt-2 w-[320px] sm:w-[380px] z-50 rounded-lg border border-line-default bg-bg-surface shadow-lg backdrop-blur-sm p-4 animate-fade-in"
        >
          <h3 className="text-sm font-semibold text-text-primary mb-2">
            해외 트렌딩
          </h3>
          <p className="text-xs text-text-secondary leading-relaxed mb-3">
            아래 소스들에서 최근 72시간 내 인기 있는 항목을 모아 한 번에 보여줍니다.
          </p>

          <div className="text-xs font-semibold text-text-primary mb-1.5">수집 소스</div>
          <ul className="text-xs text-text-secondary space-y-1 mb-4">
            {SOURCES.map((s) => (
              <li key={s.name} className="leading-relaxed">
                <span className="font-medium text-text-primary">{s.name}</span>
                <span className="text-text-muted"> — {s.desc}</span>
              </li>
            ))}
          </ul>

          <div className="text-xs font-semibold text-text-primary mb-1.5">트렌딩 점수</div>
          <div className="text-xs text-text-secondary leading-relaxed space-y-1.5">
            <p>
              상단의 <span className="text-text-primary">▲ 숫자</span> 는 출처에서 수집한 raw points (HN/Reddit ups, HF upvotes) 입니다.
            </p>
            <p>내부 트렌딩 점수는 다음과 같이 계산됩니다:</p>
            <ul className="ml-4 list-disc space-y-0.5 text-text-secondary">
              <li>기본: <code className="text-text-primary">min(50, points÷10)</code></li>
              <li>+30: Physical AI 키워드 (humanoid, embodied, manipulation, VLA …)</li>
              <li>+15: Robotics/LLM 키워드 (robot, agent, foundation model …)</li>
            </ul>
            <p className="text-text-muted">
              점수가 높을수록 Physical AI 와 더 관련 있고 커뮤니티 반응도 큰 항목입니다. 정렬·필터에만 사용되며 ▲ 표시값과는 다릅니다.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
