"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";

import { ComplexPanel, type ListScope } from "@/components/complex-panel";
import { FAVORITES_KEY, readFavorites } from "@/lib/favorites";
import { RECENT_COMPLEXES_KEY, normalizeRecentComplexes, readRecentComplexes } from "@/lib/recent-complexes";
import { ComplexSearch } from "@/components/complex-search";
import { HousingMap, type MapBounds } from "@/components/housing-map";
import { Button } from "@/components/ui/button";
import { RentPeriodFilter, rentPeriodRange, type RentPeriod } from "@/components/rent-period-filter";
import { complexes, complexMeta, getComplex, type Complex } from "@/lib/complexes";
import { formatDate } from "@/lib/format";

type PanelSize = "collapsed" | "default" | "expanded";

const PANEL_HEIGHTS: Record<PanelSize, string> = {
  collapsed: "h-16",
  default: "h-[min(48dvh,60%)]",
  expanded: "h-full",
};

type HomeShellProps = {
  mapKey: string;
  hasRentKey: boolean;
};

const LAST_COMPLEX_KEY = "jip-eonje:last-complex";

function rememberedComplexId(): string | null {
  try {
    const id = localStorage.getItem(LAST_COMPLEX_KEY);
    return id && getComplex(id) ? id : null;
  } catch {
    return null;
  }
}

function rememberComplex(id: string) {
  try {
    localStorage.setItem(LAST_COMPLEX_KEY, id);
  } catch {
    // 저장이 막혀도 이번 화면의 선택은 유지한다.
  }
}

function updateComplexUrl(id: string | null, replace = false) {
  const url = new URL(window.location.href);
  if (id) url.searchParams.set("complex", id);
  else url.searchParams.delete("complex");
  if (url.href === window.location.href) return;
  window.history[replace ? "replaceState" : "pushState"](null, "", url);
}

export function HomeShell({ mapKey, hasRentKey }: HomeShellProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [bounds, setBounds] = useState<MapBounds | null>(null);
  const [period, setPeriod] = useState<RentPeriod>({ kind: "preset", key: "m3" });
  const [panelSize, setPanelSize] = useState<PanelSize>("default");
  const [rememberedName, setRememberedName] = useState("");
  const [recentIds, setRecentIds] = useState<string[]>([]);
  const recentIdsRef = useRef<string[]>([]);
  const recentStorageUnavailable = useRef(false);
  const [recentMessage, setRecentMessage] = useState("");
  const recentComplexes = recentIds.flatMap((id) => { const complex = getComplex(id); return complex ? [complex] : []; });
  const recordRecent = useCallback((id: string | null) => {
    const stored = recentStorageUnavailable.current ? null : readRecentComplexes();
    const current = stored ?? recentIdsRef.current;
    const next = normalizeRecentComplexes(id ? [id, ...current] : current);
    recentIdsRef.current = next;
    setRecentIds(next);
    if (!id) return;
    try {
      localStorage.setItem(RECENT_COMPLEXES_KEY, JSON.stringify(next));
      recentStorageUnavailable.current = false;
      setRecentMessage("");
    } catch {
      recentStorageUnavailable.current = true;
      setRecentMessage("브라우저 저장이 제한되어 최근 기록은 이번 화면에서만 유지됩니다.");
    }
  }, []);

  function clearRecents() {
    recentIdsRef.current = [];
    setRecentIds([]);
    try {
      localStorage.removeItem(RECENT_COMPLEXES_KEY);
      recentStorageUnavailable.current = false;
      setRecentMessage("최근 본 단지 기록을 지웠습니다.");
    } catch {
      recentStorageUnavailable.current = true;
      setRecentMessage("이번 화면의 기록을 지웠습니다. 브라우저에 저장된 기록은 삭제하지 못했습니다.");
    }
  }
  const [favorites, setFavorites] = useState<string[]>([]);
  const [favoriteMessage, setFavoriteMessage] = useState("");
  const [listScope, setListScope] = useState<ListScope>("all");
  const [exploreDistrict, setExploreDistrict] = useState("");
  const [favoriteDistrict, setFavoriteDistrict] = useState("");
  const district = listScope === "favorites" ? favoriteDistrict : exploreDistrict;
  const setDistrict = listScope === "favorites" ? setFavoriteDistrict : setExploreDistrict;
  const [mapReset, setMapReset] = useState(0);
  const [searchRevision, setSearchRevision] = useState(0);
  const mapFavorites = listScope === "favorites" ? favorites : null;
  const mapComplexes = useMemo(() => !district && !mapFavorites ? complexes : complexes.filter((complex) =>
    (!district || complex.district === district) &&
    (!mapFavorites || mapFavorites.includes(complex.id)),
  ), [district, mapFavorites]);

  function showAllLocations() {
    setBounds(null);
    setMapReset((value) => value + 1);
  }
  const selected = selectedId ? (getComplex(selectedId) ?? null) : null;

  useEffect(() => {
    // 첫 렌더는 서버와 같게 유지하고, 마운트 뒤 브라우저 저장값을 복원한다.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setFavorites(readFavorites());
    const syncFavorites = (event: StorageEvent) => {
      if (event.key === FAVORITES_KEY || event.key === null) setFavorites(readFavorites());
    };
    window.addEventListener("storage", syncFavorites);
    return () => window.removeEventListener("storage", syncFavorites);
  }, []);

  function toggleFavorite(id: string) {
    const saved = favorites.includes(id);
    const next = saved ? favorites.filter((item) => item !== id) : [...favorites, id];
    setFavorites(next);
    try {
      localStorage.setItem(FAVORITES_KEY, JSON.stringify(next));
      setFavoriteMessage("");
    } catch {
      setFavoriteMessage("브라우저 저장이 제한되어 이번 화면에서만 유지됩니다.");
    }
  }

  useEffect(() => {
    function restore(fromHistory = false) {
      const params = new URLSearchParams(window.location.search);
      const id = params.get("complex") ?? (fromHistory ? null : rememberedComplexId());
      const complex = id ? getComplex(id) : null;
      setSelectedId(complex?.id ?? null);
      setRememberedName(complex?.name ?? "");
      recordRecent(complex?.id ?? null);
      if (complex) {
        setPanelSize((current) => current === "collapsed" ? "default" : current);
        if (!params.has("complex")) updateComplexUrl(complex.id, true);
      }
    }
    restore();
    const onPopState = () => restore(true);
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, [recordRecent]);

  function chooseComplex(id: string) {
    const complex = getComplex(id);
    if (!complex) return;
    setSelectedId(complex.id);
    setRememberedName(complex.name);
    setPanelSize((current) => current === "collapsed" ? "default" : current);
    rememberComplex(complex.id);
    recordRecent(complex.id);
    updateComplexUrl(complex.id);
  }

  const range = useMemo(() => rentPeriodRange(period), [period]);

  function selectComplex(complex: Complex) {
    setListScope("all");
    setExploreDistrict(complex.district);
    setBounds(null);
    setSearchRevision((value) => value + 1);
    setPanelSize("default");
    // 위치가 없는 검색 결과는 목록 복귀 시 해당 자치구 범위로 이동한다.
    if (complex.lat == null || complex.lng == null) setMapReset((value) => value + 1);
    chooseComplex(complex.id);
  }

  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-white text-neutral-900">
      <header className="z-20 shrink-0 border-b border-neutral-200 bg-[#fbfaf6] px-4 py-3 md:px-6">
        <div className="mb-3 flex items-center justify-between gap-3 md:gap-5">
          <div className="flex min-w-0 items-center gap-3 md:gap-4">
            <div className="grid h-14 w-20 shrink-0 place-items-center overflow-hidden rounded-2xl border border-[#e8e1d2] bg-[#f3efe4] md:h-[4.5rem] md:w-28">
              <Image
                src="/images/header-housing.png"
                alt="지도와 아파트 일러스트"
                width={600}
                height={393}
                priority
                sizes="(min-width: 768px) 112px, 80px"
                className="h-auto w-[5.3rem] max-w-none translate-y-0.5 md:w-[7.2rem]"
              />
            </div>
            <div className="min-w-0">
              <p className="text-[11px] font-semibold tracking-[0.08em] text-neutral-500 md:text-xs">서울 SH 행복주택</p>
              <h1 className="mt-0.5 text-xl font-bold tracking-[-0.035em] text-neutral-950 md:text-2xl">집언제</h1>
              <p className="mt-0.5 truncate text-xs text-neutral-500 md:text-sm">단지 위치와 공개된 전월세 계약을 한눈에</p>
            </div>
          </div>
          <div className="shrink-0 rounded-xl border border-neutral-200/80 bg-white/75 px-2.5 py-2 text-right shadow-sm shadow-black/[0.02] md:px-3">
            <p className="hidden text-[11px] text-neutral-400 sm:block">{formatDate(complexMeta.complexList.referenceDate)} 기준</p>
            <p className="text-xs font-semibold text-neutral-700 tabular-nums md:mt-0.5">
              {complexMeta.counts.complexes}곳
              <span className="block font-normal text-neutral-400 sm:inline"> · 지도 {complexMeta.counts.withCoordinates}곳</span>
            </p>
          </div>
        </div>
        <ComplexSearch key={selectedId ?? "list"} initialQuery={rememberedName} recentComplexes={recentComplexes} recentMessage={recentMessage} onClearRecents={clearRecents} onSelect={selectComplex} />
      </header>

      <div className="relative flex min-h-0 flex-1 flex-col md:flex-row">
        <div className="relative min-h-0 min-w-0 flex-1 overflow-hidden">
          {mapKey ? (
            <HousingMap
              mapKey={mapKey}
              complexes={mapComplexes}
              resetView={mapReset}
              searchRevision={searchRevision}
              selectedId={selectedId}
              onSelect={chooseComplex}
              onBounds={(value) => { if (!selectedId) setBounds(value); }}
            />
          ) : (
            <div className="flex h-full items-center justify-center bg-neutral-50 px-6 text-center">
              <div className="max-w-sm">
                <p className="text-sm font-medium">현재 지도를 사용할 수 없습니다</p>
                <p className="mt-2 text-sm leading-6 text-neutral-500">
                  검색과 단지 목록에서 계속 이용할 수 있습니다.
                </p>
              </div>
            </div>
          )}
        </div>

        <aside
          aria-label="단지 탐색"
          className={`z-20 flex max-h-full shrink-0 flex-col overflow-hidden rounded-t-2xl border-t border-neutral-200 bg-white md:z-auto md:h-full md:w-[440px] md:rounded-none md:border-t-0 md:border-l ${PANEL_HEIGHTS[panelSize]}`}
        >
          <div className="flex h-16 shrink-0 items-center justify-between gap-2 border-b border-neutral-100 px-4 md:hidden">
            <p className="min-w-0 truncate text-sm font-medium">{selected?.name ?? "단지 목록"}</p>
            <div className="flex shrink-0 gap-1" role="group" aria-label="패널 크기">
              {([
                ["collapsed", "접기"],
                ["default", "기본"],
                ["expanded", "펼치기"],
              ] as const).map(([size, label]) => (
                <Button
                  key={size}
                  type="button"
                  variant={panelSize === size ? "secondary" : "ghost"}
                  className="h-11 min-w-11 px-2 text-xs"
                  aria-pressed={panelSize === size}
                  aria-controls="complex-panel-content"
                  onClick={() => setPanelSize(size)}
                >
                  {label}
                </Button>
              ))}
            </div>
          </div>
          <div
            id="complex-panel-content"
            className={`min-h-0 flex-1 pb-[env(safe-area-inset-bottom)] md:block md:pb-0 ${panelSize === "collapsed" ? "hidden" : "block"}`}
          >
            <ComplexPanel
              searchRevision={searchRevision}
              onResetFilters={() => { setExploreDistrict(""); setFavoriteDistrict(""); setListScope("all"); showAllLocations(); }}
              complexes={complexes}
              selected={selected}
              bounds={mapKey ? bounds : null}
              favorites={favorites}
              favoriteMessage={favoriteMessage}
              onToggleFavorite={toggleFavorite}
              listScope={listScope}
              onListScopeChange={(scope) => { setListScope(scope); showAllLocations(); }}
              district={district}
              onDistrictChange={(value) => { setDistrict(value); showAllLocations(); }}
              onShowAllLocations={showAllLocations}
              from={range.ok ? range.from : period.kind === "custom" ? period.from : ""}
              to={range.ok ? range.to : period.kind === "custom" ? period.to : ""}
              rentEnabled={hasRentKey && range.ok}
              rangeError={range.ok ? null : range.message}
              periodControl={<RentPeriodFilter period={period} onChange={setPeriod} />}
              onSelect={chooseComplex}
              onClear={() => {
                setSelectedId(null);
                setRememberedName("");
                updateComplexUrl(null);
                try { localStorage.removeItem(LAST_COMPLEX_KEY); } catch { /* 저장이 제한되어도 목록으로 이동한다. */ }
              }}
            />
          </div>
        </aside>
      </div>
    </div>
  );
}
