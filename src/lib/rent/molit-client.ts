import { MolitError, parseMolitXml, type PublicDeal } from "./parse.ts";
import { MOLIT_ENDPOINT } from "./types.ts";

const PAGE_SIZE = 1000;
const MAX_PAGES = 30;

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

  const page = parseMolitXml(await response.text());
  return { items: page.items, totalCount: page.totalCount };
}

/** 한 지역의 한 달치 전월세 데이터를 페이지 끝까지 가져온다. */
export async function fetchMolitMonth(
  lawdCd: string,
  yyyymm: string,
  serviceKey: string,
): Promise<PublicDeal[]> {
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
