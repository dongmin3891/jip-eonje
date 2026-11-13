import { SH_STATUS } from "@/lib/sh/status";

/** 공가·예비자 접근 계층. 지금은 미지원 상태와 공식 페이지 링크만 돌려준다. */
export function GET() {
  return Response.json(SH_STATUS);
}
