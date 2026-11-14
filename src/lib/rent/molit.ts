import "server-only";

import type { Complex } from "@/lib/complexes";
import { matchesComplex } from "@/lib/rent/match";
import { fetchMolitMonth } from "@/lib/rent/molit-client";
import { isRecentMonth } from "@/lib/rent/period";
import type { PublicDeal } from "@/lib/rent/parse";
import type { RentContract } from "@/lib/rent/types";

const RECENT_TTL_MS = 6 * 60 * 60 * 1000;
const STABLE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const MONTH_CONCURRENCY = 4;

type CacheEntry = { expires: number; items: PublicDeal[] };

const monthCache = new Map<string, CacheEntry>();
const inFlight = new Map<string, Promise<PublicDeal[]>>();

async function fetchMonth(lawdCd: string, yyyymm: string, serviceKey: string): Promise<PublicDeal[]> {
  const cacheKey = `${lawdCd}:${yyyymm}`;
  const cached = monthCache.get(cacheKey);
  if (cached && cached.expires > Date.now()) return cached.items;

  const pending = inFlight.get(cacheKey);
  if (pending) return pending;

  const request = fetchMolitMonth(lawdCd, yyyymm, serviceKey)
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

async function getComplexDeals(complex: Complex, months: string[], serviceKey: string): Promise<PublicDeal[]> {
  const uniqueMonths = [...new Set(months)];
  if (uniqueMonths.length === 0) return [];
  const pages = await mapLimit(uniqueMonths, MONTH_CONCURRENCY, (month) =>
    fetchMonth(complex.lawdCd, month, serviceKey),
  );
  return pages.flat().filter((deal) => matchesComplex(deal, complex));
}

/**
 * 선택한 계약년월만 받은 뒤 단지 주소와 날짜 범위로 걸러 최신 계약일순으로 돌려준다.
 * 계약 고유번호가 없어 내용이 같은 행은 지우지 않는다. 페이지가 겹치면 건수가 늘 수 있다.
 */
export async function getRentContracts(
  complex: Complex,
  from: string,
  to: string,
  months: string[],
  serviceKey: string,
): Promise<{ contracts: RentContract[]; matchedAptNames: string[] }> {
  const complexDeals = await getComplexDeals(complex, months, serviceKey);
  const matched = complexDeals.filter((deal) => deal.contractDate >= from && deal.contractDate <= to);

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
