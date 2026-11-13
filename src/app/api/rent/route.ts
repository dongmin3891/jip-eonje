import { connection } from "next/server";
import { z } from "zod";

import { getComplex } from "@/lib/complexes";
import { getRentContracts } from "@/lib/rent/molit";
import { resolveRange } from "@/lib/rent/period";
import { MolitError } from "@/lib/rent/parse";
import { allowRequest, clientKey } from "@/lib/rent/rate-limit";
import { MOLIT_SOURCE, type ApiErrorBody } from "@/lib/rent/types";

const querySchema = z.object({
  complexId: z.string().trim().min(1).max(40),
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

function errorResponse(code: ApiErrorBody["code"], message: string, status: number) {
  return Response.json({ code, message } satisfies ApiErrorBody, { status });
}

function statusFor(code: MolitError["code"]): number {
  if (code === "KEY_MISSING") return 503;
  if (code === "QUOTA_EXCEEDED") return 429;
  return 502;
}

export async function GET(request: Request) {
  await connection();

  if (!allowRequest(clientKey(request))) {
    return errorResponse(
      "QUOTA_EXCEEDED",
      "조회가 너무 빠릅니다. 잠시 뒤에 다시 시도해 주세요.",
      429,
    );
  }

  const serviceKey = process.env.DATA_GO_KR_SERVICE_KEY?.trim();
  if (!serviceKey) {
    return errorResponse(
      "KEY_MISSING",
      "공공데이터포털 인증키가 설정되지 않아 전월세 계약을 조회하지 않습니다.",
      503,
    );
  }

  const url = new URL(request.url);
  const parsed = querySchema.safeParse({
    complexId: url.searchParams.get("complexId") ?? "",
    from: url.searchParams.get("from") ?? "",
    to: url.searchParams.get("to") ?? "",
  });
  if (!parsed.success) {
    return errorResponse("BAD_PERIOD", "조회 조건이 올바르지 않습니다.", 400);
  }

  const complex = getComplex(parsed.data.complexId);
  if (!complex) {
    return errorResponse("NOT_FOUND", "목록에 없는 단지입니다.", 404);
  }

  const range = resolveRange(parsed.data.from, parsed.data.to);
  if (!range.ok) {
    return errorResponse("BAD_PERIOD", range.message, 400);
  }

  try {
    const result = await getRentContracts(
      complex,
      range.from,
      range.to,
      range.months,
      serviceKey,
    );
    return Response.json({
      complexId: complex.id,
      from: range.from,
      to: range.to,
      lawdCd: complex.lawdCd,
      months: range.months,
      contracts: result.contracts,
      matchedAptNames: result.matchedAptNames,
      fetchedAt: new Date().toISOString(),
      source: MOLIT_SOURCE,
    });
  } catch (error) {
    if (error instanceof MolitError) {
      return errorResponse(error.code, error.message, statusFor(error.code));
    }
    console.error("rent route failed");
    return errorResponse("UPSTREAM", "전월세 계약을 조회하지 못했습니다.", 502);
  }
}
