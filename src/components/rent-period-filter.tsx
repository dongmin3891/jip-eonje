"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatDate } from "@/lib/format";
import { dayRange, presetRange, resolveRange } from "@/lib/rent/period";

const PRESETS = [
  { key: "week", label: "일주일", days: 7 },
  { key: "m1", label: "1개월", months: 1 },
  { key: "m3", label: "3개월", months: 3 },
  { key: "m6", label: "6개월", months: 6 },
  { key: "y1", label: "1년", months: 12 },
] as const;

export type RentPeriod =
  | { kind: "preset"; key: (typeof PRESETS)[number]["key"] }
  | { kind: "custom"; from: string; to: string };

export function rentPeriodRange(period: RentPeriod) {
  if (period.kind === "custom") return resolveRange(period.from, period.to);
  const preset = PRESETS.find((item) => item.key === period.key) ?? PRESETS[2];
  const range = "days" in preset ? dayRange(preset.days) : presetRange(preset.months);
  return { ok: true as const, ...range };
}

export function RentPeriodFilter({
  period,
  onChange,
}: {
  period: RentPeriod;
  onChange: (period: RentPeriod) => void;
}) {
  const range = rentPeriodRange(period);

  return (
    <fieldset className="min-w-0 space-y-2">
      <legend className="mb-2 text-xs font-medium text-neutral-600">조회 기간</legend>
      <div className="grid grid-cols-3 gap-1 rounded-xl bg-neutral-100 p-1">
        {PRESETS.map((preset) => (
          <Button
            key={preset.key}
            type="button"
            variant={period.kind === "preset" && period.key === preset.key ? "default" : "ghost"}
            className="h-10 px-2 text-sm"
            aria-pressed={period.kind === "preset" && period.key === preset.key}
            onClick={() => onChange({ kind: "preset", key: preset.key })}
          >
            {preset.label}
          </Button>
        ))}
        <Button
          type="button"
          variant={period.kind === "custom" ? "default" : "ghost"}
          className="h-10 px-2 text-sm"
          aria-pressed={period.kind === "custom"}
          onClick={() => {
            if (period.kind === "custom") return;
            const current = rentPeriodRange(period);
            if (current.ok) onChange({ kind: "custom", from: current.from, to: current.to });
          }}
        >
          직접 선택
        </Button>
      </div>
      {period.kind === "custom" ? (
        <div className="grid min-w-0 grid-cols-2 gap-2">
          <label className="min-w-0 space-y-1 text-xs text-neutral-600">
            <span>시작일</span>
            <Input
              type="date"
              value={period.from}
              aria-invalid={!range.ok}
              aria-describedby={!range.ok ? "rent-period-error" : undefined}
              className="h-11 bg-white"
              onChange={(event) => onChange({ ...period, from: event.target.value })}
            />
          </label>
          <label className="min-w-0 space-y-1 text-xs text-neutral-600">
            <span>종료일</span>
            <Input
              type="date"
              value={period.to}
              aria-invalid={!range.ok}
              aria-describedby={!range.ok ? "rent-period-error" : undefined}
              className="h-11 bg-white"
              onChange={(event) => onChange({ ...period, to: event.target.value })}
            />
          </label>
        </div>
      ) : range.ok ? (
        <p className="text-xs leading-5 text-neutral-500 tabular-nums">
          {formatDate(range.from)} – {formatDate(range.to)}
        </p>
      ) : null}
      {!range.ok ? (
        <p id="rent-period-error" role="alert" className="text-sm leading-5 text-red-700">
          {range.message}
        </p>
      ) : null}
    </fieldset>
  );
}
