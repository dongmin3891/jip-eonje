import { getComplex } from "@/lib/complexes";

export const RECENT_COMPLEXES_KEY = "jip-eonje:recent-complexes";
export const RECENT_COMPLEXES_LIMIT = 10;

export function normalizeRecentComplexes(value: unknown): string[] {
  return Array.isArray(value)
    ? [...new Set(value.filter((id): id is string => typeof id === "string" && !!getComplex(id)))].slice(0, RECENT_COMPLEXES_LIMIT)
    : [];
}

/** null이면 저장소 접근이 막힌 것이므로 현재 화면의 기록을 유지한다. */
export function readRecentComplexes(): string[] | null {
  try {
    const raw = localStorage.getItem(RECENT_COMPLEXES_KEY);
    try { return normalizeRecentComplexes(JSON.parse(raw ?? "[]")); }
    catch { return []; }
  } catch {
    return null;
  }
}
