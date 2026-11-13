import { connection } from "next/server";
import { z } from "zod";

import { getComplex } from "@/lib/complexes";
import { getRentAreas } from "@/lib/rent/molit";
import { areaCatalogRange } from "@/lib/rent/period";
import { MolitError } from "@/lib/rent/parse";
import { allowRequest, clientKey } from "@/lib/rent/rate-limit";
import type { ApiErrorBody, RentAreasResponse } from "@/lib/rent/types";

const querySchema = z.object({ complexId: z.string().trim().min(1).max(40) });
const AREA_CACHE_SECONDS = 24 * 60 * 60;

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
    return errorResponse("QUOTA_EXCEEDED", "조회가 너무 빠릅니다. 잠시 뒤에 다시 시도해 주세요.", 429);
  }

  const serviceKey = process.env.DATA_GO_KR_SERVICE_KEY?.trim();
  if (!serviceKey) {
    return errorResponse(
      "KEY_MISSING",
      "공공데이터포털 인증키가 설정되지 않아 전용면적을 조회하지 않습니다.",
      503,
    );
  }

  const url = new URL(request.url);
  const parsed = querySchema.safeParse({ complexId: url.searchParams.get("complexId") ?? "" });
  if (!parsed.success) return errorResponse("NOT_FOUND", "조회 조건이 올바르지 않습니다.", 400);

  const complex = getComplex(parsed.data.complexId);
  if (!complex) return errorResponse("NOT_FOUND", "목록에 없는 단지입니다.", 404);

  try {
    const catalog = areaCatalogRange();
    const areasM2 = await getRentAreas(complex, catalog.months, serviceKey);
    return Response.json(
      {
        complexId: complex.id,
        areasM2,
        fetchedAt: new Date().toISOString(),
      } satisfies RentAreasResponse,
      {
        headers: {
          "Cache-Control": `public, s-maxage=${AREA_CACHE_SECONDS}, stale-while-revalidate=${7 * AREA_CACHE_SECONDS}`,
        },
      },
    );
  } catch (error) {
    if (error instanceof MolitError) {
      return errorResponse(error.code, error.message, statusFor(error.code));
    }
    console.error("rent areas route failed");
    return errorResponse("UPSTREAM", "전용면적 정보를 조회하지 못했습니다.", 502);
  }
}
