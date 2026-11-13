"use client";

import { useQuery } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { formatAreaWithPyeong, formatDate, formatFetchedAt, formatFloor, formatManwon } from "@/lib/format";
import type { Complex } from "@/lib/complexes";
import { countByArea, mergeAreaKeys } from "@/lib/rent/areas";
import type { ApiErrorBody, ContractType, RentAreasResponse, RentResponse } from "@/lib/rent/types";

type RentSectionProps = {
  complex: Complex;
  from: string;
  to: string;
  enabled: boolean;
  mixedHousing: boolean;
  periodControl: ReactNode;
  rangeError: string | null;
};

type TypeFilter = "all" | ContractType;

class RentRequestError extends Error {
  readonly code: string;

  constructor(message: string, code: string) {
    super(message);
    this.code = code;
  }
}

async function fetchRent(complexId: string, from: string, to: string): Promise<RentResponse> {
  const params = new URLSearchParams({ complexId, from, to });
  const response = await fetch(`/api/rent?${params}`);
  const body = (await response.json()) as RentResponse | ApiErrorBody;
  if (!response.ok) {
    const errorBody = body as ApiErrorBody;
    throw new RentRequestError(
      errorBody.message || "전월세 계약을 불러오지 못했습니다.",
      errorBody.code || "UPSTREAM",
    );
  }
  return body as RentResponse;
}

async function fetchRentAreas(complexId: string): Promise<RentAreasResponse> {
  const params = new URLSearchParams({ complexId });
  const response = await fetch(`/api/rent/areas?${params}`);
  const body = (await response.json()) as RentAreasResponse | ApiErrorBody;
  if (!response.ok) {
    const errorBody = body as ApiErrorBody;
    throw new RentRequestError(
      errorBody.message || "전용면적 정보를 불러오지 못했습니다.",
      errorBody.code || "UPSTREAM",
    );
  }
  return body as RentAreasResponse;
}

export function RentSection(props: RentSectionProps) {
  return <RentSectionBody key={props.complex.id} {...props} />;
}

function RentSectionBody({ complex, from, to, enabled, mixedHousing, periodControl, rangeError }: RentSectionProps) {
  const [area, setArea] = useState("all");
  const [contractType, setContractType] = useState<TypeFilter>("all");

  const contractQuery = useQuery({
    queryKey: ["rent", complex.id, from, to],
    queryFn: () => fetchRent(complex.id, from, to),
    enabled: enabled && !rangeError,
  });
  const areasQuery = useQuery({
    queryKey: ["rent-areas", complex.id],
    queryFn: () => fetchRentAreas(complex.id),
    enabled: enabled && !rangeError,
    staleTime: 24 * 60 * 60 * 1000,
    gcTime: 24 * 60 * 60 * 1000,
  });

  const contracts = contractQuery.data?.contracts ?? [];
  const areas = mergeAreaKeys(areasQuery.data?.areasM2 ?? [], contracts);
  const areaCounts = countByArea(contracts);
  const activeArea = areas.includes(area) ? area : "all";
  const areaSelectDisabled =
    !enabled || !!rangeError || areasQuery.isPending || (!areasQuery.isSuccess && !contractQuery.isSuccess);
  const filtered = contracts.filter((contract) => {
    const areaMatches = activeArea === "all" || contract.areaM2.toFixed(2) === activeArea;
    const typeMatches = contractType === "all" || contract.contractType === contractType;
    return areaMatches && typeMatches;
  });
  const hasFilters = activeArea !== "all" || contractType !== "all";

  return (
    <section aria-label="공개된 전월세 계약" className="space-y-4">
      <div>
        <h3 className="text-base font-semibold">공개된 전월세 계약</h3>
        <p className="mt-1 text-xs leading-5 text-neutral-500">계약 건수는 당첨이나 입주 인원이 아닙니다.</p>
      </div>

      <div className="space-y-4 rounded-xl border border-neutral-200 p-3">
        {periodControl}
        <fieldset disabled={!enabled || !!rangeError} className="min-w-0 space-y-3 border-t border-neutral-100 pt-3 disabled:opacity-50">
          <legend className="sr-only">면적 및 계약 유형</legend>
          <div className="space-y-2">
            <label className="block text-xs font-medium text-neutral-600" htmlFor={`area-${complex.id}`}>전용면적</label>
            <select
              id={`area-${complex.id}`}
              className="h-11 w-full min-w-0 rounded-lg border border-neutral-200 bg-white px-3 text-sm focus-visible:outline-2 focus-visible:outline-neutral-500"
              value={activeArea}
              disabled={areaSelectDisabled}
              onChange={(event) => setArea(event.target.value)}
            >
              <option value="all">{areasQuery.isPending && enabled && !rangeError ? "면적 정보 불러오는 중…" : "모든 면적"}</option>
              {areas.map((value) => (
                <option key={value} value={value}>
                  {formatAreaWithPyeong(Number(value))} · {areaCounts.get(value) ?? 0}건
                </option>
              ))}
            </select>
            {areasQuery.isError ? (
              <div className="flex items-center justify-between gap-2 rounded-lg bg-neutral-50 px-3 py-2">
                <p className="text-xs leading-5 text-neutral-500">36개월 면적 정보를 불러오지 못했습니다. 현재 기간의 면적만 표시합니다.</p>
                <Button type="button" variant="ghost" className="h-9 shrink-0 px-2 text-xs" disabled={areasQuery.isFetching} onClick={() => void areasQuery.refetch()}>
                  {areasQuery.isFetching ? "불러오는 중…" : "면적 다시 시도"}
                </Button>
              </div>
            ) : null}
          </div>
          <div role="group" aria-label="계약 유형" className="grid grid-cols-3 gap-1">
            {(["all", "신규", "갱신"] as const).map((type) => (
              <Button
                key={type}
                type="button"
                className="h-10"
                variant={contractType === type ? "default" : "outline"}
                aria-pressed={contractType === type}
                disabled={!enabled || !!rangeError || !contractQuery.isSuccess}
                onClick={() => setContractType(type)}
              >
                {type === "all" ? "전체" : type}
              </Button>
            ))}
          </div>
        </fieldset>
      </div>

      {mixedHousing ? (
        <p className="text-xs leading-5 text-neutral-500">
          이 단지는 행복주택과 다른 주택유형이 함께 등록되어 있습니다. 같은 주소의 아파트 계약이 섞일 수 있습니다.
        </p>
      ) : null}

      {rangeError ? null : !enabled ? (
        <p className="rounded-xl bg-neutral-50 p-4 text-sm leading-6 text-neutral-600">
          전월세 계약 조회를 준비 중입니다. 공가·예비자 현황은 위의 SH 주택정보에서 확인해 주세요.
        </p>
      ) : contractQuery.isPending ? (
        <div role="status" className="space-y-3">
          <span className="sr-only">전월세 계약을 불러오는 중입니다.</span>
          <Skeleton className="h-7 w-24" />
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
      ) : contractQuery.isError ? (
        <div role="alert" className="space-y-3 rounded-xl bg-neutral-50 p-4">
          <p className="text-sm leading-6 text-neutral-600">
            {contractQuery.error instanceof Error ? contractQuery.error.message : "전월세 계약을 불러오지 못했습니다."}
          </p>
          <Button type="button" variant="outline" className="h-11" disabled={contractQuery.isFetching} onClick={() => void contractQuery.refetch()}>
            {contractQuery.isFetching ? "다시 불러오는 중…" : "다시 시도"}
          </Button>
        </div>
      ) : (
        <>
          <div className="flex items-center justify-between gap-2">
            <p role="status" className="text-sm text-neutral-600">
              조회 결과 <strong className="ml-1 text-xl font-semibold text-neutral-950 tabular-nums">{filtered.length}건</strong>
            </p>
            {hasFilters ? (
              <Button type="button" variant="ghost" className="h-11 text-xs" onClick={() => { setArea("all"); setContractType("all"); }}>
                면적·유형 초기화
              </Button>
            ) : null}
          </div>
          {filtered.length === 0 ? (
            <div className="rounded-xl bg-neutral-50 px-4 py-6 text-center">
              <p className="text-sm font-medium">조건에 맞는 공개 계약이 없습니다.</p>
              <p className="mt-2 text-sm leading-6 text-neutral-500">
                {hasFilters ? "면적·유형을 초기화하거나 조회 기간을 늘려보세요." : "조회 기간을 늘려 다시 확인해 보세요."}
              </p>
              <p className="mt-2 text-xs leading-5 text-neutral-500">0건이 당첨이나 입주가 없다는 뜻은 아닙니다.</p>
            </div>
          ) : (
            <ul className="divide-y divide-neutral-100 border-y border-neutral-100">
              {filtered.map((contract) => {
                const floor = formatFloor(contract.floor);
                return (
                  <li key={contract.id} className="space-y-2 py-4">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm text-neutral-500">{formatDate(contract.contractDate)}</p>
                      {contract.contractType ? <Badge variant="outline">{contract.contractType}</Badge> : null}
                    </div>
                    <p className="text-base font-semibold text-neutral-900 tabular-nums">
                      보증금 {formatManwon(contract.depositManwon)}
                      <span className="mx-1.5 text-neutral-300">/</span>
                      월세 {formatManwon(contract.monthlyRentManwon)}
                    </p>
                    <p className="text-sm text-neutral-500">
                      {formatAreaWithPyeong(contract.areaM2)}{floor ? ` · ${floor}` : ""}
                    </p>
                  </li>
                );
              })}
            </ul>
          )}
          <p className="text-xs leading-5 text-neutral-500">오늘 계약은 다음날에 집계됩니다.</p>
          <details className="text-xs leading-5 text-neutral-500">
            <summary className="cursor-pointer rounded-md py-2 focus-visible:outline-2 focus-visible:outline-neutral-500">데이터 출처·조회 시각</summary>
            <p className="mt-1">
              조회 {formatFetchedAt(contractQuery.data.fetchedAt)} · {contractQuery.data.source.name}
              {contractQuery.data.matchedAptNames.length > 0 ? ` · 매칭 단지명 ${contractQuery.data.matchedAptNames.join(", ")}` : ""}
            </p>
          </details>
        </>
      )}
    </section>
  );
}
