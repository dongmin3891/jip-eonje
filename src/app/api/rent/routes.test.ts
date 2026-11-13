/** @jest-environment node */

jest.mock("next/server", () => ({ connection: jest.fn(async () => {}) }));
jest.mock("../../../lib/rent/molit", () => ({
  getRentContracts: jest.fn(),
  getRentAreas: jest.fn(),
}));

import { getRentAreas, getRentContracts } from "../../../lib/rent/molit";
import { GET as getRent } from "./route";
import { GET as getRentAreasRoute } from "./areas/route";

const contractsMock = jest.mocked(getRentContracts);
const areasMock = jest.mocked(getRentAreas);
const originalKey = process.env.DATA_GO_KR_SERVICE_KEY;

beforeEach(() => {
  process.env.DATA_GO_KR_SERVICE_KEY = "test-key";
  contractsMock.mockReset().mockResolvedValue({ contracts: [], matchedAptNames: [] });
  areasMock.mockReset().mockResolvedValue([29, 45, 59]);
});

afterAll(() => {
  if (originalKey == null) delete process.env.DATA_GO_KR_SERVICE_KEY;
  else process.env.DATA_GO_KR_SERVICE_KEY = originalKey;
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
  expect(areasMock).not.toHaveBeenCalled();
  expect(body).not.toHaveProperty("areasM2");
  expect(body).toMatchObject({ complexId: "5d48b3157f", contracts: [], matchedAptNames: [] });
});

it("면적 API는 최근 36개월로 조회하고 장기 공유 캐시 헤더와 면적만 반환한다", async () => {
  const response = await getRentAreasRoute(new Request(
    "http://localhost/api/rent/areas?complexId=5d48b3157f",
    { headers: { "x-forwarded-for": "route-areas" } },
  ));
  const body = await response.json();

  expect(response.status).toBe(200);
  expect(areasMock).toHaveBeenCalledTimes(1);
  expect(areasMock.mock.calls[0][1]).toHaveLength(36);
  expect(areasMock.mock.calls[0][1][0]).toMatch(/^\d{6}$/);
  expect(contractsMock).not.toHaveBeenCalled();
  expect(response.headers.get("cache-control")).toContain("s-maxage=86400");
  expect(body).toMatchObject({ complexId: "5d48b3157f", areasM2: [29, 45, 59] });
  expect(body.fetchedAt).toEqual(expect.any(String));
});
