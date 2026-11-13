"use client";

import { useEffect, useMemo, useState } from "react";

import { ComplexPanel } from "@/components/complex-panel";
import { ComplexSearch } from "@/components/complex-search";
import { HousingMap, type MapBounds } from "@/components/housing-map";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { complexes, complexMeta, getComplex, type Complex } from "@/lib/complexes";
import { formatDate } from "@/lib/format";
import { dayRange, presetRange, resolveRange } from "@/lib/rent/period";

const PRESETS = [
  { key: "week", label: "일주일", days: 7 },
  { key: "m1", label: "1개월", months: 1 },
  { key: "m3", label: "3개월", months: 3 },
  { key: "m6", label: "6개월", months: 6 },
  { key: "y1", label: "1년", months: 12 },
] as const;

type Period =
  | { kind: "preset"; key: (typeof PRESETS)[number]["key"] }
  | { kind: "custom"; from: string; to: string };

function presetSpan(key: (typeof PRESETS)[number]["key"]) {
  const preset = PRESETS.find((item) => item.key === key) ?? PRESETS[2];
  if ("days" in preset) return dayRange(preset.days);
  return presetRange(preset.months);
}

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

export function HomeShell({ mapKey, hasRentKey }: HomeShellProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [bounds, setBounds] = useState<MapBounds | null>(null);
  const [period, setPeriod] = useState<Period>({ kind: "preset", key: "m3" });
  const [rememberedName, setRememberedName] = useState("");
  const selected = selectedId ? (getComplex(selectedId) ?? null) : null;

  useEffect(() => {
    const id = rememberedComplexId();
    const complex = id ? getComplex(id) : null;
    if (!complex) return;
    setSelectedId(complex.id);
    setRememberedName(complex.name);
  }, []);

  function chooseComplex(id: string) {
    const complex = getComplex(id);
    if (!complex) return;
    setSelectedId(complex.id);
    setRememberedName(complex.name);
    rememberComplex(complex.id);
  }

  const range = useMemo(() => {
    if (period.kind === "preset") {
      const preset = presetSpan(period.key);
      return { ok: true as const, from: preset.from, to: preset.to };
    }
    const resolved = resolveRange(period.from, period.to);
    if (!resolved.ok) return resolved;
    return { ok: true as const, from: resolved.from, to: resolved.to };
  }, [period]);

  function selectComplex(complex: Complex) {
    chooseComplex(complex.id);
  }

  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-white text-neutral-900">
      <header className="z-20 shrink-0 border-b border-neutral-200 bg-white px-4 pt-4 pb-3">
        <div className="mb-4 flex items-baseline justify-between gap-4">
          <div>
            <h1 className="text-lg font-semibold tracking-tight text-balance">집언제</h1>
            <p className="mt-0.5 text-sm text-neutral-500">SH 행복주택 · 공개된 전월세 계약</p>
          </div>
          <p className="text-right text-xs leading-5 text-neutral-400 tabular-nums">
            단지 목록 {formatDate(complexMeta.complexList.referenceDate)}
            <br />
            {complexMeta.counts.complexes}곳 · 지도 {complexMeta.counts.withCoordinates}곳
          </p>
        </div>
        <ComplexSearch initialQuery={rememberedName} onSelect={selectComplex} />
      </header>

      <div className="relative flex min-h-0 flex-1">
        <div className="relative min-h-0 min-w-0 flex-1">
          <div className="absolute top-3 right-3 left-3 z-10 flex flex-wrap items-center gap-1 rounded-xl border border-black/10 bg-white/95 p-1 shadow-[0_1px_1px_oklch(0_0_0/0.04),0_8px_24px_oklch(0_0_0/0.08)] backdrop-blur-md">
            {PRESETS.map((preset) => {
              const active = period.kind === "preset" && period.key === preset.key;
              return (
                <Button
                  key={preset.key}
                  type="button"
                  size="sm"
                  variant={active ? "default" : "ghost"}
                  onClick={() => setPeriod({ kind: "preset", key: preset.key })}
                >
                  {preset.label}
                </Button>
              );
            })}
            <Button
              type="button"
              size="sm"
              variant={period.kind === "custom" ? "default" : "ghost"}
              onClick={() =>
                setPeriod((current) => {
                  if (current.kind === "custom") return current;
                  const initial = presetRange(3);
                  return { kind: "custom", from: initial.from, to: initial.to };
                })
              }
            >
              직접 선택
            </Button>
            {period.kind === "custom" ? (
              <div className="flex items-center gap-1 rounded-xl bg-neutral-50 p-1">
                <Input
                  type="date"
                  aria-label="시작일"
                  value={period.from}
                  className="h-7 w-[9.5rem] bg-white"
                  onChange={(event) =>
                    setPeriod((current) =>
                      current.kind === "custom" ? { ...current, from: event.target.value } : current,
                    )
                  }
                />
                <span className="text-xs text-neutral-400">–</span>
                <Input
                  type="date"
                  aria-label="종료일"
                  value={period.to}
                  className="h-7 w-[9.5rem] bg-white"
                  onChange={(event) =>
                    setPeriod((current) =>
                      current.kind === "custom" ? { ...current, to: event.target.value } : current,
                    )
                  }
                />
              </div>
            ) : null}
          </div>

          {mapKey ? (
            <HousingMap
              mapKey={mapKey}
              complexes={complexes}
              selectedId={selectedId}
              onSelect={chooseComplex}
              onBounds={setBounds}
            />
          ) : (
            <div className="flex h-full items-center justify-center bg-neutral-50 px-6 text-center">
              <div className="max-w-sm">
                <p className="text-sm font-medium">지도를 표시하지 않습니다</p>
                <p className="mt-2 text-sm leading-6 text-neutral-500">
                  카카오맵 JavaScript 키가 없습니다. 단지는 검색과 목록에서 고를 수 있습니다. 좌표가 없는{" "}
                  {complexMeta.counts.withoutCoordinates}곳은 지도에 올리지 않습니다.
                </p>
              </div>
            </div>
          )}
        </div>

        <aside className="absolute inset-x-0 bottom-0 z-20 flex max-h-[min(48dvh,520px)] flex-col overscroll-contain border-t border-neutral-200 bg-white shadow-[0_-8px_24px_oklch(0_0_0/0.06)] md:static md:z-auto md:h-full md:max-h-none md:w-[420px] md:shrink-0 md:border-t-0 md:border-l md:shadow-none">
          <div className="mx-auto mt-2 h-1 w-10 shrink-0 rounded-full bg-neutral-200 md:hidden" />
          <ComplexPanel
            complexes={complexes}
            selected={selected}
            bounds={mapKey ? bounds : null}
            from={range.ok ? range.from : period.kind === "custom" ? period.from : ""}
            to={range.ok ? range.to : period.kind === "custom" ? period.to : ""}
            rentEnabled={hasRentKey && range.ok}
            rangeError={range.ok ? null : range.message}
            onSelect={chooseComplex}
            onClear={() => setSelectedId(null)}
          />
        </aside>
      </div>
    </div>
  );
}
