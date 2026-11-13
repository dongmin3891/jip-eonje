/**
 * SH 단지별 공가·예비자·최근 1년 퇴거를 돌려주는 외부 공식 API는 확인되지 않았다.
 * 이 모듈만 나중에 공식 API로 바꾸면 된다. 숫자를 추정해서 채우지 않는다.
 */
export const SH_STATUS = {
  supported: false as const,
  reason:
    "SH 단지별 공가, 예비자, 최근 1년 퇴거를 외부에서 조회하는 공식 API가 확인되지 않았습니다.",
  linkLabel: "SH 주택정보",
  linkUrl: "https://www.i-sh.co.kr/houseinfo/main/selectFromMain.do",
  checkedAt: "2026-11-13",
};

export type ShStatus = typeof SH_STATUS;
