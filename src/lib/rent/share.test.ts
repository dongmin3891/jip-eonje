import { clearRentShareParams, readRentShare, rentShareUrl } from "./share";

const href = "https://example.com/?source=cafe";
const base = rentShareUrl(href, "5d48b3157f", "2026-11-01", "2026-11-10", { areas: ["59.00", "29.00", "29.00"], contractType: "신규" });

it("공유 조건을 날짜·다중 면적·계약 유형으로 복원한다", () => {
  const url = new URL(base);
  expect(url.searchParams.get("source")).toBe("cafe");
  expect(readRentShare(url.searchParams)).toEqual({
    period: { kind: "custom", from: "2026-11-01", to: "2026-11-10" }, areas: ["29.00", "59.00"], contractType: "신규",
  });
});

it("모든 면적·모든 유형도 명시적으로 공유하고 기존 공유 조건만 지운다", () => {
  const url = new URL(rentShareUrl(base, "another", "2026-10-01", "2026-11-01", { areas: [], contractType: "all" }));
  expect(readRentShare(url.searchParams)).toMatchObject({ areas: [], contractType: "all" });
  clearRentShareParams(url.searchParams);
  expect(url.search).toBe("?source=cafe&complex=another");
  expect(readRentShare(url.searchParams)).toBeNull();
});

it.each([
  ["from", "2026-02-30"], ["to", "2026-13-01"], ["from", "2026-11-11"],
  ["from", "2020-01-01"], ["areas", "-29.00"], ["areas", "NaN"],
  ["areas", "29.00,"], ["areas", "0.00"], ["type", "기타"], ["rent", "2"],
])("유효하지 않은 공유 조건 %s=%s는 적용하지 않는다", (key, value) => {
  const url = new URL(base);
  url.searchParams.set(key, value);
  expect(readRentShare(url.searchParams)).toBeNull();
});

it("불완전하거나 중복된 조건은 일부만 적용하지 않는다", () => {
  const url = new URL(base);
  url.searchParams.delete("areas");
  expect(readRentShare(url.searchParams)).toBeNull();
  url.searchParams.append("areas", "29.00");
  url.searchParams.append("type", "갱신");
  expect(readRentShare(url.searchParams)).toBeNull();
});
