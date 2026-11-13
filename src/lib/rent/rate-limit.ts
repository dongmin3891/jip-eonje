const hits = new Map<string, number[]>();

/** 같은 주소에서 짧은 시간에 실거래 조회가 몰리지 않게 한다. */
export function allowRequest(
  key: string,
  now = Date.now(),
  limit = 20,
  windowMs = 60_000,
): boolean {
  const recent = (hits.get(key) ?? []).filter((time) => now - time < windowMs);
  if (recent.length >= limit) {
    hits.set(key, recent);
    return false;
  }
  recent.push(now);
  hits.set(key, recent);
  return true;
}

export function clientKey(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || request.headers.get("x-real-ip")?.trim() || "local";
}
