/** 만원 단위 금액을 읽기 쉬운 원화 문구로 바꾼다. 13120 → "1억 3,120만원". */
export function formatManwon(manwon: number): string {
  if (!Number.isFinite(manwon)) return "-";
  const rounded = Math.round(manwon);
  if (rounded === 0) return "0원";
  const sign = rounded < 0 ? "-" : "";
  const absolute = Math.abs(rounded);
  const eok = Math.floor(absolute / 10000);
  const rest = absolute % 10000;
  const restText = rest.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  if (eok > 0 && rest > 0) return `${sign}${eok}억 ${restText}만원`;
  if (eok > 0) return `${sign}${eok}억`;
  return `${sign}${restText}만원`;
}

/** "2026-11-12" → "2026.11.12" */
export function formatDate(isoDate: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(isoDate);
  if (!match) return isoDate;
  return `${match[1]}.${match[2]}.${match[3]}`;
}

export function formatArea(areaM2: number): string {
  return `${areaM2.toFixed(2)}㎡`;
}

export function formatFloor(floor: number | null): string | null {
  if (floor == null) return null;
  if (floor < 0) return `지하 ${Math.abs(floor)}층`;
  return `${floor}층`;
}

/** ISO 시각을 서울 기준 날짜·시각으로 표시한다. */
export function formatFetchedAt(isoTimestamp: string): string {
  const date = new Date(isoTimestamp);
  if (Number.isNaN(date.getTime())) return isoTimestamp;
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  })
    .format(date)
    .replace(/(\d{4})-(\d{2})-(\d{2})/, "$1.$2.$3");
}
