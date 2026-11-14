import { connection } from "next/server";
import { z } from "zod";

import { getComplex } from "@/lib/complexes";
import type { ApiErrorBody, RentAreasResponse } from "@/lib/rent/types";

const querySchema = z.object({ complexId: z.string().trim().min(1).max(40) });
const AREA_CACHE_SECONDS = 24 * 60 * 60;

function errorResponse(code: ApiErrorBody["code"], message: string, status: number) {
  return Response.json({ code, message } satisfies ApiErrorBody, { status });
}

export async function GET(request: Request) {
  await connection();

  const url = new URL(request.url);
  const parsed = querySchema.safeParse({ complexId: url.searchParams.get("complexId") ?? "" });
  if (!parsed.success) return errorResponse("NOT_FOUND", "조회 조건이 올바르지 않습니다.", 400);

  const complex = getComplex(parsed.data.complexId);
  if (!complex) return errorResponse("NOT_FOUND", "목록에 없는 단지입니다.", 404);

  return Response.json(
    {
      complexId: complex.id,
      areasM2: complex.areasM2,
      fetchedAt: new Date().toISOString(),
    } satisfies RentAreasResponse,
    {
      headers: {
        "Cache-Control": `public, s-maxage=${AREA_CACHE_SECONDS}, stale-while-revalidate=${7 * AREA_CACHE_SECONDS}`,
      },
    },
  );
}
