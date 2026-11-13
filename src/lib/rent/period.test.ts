import { listMonths, presetRange, resolveRange } from "@/lib/rent/period";

describe("계약 기간", () => {
  it("걸친 계약년월을 빠짐없이 만든다", () => {
    expect(listMonths("2026-09-15", "2026-11-02")).toEqual(["202609", "202610", "202611"]);
  });

  it("프리셋은 서울 오늘에서 개월수만큼 뒤로 간다", () => {
    expect(presetRange(3, "2026-11-13")).toEqual({ from: "2026-08-13", to: "2026-11-13" });
    expect(presetRange(1, "2026-11-13")).toEqual({ from: "2026-10-13", to: "2026-11-13" });
  });

  it("잘못된 범위와 36개월 초과는 조회하지 않는다", () => {
    expect(resolveRange("2026-11-02", "2026-09-15", "2026-11-13").ok).toBe(false);
    expect(resolveRange("2023-11-01", "2026-11-01", "2026-11-13").ok).toBe(false);
    const within = resolveRange("2023-12-01", "2026-11-01", "2026-11-13");
    expect(within.ok).toBe(true);
    if (within.ok) expect(within.months).toHaveLength(36);
  });

  it("미래 월은 호출 목록에서 뺀다", () => {
    const range = resolveRange("2026-11-01", "2027-01-15", "2026-11-13");
    expect(range).toEqual({
      ok: true,
      from: "2026-11-01",
      to: "2027-01-15",
      months: ["202611"],
    });
  });
});
