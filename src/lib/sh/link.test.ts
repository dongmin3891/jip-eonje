import shLinks from "@/data/sh-links.json";
import { complexes } from "@/lib/complexes";
import { SH_HOUSE_INFO_MAIN, shHouseInfoUrl } from "@/lib/sh/link";

describe("SH 공식 상세페이지 매핑", () => {
  it("모든 매핑이 실제 단지와 정규 상세 URL을 가리킨다", () => {
    const complexIds = new Set(complexes.map((complex) => complex.id));
    const entries = Object.entries(shLinks);

    expect(entries).toHaveLength(182);
    for (const [complexId, link] of entries) {
      expect(complexIds.has(complexId)).toBe(true);
      expect(link.biznsCd).toMatch(/^\d+$/);
      expect(link.url).toBe(
        `https://www.i-sh.co.kr/houseinfo/main/selectHouseImgInfo.do?ctgrCd=10&biznsCd=${link.biznsCd}`,
      );
      expect(shHouseInfoUrl(complexId)).toBe(link.url);
    }
  });

  it("검증되지 않은 단지는 주택정보 메인으로 보낸다", () => {
    expect(shHouseInfoUrl("45e8591f50")).toBe(SH_HOUSE_INFO_MAIN);
    expect(shHouseInfoUrl("missing")).toBe(SH_HOUSE_INFO_MAIN);
  });
});
