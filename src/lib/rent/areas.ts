/** 셀렉트 값으로 쓰는 전용면적. 59.9와 59.90을 같은 항목으로 본다. */
export function areaKey(areaM2: number): string {
  return areaM2.toFixed(2);
}

/** 긴 기간에서 모은 면적과 이번 조회 계약의 면적을 합쳐 오름차순으로 돌려준다. */
export function mergeAreaKeys(catalog: number[], contracts: { areaM2: number }[]): string[] {
  const keys = new Set<string>(catalog.map(areaKey));
  for (const contract of contracts) keys.add(areaKey(contract.areaM2));
  return [...keys].sort((left, right) => Number(left) - Number(right));
}

export function countByArea(contracts: { areaM2: number }[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const contract of contracts) {
    const key = areaKey(contract.areaM2);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return counts;
}
