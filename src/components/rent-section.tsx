"use client";

import { useQuery } from "@tanstack/react-query";
import { useCallback, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ArrowUp, ClipboardList, LoaderCircle } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { formatAreaWithPyeong, formatDate, formatFetchedAt, formatFloor, formatManwon } from "@/lib/format";
import type { Complex } from "@/lib/complexes";
import { countByArea, mergeAreaKeys } from "@/lib/rent/areas";
import type { ApiErrorBody, ContractType, RentAreasResponse, RentResponse } from "@/lib/rent/types";
import { RentPeriodFilter, rentPeriodRange } from "@/components/rent-period-filter";
import type { RentFilters } from "@/lib/rent/share";

type RentSectionProps = {
  actionContainer: HTMLElement | null;
  complex: Complex;
  from: string;
  to: string;
  enabled: boolean;
  mixedHousing: boolean;
  filters: RentFilters;
  onApplyFilters: (filters: RentFilters) => boolean;
  rangeError: string | null;
  addressWarning?: string;
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

function RentSectionBody({ actionContainer, complex, from, to, enabled, mixedHousing, filters, onApplyFilters, rangeError, addressWarning }: RentSectionProps) {
  const { areas: selectedAreas, contractType } = filters;
  const [draftPeriod, setDraftPeriod] = useState(filters.period);
  const draftRange = rentPeriodRange(draftPeriod);
  const [sheet, setSheet] = useState<"period" | "area" | "contracts">("area");
  const [sheetOpen, setSheetOpen] = useState(false);
  const [fromContracts, setFromContracts] = useState(false);
  const [draftAreas, setDraftAreas] = useState<string[]>([]);
  const [draftType, setDraftType] = useState<TypeFilter>("all");
  const [saveError, setSaveError] = useState(false);
  const returnFocus = useRef<HTMLElement | null>(null);
  const focusSheetContent = useCallback((node: HTMLDivElement | null) => {
    if (node && fromContracts) {
      if (node.parentElement) node.parentElement.scrollTop = 0;
      node.focus({ preventScroll: true });
    }
  }, [fromContracts]);

  function openSheet(target: typeof sheet, trigger: HTMLElement) {
    returnFocus.current = trigger;
    setFromContracts(false);
    setDraftPeriod(filters.period);
    setDraftAreas([...selectedAreas]);
    setDraftType(contractType);
    setSheet(target);
    setSheetOpen(true);
  }
  function editContractFilters(target: "period" | "area") {
    setDraftPeriod(filters.period);
    setDraftAreas([...selectedAreas]);
    setDraftType(contractType);
    setFromContracts(true);
    setSheet(target);
  }
  function finishFilterSelection() {
    if (fromContracts) setSheet("contracts");
    else setSheetOpen(false);
  }
  function toggleDraftArea(value: string) {
    setDraftAreas((current) => current.includes(value)
      ? current.filter((item) => item !== value)
      : [...current, value].sort((a, b) => Number(a) - Number(b)));
  }
  function applyAreas() {
    setSaveError(!onApplyFilters({ ...filters, areas: draftAreas, contractType: draftType }));
    finishFilterSelection();
  }
  function applyPeriod() {
    if (!draftRange.ok) return;
    setSaveError(!onApplyFilters({ ...filters, period: draftPeriod }));
    finishFilterSelection();
  }

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
  const areas = mergeAreaKeys([...(areasQuery.data?.areasM2 ?? []), ...selectedAreas.map(Number)], contracts);
  const typeContracts = contracts.filter((item) => draftType === "all" || item.contractType === draftType);
  const areaCounts = countByArea(typeContracts);
  const countsReady = enabled && !rangeError && contractQuery.isSuccess;
  const areaSelectDisabled =
    !enabled || !!rangeError || areasQuery.isPending || (!areasQuery.isSuccess && !contractQuery.isSuccess);
  const filtered = contracts.filter((contract) => {
    const areaMatches = selectedAreas.length === 0 || selectedAreas.includes(contract.areaM2.toFixed(2));
    const typeMatches = contractType === "all" || contract.contractType === contractType;
    return areaMatches && typeMatches;
  });
  const hasFilters = selectedAreas.length > 0 || contractType !== "all";
  const actionLabel = countsReady ? "계약 내역 보기" : rangeError ? "조회 기간을 확인해 주세요" : !enabled ? "계약 조회 준비 중" : contractQuery.isError ? "계약 조회 실패" : "계약 불러오는 중…";
  const loading = enabled && !rangeError && contractQuery.isPending;

  return (
    <section aria-label="공개된 전월세 계약" className="space-y-2">
      <div className="sticky top-[53px] z-[5] rounded-xl border border-emerald-100 bg-emerald-50 px-3 py-2">
        <button type="button" onClick={(event) => openSheet("period", event.currentTarget)} aria-haspopup="dialog" className="flex min-h-11 w-full items-center justify-between gap-2 text-left text-xs text-emerald-900">
          <span>{formatDate(from)} – {formatDate(to)}</span><span className="shrink-0 underline">기간 변경</span>
        </button>
        <button type="button" onClick={(event) => openSheet("area", event.currentTarget)} aria-haspopup="dialog" className="flex min-h-11 w-full items-center justify-between gap-2 border-t border-emerald-100 text-left text-sm font-medium text-emerald-950">
          <span>{selectedAreas.length === 0 ? "모든 면적" : selectedAreas.length === 1 ? formatAreaWithPyeong(Number(selectedAreas[0])) : `${selectedAreas[0]}㎡ 외 ${selectedAreas.length - 1}개`}</span>
          <span className="shrink-0 text-xs font-normal underline">면적 변경</span>
        </button>
        <div className="flex items-center justify-between gap-2 border-t border-emerald-100 py-3">
          <h3 className="text-sm text-emerald-900">공개 계약{contractType === "all" ? "" : ` · ${contractType}`}</h3>
          <p role="status" className="text-3xl font-bold tabular-nums text-emerald-950">{countsReady ? `${filtered.length}건` : contractQuery.isError ? "조회 실패" : enabled && !rangeError ? "조회 중…" : "—"}</p>
        </div>
      </div>
      {saveError ? <p className="text-xs text-neutral-500">브라우저 저장이 제한되어 조회 조건은 이번 화면에서만 유지됩니다.</p> : null}

      {actionContainer ? createPortal(
        <Button
          type="button"
          className="pointer-events-auto h-14 w-full justify-between gap-3 rounded-2xl bg-emerald-800 px-4 text-white shadow-lg shadow-emerald-950/20 hover:bg-emerald-900 disabled:opacity-80"
          disabled={!countsReady}
          aria-label={countsReady ? `${actionLabel} · ${filtered.length}건` : actionLabel}
          aria-haspopup="dialog"
          onClick={(event) => openSheet("contracts", event.currentTarget)}
        >
          <span className="flex min-w-0 items-center gap-2">
            {loading ? <LoaderCircle aria-hidden="true" className="size-5 animate-spin motion-reduce:animate-none" /> : <ClipboardList aria-hidden="true" className="size-5" />}
            <span className="text-sm font-semibold">{actionLabel}</span>
          </span>
          {countsReady ? <span className="flex shrink-0 items-center gap-2"><span className="rounded-full bg-white/15 px-2.5 py-1 text-sm font-semibold tabular-nums">{filtered.length}건</span><ArrowUp aria-hidden="true" className="size-4" /></span> : null}
        </Button>, actionContainer,
      ) : null}
      <p className="text-xs leading-5 text-neutral-500">단지 전체 공개 계약입니다. 행복주택 당첨자의 계약 인원과 다를 수 있습니다.</p>

      {addressWarning ? <p className="text-xs leading-5 text-neutral-500">{addressWarning}</p> : null}

      {mixedHousing ? (
        <p className="text-xs leading-5 text-neutral-500">
          이 단지는 행복주택과 다른 주택유형이 함께 등록되어 있습니다. 같은 주소의 아파트 계약이 섞일 수 있습니다.
        </p>
      ) : null}

      {rangeError ? null : !enabled ? (
        <p className="rounded-xl bg-neutral-50 p-4 text-sm leading-6 text-neutral-600">
          전월세 계약 조회를 준비 중입니다. 공가·예비자 현황은 아래 SH 주택정보에서 확인해 주세요.
        </p>
      ) : contractQuery.isPending ? (
        <div className="space-y-3">
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
          <p className="text-xs leading-5 text-neutral-500">신고·공개 시점에 따라 최근 계약이 아직 반영되지 않았을 수 있습니다.</p>
          <details className="text-xs leading-5 text-neutral-500">
            <summary className="cursor-pointer rounded-md py-2 focus-visible:outline-2 focus-visible:outline-neutral-500">데이터 출처·조회 시각</summary>
            <p className="mt-1">
              조회 {formatFetchedAt(contractQuery.data.fetchedAt)} · {contractQuery.data.source.name}
              {contractQuery.data.matchedAptNames.length > 0 ? ` · 매칭 단지명 ${contractQuery.data.matchedAptNames.join(", ")}` : ""}
            </p>
          </details>
        </>
      )}
      <BottomSheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        title={sheet === "period" ? "조회 기간" : sheet === "area" ? "관심 면적 선택" : "계약 내역"}
        description={sheet === "contracts" ? `${complex.name} · ${formatDate(from)} – ${formatDate(to)}` : complex.name}
        headerContent={sheet === "contracts" ? (
          <div role="group" aria-label="적용된 조회 조건" className="mt-2 flex max-h-24 flex-wrap gap-1.5 overflow-y-auto text-xs">
            {(selectedAreas.length ? selectedAreas.map((area) => formatAreaWithPyeong(Number(area))) : ["모든 면적"]).map((label) => <span key={label} className="rounded-md bg-emerald-50 px-2 py-1 text-emerald-900">{label}</span>)}
            <span className="rounded-md bg-neutral-100 px-2 py-1">{contractType === "all" ? "모든 계약 유형" : contractType}</span>
            <span className="rounded-md bg-neutral-100 px-2 py-1 font-semibold" aria-live="polite">{countsReady ? `${filtered.length}건` : actionLabel}</span>
          </div>
        ) : undefined}
        returnFocus={returnFocus}
        footer={sheet !== "contracts" ? (
          <div className="grid grid-cols-2 gap-2">
            <Button type="button" variant="outline" className="h-11" onClick={finishFilterSelection}>취소</Button>
            <Button type="button" className="h-11" disabled={sheet === "period" && !draftRange.ok} onClick={sheet === "period" ? applyPeriod : applyAreas}>{fromContracts ? "적용하고 내역 보기" : "적용"}</Button>
          </div>
        ) : undefined}
      >
        <div key={sheet} ref={focusSheetContent} tabIndex={-1} className="outline-none">
        {sheet === "period" ? <>
          <RentPeriodFilter period={draftPeriod} onChange={setDraftPeriod} />
          <p className="mt-3 text-xs leading-5 text-neutral-500">적용을 누르면 선택한 기간으로 조회합니다. 조회 조건은 이 브라우저에 단지별로 저장됩니다.</p>
        </> : sheet === "area" ? (
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm text-neutral-600">여러 면적 선택 가능</p>
              <button type="button" className="min-h-11 text-xs underline" onClick={() => setDraftAreas([])}>모든 면적으로</button>
            </div>
            <p className="text-xs leading-5 text-neutral-500">여러 면적을 선택하면 계약 건수를 합산합니다. 공식 공급형 구분은 아닙니다.</p>
            {areasQuery.isPending && enabled && !rangeError ? <p className="text-xs text-neutral-500">면적 정보 불러오는 중…</p> : null}
            <div role="group" aria-label="관심 전용면적 선택" className="rounded-lg border border-neutral-200">
              {areas.map((value) => (
                <label key={value} className="flex min-h-11 items-center gap-2 px-3 py-2 text-sm">
                  <input type="checkbox" checked={draftAreas.includes(value)} disabled={areaSelectDisabled} onChange={() => toggleDraftArea(value)} className="size-4 accent-emerald-700" />
                  {formatAreaWithPyeong(Number(value))} · {countsReady ? `${areaCounts.get(value) ?? 0}건` : "—"}
                </label>
              ))}
            </div>
            {!areasQuery.isPending && areas.length === 0 ? <p className="text-xs text-neutral-500">확인된 면적이 없습니다. 모든 면적으로 조회할 수 있습니다.</p> : null}
            {areasQuery.isError ? (
              <div className="flex items-center justify-between gap-2 rounded-lg bg-neutral-50 px-3 py-2">
                <p className="text-xs leading-5 text-neutral-500">면적 정보를 불러오지 못했습니다. 현재 기간의 면적과 저장한 관심 면적만 표시합니다.</p>
                <Button type="button" variant="ghost" className="h-9 shrink-0 px-2 text-xs" disabled={areasQuery.isFetching} onClick={() => void areasQuery.refetch()}>면적 다시 시도</Button>
              </div>
            ) : null}
            <details>
              <summary className="cursor-pointer py-2 text-xs text-neutral-500">계약 유형 · {draftType === "all" ? "전체" : draftType}</summary>
              <div role="group" aria-label="계약 유형" className="grid grid-cols-3 gap-1">
                {(["all", "신규", "갱신"] as const).map((type) => (
                  <Button key={type} type="button" className="h-10" variant={draftType === type ? "default" : "outline"} aria-pressed={draftType === type} onClick={() => setDraftType(type)}>{type === "all" ? "전체" : type}</Button>
                ))}
              </div>
            </details>
            <p className="text-xs text-neutral-500">{draftAreas.length ? `${draftAreas.length}개 면적 선택` : "선택 없음 · 모든 면적으로 조회"}</p>
          </div>

        ) : (
          <div>
          {!countsReady ? (
            <div className="space-y-3 rounded-xl bg-neutral-50 px-4 py-6">
              <p role={contractQuery.isError ? "alert" : "status"} className="text-sm">{contractQuery.isError ? contractQuery.error.message : actionLabel}</p>
              {contractQuery.isError ? <Button type="button" variant="outline" disabled={contractQuery.isFetching} onClick={() => void contractQuery.refetch()}>다시 시도</Button> : null}
              <Button type="button" variant="outline" className="h-11" onClick={() => editContractFilters("period")}>기간 변경</Button>
            </div>
          ) : filtered.length === 0 ? (
            <div className="rounded-xl bg-neutral-50 px-4 py-6 text-center">
              <p className="text-sm font-medium">조건에 맞는 공개 계약이 없습니다.</p>
              <p className="mt-2 text-sm leading-6 text-neutral-500">
                {hasFilters ? "관심 면적을 변경하거나 조회 기간을 늘려보세요." : "조회 기간을 늘려 다시 확인해 보세요."}
              </p>
              <p className="mt-2 text-xs leading-5 text-neutral-500">0건이 당첨이나 입주가 없다는 뜻은 아닙니다.</p>
              <div className="mt-4 grid grid-cols-2 gap-2">
                <Button type="button" className="h-11" onClick={() => editContractFilters("period")}>기간 변경</Button>
                <Button type="button" variant="outline" className="h-11" onClick={() => editContractFilters("area")}>면적 변경</Button>
              </div>
            </div>
          ) : (
            <ul aria-label="개별 계약 내역" className="divide-y divide-neutral-100 border-y border-neutral-100">
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
          </div>

        )}
        </div>
      </BottomSheet>
    </section>
  );
}
