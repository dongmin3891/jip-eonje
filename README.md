# 집언제

서울 SH 행복주택 예비입주자를 위한 단지 탐색 웹앱입니다. 단지를 검색하거나 지도에서 선택해 공개된 전월세 계약을 살펴보고, SH 공식 주택정보로 이동해 공가·예비자 안내를 확인할 수 있습니다.

> 전월세 계약 건수는 당첨자 수나 입주 인원이 아닙니다. 공가·예비자 수와 입주 가능 시점은 앱에서 계산하지 않으며, SH 공식 안내를 확인해야 합니다.

## 주요 기능

- **단지 찾기**: 단지명·자치구·법정동·주소 검색, 자치구 필터, 지도와 목록 탐색
- **전월세 계약 조회**: 기간 선택, 전용면적 복수 선택, 신규·갱신 계약 필터
- **다시 찾아보기**: 관심 단지, 최근 본 단지 최대 10개, 마지막 선택 단지와 단지별 조회 조건 복원
- **조회 조건 공유**: 단지·기간·면적·계약 유형이 담긴 링크 복사
- **SH 공식 정보 연결**: 확인된 단지는 상세페이지로, 나머지는 SH 주택정보 메인으로 이동

로그인 없이 사용할 수 있습니다. 관심 단지와 최근 기록, 조회 조건은 같은 브라우저의 `localStorage`에 저장되며 기기 간 동기화되지 않습니다.

## 빠른 시작

CI와 Docker 환경에 맞춰 **Node.js 22와 npm**을 사용합니다. 저장소 루트에서 실행하세요.

```bash
npm ci
cp .env.example .env.local
npm run dev
```

이미 `.env.local`이 있다면 복사 단계를 건너뜁니다. 실행 후 [http://localhost:4317](http://localhost:4317)에 접속합니다.

API 키를 비워 두어도 단지 검색과 목록, 관심 단지 기능을 사용할 수 있습니다. 지도와 실거래 조회는 각각 필요한 키가 없다는 안내를 표시합니다.

## 환경변수 설정

로컬 설정은 저장소 루트의 `.env.local`에 입력합니다. 예시는 [.env.example](.env.example)에 있으며, 실제 키가 들어간 파일은 Git에서 제외됩니다.

| 변수 | 사용하는 곳 | 필요한 기능 |
| --- | --- | --- |
| `DATA_GO_KR_SERVICE_KEY` | 서버, 전용면적 생성 스크립트 | 국토부 전월세 계약 조회·면적 목록 갱신 |
| `KAKAO_MAP_JS_KEY` | 서버에서 읽어 브라우저 SDK에 전달 | 카카오 지도 표시 |
| `KAKAO_REST_API_KEY` | 단지 목록 생성 스크립트 | 선택 사항. 좌표가 없는 단지의 주소 검색 |

### 전월세 실거래

1. 공공데이터포털의 [국토교통부 아파트 전월세 실거래가 자료](https://www.data.go.kr/data/15126474/openapi.do)에서 활용신청을 합니다.
2. 일반 인증키를 `DATA_GO_KR_SERVICE_KEY`에 입력합니다. 앱은 인코딩된 키와 디코딩된 키를 모두 처리합니다.
3. 개발 서버를 다시 시작하고 단지 상세에서 계약 조회를 확인합니다.

### 카카오 지도

1. [Kakao Developers](https://developers.kakao.com/)에서 앱의 JavaScript 키를 확인합니다.
2. 웹 도메인에 로컬 주소 `http://localhost:4317`과 실제 서비스 도메인을 등록합니다.
3. JavaScript 키를 `KAKAO_MAP_JS_KEY`에 입력하고 개발 서버를 다시 시작합니다.

`KAKAO_MAP_JS_KEY`는 브라우저에서 사용하는 키이므로 카카오 콘솔의 허용 도메인 설정으로 관리합니다. 현재 코드는 이 이름을 서버에서 읽어 전달하므로 `NEXT_PUBLIC_` 접두사를 붙이지 않습니다. REST API 키는 지도 표시용 JavaScript 키와 별개입니다.

## 개발 명령어

| 명령어 | 설명 |
| --- | --- |
| `npm run dev` | 개발 서버 실행, 포트 `4317` |
| `npm run typecheck` | TypeScript 타입 검사 |
| `npm run lint` | ESLint 검사 |
| `npm test -- --runInBand` | Jest 테스트를 순차 실행 |
| `npm run build` | 프로덕션 빌드와 standalone 산출물 생성 |
| `npm start` | 빌드 후 Next.js 서버 실행, 포트 `4317` |
| `npm run data:complexes` | 공식 원본에서 단지 목록과 좌표 재생성 |
| `npm run data:areas` | 최근 36개월 실거래에서 전용면적 목록 갱신 |

컨테이너는 standalone의 `server.js`를 실행하며 내부 포트는 `3000`입니다. Docker 실행과 K3s 배포 절차는 [배포 문서](docs/deployment.md)에 있습니다.

> `data:complexes`는 `.env.local`을 자동으로 읽지 않습니다. 이 파일의 REST API 키로 좌표를 보완하려면 [데이터 갱신 절차](docs/development.md#단지-목록과-좌표)를 따르세요.

## 데이터와 해석 범위

단지 목록은 서울 열린데이터광장의 SH 주택관리현황에서 **주택유형에 ‘행복’이 포함된 행**을 가져옵니다. 좌표는 서울시 공동주택 아파트 정보와 주소·단지명을 대조해 연결합니다.

아래 수치는 저장소의 [데이터 메타정보](src/data/complexes.meta.json)를 기준으로 합니다.

| 항목 | 값 |
| --- | --- |
| 단지 목록 원본 | [OA-12027 SH 주택관리현황](https://data.seoul.go.kr/dataList/OA-12027/F/1/datasetView.do) |
| 원본 기준일 | 2025-12-31, 시트 `25.12.31.기준` |
| 데이터 생성일 | 2026-11-13 |
| 전체 원본 행 / 채택 단지 | 825행 / 219단지 |
| 좌표 확보 / 미확보 | 153단지 / 66단지 |
| 좌표 매칭 근거 | 도로명 주소 145단지, 단지명 8단지 |
| 좌표 원본 | [OA-15818 서울시 공동주택 아파트 정보](https://data.seoul.go.kr/dataList/OA-15818/S/1/datasetView.do), 2,898행 |

좌표가 없는 단지도 검색과 계약 조회 대상에 포함하며, 지도 마커만 표시하지 않습니다. 좌표를 임의로 추정하지 않습니다.

계약 내역은 주소가 일치하는 공개 자료입니다. 행복주택 외 주택유형이 섞인 단지나 주소가 같은 단지는 다른 유형·단지의 계약이 함께 잡힐 수 있습니다. 예를 들어 DMC센트럴자이(증산2)와 DMC센트럴자이(증산2)_2단지는 같은 주소를 사용합니다. 여러 주택유형이 함께 적힌 행의 임대세대수도 유형별 합계이므로 공가 수로 해석하면 안 됩니다.

앱은 매매가, 시세 예측, 투자 분석, 중개 기능을 제공하지 않습니다. 데이터 출처와 매칭 규칙, 외부 API 조사 당시의 확인 범위는 [공공 API 조사 문서](docs/api-research.md)에 정리했습니다.

## 기술 구성

Next.js 16.4.6 App Router, React 19.3, TypeScript, Tailwind CSS 4, TanStack Query를 사용합니다. 서버에서 국토부 XML 응답을 정규화하고, 화면에서 면적·계약 유형을 필터링합니다. 별도 데이터베이스는 사용하지 않습니다.

```text
src/
  app/                  페이지, 레이아웃, API Route Handlers
  components/           검색, 지도, 단지 상세, 계약 필터와 공통 UI
  data/                 단지 목록, 출처·기준일, SH 상세페이지 주소
  lib/                  검색, 브라우저 저장, 계약 조회·파싱·매칭
  types/                카카오맵 타입 선언
scripts/                단지 목록·전용면적 생성 스크립트
docs/                   개발, 배포, 외부 데이터 조사 문서
k8s/                    Deployment, Service, Ingress, Certificate
argocd/                 Argo CD Application
.github/workflows/      검사, 이미지 빌드·게시, 배포 이미지 갱신
```

## 문서 안내

| 문서 | 내용 |
| --- | --- |
| [개발 가이드](docs/development.md) | 데이터 흐름, 내부 API, 데이터 갱신, 검증 방법 |
| [배포 가이드](docs/deployment.md) | Docker, GitHub Actions, K3s·Argo CD, 운영 점검 |
| [공공 API 조사](docs/api-research.md) | 공식 출처, 채택 근거, 주소 매칭과 연동 범위 |
| [AGENTS.md](AGENTS.md) | 코딩 에이전트가 따라야 할 프로젝트 규칙 |
