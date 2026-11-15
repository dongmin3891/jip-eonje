import { z } from "zod";
import type { RentPeriod } from "@/components/rent-period-filter";

const schema = z.object({
  period: z.discriminatedUnion("kind", [
    z.object({ kind: z.literal("preset"), key: z.enum(["week", "m1", "m3", "m6", "y1"]) }),
    z.object({ kind: z.literal("custom"), from: z.string(), to: z.string() }),
  ]).optional(),
  area: z.string().regex(/^(all|\d+\.\d{2})$/).optional(),
  areas: z.array(z.string().regex(/^\d+\.\d{2}$/)).optional(),
});
type Preferences = { period?: RentPeriod; area?: string; areas?: string[] };
const key = (id: string) => `jip-eonje:rent-preferences:${id}`;

export function readRentPreferences(id: string): Preferences {
  try {
    const saved = schema.parse(JSON.parse(localStorage.getItem(key(id)) ?? "{}"));
    return {
      period: saved.period,
      areas: [...new Set(saved.areas ?? (saved.area && saved.area !== "all" ? [saved.area] : []))]
        .sort((a, b) => Number(a) - Number(b)),
    };
  } catch {
    return {};
  }
}

export function saveRentPreferences(id: string, patch: Preferences): boolean {
  try {
    localStorage.setItem(key(id), JSON.stringify({ ...readRentPreferences(id), ...patch }));
    return true;
  } catch {
    return false;
  }
}
