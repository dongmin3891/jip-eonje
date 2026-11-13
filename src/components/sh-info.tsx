"use client";

import { useQuery } from "@tanstack/react-query";

import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDate } from "@/lib/format";
import { SH_STATUS, type ShStatus } from "@/lib/sh/status";

async function fetchShStatus(): Promise<ShStatus> {
  const response = await fetch("/api/sh-status");
  if (!response.ok) throw new Error("sh-status");
  return response.json() as Promise<ShStatus>;
}

export function ShInfoView({ status }: { status: ShStatus }) {
  if (status.supported !== false) {
    return <p className="text-sm text-neutral-500">공가 응답을 표시할 수 없습니다.</p>;
  }

  return (
    <section className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-medium text-neutral-900">SH 주택정보</h3>
        <Badge variant="outline">자동 조회 미지원</Badge>
      </div>
      <p className="text-sm leading-6 text-neutral-600">{status.reason}</p>
      <p className="text-sm text-neutral-500">공가, 예비자, 퇴거 수는 표시하지 않습니다.</p>
      <a
        href={status.linkUrl}
        target="_blank"
        rel="noreferrer"
        className="inline-block text-sm font-medium text-neutral-900 underline underline-offset-4"
      >
        {status.linkLabel}
      </a>
      <p className="text-xs text-neutral-400">확인일 {formatDate(status.checkedAt)}</p>
    </section>
  );
}

export function ShInfo() {
  const query = useQuery({
    queryKey: ["sh-status"],
    queryFn: fetchShStatus,
    staleTime: Infinity,
  });

  if (query.isPending) return <Skeleton className="h-24 w-full" />;
  if (query.isError || !query.data) {
    return (
      <section className="space-y-2">
        <h3 className="text-sm font-medium">SH 주택정보</h3>
        <p className="text-sm text-neutral-600">공가 정보를 확인하지 못했습니다.</p>
        <a
          href={SH_STATUS.linkUrl}
          target="_blank"
          rel="noreferrer"
          className="inline-block text-sm font-medium underline underline-offset-4"
        >
          {SH_STATUS.linkLabel}
        </a>
      </section>
    );
  }

  return <ShInfoView status={query.data} />;
}
