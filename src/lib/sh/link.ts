import shLinks from "@/data/sh-links.json";

/** 상세 코드를 확인하지 못한 단지가 이동하는 SH 주택정보 메인. */
export const SH_HOUSE_INFO_MAIN = "https://www.i-sh.co.kr/houseinfo/main/selectFromMain.do";

const DETAIL_URL =
  /^https:\/\/www\.i-sh\.co\.kr\/houseinfo\/main\/selectHouseImgInfo\.do\?ctgrCd=10&biznsCd=\d+$/;

type ShLink = {
  biznsCd: string;
  url: string;
};

const links = shLinks as Record<string, ShLink>;

/**
 * 단지 id에 검증된 공식 상세 주소가 있으면 그 주소, 없으면 주택정보 메인.
 * SH 내부 API를 호출하지 않는다.
 */
export function shHouseInfoUrl(complexId: string): string {
  const link = links[complexId];
  if (!link || !DETAIL_URL.test(link.url) || !link.url.endsWith(`biznsCd=${link.biznsCd}`)) {
    return SH_HOUSE_INFO_MAIN;
  }
  return link.url;
}
