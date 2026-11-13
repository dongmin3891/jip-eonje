import { SH_HOUSE_INFO_MAIN, shHouseInfoUrl } from "@/lib/sh/link";

export function ShLinkBadge({ complexId }: { complexId: string }) {
  const linked = shHouseInfoUrl(complexId) !== SH_HOUSE_INFO_MAIN;
  return <span className={`mt-1 inline-block rounded-full px-2 py-0.5 text-xs ${linked ? "bg-emerald-50 text-emerald-800" : "bg-amber-50 text-amber-900"}`}>
    {linked ? "SH 상세 연결" : "SH에서 직접 검색"}
  </span>;
}
