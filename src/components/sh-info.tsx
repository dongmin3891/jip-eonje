import { buttonVariants } from "@/components/ui/button";
import type { Complex } from "@/lib/complexes";
import { shHouseInfoUrl } from "@/lib/sh/link";
import { cn } from "cn";

export function ShInfo({ complex }: { complex: Complex }) {
  return (
    <section className="space-y-2">
      <h3 className="text-sm font-medium text-neutral-900">SH 공가·예비자 현황</h3>
      <p className="text-sm leading-6 text-neutral-600">
        공가 수, 예비자 수, 최근 1년 퇴거 현황은 SH 공식 주택정보에서 확인할 수 있습니다.
      </p>
      <a
        href={shHouseInfoUrl(complex.id)}
        target="_blank"
        rel="noopener noreferrer"
        className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
      >
        SH 주택정보 확인 →
      </a>
    </section>
  );
}
