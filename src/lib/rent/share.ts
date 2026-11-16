import { z } from "zod";
import type { RentPeriod } from "@/components/rent-period-filter";
import type { ContractType } from "@/lib/rent/types";
import { resolveRange } from "@/lib/rent/period";

export type RentFilters = {
  period: RentPeriod;
  areas: string[];
  contractType: "all" | ContractType;
};

const shareKeys = ["rent", "from", "to", "areas", "type"] as const;
const schema = z.object({
  from: z.iso.date(),
  to: z.iso.date(),
  areas: z.array(z.string().regex(/^\d{1,5}\.\d{2}$/).refine((value) => Number(value) > 0)).max(100),
  contractType: z.enum(["all", "신규", "갱신"]),
});

export function clearRentShareParams(params: URLSearchParams) {
  shareKeys.forEach((key) => params.delete(key));
}

/** 공유 기간은 상대적인 프리셋 대신 날짜로 고정한다. */
export function rentShareUrl(href: string, complexId: string, from: string, to: string, filters: Pick<RentFilters, "areas" | "contractType">): string {
  const url = new URL(href);
  clearRentShareParams(url.searchParams);
  url.searchParams.set("complex", complexId);
  url.searchParams.set("rent", "1");
  url.searchParams.set("from", from);
  url.searchParams.set("to", to);
  url.searchParams.set("areas", [...new Set(filters.areas)].sort((a, b) => Number(a) - Number(b)).join(","));
  url.searchParams.set("type", filters.contractType);
  return url.href;
}

export function readRentShare(params: URLSearchParams): RentFilters | null {
  if (!params.get("complex") || params.get("rent") !== "1") return null;
  if (shareKeys.some((key) => params.getAll(key).length !== 1)) return null;
  const rawAreas = params.get("areas")!;
  const parsed = schema.safeParse({
    from: params.get("from"), to: params.get("to"),
    areas: rawAreas ? rawAreas.split(",") : [], contractType: params.get("type"),
  });
  if (!parsed.success || !resolveRange(parsed.data.from, parsed.data.to).ok) return null;
  return {
    period: { kind: "custom", from: parsed.data.from, to: parsed.data.to },
    areas: [...new Set(parsed.data.areas)].sort((a, b) => Number(a) - Number(b)),
    contractType: parsed.data.contractType,
  };
}
