import { formatArea, formatAreaWithPyeong, formatDate, formatFloor, formatManwon, formatPyeong } from "@/lib/format";

describe("formatManwon", () => {
  it("만원 단위를 억과 만원으로 읽는다", () => {
    expect(formatManwon(13120)).toBe("1억 3,120만원");
    expect(formatManwon(10496)).toBe("1억 496만원");
    expect(formatManwon(10000)).toBe("1억");
    expect(formatManwon(53)).toBe("53만원");
    expect(formatManwon(0)).toBe("0원");
  });
});

describe("날짜와 면적", () => {
  it("계약일과 면적, 층을 표시한다", () => {
    expect(formatDate("2026-11-12")).toBe("2026.11.12");
    expect(formatDate("2023-01-09")).toBe("2023.01.09");
    expect(formatArea(39.82)).toBe("39.82㎡");
    expect(formatArea(59.9)).toBe("59.90㎡");
    expect(formatPyeong(39)).toBe("11.8평");
    expect(formatPyeong(40)).toBe("12.1평");
    expect(formatPyeong(84.99)).toBe("25.7평");
    expect(formatAreaWithPyeong(125.46)).toBe("125.46㎡ · 38.0평");
    expect(formatFloor(5)).toBe("5층");
    expect(formatFloor(-1)).toBe("지하 1층");
    expect(formatFloor(null)).toBeNull();
  });
});
