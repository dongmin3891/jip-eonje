import { CopyButton } from "@/components/copy-button";
import { buttonVariants } from "@/components/ui/button";
import type { Complex } from "@/lib/complexes";
import { SH_HOUSE_INFO_MAIN, shHouseInfoUrl } from "@/lib/sh/link";
import { cn } from "cn";

export function ShInfo({ complex }: { complex: Complex }) {
  const href = shHouseInfoUrl(complex.id);
  const hasDetailLink = href !== SH_HOUSE_INFO_MAIN;

  return (
    <section className="space-y-2 rounded-xl border border-neutral-200 bg-neutral-50 p-4">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-sm font-medium text-neutral-900">SH 공가·예비자 현황</h3>
        <span
          className={cn(
            "shrink-0 rounded-full px-2 py-1 text-xs font-medium",
            hasDetailLink
              ? "bg-emerald-100 text-emerald-800"
              : "bg-amber-100 text-amber-900",
          )}
        >
          {hasDetailLink ? "상세페이지 연결" : "상세 링크 미확인"}
        </span>
      </div>
      <p className="text-sm leading-6 text-neutral-600">
        {hasDetailLink
          ? "공가 수, 예비자 수, 최근 1년 퇴거 현황을 SH 공식 상세페이지에서 확인할 수 있습니다."
          : "확인된 SH 단지 코드가 없어 주택정보 메인으로 이동합니다. SH에서 단지명을 검색해 주세요."}
      </p>
      {!hasDetailLink ? (
        <div className="space-y-2 rounded-lg bg-white p-3">
          <p className="select-text break-words text-sm text-neutral-800">검색할 이름: {complex.name}</p>
          <CopyButton key={complex.id} label="단지명 복사" value={complex.name} />
          <p className="text-xs leading-5 text-neutral-500">SH에서는 이름이 다르게 등록되어 검색되지 않을 수 있습니다.</p>
        </div>
      ) : null}
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className={cn(buttonVariants({ variant: "outline", size: "sm" }), "mt-1 h-11 w-full bg-white")}
      >
        {hasDetailLink ? "이 단지 SH 상세정보 보기 ↗" : "SH 주택정보 메인에서 찾기 ↗"}
      </a>
    </section>
  );
}
