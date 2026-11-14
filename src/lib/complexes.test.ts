import { addressPeers, complexes, complexMeta, getComplex, searchComplexes } from "@/lib/complexes";

describe("단지 목록", () => {
  it("주택유형에 행복이 있는 단지와 기준일을 담는다", () => {
    expect(complexes).toHaveLength(219);
    expect(complexes).toHaveLength(complexMeta.counts.complexes);
    expect(complexMeta.complexList.referenceDate).toBe("2025-12-31");
    expect(complexMeta.complexList.datasetId).toBe("OA-12027");
    expect(complexes.every((complex) => complex.housingType.includes("행복"))).toBe(true);
    expect(complexes.every((complex) => Array.isArray(complex.areasM2))).toBe(true);
    expect(complexMeta.counts.withCoordinates).toBe(153);
    expect(complexMeta.counts.withoutCoordinates).toBe(66);
  });

  it("빈 검색과 없는 이름은 결과가 없다", () => {
    expect(searchComplexes("")).toEqual([]);
    expect(searchComplexes("   ")).toEqual([]);
    expect(searchComplexes("zzzz-none")).toEqual([]);
  });

  it("단지명과 자치구로 찾고 주소가 겹치는 단지를 짝짓는다", () => {
    const found = searchComplexes("강남센트럴");
    expect(found[0]?.id).toBe("5d48b3157f");
    expect(searchComplexes("강남").every((complex) => complex.district === "강남구" || complex.name.includes("강남"))).toBe(
      true,
    );
    const peers = addressPeers("42dd2717c8");
    expect(peers.map((complex) => complex.id)).toContain("2813d1c546");
    expect(addressPeers("2813d1c546").map((complex) => complex.id)).toContain("42dd2717c8");
    expect(getComplex("5d48b3157f")?.name).toBe("강남센트럴아이파크");
  });
});
