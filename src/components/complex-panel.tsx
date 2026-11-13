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
        <div className="border-b border-neutral-100 px-4 py-3">
          <h2 className="text-sm font-medium">
            {bounds ? `이 영역의 단지 ${visible.length}` : `전체 단지 ${visible.length}`}
          </h2>
          <p className="mt-1 text-xs leading-5 text-neutral-500">
            좌표가 없는 단지는 검색에서 고릅니다.
          </p>
        </div>
        <ul className="min-h-0 flex-1 overflow-y-auto">
          {visible.length === 0 ? (
            <li className="px-4 py-6 text-sm text-neutral-500">이 영역에는 단지가 없습니다.</li>
          ) : (
            visible.map((complex) => (
              <li key={complex.id} className="border-b border-neutral-100">
                <button
                  type="button"
                  className="w-full px-4 py-3 text-left hover:bg-neutral-50"
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
    <div className="h-full min-h-0 overflow-y-auto px-4 py-4">
      <Button type="button" variant="ghost" size="sm" className="-ml-2 mb-3" onClick={onClear}>
        목록
      </Button>
      <h2 className="text-xl font-semibold tracking-tight">{selected.name}</h2>
      <p className="mt-1 text-sm leading-6 text-neutral-600">
        {selected.district} · {selected.address}
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Badge variant="outline">{selected.housingType}</Badge>
        {hasCoordinates(selected) ? null : <Badge variant="secondary">지도 위치 미확보</Badge>}
      </div>
      <p className="mt-3 text-xs leading-5 text-neutral-500">
        {selected.rentalUnits == null
          ? "임대세대수는 원본에 없습니다. 공가 수가 아닙니다."
          : `SH 임대세대수 ${selected.rentalUnits.toLocaleString("ko-KR")}세대 · 공가 수가 아닙니다.`}
        {selected.moveInDate ? ` 입주개시 ${formatDate(selected.moveInDate)}.` : ""}
      </p>
      {peers.length > 0 ? (
        <p className="mt-2 text-xs leading-5 text-neutral-500">
          이 주소는 {peers.map((peer) => peer.name).join(", ")}와 겹칩니다. 공개된 계약이 함께 잡힐 수
          있습니다.
        </p>
      ) : null}

      <div className="mt-5 border-t border-neutral-100 pt-4">
        <ShInfo />
      </div>
      <div className="mt-5 border-t border-neutral-100 pt-4">
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
