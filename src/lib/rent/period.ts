const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export function koreaToday(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

export function shiftDays(isoDate: string, days: number): string {
  const [year, month, day] = isoDate.split("-").map(Number);
  const shifted = new Date(Date.UTC(year, month - 1, day + days));
  const nextYear = shifted.getUTCFullYear();
  const nextMonth = String(shifted.getUTCMonth() + 1).padStart(2, "0");
  const nextDay = String(shifted.getUTCDate()).padStart(2, "0");
  return `${nextYear}-${nextMonth}-${nextDay}`;
}

export function shiftMonths(isoDate: string, months: number): string {
  const [year, month, day] = isoDate.split("-").map(Number);
  const shifted = new Date(Date.UTC(year, month - 1 + months, day));
  const nextYear = shifted.getUTCFullYear();
  const nextMonth = String(shifted.getUTCMonth() + 1).padStart(2, "0");
  const nextDay = String(shifted.getUTCDate()).padStart(2, "0");
  return `${nextYear}-${nextMonth}-${nextDay}`;
}

export function presetRange(
  months: 1 | 3 | 6 | 12,
  today = koreaToday(),
): { from: string; to: string } {
  return { from: shiftMonths(today, -months), to: today };
}

/** 일주일. 끝날은 서울 오늘이고, 시작은 그 7일 전이다. */
export function dayRange(days: 7, today = koreaToday()): { from: string; to: string } {
  return { from: shiftDays(today, -days), to: today };
}

/** 전용면적 목록용 최근 36개월. 조회 한도와 같은 길이이고, 기간 필터와는 따로 쓴다. */
export function areaCatalogRange(today = koreaToday()): { from: string; to: string; months: string[] } {
  const from = shiftMonths(today, -35);
  return {
    from,
    to: today,
    months: listMonths(from, today).filter((month) => month <= yyyymm(today)),
  };
}

function monthIndex(isoDate: string): number {
  const [year, month] = isoDate.split("-").map(Number);
  return year * 12 + (month - 1);
}

export function yyyymm(isoDate: string): string {
  return isoDate.slice(0, 7).replace("-", "");
}

/** 시작·종료일이 걸친 계약년월. 2026-09-15~2026-11-02 → 202609, 202610, 202611. */
export function listMonths(from: string, to: string): string[] {
  const start = monthIndex(from);
  const end = monthIndex(to);
  const months: string[] = [];
  for (let index = start; index <= end; index += 1) {
    const year = Math.floor(index / 12);
    const month = (index % 12) + 1;
    months.push(`${year}${String(month).padStart(2, "0")}`);
  }
  return months;
}

export type ResolvedRange =
  | { ok: true; from: string; to: string; months: string[] }
  | { ok: false; message: string };

/**
 * 직접 선택 기간. 시작일이 종료일보다 늦거나 36개월을 넘으면 조회하지 않는다.
 * 오늘(서울) 이후의 계약년월은 호출하지 않는다.
 */
export function resolveRange(from: string, to: string, today = koreaToday()): ResolvedRange {
  if (!ISO_DATE.test(from) || !ISO_DATE.test(to)) {
    return { ok: false, message: "기간은 YYYY-MM-DD 형식이어야 합니다." };
  }
  if (from > to) {
    return { ok: false, message: "시작일이 종료일보다 늦습니다." };
  }
  const months = listMonths(from, to);
  if (months.length > 36) {
    return { ok: false, message: "기간은 최대 36개월까지 조회할 수 있습니다." };
  }
  const current = yyyymm(today);
  return {
    ok: true,
    from,
    to,
    months: months.filter((month) => month <= current),
  };
}

export function isRecentMonth(month: string, today = koreaToday()): boolean {
  const current = yyyymm(today);
  const previous = yyyymm(shiftMonths(`${today.slice(0, 7)}-01`, -1));
  return month === current || month === previous;
}
