import type { Complex } from "@/lib/complexes";
import { matchesComplex } from "@/lib/rent/match";
import type { PublicDeal } from "@/lib/rent/parse";

const complex: Complex = {
  id: "fixture",
  name: "창신테스트",
  district: "종로구",
  lawdCd: "11110",
  housingType: "행복(재건축)",
  rentalUnits: 10,
  moveInDate: null,
  address: "지봉로5길 7 (창신동 232)",
  roadName: "지봉로5길",
  buildingNo: "7",
  legalDong: "창신동",
  lotNumber: "232",
  buildingName: null,
  lat: null,
  lng: null,
  coordSource: null,
};

function deal(overrides: Partial<PublicDeal> = {}): PublicDeal {
  return {
    aptNm: "다른이름",
    aptSeq: "11110-34",
    legalDong: "창신동",
    lotNumber: "232",
    roadCompact: "지봉로5길7",
    areaM2: 59.95,
    contractDate: "2024-07-17",
    depositManwon: 50000,
    monthlyRentManwon: 0,
    floor: 5,
    contractType: "신규",
    cancelled: false,
    ...overrides,
  };
}

describe("실거래 단지 매칭", () => {
  it("법정동·지번 또는 도로명·건물번호가 같으면 맞춘다", () => {
    expect(matchesComplex(deal(), complex)).toBe(true);
    expect(
      matchesComplex(deal({ lotNumber: "999", legalDong: "다른동" }), complex),
    ).toBe(true);
    expect(
      matchesComplex(deal({ roadCompact: null }), complex),
    ).toBe(true);
  });

  it("지번과 도로명이 모두 다르거나 이름만 같으면 제외한다", () => {
    expect(
      matchesComplex(
        deal({ lotNumber: "233", roadCompact: "다른길1", aptNm: complex.name }),
        complex,
      ),
    ).toBe(false);
  });

  it("취소된 행은 주소가 같아도 제외한다", () => {
    expect(matchesComplex(deal({ cancelled: true }), complex)).toBe(false);
  });
});
