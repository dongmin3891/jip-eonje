<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## 프로젝트 개요

집언제는 서울 SH 행복주택 단지와 공개 전월세 계약을 탐색하는 한국어 웹앱이다. Next.js App Router와 정적 JSON 데이터를 사용하며, 별도 로그인·데이터베이스는 없다.

- 시작 안내: [README.md](README.md)
- 구조·API·데이터 갱신: [docs/development.md](docs/development.md)
- 배포: [docs/deployment.md](docs/deployment.md)
- 데이터 근거: [docs/api-research.md](docs/api-research.md)

## 작업 기준

- Node.js 22와 npm을 기준으로 작업하고 `package-lock.json`을 유지한다.
- 기존 `src/components/ui/`와 `src/lib/` 구현을 먼저 확인하고 재사용한다.
- 경로 별칭 `@/`는 `src/`를 가리킨다. 테스트는 관련 구현 옆의 `*.test.ts` 또는 `*.test.tsx`에 둔다.
- 화면 문구와 문서는 한국어로 작성한다. 데이터가 없거나 기능을 사용할 수 없는 이유를 구분해서 설명한다.
- Next.js API를 변경하기 전에 위 자동 생성 블록의 안내대로 설치된 버전의 문서를 읽는다. 해당 블록을 삭제하거나 바꾸지 않는다.

## 데이터 규칙

- 단지 채택 기준은 공식 주택관리현황의 주택유형에 ‘행복’이 포함되는지다. 기준일·출처를 함께 유지한다.
- 확인하지 못한 좌표는 `null`로 둔다. 검색·계약 조회에는 남기고 지도 마커에서는 제외한다.
- 계약 매칭은 법정동·지번 또는 도로명·건물번호로 한다. 단지명만으로 연결하지 않는다.
- 취소 계약은 제외한다. 계약 고유번호가 없으므로 금액·날짜 등이 같다는 이유만으로 중복을 제거하지 않는다.
- 금액 필드의 단위는 만원, 전용면적은 ㎡다. 기간 계산은 `Asia/Seoul`을 기준으로 한다.
- 전월세 건수를 당첨·입주 인원으로 설명하지 않는다. 공가·예비자·입주 시점은 추정하지 않는다.
- SH 공가·예비자 정보는 공식 페이지로 연결한다. 상세 주소는 `src/data/sh-links.json`에서 관리하고 확인되지 않은 단지는 주택정보 메인으로 보낸다.
- 단지 목록·전용면적 갱신은 `scripts/`의 생성 절차를 사용한다. 사용자 요청 중 최근 36개월 전체를 조회해 면적 목록을 만들지 않는다.

## 환경변수와 배포

- 실제 인증키·토큰·Secret 값은 코드, 문서, 테스트, 로그에 넣지 않는다. 로컬 예시는 `.env.example`을 기준으로 한다.
- `DATA_GO_KR_SERVICE_KEY`는 서버와 데이터 생성 스크립트에서만 사용한다.
- `KAKAO_MAP_JS_KEY`는 서버에서 읽어 브라우저 SDK에 전달한다. 환경변수 이름과 카카오 도메인 제한을 유지한다.
- `KAKAO_REST_API_KEY`는 단지 목록 생성 전용이다. 런타임 의존성을 추가하지 않는다.
- 지도 키·실거래 키가 없어도 검색과 목록은 사용할 수 있어야 한다.
- 운영은 standalone 컨테이너의 `3000` 포트를 사용한다. 로컬 npm 서버는 `4317` 포트다.

## 변경 후 확인

코드 변경 시 관련 동작을 검증하고 다음 검사를 실행한다.

```bash
npm run typecheck
npm run lint
npm test -- --runInBand
npm run build
```

문서만 수정했다면 링크·경로·명령어와 `git diff --check`를 확인한다. UI 변경은 모바일·데스크톱에서 검색, 단지 선택, 필터, 키 미설정 상태 등 영향을 받는 흐름을 확인한다. 실제 키나 배포 환경에서 확인하지 못한 동작을 검증 완료로 기록하지 않는다.

사용법·환경변수·데이터 규칙·배포 구성이 바뀌면 관련 문서도 함께 갱신한다.
