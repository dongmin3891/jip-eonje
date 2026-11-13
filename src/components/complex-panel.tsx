"use client";

import { useRef, useState, type ReactNode } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  addressPeers,
  hasCoordinates,
  isMixedHousingType,
  type Complex,
} from "@/lib/complexes";
import { formatDate } from "@/lib/format";
import type { MapBounds } from "@/components/housing-map";
import { isInside } from "@/components/housing-map";
import { RentSection } from "@/components/rent-section";
import { ShInfo } from "@/components/sh-info";
import { ShLinkBadge } from "@/components/sh-link-badge";
import { CopyButton } from "@/components/copy-button";
import { FavoriteButton } from "@/components/favorite-button";

export type ListScope = "all" | "favorites";

type ComplexPanelProps = {
  searchRevision: number;
  complexes: Complex[];
  selected: Complex | null;
  bounds: MapBounds | null;
  favorites: string[];
  favoriteMessage: string;
  onToggleFavorite: (id: string) => void;
  listScope: ListScope;
  onListScopeChange: (scope: ListScope) => void;
  district: string;
  onDistrictChange: (district: string) => void;
  onShowAllLocations: () => void;
  onResetFilters: () => void;
  from: string;
  to: string;
  rentEnabled: boolean;
  rangeError: string | null;
  periodControl: ReactNode;
  onSelect: (id: string) => void;
  onClear: () => void;
};

export function ComplexPanel({
  searchRevision,
  complexes,
  selected,
  bounds,
  favorites,
  favoriteMessage,
  onToggleFavorite,
  listScope,
  onListScopeChange,
  district,
  onDistrictChange,
  onShowAllLocations,
  onResetFilters,
  from,
  to,
  rentEnabled,
  rangeError,
  periodControl,
  onSelect,
  onClear,
}: ComplexPanelProps) {
  const listScroll = useRef(0);
  const [missingOpen, setMissingOpen] = useState(false);
  const filterKey = `${listScope}:${district}:${searchRevision}`;
  const lastFilter = useRef(filterKey);

  function renderRow(complex: Complex) {
    return (
      <li key={complex.id} className="flex items-start pr-2">
        <button type="button" className="min-w-0 flex-1 px-4 py-3 text-left hover:bg-neutral-50 focus-visible:outline-2 focus-visible:outline-neutral-400" onClick={() => onSelect(complex.id)}>
          <span className="block text-sm font-medium">{complex.name}</span>
          <ShLinkBadge complexId={complex.id} />
          <span className="mt-0.5 block text-xs text-neutral-500">{complex.district} · {complex.address}</span>
          {!hasCoordinates(complex) ? <span className="mt-1 block text-xs text-neutral-500">지도 위치 미확보</span> : null}
        </button>
        <FavoriteButton name={complex.name} saved={favorites.includes(complex.id)} onToggle={() => onToggleFavorite(complex.id)} />
      </li>
    );
  }

  if (!selected) {
    const matching = complexes.filter((complex) =>
      (!district || complex.district === district) &&
      (listScope !== "favorites" || favorites.includes(complex.id)),
    );
    const useMapBounds = listScope === "all" && !!bounds;
    const missing = matching.filter((complex) => !hasCoordinates(complex));
    const visible = matching.filter((complex) => hasCoordinates(complex) && (!useMapBounds || isInside(complex, bounds!)));
    const districts = [...new Set(complexes.map((complex) => complex.district))].sort((a, b) => a.localeCompare(b, "ko"));
    return (
      <div className="flex h-full min-h-0 flex-col">
        <div className="shrink-0 space-y-2 px-4 pt-3 pb-2">
          <div role="group" aria-label="단지 찾기와 관심 목록" className="grid grid-cols-2 gap-1">
            {([["all", "단지 찾기"], ["favorites", `관심 ${favorites.length}`]] as const).map(([scope, label]) => (
              <Button key={scope} type="button" className="h-11 px-2" variant={listScope === scope ? "default" : "outline"} aria-pressed={listScope === scope} onClick={() => onListScopeChange(scope)}>{label}</Button>
            ))}
          </div>
          <select aria-label="자치구 필터" className="h-11 w-full rounded-lg border border-neutral-200 bg-white px-3 text-sm" value={district} onChange={(event) => onDistrictChange(event.target.value)}>
            <option value="">모든 자치구</option>
            {districts.map((name) => <option key={name} value={name}>{name}</option>)}
          </select>
          <h2 className="text-sm font-medium tabular-nums">
            {district ? `${district} · ` : ""}{listScope === "favorites" ? `관심 단지 ${matching.length}곳` : useMapBounds ? `지도 안의 단지 ${visible.length}곳` : `위치 확인된 단지 ${visible.length}곳`}
          </h2>
          {bounds ? <Button type="button" variant="outline" className="h-11" onClick={onShowAllLocations}>{listScope === "favorites" ? "관심 단지 위치 보기" : `${district || "서울"} 단지 위치 보기`}</Button> : null}
          <p className="mt-1 text-xs leading-5 text-neutral-500">
            {listScope === "favorites" ? "지도 위치와 관계없이 저장한 단지를 보여줍니다." : useMapBounds ? "현재 지도에 보이는 단지입니다. 지도를 움직이면 목록도 바뀝니다." : "자치구를 선택해 목록을 좁힐 수 있습니다."}
          </p>
          {listScope === "favorites" ? <p className="text-xs text-neutral-500">관심 단지는 이 브라우저에 저장됩니다.</p> : null}
          <p role="status" className="text-xs leading-5 text-neutral-600">{favoriteMessage}</p>
        </div>
        <div role="region" aria-label="단지 목록" className="min-h-0 flex-1 overflow-y-auto overscroll-contain"
          ref={(node) => {
            if (!node) return;
            if (lastFilter.current !== filterKey) { listScroll.current = 0; lastFilter.current = filterKey; }
            node.scrollTop = listScroll.current;
          }}
          onScroll={(event) => { listScroll.current = event.currentTarget.scrollTop; }}>
        <ul>
          {visible.length === 0 ? (
            <li className="space-y-3 px-4 py-6 text-sm text-neutral-500">
              <p>{listScope === "favorites" && favorites.length === 0 ? "아직 관심 단지가 없습니다. 단지 옆 별표를 눌러 저장해 보세요." : missing.length ? "지도에 표시할 단지가 없습니다. 아래 위치 미확보 목록을 확인해 주세요." : "선택한 조건에 맞는 단지가 없습니다."}</p>
              <Button type="button" variant="outline" className="h-11" onClick={onResetFilters}>조건 초기화하고 단지 찾기</Button>
            </li>
          ) : (
            visible.map(renderRow)
          )}
        </ul>
        {missing.length > 0 ? (
          <details className="border-t border-neutral-200" open={missingOpen} onToggle={(event) => setMissingOpen(event.currentTarget.open)}>
            <summary className="cursor-pointer px-4 py-4 text-sm font-medium">지도 위치 미확보 {missing.length}곳</summary>
            <p className="px-4 pb-2 text-xs text-neutral-500">현재 지도 범위와 관계없는 단지입니다. 선택한 지역·관심 조건은 적용됩니다.</p>
            <ul>{missing.map(renderRow)}</ul>
          </details>
        ) : null}
        </div>
      </div>
    );
  }

  const peers = addressPeers(selected.id);
  const mixed = isMixedHousingType(selected);
  return (
    <div className="h-full min-h-0 overflow-y-auto overscroll-contain">
      <div className="sticky top-0 z-10 border-b border-neutral-100 bg-white/95 px-4 py-1 backdrop-blur-sm">
        <Button type="button" variant="ghost" className="-ml-2 h-11 px-2" onClick={onClear}>
          ← 단지 목록
        </Button>
      </div>
      <div className="space-y-6 px-5 py-5">
        <section aria-label="단지 정보">
          <h2 className="text-xl font-semibold leading-snug tracking-tight text-balance">{selected.name}</h2>
          <div className="flex items-center gap-2">
            <FavoriteButton name={selected.name} saved={favorites.includes(selected.id)} onToggle={() => onToggleFavorite(selected.id)} />
            <span className="text-sm text-neutral-600">{favorites.includes(selected.id) ? "관심 단지에 저장됨" : "관심 단지로 저장"}</span>
          </div>
          <p role="status" className="text-xs leading-5 text-neutral-600">{favoriteMessage}</p>
          <p className="mt-2 text-sm leading-6 text-neutral-600">{selected.address}</p>
          <div className="mt-3"><CopyButton key={selected.id} label="단지 링크 복사" value={() => window.location.href} /></div>
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

        <ShInfo complex={selected} />

        <div className="border-t border-neutral-200 pt-6">
          {peers.length > 0 ? (
            <p className="mb-4 rounded-lg bg-neutral-50 p-3 text-xs leading-5 text-neutral-600">
              이 주소는 {peers.map((peer) => peer.name).join(", ")}와 겹칩니다. 공개된 계약이 함께 잡힐 수 있습니다.
            </p>
          ) : null}
          <RentSection
            complex={selected}
            from={from}
            to={to}
            enabled={rentEnabled}
            mixedHousing={mixed}
            periodControl={periodControl}
            rangeError={rangeError}
          />
        </div>
      </div>
    </div>
  );
}
