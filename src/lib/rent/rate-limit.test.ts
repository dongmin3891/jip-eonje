import { allowRequest } from "@/lib/rent/rate-limit";

describe("조회 횟수 제한", () => {
  it("한 주소의 연속 요청을 막는다", () => {
    const key = `test-${Date.now()}`;
    for (let index = 0; index < 20; index += 1) {
      expect(allowRequest(key, 1_000, 20, 60_000)).toBe(true);
    }
    expect(allowRequest(key, 1_000, 20, 60_000)).toBe(false);
    expect(allowRequest(key, 61_000, 20, 60_000)).toBe(true);
  });
});