import { z } from "zod";
import type { RentPeriod } from "@/components/rent-period-filter";
import type { RentFilters } from "@/lib/rent/share";

const schema = z.object({
  period: z.discriminatedUnion("kind", [
    z.object({ kind: z.literal("preset"), key: z.enum(["week", "m1", "m3", "m6", "y1"]) }),
    z.object({ kind: z.literal("custom"), from: z.string(), to: z.string() }),
  ]).optional(),
  area: z.string().regex(/^(all|\d+\.\d{2})$/).optional(),
  areas: z.array(z.string().regex(/^\d+\.\d{2}$/)).optional(),
  contractType: z.enum(["all", "신규", "갱신"]).optional(),
});
type Preferences = { period?: RentPeriod; area?: string; areas?: string[]; contractType?: RentFilters["contractType"] };
const key = (id: string) => `jip-eonje:rent-preferences:${id}`;

export function readRentPreferences(id: string): Preferences {
  try {
    const saved = schema.parse(JSON.parse(localStorage.getItem(key(id)) ?? "{}"));
    return {
      period: saved.period,
      contractType: saved.contractType,
      areas: [...new Set(saved.areas ?? (saved.area && saved.area !== "all" ? [saved.area] : []))]
        .sort((a, b) => Number(a) - Number(b)),
    };
  } catch {
    return {};
  }
}

export function readRentFilters(id: string): RentFilters {
  const saved = readRentPreferences(id);
  return { period: saved.period ?? { kind: "preset", key: "m3" }, areas: saved.areas ?? [], contractType: saved.contractType ?? "all" };
}

export function saveRentPreferences(id: string, patch: Preferences): boolean {
  try {
    localStorage.setItem(key(id), JSON.stringify({ ...readRentPreferences(id), ...patch }));
    return true;
  } catch {
    return false;
  }
}
