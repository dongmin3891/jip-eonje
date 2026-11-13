import type { Complex } from "@/lib/complexes";
import type { PublicDeal } from "@/lib/rent/parse";

export function normalizeLot(value: string | null | undefined): string | null {
  if (!value) return null;
  const normalized = value.replace(/\s+/g, "").replace(/번지$/, "");
  return normalized || null;
}

/**
 * 법정동+지번이 같거나, 도로명+건물번호가 같으면 같은 단지로 본다.
 * 단지명만 같은 경우는 맞추지 않는다. 취소 행은 제외한다.
 */
export function matchesComplex(deal: PublicDeal, complex: Complex): boolean {
  if (deal.cancelled) return false;

  const dealLot = normalizeLot(deal.lotNumber);
  const complexLot = normalizeLot(complex.lotNumber);
  const sameLot =
    !!deal.legalDong &&
    !!complex.legalDong &&
    deal.legalDong === complex.legalDong.replace(/\s+/g, "") &&
    !!dealLot &&
    !!complexLot &&
    dealLot === complexLot;

  const complexRoad = `${complex.roadName ?? ""}${complex.buildingNo ?? ""}`.replace(/\s+/g, "");
  const sameRoad = !!deal.roadCompact && !!complexRoad && deal.roadCompact === complexRoad;

  return sameLot || sameRoad;
}
