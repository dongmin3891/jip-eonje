"use client";

import { useRef, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import {
  addressPeers,
  hasCoordinates,
  isMixedHousingType,
  type Complex,
} from "@/lib/complexes";
import { formatDate } from "@/lib/format";
import { RentSection } from "@/components/rent-section";
import { ShInfo } from "@/components/sh-info";
import { CopyButton } from "@/components/copy-button";
import { FavoriteButton } from "@/components/favorite-button";
import { SearchHighlight } from "@/components/search-highlight";
import { rentShareUrl, type RentFilters } from "@/lib/rent/share";

export type ListScope = "all" | "favorites";

type ComplexPanelProps = {
  searchQuery: string;
  searchResults: Complex[] | null;
  onClearSearch: () => void;
  onShowMap: () => void;
  complexes: Complex[];
  selected: Complex | null;
  lastViewedId: string | null;
  favorites: string[];
  favoriteMessage: string;
  onToggleFavorite: (id: string) => void;
  listScope: ListScope;
  onListScopeChange: (scope: ListScope) => void;
  district: string;
  onDistrictChange: (district: string) => void;
  onResetFilters: () => void;
  from: string;
  to: string;
  rentEnabled: boolean;
  rangeError: string | null;
  filters: RentFilters;
  onApplyFilters: (filters: RentFilters) => boolean;
  onSelect: (id: string) => void;
  onClear: () => void;
};

export function ComplexPanel({
  searchQuery,
  searchResults,
  onClearSearch,
  onShowMap,
  complexes,
  selected,
  lastViewedId,
  favorites,
  favoriteMessage,
  onToggleFavorite,
  listScope,
  onListScopeChange,
  district,
  onDistrictChange,
  onResetFilters,
  from,
  to,
  rentEnabled,
  rangeError,
  filters,
  onApplyFilters,
  onSelect,
  onClear,
}: ComplexPanelProps) {
  const listScroll = useRef<Record<string, number>>({});
  const [regionOpen, setRegionOpen] = useState(false);
  const regionTrigger = useRef<HTMLButtonElement>(null);
  const [rentActionContainer, setRentActionContainer] = useState<HTMLDivElement | null>(null);
  const filterKey = searchQuery ? `search:${searchQuery}` : `browse:${listScope}:${district}`;
  const backLabel = searchQuery ? "검색 결과" : listScope === "favorites" ? "관심 단지" : district ? `${district} 목록` : "단지 목록";
  const mapButton = <Button type="button" variant="outline" className="h-11 shrink-0 px-3 text-xs md:hidden" onClick={onShowMap}>지도 보기</Button>;

  function renderRow(complex: Complex) {
    const address = complex.address.replace(/^서울(?:특별시|시)?\s*/, "");
    const street = address.startsWith(complex.district) ? address.slice(complex.district.length).trim() : address;
    return (
      <li key={complex.id} className={`flex items-start border-b border-neutral-100 pr-2 ${lastViewedId === complex.id ? "bg-amber-50/70" : ""}`}>
        <button type="button" data-complex={complex.id} aria-label={`${complex.name} ${complex.district} · ${street}`} className="min-w-0 flex-1 px-4 py-3 text-left hover:bg-neutral-50 focus-visible:outline-2 focus-visible:outline-neutral-400" onClick={() => onSelect(complex.id)}>
          <span className="line-clamp-2 text-base font-semibold leading-6"><SearchHighlight text={complex.name} query={searchQuery} /></span>
          <span className="mt-1 block truncate text-xs text-neutral-500"><SearchHighlight text={`${complex.district} · ${street}`} query={searchQuery} /></span>
          {lastViewedId === complex.id ? <span className="mt-1 block text-xs text-amber-800">방금 본 단지</span> : null}
          {!hasCoordinates(complex) ? <span className="mt-1 block text-xs text-neutral-400">지도 표시 없음</span> : null}
        </button>
        <FavoriteButton name={complex.name} saved={favorites.includes(complex.id)} onToggle={() => onToggleFavorite(complex.id)} />
      </li>
    );
  }

  if (!selected) {
    const matching = searchResults ?? complexes.filter((complex) =>
      (!district || complex.district === district) &&
      (listScope !== "favorites" || favorites.includes(complex.id)),
    );
    const districts = [...new Set(complexes.map((complex) => complex.district))].sort((a, b) => a.localeCompare(b, "ko"));
    return (
      <div className="flex h-full min-h-0 flex-col">
        <div className="shrink-0 space-y-2 px-4 pt-3 pb-2">
          {searchQuery ? <div className="flex items-center justify-between gap-3">
            <div className="min-w-0" aria-live="polite" aria-atomic="true">
            <h2 className="break-words text-sm font-semibold">‘{searchQuery}’ 검색 결과 · {matching.length}곳</h2>
            <p className="mt-1 text-xs text-neutral-500">서울 전체에서 찾은 단지입니다.</p>
            </div>
            {mapButton}
          </div> : <>
          <div role="group" aria-label="단지 찾기와 관심 목록" className="grid grid-cols-2 gap-1">
            {([["all", "단지 찾기"], ["favorites", `관심 ${favorites.length}`]] as const).map(([scope, label]) => (
              <Button key={scope} type="button" className="h-11 px-2" variant={listScope === scope ? "default" : "outline"} aria-pressed={listScope === scope} onClick={() => onListScopeChange(scope)}>{label}</Button>
            ))}
          </div>
          <div className="flex items-center justify-between gap-2">
            <Button ref={regionTrigger} type="button" variant={district ? "ghost" : "outline"} className={`h-11 px-2 ${district ? "-ml-2" : "border-emerald-200 bg-emerald-50 text-emerald-950 hover:bg-emerald-100"}`} aria-label={`지역 선택: ${district || "지역으로 찾기 (서울 모든 지역)"}`} aria-haspopup="dialog" aria-expanded={regionOpen} onClick={() => setRegionOpen(true)}>
              {district || "지역으로 찾기"} <span aria-hidden="true">⌄</span>
            </Button>
            <div className="flex shrink-0 items-center gap-2">
              <h2 className="text-xs text-neutral-500 tabular-nums"><span className="sr-only">{listScope === "favorites" ? "관심 단지 " : "단지 "}</span>{matching.length}곳</h2>
              {mapButton}
            </div>
          </div>
          </>}
          {favoriteMessage ? <p role="status" className="text-xs leading-5 text-neutral-600">{favoriteMessage}</p> : null}
        </div>
        <div id="complex-list" role="region" aria-label="단지 목록" className="min-h-0 flex-1 overflow-y-auto overscroll-contain"
          ref={(node) => {
            if (!node) return;
            node.scrollTop = listScroll.current[filterKey] ?? 0;
          }}
          onScroll={(event) => { listScroll.current[filterKey] = event.currentTarget.scrollTop; }}>
        <ul>
          {matching.length === 0 ? (
            <li className="space-y-3 px-4 py-6 text-sm text-neutral-500">
              <p>{searchQuery ? "검색 결과가 없습니다. 단지명이나 지역 이름을 바꿔 보세요." : listScope === "favorites" && favorites.length === 0 ? "아직 관심 단지가 없습니다. 단지 옆 별표를 눌러 저장해 보세요." : "선택한 조건에 맞는 단지가 없습니다."}</p>
              <Button type="button" variant="outline" className="h-11" onClick={searchQuery ? onClearSearch : onResetFilters}>{searchQuery ? "검색 종료하고 이전 목록 보기" : "조건 초기화하고 단지 찾기"}</Button>
            </li>
          ) : (
            matching.map(renderRow)
          )}
        </ul>
        </div>
        <BottomSheet open={regionOpen} onClose={() => setRegionOpen(false)} title="지역 선택" description="선택한 지역의 단지를 목록과 지도에서 확인합니다." returnFocus={regionTrigger}>
          <div className="grid grid-cols-3 gap-2" role="group" aria-label="자치구">
            {["", ...districts].map((name) => (
              <Button key={name} type="button" variant={district === name ? "default" : "outline"} className={`h-11 ${name ? "" : "col-span-3"}`} aria-pressed={district === name} onClick={() => { onDistrictChange(name); setRegionOpen(false); }}>
                {name || "서울 모든 지역"}
              </Button>
            ))}
          </div>
        </BottomSheet>
      </div>
    );
  }

  const peers = addressPeers(selected.id);
  const mixed = isMixedHousingType(selected);
  return (
    <div className="relative h-full min-h-0">
      <div data-detail-scroll className="h-full min-h-0 overflow-y-auto overscroll-contain scroll-pb-28">
      <div className="sticky top-0 z-10 flex items-center gap-2 border-b border-neutral-100 bg-white/95 px-4 py-1 backdrop-blur-sm">
        <Button type="button" variant="ghost" className="-ml-2 h-11 shrink-0 px-2" onClick={onClear}>
          ← {backLabel}
        </Button>
        <h2 className="min-w-0 flex-1 truncate text-sm font-semibold" title={selected.name}>{selected.name}</h2>
        <FavoriteButton name={selected.name} saved={favorites.includes(selected.id)} onToggle={() => onToggleFavorite(selected.id)} />
      </div>
      <div key={selected.id} className="space-y-4 px-4 pt-3 pb-28">
          {favoriteMessage ? <p role="status" className="text-xs leading-5 text-neutral-600">{favoriteMessage}</p> : null}

        <RentSection
          actionContainer={rentActionContainer}
          complex={selected}
          from={from}
          to={to}
          enabled={rentEnabled}
          mixedHousing={mixed}
          filters={filters}
          onApplyFilters={onApplyFilters}
          rangeError={rangeError}
          addressWarning={peers.length ? `이 주소는 ${peers.map((peer) => peer.name).join(", ")}와 겹쳐 공개 계약이 함께 잡힐 수 있습니다.` : undefined}
        />

        <ShInfo complex={selected} />
        <section aria-label="단지 기본정보">
          <p className="mt-2 text-sm leading-6 text-neutral-600">{selected.address}</p>
          <div className="mt-3"><CopyButton key={`${selected.id}:${from}:${to}:${filters.areas.join(",")}:${filters.contractType}`} label="조회 조건 링크 복사" value={() => rentShareUrl(window.location.href, selected.id, from, to, filters)} /></div>
          <p className="mt-1 text-xs text-neutral-500">단지·기간·면적·계약 유형을 함께 공유합니다.</p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Badge variant="outline">{selected.housingType}</Badge>
            {hasCoordinates(selected) ? null : <Badge variant="secondary">지도 위치 미확보</Badge>}
          </div>
          {selected.rentalUnits != null || selected.moveInDate ? (
            <details className="group mt-3 text-sm">
              <summary className="cursor-pointer rounded-md py-2 text-neutral-500 hover:text-neutral-900 focus-visible:outline-2 focus-visible:outline-neutral-500">
                단지 기본정보
              </summary>
              <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 rounded-lg bg-neutral-50 p-3 text-sm tabular-nums">
                {selected.rentalUnits != null ? (
                  <>
                    <dt className="text-neutral-500">SH 임대세대수</dt>
                    <dd className="text-right">{selected.rentalUnits.toLocaleString("ko-KR")}세대</dd>
                  </>
                ) : null}
                {selected.moveInDate ? (
                  <>
                    <dt className="text-neutral-500">입주개시</dt>
                    <dd className="text-right">{formatDate(selected.moveInDate)}</dd>
                  </>
                ) : null}
              </dl>
            </details>
          ) : null}
        </section>

      </div>
      </div>
      <div ref={setRentActionContainer} role="region" aria-label="계약 내역 바로가기" className="pointer-events-none absolute inset-x-0 bottom-0 z-20 bg-gradient-to-t from-white via-white/95 to-transparent px-4 pt-6 pb-3" />
    </div>
  );
}
