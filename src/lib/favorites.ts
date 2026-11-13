import { getComplex } from "@/lib/complexes";

export const FAVORITES_KEY = "jip-eonje:favorite-complexes";

export function readFavorites(): string[] {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(FAVORITES_KEY) ?? "[]");
    return Array.isArray(value)
      ? [...new Set(value.filter((id): id is string => typeof id === "string" && !!getComplex(id)))]
      : [];
  } catch {
    return [];
  }
}
