/** @jest-environment node */

jest.mock("next/server", () => ({ connection: jest.fn(async () => {}) }));
jest.mock("../../../lib/rent/molit", () => ({
  getRentContracts: jest.fn(),
}));

import { getComplex } from "../../../lib/complexes";
import { getRentContracts } from "../../../lib/rent/molit";
import { GET as getRent } from "./route";
import { GET as getRentAreasRoute } from "./areas/route";

const contractsMock = jest.mocked(getRentContracts);
const originalKey = process.env.DATA_GO_KR_SERVICE_KEY;
const originalFetch = global.fetch;
const fetchMock = jest.fn();

beforeEach(() => {
  process.env.DATA_GO_KR_SERVICE_KEY = "test-key";
  contractsMock.mockReset().mockResolvedValue({ contracts: [], matchedAptNames: [] });
  fetchMock.mockReset();
  global.fetch = fetchMock;
});

afterAll(() => {
  if (originalKey == null) delete process.env.DATA_GO_KR_SERVICE_KEY;
  else process.env.DATA_GO_KR_SERVICE_KEY = originalKey;
  global.fetch = originalFetch;
});

it("계약 API는 선택 기간의 월만 조회하고 면적 카탈로그를 기다리지 않는다", async () => {
  const response = await getRent(new Request(
    "http://localhost/api/rent?complexId=5d48b3157f&from=2026-09-15&to=2026-11-02",
    { headers: { "x-forwarded-for": "route-contracts" } },
  ));
  const body = await response.json();

  expect(response.status).toBe(200);
  expect(contractsMock).toHaveBeenCalledTimes(1);
  expect(contractsMock.mock.calls[0][3]).toEqual(["202609", "202610", "202611"]);
  expect(contractsMock.mock.calls[0]).toHaveLength(5);
  expect(fetchMock).not.toHaveBeenCalled();
  expect(body).not.toHaveProperty("areasM2");
  expect(body).toMatchObject({ complexId: "5d48b3157f", contracts: [], matchedAptNames: [] });
});

it("면적 API는 인증키나 국토부 호출 없이 정적 카탈로그를 반환한다", async () => {
  delete process.env.DATA_GO_KR_SERVICE_KEY;
  const response = await getRentAreasRoute(new Request(
    "http://localhost/api/rent/areas?complexId=5d48b3157f",
    { headers: { "x-forwarded-for": "route-areas" } },
  ));
  const body = await response.json();

  expect(response.status).toBe(200);
  expect(fetchMock).not.toHaveBeenCalled();
  expect(contractsMock).not.toHaveBeenCalled();
  expect(response.headers.get("cache-control")).toContain("s-maxage=86400");
  expect(body).toMatchObject({
    complexId: "5d48b3157f",
    areasM2: getComplex("5d48b3157f")?.areasM2,
  });
  expect(body.fetchedAt).toEqual(expect.any(String));
});

it("면적 API는 없는 단지를 404로 반환한다", async () => {
  const response = await getRentAreasRoute(
    new Request("http://localhost/api/rent/areas?complexId=not-found"),
  );

  expect(response.status).toBe(404);
  expect(await response.json()).toMatchObject({ code: "NOT_FOUND" });
  expect(fetchMock).not.toHaveBeenCalled();
});
