#!/usr/bin/env node
/**
 * 최근 36개월 국토부 전월세 데이터를 지역·월별로 한 번씩 받아
 * src/data/complexes.json의 단지별 areasM2 카탈로그를 갱신한다.
 */
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import type { Complex } from "../src/lib/complexes.ts";
import { areaKey } from "../src/lib/rent/areas.ts";
import { matchesComplex } from "../src/lib/rent/match.ts";
import { fetchMolitMonth } from "../src/lib/rent/molit-client.ts";
import { areaCatalogRange } from "../src/lib/rent/period.ts";
import type { PublicDeal } from "../src/lib/rent/parse.ts";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const COMPLEXES_FILE = path.join(ROOT, "src/data/complexes.json");
const DEFAULT_CONCURRENCY = 4;

export type MonthLoader = (
  lawdCd: string,
  yyyymm: string,
  serviceKey: string,
) => Promise<PublicDeal[]>;

type MonthJob = {
  lawdCd: string;
  month: string;
  complexes: Complex[];
};

async function mapLimit<T>(items: T[], limit: number, task: (item: T) => Promise<void>): Promise<void> {
  let cursor = 0;
  async function worker() {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      await task(items[index]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, () => worker()));
}

function groupByLawdCd(complexes: Complex[]): Map<string, Complex[]> {
  const groups = new Map<string, Complex[]>();
  for (const complex of complexes) {
    const group = groups.get(complex.lawdCd);
    if (group) group.push(complex);
    else groups.set(complex.lawdCd, [complex]);
  }
  return groups;
}

function initialAreaKeys(complexes: Complex[]): Map<string, Set<string>> {
  return new Map(
    complexes.map((complex) => [
      complex.id,
      new Set(
        complex.areasM2
          .filter((area) => Number.isFinite(area))
          .map(areaKey),
      ),
    ]),
  );
}

/**
 * 같은 지역·월 요청을 모든 단지가 공유하도록 전용면적 카탈로그를 만든다.
 * 기존 areasM2는 지우지 않고 새로 발견된 면적과 합친다.
 */
export async function generateAreaCatalog(
  complexes: Complex[],
  months: string[],
  serviceKey: string,
  loadMonth: MonthLoader = fetchMolitMonth,
  concurrency = DEFAULT_CONCURRENCY,
): Promise<Complex[]> {
  const groups = groupByLawdCd(complexes);
  const uniqueMonths = [...new Set(months)];
  const jobs: MonthJob[] = [...groups].flatMap(([lawdCd, lawdComplexes]) =>
    uniqueMonths.map((month) => ({ lawdCd, month, complexes: lawdComplexes })),
  );
  const areasByComplex = initialAreaKeys(complexes);

  await mapLimit(jobs, Math.max(1, concurrency), async (job) => {
    let deals: PublicDeal[];
    try {
      deals = await loadMonth(job.lawdCd, job.month, serviceKey);
    } catch (cause) {
      throw new Error(`FAILED lawdCd=${job.lawdCd} month=${job.month}`, { cause });
    }

    for (const deal of deals) {
      for (const complex of job.complexes) {
        if (matchesComplex(deal, complex)) {
          areasByComplex.get(complex.id)?.add(areaKey(deal.areaM2));
        }
      }
    }
  });

  return complexes.map((complex) => ({
    ...complex,
    areasM2: [...(areasByComplex.get(complex.id) ?? [])]
      .sort((left, right) => Number(left) - Number(right))
      .map(Number),
  }));
}

function displayMonth(month: string): string {
  return `${month.slice(0, 4)}-${month.slice(4)}`;
}

async function main() {
  const serviceKey = process.env.DATA_GO_KR_SERVICE_KEY?.trim();
  if (!serviceKey) {
    throw new Error("DATA_GO_KR_SERVICE_KEY가 필요합니다.");
  }

  const complexes = JSON.parse(await readFile(COMPLEXES_FILE, "utf8")) as Complex[];
  const catalog = areaCatalogRange();
  const lawdCount = new Set(complexes.map((complex) => complex.lawdCd)).size;

  console.log("Generating rent areas...");
  console.log("");
  console.log(`period: ${displayMonth(catalog.months[0])} ~ ${displayMonth(catalog.months.at(-1) ?? "")}`);
  console.log(`complexes: ${complexes.length}`);
  console.log(`lawdCd: ${lawdCount}`);
  console.log(`month requests: ${lawdCount * catalog.months.length}`);
  console.log("");

  const generated = await generateAreaCatalog(complexes, catalog.months, serviceKey);
  await writeFile(COMPLEXES_FILE, `${JSON.stringify(generated, null, 2)}\n`);

  const withAreas = generated.filter((complex) => complex.areasM2.length > 0).length;
  console.log("completed");
  console.log("");
  console.log(`with areas: ${withAreas}`);
  console.log(`without areas: ${generated.length - withAreas}`);
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
