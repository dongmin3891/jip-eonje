#!/usr/bin/env node
/**
 * SH 행복주택 단지 목록(src/data/complexes.json)을 공식 공개 데이터로부터 생성한다.
 *
 * 단지 목록 (행복주택 여부의 근거)
 *   서울 열린데이터광장 OA-12027 「서울주택도시개발공사_주택관리현황」 (제공: SH공사 주택관리부, 연간 갱신)
 *   https://data.seoul.go.kr/dataList/OA-12027/F/1/datasetView.do
 *   주택유형에 "행복"이 포함된 행만 사용한다. 그 밖의 단지는 목록에 넣지 않는다.
 *
 * 좌표
 *   1) 서울 열린데이터광장 OA-15818 「서울시 공동주택 아파트 정보」(원천: K-apt)와
 *      자치구 + 도로명주소가 일치하거나, 자치구(+법정동) + 단지명이 정확히 일치하는 경우
 *   2) (선택) KAKAO_REST_API_KEY 가 있으면 남은 단지를 카카오 로컬 주소검색 API로 지오코딩
 *   둘 다 실패한 단지는 좌표 없이(lat/lng = null) 남기고 지도에 표시하지 않는다. 좌표를 추정하지 않는다.
 *
 * 사용법
 *   node scripts/build-complexes.mjs [--sh-file <xlsx>] [--kapt-file <csv>]
 *   파일 인자를 주지 않으면 위 공식 페이지의 내려받기 주소에서 직접 받는다.
 */
import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import readXlsxFile from "read-excel-file/node";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT_FILE = path.join(ROOT, "src/data/complexes.json");
const META_FILE = path.join(ROOT, "src/data/complexes.meta.json");

const SH_DATASET = {
  id: "OA-12027",
  title: "서울주택도시개발공사_주택관리현황",
  provider: "SH공사 (서울 열린데이터광장)",
  pageUrl: "https://data.seoul.go.kr/dataList/OA-12027/F/1/datasetView.do",
  // 「서울주택도시개발공사_주택관리현황(2026).xlsx」의 파일 번호. 새 파일이 올라오면 페이지에서 번호를 확인해 바꾼다.
  fileSeq: "8",
  infSeq: "3",
};
const KAPT_DATASET = {
  id: "OA-15818",
  title: "서울시 공동주택 아파트 정보",
  provider: "서울특별시 (원천: K-apt 공동주택관리정보시스템)",
  pageUrl: "https://data.seoul.go.kr/dataList/OA-15818/S/1/datasetView.do",
};

/** 국토부 실거래가 API의 LAWD_CD(법정동코드 앞 5자리) */
const LAWD_CD_BY_DISTRICT = {
  종로구: "11110", 중구: "11140", 용산구: "11170", 성동구: "11200", 광진구: "11215",
  동대문구: "11230", 중랑구: "11260", 성북구: "11290", 강북구: "11305", 도봉구: "11320",
  노원구: "11350", 은평구: "11380", 서대문구: "11410", 마포구: "11440", 양천구: "11470",
  강서구: "11500", 구로구: "11530", 금천구: "11545", 영등포구: "11560", 동작구: "11590",
  관악구: "11620", 서초구: "11650", 강남구: "11680", 송파구: "11710", 강동구: "11740",
};

const stripSpaces = (value) => (value ?? "").replace(/\s+/g, "");

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i].startsWith("--")) args[argv[i].slice(2)] = argv[i + 1];
  }
  return args;
}

async function postDownload(url, form, referer) {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "User-Agent": "Mozilla/5.0 (data build script)",
      Referer: referer,
    },
    body: new URLSearchParams(form),
  });
  if (!response.ok) throw new Error(`내려받기 실패 (${response.status}): ${url}`);
  return Buffer.from(await response.arrayBuffer());
}

async function loadShWorkbook(file) {
  const buffer = file
    ? await readFile(file)
    : await postDownload(
        "https://datafile.seoul.go.kr/bigfile/iot/inf/nio_download.do?&useCache=false",
        { infId: SH_DATASET.id, seqNo: SH_DATASET.fileSeq, seq: SH_DATASET.fileSeq, infSeq: SH_DATASET.infSeq },
        SH_DATASET.pageUrl,
      );
  if (buffer.subarray(0, 2).toString() !== "PK") {
    throw new Error("주택관리현황 파일이 xlsx 형식이 아닙니다. fileSeq 값을 확인하세요.");
  }
  const sheets = await readXlsxFile(buffer);
  const first = sheets[0];
  return { sheetName: first.sheet, rows: first.data };
}

async function loadKaptRows(file) {
  const buffer = file
    ? await readFile(file)
    : await postDownload(
        "https://datafile.seoul.go.kr/bigfile/iot/sheet/csv/download.do",
        {
          srvType: "S", infId: KAPT_DATASET.id, serviceKind: "1", pageNo: "1", gridTotalCnt: "10000",
          ssUserId: "SAMPLE_VIEW", strWhere: "", strOrderby: "", filterCol: "필터선택", txtFilter: "",
        },
        KAPT_DATASET.pageUrl,
      );
  const text = new TextDecoder("euc-kr").decode(buffer);
  const [header, ...rows] = parseCsv(text);
  return rows
    .filter((row) => row.length === header.length)
    .map((row) => Object.fromEntries(header.map((key, i) => [key, row[i]])));
}

/** 따옴표 안의 쉼표·줄바꿈을 처리하는 CSV 파서 */
function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') { field += '"'; i += 1; }
      else if (ch === '"') quoted = false;
      else field += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ",") { row.push(field); field = ""; }
    else if (ch === "\n") { row.push(field); rows.push(row); row = []; field = ""; }
    else if (ch !== "\r") field += ch;
  }
  if (field || row.length) { row.push(field); rows.push(row); }
  return rows;
}

/** "25.12.31.기준" → "2025-12-31" */
function parseReferenceDate(sheetName) {
  const match = /(\d{2})\.(\d{1,2})\.(\d{1,2})/.exec(sheetName);
  if (!match) throw new Error(`시트 이름에서 기준일을 읽지 못했습니다: ${sheetName}`);
  const [, yy, mm, dd] = match;
  return `20${yy}-${mm.padStart(2, "0")}-${dd.padStart(2, "0")}`;
}

function seoulToday() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

/** read-excel-file는 시간대 없는 날짜를 UTC 자정으로 만든다. 로컬 날짜로 읽으면 KST에서 하루 밀린다. */
function toIsoDate(value) {
  if (!(value instanceof Date) || Number.isNaN(value.getTime())) return null;
  const year = value.getUTCFullYear();
  const month = String(value.getUTCMonth() + 1).padStart(2, "0");
  const day = String(value.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/** "삼성로 72길 12" → { roadName: "삼성로72길", buildingNo: "12" } */
function parseRoad(text) {
  const compact = stripSpaces(text.split(",")[0]);
  const match = /^(.*(?:로|길))(\d+(?:-\d+)?)$/.exec(compact);
  return match ? { roadName: match[1], buildingNo: match[2] } : null;
}

/**
 * "녹번동 282" / "금호동4가 1553" / "가산동143-7" / "신월2동 489-3"(행정동 표기) → 법정동 + 지번
 */
function parseLot(text) {
  const match = /^(?:([가-힣]+)\d+동|([가-힣]+(?:\d+가)?))\s*(산?\s*\d+(?:-\d+)?)?/.exec(text.trim());
  if (!match) return { legalDong: null, lotNumber: null };
  const legalDong = match[1] ? `${match[1]}동` : match[2];
  if (!/(동|가|로)$/.test(legalDong)) return { legalDong: null, lotNumber: null };
  return { legalDong, lotNumber: match[3] ? stripSpaces(match[3]) : null };
}

/** SH 원문 주소 "통일로610 (녹번동 282, 건물명)" → 도로명·법정동·지번·건물명 */
function parseShAddress(rawAddress) {
  const address = rawAddress.trim().replace(/^(서울특별시|서울시)\s*/, "").replace(/^[가-힣]+구\s+/, "");
  const paren = /^(.*?)\s*\((.*)\)\s*$/.exec(address);
  const head = paren ? paren[1] : address;
  const [lotText = "", buildingName = ""] = paren ? paren[2].split(",").map((part) => part.trim()) : [];
  const road = parseRoad(head);
  const lot = parseLot(paren ? lotText : road ? "" : head);
  return { road, ...lot, buildingName: buildingName || null };
}

/** K-apt "서울특별시 성동구 금호동4가 독서당로 344" → 도로명·건물번호 */
function parseKaptRoad(fullAddress) {
  const tokens = fullAddress.trim().split(/\s+/).slice(2);
  if (tokens.length > 1 && /(동|가)$/.test(tokens[0])) tokens.shift();
  return parseRoad(tokens.join(""));
}

const normalizeName = (name) => stripSpaces(name).toLowerCase().replace(/아파트/g, "");

/** 단지명 본체, 괄호 안 이름, 주소의 건물명을 K-apt 단지명과 비교할 후보로 만든다 */
function nameCandidates(name, buildingName) {
  const outer = name.replace(/\(.*?\)/g, "");
  const inner = [...name.matchAll(/\(([^)]*)\)/g)].map((m) => m[1]);
  return [...new Set([outer, ...inner, buildingName ?? ""].map(normalizeName))].filter((n) => n.length >= 5);
}

function buildKaptIndex(kaptRows) {
  const byRoad = new Map();
  const byName = new Map();
  const push = (map, key, value) => map.set(key, [...(map.get(key) ?? []), value]);
  for (const row of kaptRows) {
    const lng = Number(row["좌표X"]);
    const lat = Number(row["좌표Y"]);
    if (!(lat > 37 && lat < 38 && lng > 126 && lng < 128)) continue;
    const entry = { code: row["k-아파트코드"], dong: row["주소(읍면동)"], lat, lng };
    const district = row["주소(시군구)"];
    const road = parseKaptRoad(row["kapt도로명주소"]);
    if (road) push(byRoad, `${district}|${road.roadName}|${road.buildingNo}`, entry);
    push(byName, `${district}|${normalizeName(row["k-아파트명"])}`, entry);
  }
  return { byRoad, byName };
}

function findKaptCoordinate(complex, index) {
  if (complex.road) {
    const hits = index.byRoad.get(`${complex.district}|${complex.road.roadName}|${complex.road.buildingNo}`);
    if (hits?.length) return { ...hits[0], source: "kapt-address" };
  }
  for (const candidate of nameCandidates(complex.name, complex.buildingName)) {
    const hits = (index.byName.get(`${complex.district}|${candidate}`) ?? []).filter(
      (hit) => !complex.legalDong || hit.dong === complex.legalDong,
    );
    if (hits.length === 1) return { ...hits[0], source: "kapt-name" };
  }
  return null;
}

async function geocodeWithKakao(complex, apiKey) {
  const query = complex.road
    ? `서울 ${complex.district} ${complex.road.roadName} ${complex.road.buildingNo}`
    : complex.legalDong && complex.lotNumber
      ? `서울 ${complex.district} ${complex.legalDong} ${complex.lotNumber}`
      : null;
  if (!query) return null;
  const response = await fetch(
    `https://dapi.kakao.com/v2/local/search/address.json?${new URLSearchParams({ query, size: "1" })}`,
    { headers: { Authorization: `KakaoAK ${apiKey}` } },
  );
  if (!response.ok) throw new Error(`카카오 주소검색 실패 (${response.status})`);
  const [doc] = (await response.json()).documents ?? [];
  const district = doc?.road_address?.region_2depth_name ?? doc?.address?.region_2depth_name;
  if (!doc || district !== complex.district) return null;
  return { lat: Number(doc.y), lng: Number(doc.x), source: "kakao-geocode" };
}

async function loadPreviousComplexes() {
  try {
    const previous = JSON.parse(await readFile(OUT_FILE, "utf8"));
    return new Map(previous.map((complex) => [complex.id, complex]));
  } catch {
    return new Map();
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const kakaoKey = process.env.KAKAO_REST_API_KEY;

  const [{ sheetName, rows }, kaptRows, previousComplexes] = await Promise.all([
    loadShWorkbook(args["sh-file"]),
    loadKaptRows(args["kapt-file"]),
    loadPreviousComplexes(),
  ]);

  const [header, ...dataRows] = rows;
  const expected = ["자치구명", "단지명", "주택유형", "임대세대수", "입주개시일", "주소"];
  if (expected.some((name, i) => header[i] !== name)) {
    throw new Error(`주택관리현황 열 구성이 예상과 다릅니다: ${header.join(", ")}`);
  }

  const kaptIndex = buildKaptIndex(kaptRows);
  const complexes = [];
  for (const [district, name, housingType, rentalUnits, moveInDate, address] of dataRows) {
    if (typeof housingType !== "string" || !housingType.includes("행복")) continue;
    const lawdCd = LAWD_CD_BY_DISTRICT[district];
    if (!lawdCd) throw new Error(`알 수 없는 자치구: ${district}`);

    const parsed = parseShAddress(String(address));
    const base = { district, name: String(name).trim(), ...parsed };
    const id = createHash("sha1").update(`${district}|${base.name}|${address}`).digest("hex").slice(0, 10);

    let coordinate = findKaptCoordinate(base, kaptIndex);
    const previous = previousComplexes.get(id);
    if (!coordinate && previous?.coordSource === "kakao-geocode") {
      const kept = previous;
      coordinate = { lat: kept.lat, lng: kept.lng, source: "kakao-geocode" };
    }
    if (!coordinate && kakaoKey) coordinate = await geocodeWithKakao(base, kakaoKey);

    complexes.push({
      id,
      name: base.name,
      district,
      lawdCd,
      housingType: housingType.trim(),
      rentalUnits: typeof rentalUnits === "number" ? rentalUnits : null,
      moveInDate: toIsoDate(moveInDate),
      address: String(address).trim(),
      roadName: parsed.road?.roadName ?? null,
      buildingNo: parsed.road?.buildingNo ?? null,
      legalDong: parsed.legalDong,
      lotNumber: parsed.lotNumber,
      buildingName: parsed.buildingName,
      lat: coordinate?.lat ?? null,
      lng: coordinate?.lng ?? null,
      coordSource: coordinate?.source ?? null,
      areasM2: Array.isArray(previous?.areasM2) ? previous.areasM2 : [],
    });
  }

  if (new Set(complexes.map((c) => c.id)).size !== complexes.length) throw new Error("단지 ID가 중복됩니다.");
  complexes.sort((a, b) => a.district.localeCompare(b.district, "ko") || a.name.localeCompare(b.name, "ko"));

  const countBy = (source) => complexes.filter((c) => c.coordSource === source).length;
  const meta = {
    generatedAt: seoulToday(),
    complexList: {
      datasetId: SH_DATASET.id,
      title: SH_DATASET.title,
      provider: SH_DATASET.provider,
      url: SH_DATASET.pageUrl,
      sheetName,
      referenceDate: parseReferenceDate(sheetName),
      totalRows: dataRows.length,
      rule: '주택유형에 "행복"이 포함된 단지',
    },
    coordinates: {
      datasetId: KAPT_DATASET.id,
      title: KAPT_DATASET.title,
      provider: KAPT_DATASET.provider,
      url: KAPT_DATASET.pageUrl,
      kaptRows: kaptRows.length,
    },
    counts: {
      complexes: complexes.length,
      withCoordinates: complexes.filter((c) => c.lat !== null).length,
      byKaptAddress: countBy("kapt-address"),
      byKaptName: countBy("kapt-name"),
      byKakaoGeocode: countBy("kakao-geocode"),
      withoutCoordinates: countBy(null),
    },
  };

  await writeFile(OUT_FILE, `${JSON.stringify(complexes, null, 2)}\n`);
  await writeFile(META_FILE, `${JSON.stringify(meta, null, 2)}\n`);
  console.log(JSON.stringify(meta, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
