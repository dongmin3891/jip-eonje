import { complexes } from "./complexes";
import { normalizeRecentComplexes, readRecentComplexes, RECENT_COMPLEXES_KEY } from "./recent-complexes";

afterEach(() => { localStorage.clear(); jest.restoreAllMocks(); });

it("잘못된 ID와 중복을 제거하고 최신 순서대로 10곳까지만 유지한다", () => {
  const ids = complexes.slice(0, 12).map((complex) => complex.id);
  expect(normalizeRecentComplexes([null, "missing", ids[0], ...ids])).toEqual(ids.slice(0, 10));
  expect(normalizeRecentComplexes({ ids })).toEqual([]);
});

it("손상된 저장 데이터는 빈 기록으로, 저장소 차단은 null로 반환한다", () => {
  localStorage.setItem(RECENT_COMPLEXES_KEY, "{broken");
  expect(readRecentComplexes()).toEqual([]);
  jest.spyOn(Storage.prototype, "getItem").mockImplementation(() => { throw new Error("denied"); });
  expect(readRecentComplexes()).toBeNull();
});
