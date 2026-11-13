# 공공 API 조사

조사일 2026-11-13. 인증키가 없어 실거래 API와 카카오맵 SDK의 성공 응답은 호출하지 못했다. 아래 원본 파일 내려받기와 페이지 응답은 이 날짜에 다시 확인했다.

## 단지 목록

서울 열린데이터광장 [OA-12027 서울주택도시개발공사_주택관리현황](https://data.seoul.go.kr/dataList/OA-12027/F/1/datasetView.do).

- 제공: SH공사 주택관리부. 연간 갱신.
- 내려받기: `POST https://datafile.seoul.go.kr/bigfile/iot/inf/nio_download.do?&useCache=false`
- 폼: `infId=OA-12027`, `seqNo=8`, `seq=8`, `infSeq=3`. 응답이 xlsx(`PK`)가 아니면 파일 번호가 바뀐 것이다.
- 시트 `25.12.31.기준`. 기준일 2025-12-31. 825행.
- 열: 자치구명, 단지명, 주택유형, 임대세대수, 입주개시일, 주소.
- 채택 규칙: 주택유형에 「행복」이 포함된 행만. 219단지.

쓰지 않은 목록:

- 공공데이터포털 15099541 공공주택 현황. 2022-02-28 기준이라 오래되었다.
- 15066029 행복주택 공급계획. 계획 자료라 입주 단지가 아니다.
- 15004875 주택관리현황. 유형별 합계만 있고 단지 목록이 없다.

임대세대수는 해당 주택유형 세대수이며 공가가 아니다. 여러 유형이 쉼표로 묶인 행은 그 합계다.

## 좌표

서울 열린데이터광장 [OA-15818 서울시 공동주택 아파트 정보](https://data.seoul.go.kr/dataList/OA-15818/S/1/datasetView.do). 원천은 K-apt. 일 갱신. EUC-KR CSV 2,898행.

- 내려받기: `POST https://datafile.seoul.go.kr/bigfile/iot/sheet/csv/download.do`
- 폼: `srvType=S`, `infId=OA-15818`, `serviceKind=1`, `pageNo=1`, `gridTotalCnt=10000`, `ssUserId=SAMPLE_VIEW`, `filterCol=필터선택`.

매칭 순서:

1. 자치구와 도로명·건물번호가 같으면 `kapt-address`. 145곳.
2. 자치구와 정규화한 단지명이 하나만 맞고, 법정동이 있으면 법정동까지 같으면 `kapt-name`. 8곳.
3. `KAKAO_REST_API_KEY` 가 있으면 카카오 로컬 주소검색. 구가 같을 때만 채택. 이번 생성에서는 키가 없어 0곳.
4. 나머지는 좌표 없음. 66곳. 추정하지 않는다.

지오코딩에 쓰지 않은 것: 행정안전부 위치정보요약DB는 신청이 필요하고, Nominatim은 오배치 위험이 있다.

좌표가 없는 단지는 검색과 실거래에는 남기고 마커에는 넣지 않는다.

## 전월세 실거래

[국토교통부 아파트 전월세 실거래가 자료](https://www.data.go.kr/data/15126474/openapi.do). 페이지는 2026-11-13에 HTTP 200이었다.

- `GET https://apis.data.go.kr/1613000/RTMSDataSvcAptRent/getRTMSDataSvcAptRent`
- 버전 1.0. 배포 2024-07-17. 일 1회 갱신.
- 필수: `serviceKey`, `LAWD_CD`(법정동코드 앞 5자리), `DEAL_YMD`(YYYYMM).
- 선택: `pageNo`, `numOfRows`. 이 앱은 `numOfRows=1000`.
- 성공 `resultCode` `000`. 데이터 없음 `03`. 숫자로 파싱된 `0` 도 성공으로 본다.
- 개발계정 트래픽은 1만 건 수준이다. 게이트웨이 `returnReasonCode` 30 미등록, 31 만료, 32 IP 미허용, 22 트래픽 초과.

쓰는 필드: `umdNm`, `jibun`, `roadnm`, `roadnmbonbun`, `roadnmbubun`, `aptNm`, `aptSeq`, `excluUseAr`, `dealYear`, `dealMonth`, `dealDay`, `deposit`, `monthlyRent`, `floor`, `contractType`, `cdealType`, `cdealDay`.

금액은 만원이다. `50,000` 은 5억이다.

매칭:

- 법정동(공백 제거)과 지번(공백·끝의 「번지」 제거, `산13-13` 유지)이 같거나
- 도로명과 건물번호를 붙인 값이 같다. `roadnm` 이 번호 없이 끝나면 본번·부번으로 번호를 붙인다.
- 단지명만 같은 경우는 제외한다.
- `cdealType` 또는 `cdealDay` 가 있으면 취소로 보고 뺀다. `dealingGbn` 은 취소 판정에 쓰지 않는다.
- 계약 고유번호가 없어 내용이 같은 행은 지우지 않는다. 공공임대는 같은 날 같은 조건이 반복된다. 페이지가 겹치면 건수가 늘 수 있다.

조회는 필요한 월만 하고, 받은 뒤 계약일과 단지로 거른다. 최근 두 달은 6시간, 그 이전은 7일 메모리 캐시. 같은 월 요청은 합치고, 월 조회는 동시에 4개까지. 한 달이 30페이지를 넘으면 일부만 보여 주지 않고 오류로 올린다. 타임아웃은 20초.

서울 `LAWD_CD`: 종로 11110, 중구 11140, 용산 11170, 성동 11200, 광진 11215, 동대문 11230, 중랑 11260, 성북 11290, 강북 11305, 도봉 11320, 노원 11350, 은평 11380, 서대문 11410, 마포 11440, 양천 11470, 강서 11500, 구로 11530, 금천 11545, 영등포 11560, 동작 11590, 관악 11620, 서초 11650, 강남 11680, 송파 11710, 강동 11740.

## SH 공가·예비자

단지별 공가, 공급형별 예비자, 최근 1년 퇴거를 외부에 주는 공식 API는 찾지 못했다.

- 공공데이터포털의 SH 자료는 파일 위주이고, 단지별 공가·예비자 오픈 API는 없었다.
- [SH 오픈 API 안내](https://www.i-sh.co.kr/app/lay2/program/S1T437C440/open/govern/openData/openApi/openDataInfoView.do) 에는 채용, 상가·공장, 토지, 임대·분양 공고, 계약 등이 있고 공가·대기자는 없다.
- 마이홈 예비입주자 대기(공공데이터포털 15108378, `HWSPR03/moveWaitStsList`)는 입주대기자와 퇴거는 있으나 공가 수와 기준일이 없다. SH 단지가 결과에 있는지는 키 없이 확인하지 않아 이 MVP에서는 쓰지 않는다.

대신 [SH 주택정보](https://www.i-sh.co.kr/houseinfo/main/selectFromMain.do) 링크를 둔다. 2026-11-13 응답은 HTTP 200이었다. 재개발 공가 화면은 긁지 않는다.

접근 코드는 `src/lib/sh/status.ts` 와 `GET /api/sh-status` 에만 있다. 지금은 `supported: false` 와 링크, 확인일을 돌려준다.

## 지도

카카오맵 JavaScript SDK. `https://dapi.kakao.com/v2/maps/sdk.js?appkey=&autoload=false&libraries=clusterer`.

키는 서버 환경변수 `KAKAO_MAP_JS_KEY` 에서 읽어 브라우저에 전달한다. 잘못된 키는 SDK 스크립트가 401과 `wrong appKey` 로 거절하는 것을 이전 확인에서 봤고, 그 경우 화면은 오류 문구를 보여 준다. 유효한 키와 허용 도메인으로 지도가 열리는 것은 아직 확인하지 못했다.
