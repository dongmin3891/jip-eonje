import { countByArea, mergeAreaKeys } from "@/lib/rent/areas";

describe("전용면적 목록", () => {
  it("긴 기간의 면적을 이번 기간 계약과 합치고 없는 면적은 0건이다", () => {
    const areas = mergeAreaKeys([84.99, 59.9], [{ areaM2: 59.95 }, { areaM2: 59.95 }]);
    const counts = countByArea([{ areaM2: 59.95 }, { areaM2: 59.95 }]);

    expect(areas).toEqual(["59.90", "59.95", "84.99"]);
    expect(counts.get("59.95")).toBe(2);
    expect(counts.get("84.99") ?? 0).toBe(0);
  });
});