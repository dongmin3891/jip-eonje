/** @jest-environment node */

jest.mock("server-only", () => ({}));

import { getComplex } from "@/lib/complexes";
import { getRentContracts } from "@/lib/rent/molit";

const originalFetch = global.fetch;

function xml(month: string, areaM2: number) {
  return `<?xml version="1.0" encoding="UTF-8"?>
    <response><header><resultCode>000</resultCode></header><body><items><item>
      <umdNm>역삼동</umdNm><aptNm>강남센트럴아이파크</aptNm><jibun>902</jibun>
      <excluUseAr>${areaM2}</excluUseAr><dealYear>${month.slice(0, 4)}</dealYear>
      <dealMonth>${Number(month.slice(4))}</dealMonth><dealDay>10</dealDay>
      <deposit>10000</deposit><monthlyRent>50</monthlyRent><floor>5</floor>
      <contractType>신규</contractType><roadnm>테헤란로44길</roadnm><roadnmbonbun>26</roadnmbonbun>
    </item></items><numOfRows>1000</numOfRows><pageNo>1</pageNo><totalCount>1</totalCount></body></response>`;
}

afterEach(() => {
  global.fetch = originalFetch;
  jest.restoreAllMocks();
});

it("계약 조회는 전달한 월만 요청하고 면적 조회용 추가 월을 불러오지 않는다", async () => {
  const fetchMock = jest.fn(async (input: RequestInfo | URL) => {
    const month = new URL(String(input)).searchParams.get("DEAL_YMD")!;
    return new Response(xml(month, 29), { status: 200 });
  });
  global.fetch = fetchMock;
  const complex = getComplex("5d48b3157f")!;

  const result = await getRentContracts(complex, "2099-02-01", "2099-02-28", ["209902"], "key");

  expect(result.contracts).toHaveLength(1);
  expect(fetchMock).toHaveBeenCalledTimes(1);
  expect(new URL(String(fetchMock.mock.calls[0][0])).searchParams.get("DEAL_YMD")).toBe("209902");
});
