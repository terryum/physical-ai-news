import type { Item } from "../../src/data/types";

export function formatDate(iso: string): string {
  const d = new Date(iso);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}.${m}.${day}`;
}

export function dDay(deadlineAt: string, now: Date): string {
  const deadline = new Date(deadlineAt);
  const diff = Math.ceil(
    (deadline.getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
  );
  if (diff === 0) return "D-Day";
  if (diff > 0) return `D-${diff}`;
  return `D+${Math.abs(diff)}`;
}

export function getCanonicalUrl(item: Item): string {
  const canonical = item.links.find((l) => l.kind === "canonical");
  return canonical?.url ?? item.links[0]?.url ?? "#";
}
