import "server-only";

import type { Complex } from "@/lib/complexes";
import { matchesComplex } from "@/lib/rent/match";
import { isRecentMonth } from "@/lib/rent/period";
import { MolitError, parseMolitXml, type PublicDeal } from "@/lib/rent/parse";
import { MOLIT_ENDPOINT, type RentContract } from "@/lib/rent/types";

const PAGE_SIZE = 1000;
const MAX_PAGES = 30;
const RECENT_TTL_MS = 6 * 60 * 60 * 1000;
const STABLE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const MONTH_CONCURRENCY = 4;

type CacheEntry = { expires: number; items: PublicDeal[] };

const monthCache = new Map<string, CacheEntry>();
const inFlight = new Map<string, Promise<PublicDeal[]>>();

/** 인코딩된 키는 한 번만 풀고, URLSearchParams가 다시 인코딩하게 둔다. */
export function decodeServiceKey(raw: string): string {
  const key = raw.trim();
  if (!key.includes("%")) return key;
  try {
    return decodeURIComponent(key);
  } catch {
    return key;
  }
}

async function fetchPage(
  lawdCd: string,
  yyyymm: string,
  pageNo: number,
  serviceKey: string,
): Promise<{ items: PublicDeal[]; totalCount: number }> {
  const params = new URLSearchParams({
    serviceKey: decodeServiceKey(serviceKey),
    LAWD_CD: lawdCd,
    DEAL_YMD: yyyymm,
    pageNo: String(pageNo),
    numOfRows: String(PAGE_SIZE),
  });

  let response: Response;
  try {
    response = await fetch(`${MOLIT_ENDPOINT}?${params}`, {
      cache: "no-store",
      signal: AbortSignal.timeout(20_000),
    });
  } catch (error) {
    const name = error instanceof Error ? error.name : "";
    if (name === "TimeoutError" || name === "AbortError") {
      throw new MolitError("UPSTREAM", "실거래 조회 시간이 초과되었습니다.");
    }
    throw new MolitError("UPSTREAM", "실거래 서버에 연결하지 못했습니다.");
  }

  if (response.status === 401 || response.status === 403) {
    throw new MolitError("KEY_INVALID", "공공데이터포털 인증키가 거부되었습니다.");
  }
  if (!response.ok) {
    throw new MolitError("UPSTREAM", `실거래 조회에 실패했습니다. (${response.status})`);
  }

  const xml = await response.text();
  const page = parseMolitXml(xml);
  return { items: page.items, totalCount: page.totalCount };
}

async function loadMonth(lawdCd: string, yyyymm: string, serviceKey: string): Promise<PublicDeal[]> {
  const first = await fetchPage(lawdCd, yyyymm, 1, serviceKey);
  const pages = first.totalCount === 0 ? 1 : Math.ceil(first.totalCount / PAGE_SIZE);
  if (pages > MAX_PAGES) {
    throw new MolitError("UPSTREAM", "한 달 조회 결과가 너무 많아 모두 가져오지 못했습니다.");
  }
  const items = [...first.items];
  for (let page = 2; page <= pages; page += 1) {
    const next = await fetchPage(lawdCd, yyyymm, page, serviceKey);
    items.push(...next.items);
  }
  return items;
}

async function fetchMonth(lawdCd: string, yyyymm: string, serviceKey: string): Promise<PublicDeal[]> {
  const cacheKey = `${lawdCd}:${yyyymm}`;
  const cached = monthCache.get(cacheKey);
  if (cached && cached.expires > Date.now()) return cached.items;

  const pending = inFlight.get(cacheKey);
  if (pending) return pending;

  const request = loadMonth(lawdCd, yyyymm, serviceKey)
    .then((items) => {
      const ttl = isRecentMonth(yyyymm) ? RECENT_TTL_MS : STABLE_TTL_MS;
      monthCache.set(cacheKey, { items, expires: Date.now() + ttl });
      return items;
    })
    .finally(() => {
      inFlight.delete(cacheKey);
    });
  inFlight.set(cacheKey, request);
  return request;
}

async function mapLimit<T, R>(items: T[], limit: number, task: (item: T) => Promise<R>): Promise<R[]> {
  const results = new Array<R>(items.length);
  let cursor = 0;
  async function worker() {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      results[index] = await task(items[index]);
    }
  }
  const workers = Math.min(limit, items.length);
  await Promise.all(Array.from({ length: workers }, () => worker()));
  return results;
}

/**
 * 지역·계약년월로 받은 뒤 단지 주소와 기간으로 걸러 최신 계약일순으로 돌려준다.
 * 계약 고유번호가 없어 내용이 같은 행은 지우지 않는다. 페이지가 겹치면 건수가 늘 수 있다.
 */
export async function getRentContracts(
  complex: Complex,
  from: string,
  to: string,
  months: string[],
  serviceKey: string,
): Promise<{ contracts: RentContract[]; matchedAptNames: string[] }> {
  if (months.length === 0) return { contracts: [], matchedAptNames: [] };

  const pages = await mapLimit(months, MONTH_CONCURRENCY, (month) =>
    fetchMonth(complex.lawdCd, month, serviceKey),
  );
  const matched = pages.flat().filter((deal) => {
    return deal.contractDate >= from && deal.contractDate <= to && matchesComplex(deal, complex);
  });

  matched.sort(
    (left, right) =>
      right.contractDate.localeCompare(left.contractDate) ||
      left.areaM2 - right.areaM2 ||
      (left.floor ?? 0) - (right.floor ?? 0) ||
      left.aptNm.localeCompare(right.aptNm, "ko"),
  );

  const contracts = matched.map((deal, index) => ({
    id: [
      deal.contractDate,
      deal.areaM2,
      deal.depositManwon,
      deal.monthlyRentManwon,
      deal.floor ?? "",
      deal.aptNm,
      deal.aptSeq ?? "",
      index,
    ].join("|"),
    contractDate: deal.contractDate,
    areaM2: deal.areaM2,
    depositManwon: deal.depositManwon,
    monthlyRentManwon: deal.monthlyRentManwon,
    floor: deal.floor,
    contractType: deal.contractType,
    aptNm: deal.aptNm,
    aptSeq: deal.aptSeq,
  }));

  const matchedAptNames = [...new Set(matched.map((deal) => deal.aptNm).filter(Boolean))];
  return { contracts, matchedAptNames };
}
