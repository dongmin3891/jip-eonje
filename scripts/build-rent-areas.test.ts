/** @jest-environment node */

import type { Complex } from "../src/lib/complexes";
import type { PublicDeal } from "../src/lib/rent/parse";
import { generateAreaCatalog } from "./build-rent-areas";

function complex(id: string, lawdCd: string, lotNumber: string, areasM2: number[] = []): Complex {
  return {
    id,
    name: id,
    district: "테스트구",
    lawdCd,
    housingType: "행복",
    rentalUnits: null,
    moveInDate: null,
    address: `테스트동 ${lotNumber}`,
    roadName: null,
    buildingNo: null,
    legalDong: "테스트동",
    lotNumber,
    buildingName: null,
    lat: null,
    lng: null,
    coordSource: null,
    areasM2,
  };
}

function deal(lotNumber: string, areaM2: number): PublicDeal {
  return {
    aptNm: "테스트",
    aptSeq: null,
    legalDong: "테스트동",
    lotNumber,
    roadCompact: null,
    areaM2,
    contractDate: "2026-11-01",
    depositManwon: 1000,
    monthlyRentManwon: 10,
    floor: 1,
    contractType: "신규",
    cancelled: false,
  };
}

it("지역·월을 한 번씩만 받아 같은 지역의 여러 단지에 매칭하고 기존 면적과 합친다", async () => {
  const complexes = [
    complex("a", "11110", "1", [59.9]),
    complex("b", "11110", "2"),
    complex("c", "11200", "3", [84.91]),
  ];
  const loadMonth = jest.fn(async (lawdCd: string, month: string) => {
    if (lawdCd === "11110" && month === "202610") {
      return [deal("1", 29.91), deal("1", 29.91), deal("2", 39.84)];
    }
    if (lawdCd === "11110" && month === "202611") return [deal("1", 44.9)];
    return [];
  });

  const generated = await generateAreaCatalog(
    complexes,
    ["202610", "202611", "202610"],
    "key",
    loadMonth,
    2,
  );

  expect(loadMonth).toHaveBeenCalledTimes(4);
  expect(new Set(loadMonth.mock.calls.map(([lawdCd, month]) => `${lawdCd}:${month}`))).toEqual(
    new Set(["11110:202610", "11110:202611", "11200:202610", "11200:202611"]),
  );
  expect(generated.find((item) => item.id === "a")?.areasM2).toEqual([29.91, 44.9, 59.9]);
  expect(generated.find((item) => item.id === "b")?.areasM2).toEqual([39.84]);
  expect(generated.find((item) => item.id === "c")?.areasM2).toEqual([84.91]);
});

it("실패한 지역과 월을 오류에 표시한다", async () => {
  const loadMonth = jest.fn(async () => {
    throw new Error("upstream");
  });

  await expect(
    generateAreaCatalog([complex("a", "11380", "1")], ["202611"], "key", loadMonth),
  ).rejects.toThrow("FAILED lawdCd=11380 month=202611");
});
