"use client";

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

type ComplexPanelProps = {
  complexes: Complex[];
  selected: Complex | null;
  bounds: MapBounds | null;
  from: string;
  to: string;
  rentEnabled: boolean;
  rangeError: string | null;
  onSelect: (id: string) => void;
  onClear: () => void;
};

export function ComplexPanel({
  complexes,
  selected,
  bounds,
  from,
  to,
  rentEnabled,
  rangeError,
  onSelect,
  onClear,
}: ComplexPanelProps) {
  if (!selected) {
    const visible = bounds ? complexes.filter((complex) => isInside(complex, bounds)) : complexes;
    return (
      <div className="flex h-full min-h-0 flex-col">
        <div className="px-4 pt-4 pb-3">
          <h2 className="text-sm font-medium tabular-nums">
            {bounds ? `이 영역의 단지 ${visible.length}` : `전체 단지 ${visible.length}`}
          </h2>
          <p className="mt-1 text-xs leading-5 text-neutral-500">
            좌표가 없는 단지는 검색에서 고릅니다.
          </p>
        </div>
        <ul className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
          {visible.length === 0 ? (
            <li className="px-4 py-6 text-sm text-neutral-500">이 영역에는 단지가 없습니다.</li>
          ) : (
            visible.map((complex) => (
              <li key={complex.id}>
                <button
                  type="button"
                  className="w-full px-4 py-3 text-left transition-colors duration-150 hover:bg-neutral-50 focus-visible:bg-neutral-50 focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-neutral-400"
                  onClick={() => onSelect(complex.id)}
                >
                  <span className="block text-sm font-medium">{complex.name}</span>
                  <span className="mt-0.5 block text-xs text-neutral-500">
                    {complex.district} · {complex.address}
                  </span>
                  {hasCoordinates(complex) ? null : (
                    <span className="mt-1 block text-xs text-neutral-400">지도 위치 미확보</span>
                  )}
                </button>
              </li>
            ))
          )}
        </ul>
      </div>
    );
  }

  const peers = addressPeers(selected.id);
  const mixed = isMixedHousingType(selected);

  return (
    <div className="h-full min-h-0 overflow-y-auto overscroll-contain px-5 py-5">
      <Button type="button" variant="ghost" size="sm" className="-ml-2 mb-4" onClick={onClear}>
        ← 목록
      </Button>
      <h2 className="text-2xl font-semibold tracking-tight text-balance">{selected.name}</h2>
      <p className="mt-1 text-sm leading-6 text-neutral-600">
        {selected.district} · {selected.address}
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Badge variant="outline">{selected.housingType}</Badge>
        {hasCoordinates(selected) ? null : <Badge variant="secondary">지도 위치 미확보</Badge>}
      </div>
      {selected.rentalUnits != null || selected.moveInDate ? (
        <p className="mt-4 text-sm leading-6 text-neutral-500 tabular-nums">
          {selected.rentalUnits != null
            ? `SH 임대세대수 ${selected.rentalUnits.toLocaleString("ko-KR")}세대`
            : null}
          {selected.rentalUnits != null && selected.moveInDate ? " · " : null}
          {selected.moveInDate ? `입주개시 ${formatDate(selected.moveInDate)}.` : null}
        </p>
      ) : null}
      {peers.length > 0 ? (
        <p className="mt-2 text-xs leading-5 text-neutral-500">
          이 주소는 {peers.map((peer) => peer.name).join(", ")}와 겹칩니다. 공개된 계약이 함께 잡힐 수
          있습니다.
        </p>
      ) : null}

      <div className="mt-8">
        <ShInfo complex={selected} />
      </div>
      <div className="mt-8">
        {rangeError ? (
          <p className="text-sm leading-6 text-neutral-600">{rangeError}</p>
        ) : (
          <RentSection
            complex={selected}
            from={from}
            to={to}
            enabled={rentEnabled}
            mixedHousing={mixed}
          />
        )}
      </div>
    </div>
  );
}
