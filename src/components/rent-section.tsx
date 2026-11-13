"use client";

import { useQuery } from "@tanstack/react-query";
import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { formatArea, formatDate, formatFetchedAt, formatFloor, formatManwon } from "@/lib/format";
import type { Complex } from "@/lib/complexes";
import type { ApiErrorBody, ContractType, RentResponse } from "@/lib/rent/types";

type RentSectionProps = {
  complex: Complex;
  from: string;
  to: string;
  enabled: boolean;
  mixedHousing: boolean;
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

export function RentSection(props: RentSectionProps) {
  return <RentSectionBody key={props.complex.id} {...props} />;
}

function RentSectionBody({ complex, from, to, enabled, mixedHousing }: RentSectionProps) {
  const [area, setArea] = useState("all");
  const [contractType, setContractType] = useState<TypeFilter>("all");

  const query = useQuery({
    queryKey: ["rent", complex.id, from, to],
    queryFn: () => fetchRent(complex.id, from, to),
    enabled,
  });

  if (!enabled) {
    return (
      <section className="space-y-2">
        <h3 className="text-sm font-medium">공개된 전월세 계약</h3>
        <p className="text-sm leading-6 text-neutral-600">
          공공데이터포털 인증키가 설정되지 않아 전월세 계약을 조회하지 않습니다.
        </p>
      </section>
    );
  }

  if (query.isPending) {
    return (
      <div className="space-y-2">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-10 w-24" />
        <Skeleton className="h-16 w-full" />
      </div>
    );
  }

  if (query.isError) {
    return (
      <section className="space-y-2">
        <h3 className="text-sm font-medium">공개된 전월세 계약</h3>
        <p className="text-sm leading-6 text-neutral-600">
          {query.error instanceof Error ? query.error.message : "전월세 계약을 불러오지 못했습니다."}
        </p>
      </section>
    );
  }

  const contracts = query.data.contracts;
  const areas = [...new Set(contracts.map((contract) => contract.areaM2.toFixed(2)))].sort(
    (left, right) => Number(left) - Number(right),
  );
  const filtered = contracts.filter((contract) => {
    const areaMatches = area === "all" || contract.areaM2.toFixed(2) === area;
    const typeMatches = contractType === "all" || contract.contractType === contractType;
    return areaMatches && typeMatches;
  });

  return (
    <section className="space-y-3">
      <div>
        <p className="text-sm text-neutral-500">공개된 전월세 계약</p>
        <p className="text-4xl font-semibold tracking-tight text-neutral-950 tabular-nums">
          {filtered.length}
          <span className="ml-1 text-lg font-medium">건</span>
        </p>
        <p className="mt-1 text-xs leading-5 text-neutral-500">
          이 건수는 당첨이나 입주 인원이 아닙니다. {formatDate(from)} – {formatDate(to)}
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <label className="text-xs text-neutral-500" htmlFor={`area-${complex.id}`}>
          전용면적
        </label>
        <select
          id={`area-${complex.id}`}
          aria-label="전용면적"
          className="h-8 rounded-lg border border-neutral-200 bg-white px-2 text-sm"
          value={area}
          onChange={(event) => setArea(event.target.value)}
        >
          <option value="all">전체</option>
          {areas.map((value) => (
            <option key={value} value={value}>
              {value}㎡
            </option>
          ))}
        </select>
        {(["all", "신규", "갱신"] as const).map((type) => (
          <Button
            key={type}
            type="button"
            size="sm"
            variant={contractType === type ? "default" : "outline"}
            onClick={() => setContractType(type)}
          >
            {type === "all" ? "전체" : type}
          </Button>
        ))}
      </div>

      {mixedHousing ? (
        <p className="text-xs leading-5 text-neutral-500">
          이 단지는 행복주택과 다른 주택유형이 함께 등록되어 있습니다. 같은 주소의 아파트 계약이 섞일 수
          있습니다.
        </p>
      ) : null}

      {filtered.length === 0 ? (
        <p className="text-sm leading-6 text-neutral-600">
          이 조건으로 매칭된 공개 계약이 없습니다. 0건이 당첨이나 입주가 없다는 뜻은 아닙니다.
        </p>
      ) : (
        <ul className="divide-y divide-neutral-100 border-y border-neutral-100">
          {filtered.map((contract) => {
            const floor = formatFloor(contract.floor);
            return (
              <li key={contract.id} className="py-3">
                <div className="flex items-baseline justify-between gap-3">
                  <p className="text-sm font-medium">{formatDate(contract.contractDate)}</p>
                  {contract.contractType ? (
                    <Badge variant="outline">{contract.contractType}</Badge>
                  ) : null}
                </div>
                <p className="mt-1 text-sm text-neutral-700">
                  {formatArea(contract.areaM2)}
                  {floor ? ` · ${floor}` : ""}
                </p>
                <p className="mt-1 text-sm text-neutral-900">
                  보증금 {formatManwon(contract.depositManwon)} · 월세{" "}
                  {formatManwon(contract.monthlyRentManwon)}
                </p>
              </li>
            );
          })}
        </ul>
      )}

      <p className="text-xs leading-5 text-neutral-400">
        조회 {formatFetchedAt(query.data.fetchedAt)} · {query.data.source.name}
        {query.data.matchedAptNames.length > 0
          ? ` · 매칭 단지명 ${query.data.matchedAptNames.join(", ")}`
          : ""}
      </p>
    </section>
  );
}
