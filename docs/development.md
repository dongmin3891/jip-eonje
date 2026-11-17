# 개발 가이드

[README](../README.md) · [배포 가이드](deployment.md) · [공공 API 조사](api-research.md)

이 문서는 저장소의 데이터 흐름과 내부 API, 데이터 갱신 절차를 설명합니다. 설치와 환경변수 설정은 README를 먼저 확인하세요.

## 데이터 흐름

| 단계 | 담당 코드 | 역할 |
| --- | --- | --- |
| 원본 데이터 생성 | [scripts/](../scripts/) | 공식 목록·좌표와 전용면적을 JSON으로 저장 |
| 단지 탐색 | [complexes.ts](../src/lib/complexes.ts), [home-shell.tsx](../src/components/home-shell.tsx) | 정적 목록 검색, 단지 선택, 지도·목록 상태 관리 |
| 계약 요청 | [rent-section.tsx](../src/components/rent-section.tsx) | TanStack Query로 기간별 계약·면적 목록 요청 |
| 외부 API 호출 | [molit.ts](../src/lib/rent/molit.ts), [molit-client.ts](../src/lib/rent/molit-client.ts) | 지역·월별 조회, 메모리 캐시, 페이지 수집 |
| 정규화·매칭 | [parse.ts](../src/lib/rent/parse.ts), [match.ts](../src/lib/rent/match.ts) | XML 파싱, 취소 제외, 주소 매칭 |
| 화면 필터 | [rent-section.tsx](../src/components/rent-section.tsx) | 받은 계약에서 전용면적·신규·갱신 필터 적용 |

서버가 국토부에 보내는 조회 단위는 `법정구 코드(LAWD_CD) × 계약월(YYYYMM)`입니다. 받은 결과를 단지 주소와 시작·종료일로 좁힙니다. 면적·계약 유형만 바꾸면 기존 응답을 화면에서 다시 필터링합니다.

단지와 면적 목록은 앱에 포함되는 정적 JSON입니다. 데이터 파일을 갱신한 뒤 운영에 반영하려면 새 이미지를 빌드·배포해야 합니다.

## 내부 API

모든 엔드포인트는 `GET` 요청을 받으며 JSON을 반환합니다. 응답 타입은 [types.ts](../src/lib/rent/types.ts)에 있습니다.

| 경로 | 필수 쿼리 | 성공 응답 |
| --- | --- | --- |
| `/api/health` | 없음 | `{"status":"ok"}` |
| `/api/rent` | `complexId`, `from`, `to` | 조회 조건, 계약 목록, 매칭된 단지명, 출처 |
| `/api/rent/areas` | `complexId` | 단지 ID, `areasM2`, `fetchedAt` |

`complexId`는 [complexes.json](../src/data/complexes.json)의 `id`입니다. `from`과 `to`는 `YYYY-MM-DD` 형식이며 양 끝 날짜를 포함합니다. 시작일이 종료일보다 늦거나 기간이 걸치는 계약월이 36개를 넘으면 거절합니다. 서울 기준 현재 월 이후의 계약월은 외부 API에 요청하지 않습니다.

개발 서버를 켠 상태에서 다음과 같이 확인할 수 있습니다. 계약 조회에는 인증키가 필요합니다.

```bash
curl -fsS http://localhost:4317/api/health
curl -fsS 'http://localhost:4317/api/rent/areas?complexId=5d48b3157f'
curl -fsS 'http://localhost:4317/api/rent?complexId=5d48b3157f&from=2026-08-01&to=2026-10-31'
```

계약 금액 `depositManwon`과 `monthlyRentManwon`의 단위는 **만원**, `areaM2`는 **㎡**입니다. `contractType`은 `신규`, `갱신`, `null` 중 하나입니다. 계약은 최신 계약일순으로 반환합니다.

`/api/rent/areas`는 저장된 면적 목록만 반환하므로 인증키 없이 호출할 수 있습니다. 응답의 `fetchedAt`은 응답 생성 시각이며 면적 자료를 수집한 날짜가 아닙니다. `/api/rent`의 `fetchedAt` 역시 응답 생성 시각으로, 계약 자료는 서버 캐시에서 가져올 수 있습니다.

### 오류 응답

오류 형식은 `{"code":"오류 코드","message":"안내 문구"}`입니다.

| HTTP | 코드 | 의미 |
| --- | --- | --- |
| 400 | `BAD_PERIOD` | 계약 조회 조건 형식 또는 기간 오류 |
| 400 | `NOT_FOUND` | 면적 조회의 단지 ID 형식 오류 |
| 404 | `NOT_FOUND` | 목록에 없는 단지 |
| 429 | `QUOTA_EXCEEDED` | 앱의 요청 제한 또는 공공데이터포털 호출 한도 초과 |
| 502 | `KEY_INVALID` | 외부 API에서 인증키·허용 IP를 거부 |
| 502 | `UPSTREAM` | 외부 API 연결·응답·파싱·페이지 수집 오류 |
| 503 | `KEY_MISSING` | 서버의 실거래 인증키 미설정 |

계약 API는 요청 제한, 인증키, 조회 조건 순으로 검사합니다. 키가 없다면 잘못된 쿼리에도 먼저 `KEY_MISSING`을 반환할 수 있습니다. 정상 조회에서 계약이 없는 경우에는 오류 대신 빈 `contracts` 배열을 반환합니다.

### 캐시와 요청 제한

- 월별 계약 캐시는 `LAWD_CD:YYYYMM`을 키로 사용합니다. 현재 월·직전 월은 6시간, 그 이전 월은 7일간 유지합니다.
- 진행 중인 같은 지역·월 요청은 공유하며, 한 계약 조회 안에서 월별 요청을 최대 4개까지 병렬 처리합니다.
- 외부 API는 페이지당 1,000행을 요청합니다. 한 달 결과가 30페이지를 넘으면 일부 결과 대신 오류를 반환합니다. 페이지 요청별 제한 시간은 20초입니다.
- 계약 API는 클라이언트 주소별로 60초 동안 최대 20회 요청을 허용합니다. `x-forwarded-for`의 첫 주소, `x-real-ip`, `local` 순으로 식별합니다.
- 캐시와 요청 제한은 프로세스 메모리에 있습니다. 재시작하면 초기화되고 여러 Pod 사이에서 공유되지 않습니다.
- 면적 API의 공유 캐시 헤더는 `s-maxage=86400, stale-while-revalidate=604800`입니다. 브라우저의 TanStack Query 면적 캐시도 24시간을 기준으로 합니다.

## 브라우저 저장과 공유

| 저장 항목 | localStorage 키 |
| --- | --- |
| 관심 단지 | `jip-eonje:favorite-complexes` |
| 최근 본 단지, 최대 10개 | `jip-eonje:recent-complexes` |
| 마지막 선택 단지 | `jip-eonje:last-complex` |
| 단지별 기간·면적·계약 유형 | `jip-eonje:rent-preferences:<단지 ID>` |

단지 링크에는 `complex`가 들어갑니다. 조회 조건 링크는 여기에 `rent=1`, `from`, `to`, `areas`, `type`을 함께 저장합니다. 면적은 소수점 두 자리의 쉼표 구분 값이며 빈 값은 전체 면적을 뜻합니다.

공유 기간은 ‘최근 3개월’ 같은 상대 기간을 실제 날짜로 바꾸어 저장합니다. 유효한 공유 조건을 브라우저 저장값보다 먼저 적용합니다. 브라우저 저장이 제한되어도 현재 화면에서 선택·탐색을 이어갈 수 있도록 처리합니다.

## 데이터 갱신

### 단지 목록과 좌표

공식 원본을 내려받아 목록과 메타정보를 다시 생성합니다.

```bash
npm run data:complexes
```

이 명령은 `.env.local`을 자동으로 읽지 않습니다. 해당 파일의 `KAKAO_REST_API_KEY`로 좌표를 보완하려면 다음 명령을 사용합니다.

```bash
node --env-file-if-exists=.env.local scripts/build-complexes.mjs
```

원본을 이미 내려받았다면 파일 경로를 지정할 수도 있습니다.

```bash
npm run data:complexes -- --sh-file /path/to/sh.xlsx --kapt-file /path/to/kapt.csv
```

결과는 `src/data/complexes.json`과 `src/data/complexes.meta.json`에 저장됩니다. 같은 ID의 기존 전용면적은 유지합니다. K-apt에서 좌표를 찾지 못한 경우 기존 카카오 지오코딩 좌표도 유지하며, 남은 단지는 REST API 키가 있을 때만 주소 검색을 시도합니다.

원본 파일 번호나 열 구성이 바뀌면 스크립트가 실패할 수 있습니다. 공식 원본과 스크립트의 `SH_DATASET`, 예상 열 구성을 대조하세요. 단지 ID는 자치구·단지명·주소에서 생성되므로 원본 이름이나 주소가 바뀌면 ID와 기존 브라우저 기록·SH 링크 연결에도 영향이 있습니다.

### 전용면적 목록

`.env.local`에 `DATA_GO_KR_SERVICE_KEY`를 넣고 실행합니다. 이 명령은 환경변수 파일을 자동으로 읽습니다.

```bash
npm run data:areas
```

최근 36개 계약월을 지역별로 한 번씩 수집해 기존 `areasM2`에 합칩니다. 기존 면적을 삭제하지 않으므로 목록 전체가 최근 36개월에만 한정되는 것은 아닙니다. 소수점 두 자리로 중복을 정리하고 오름차순으로 저장합니다.

현재 목록은 25개 지역이므로 기본 조회 단위는 최대 900개이며, 페이지가 여러 개면 실제 외부 요청은 늘어납니다. 모든 조회가 성공한 뒤에만 JSON을 저장합니다. 실패 시 출력되는 `lawdCd`와 `month`로 실패 구간을 확인합니다.

### 갱신 후 확인

```bash
git diff -- src/data/complexes.json src/data/complexes.meta.json
npm test -- --runInBand
npm run typecheck
npm run lint
npm run build
```

단지 수, 좌표 확보 수, 기준일과 생성일을 확인하고 README의 데이터 표도 맞춥니다. SH 상세페이지를 추가할 때는 자치구·단지명·도로명 주소를 확인한 뒤 [sh-links.json](../src/data/sh-links.json)에 등록합니다.

## 검증 범위

기존 테스트는 금액·기간·XML 파싱·주소 매칭·API 오류 처리, 검색·지도·목록 연동, 최근 기록과 조회 조건 공유 등을 다룹니다. 테스트 파일은 구현 옆에 있습니다.

코드 변경 후에는 위 타입 검사·린트·테스트·빌드를 실행합니다. 화면을 바꿨다면 모바일·데스크톱에서 영향을 받는 흐름과 키 미설정·조회 실패·빈 결과를 확인하세요. 테스트 성공만으로 실제 카카오 지도나 국토부 인증키의 작동을 확인한 것은 아닙니다.

문서만 바꾼 경우에는 링크·파일 경로·명령어를 대조하고 `git diff --check`로 형식을 확인합니다. Next.js 관련 구현 전에는 [AGENTS.md](../AGENTS.md)에 따라 설치된 패키지의 `node_modules/next/dist/docs/`에서 해당 버전의 안내를 읽습니다.
