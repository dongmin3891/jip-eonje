import complexData from "@/data/complexes.json";
import metaData from "@/data/complexes.meta.json";

export type CoordSource = "kapt-address" | "kapt-name" | "kakao-geocode";

export type Complex = {
  id: string;
  name: string;
  district: string;
  lawdCd: string;
  housingType: string;
  rentalUnits: number | null;
  moveInDate: string | null;
  address: string;
  roadName: string | null;
  buildingNo: string | null;
  legalDong: string | null;
  lotNumber: string | null;
  buildingName: string | null;
  lat: number | null;
  lng: number | null;
  coordSource: CoordSource | null;
  /** 최근 데이터 생성에서 확인한 전용면적 카탈로그. */
  areasM2: number[];
};

export type ComplexMeta = {
  generatedAt: string;
  complexList: {
    datasetId: string;
    title: string;
    provider: string;
    url: string;
    sheetName: string;
    referenceDate: string;
    totalRows: number;
    rule: string;
  };
  coordinates: {
    datasetId: string;
    title: string;
    provider: string;
    url: string;
    kaptRows: number;
  };
  counts: {
    complexes: number;
    withCoordinates: number;
    byKaptAddress: number;
    byKaptName: number;
    byKakaoGeocode: number;
    withoutCoordinates: number;
  };
};

export const complexes = complexData as Complex[];
export const complexMeta = metaData as ComplexMeta;

const byId = new Map(complexes.map((complex) => [complex.id, complex]));

export function getComplex(id: string): Complex | undefined {
  return byId.get(id);
}

export function hasCoordinates(complex: Complex): boolean {
  return complex.lat != null && complex.lng != null;
}

/** 주택유형에 행복주택 외 유형이 함께 있으면 실거래가 단지 전체 계약과 섞일 수 있다. */
export function isMixedHousingType(complex: Complex): boolean {
  return complex.housingType.includes(",");
}

function compact(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, "");
}

/**
 * 단지명 접두 100, 단지명 포함 80, 자치구 60, 법정동 55, 주소 40.
 * 빈 검색어는 결과를 내지 않는다.
 */
export function searchComplexes(query: string, limit = 8): Complex[] {
  const needle = compact(query);
  if (!needle) return [];

  const scored = complexes.flatMap((complex) => {
    const name = compact(complex.name);
    const district = compact(complex.district);
    const dong = compact(complex.legalDong ?? "");
    const address = compact(complex.address);
    let score = 0;
    if (name.startsWith(needle)) score = 100;
    else if (name.includes(needle)) score = 80;
    else if (district.includes(needle)) score = 60;
    else if (dong.includes(needle)) score = 55;
    else if (address.includes(needle)) score = 40;
    return score > 0 ? [{ complex, score }] : [];
  });

  scored.sort(
    (left, right) =>
      right.score - left.score ||
      left.complex.district.localeCompare(right.complex.district, "ko") ||
      left.complex.name.localeCompare(right.complex.name, "ko"),
  );
  return scored.slice(0, limit).map((item) => item.complex);
}

function addressKeys(complex: Complex): string[] {
  const keys: string[] = [];
  if (complex.roadName && complex.buildingNo) {
    keys.push(`road:${complex.district}|${complex.roadName}|${complex.buildingNo}`);
  }
  if (complex.legalDong && complex.lotNumber) {
    keys.push(
      `lot:${complex.district}|${complex.legalDong}|${complex.lotNumber.replace(/\s+/g, "")}`,
    );
  }
  return keys;
}

const peersById = new Map<string, Complex[]>();

function indexAddressPeers(list: Complex[]) {
  const groups = new Map<string, Complex[]>();
  for (const complex of list) {
    for (const key of addressKeys(complex)) {
      const group = groups.get(key);
      if (group) group.push(complex);
      else groups.set(key, [complex]);
    }
  }
  for (const group of groups.values()) {
    if (group.length < 2) continue;
    for (const complex of group) {
      const peers = peersById.get(complex.id) ?? [];
      for (const other of group) {
        if (other.id !== complex.id && !peers.some((item) => item.id === other.id)) {
          peers.push(other);
        }
      }
      peersById.set(complex.id, peers);
    }
  }
}

indexAddressPeers(complexes);

/** 도로명 또는 지번이 같은 다른 단지. 실거래가 함께 잡힐 수 있다. */
export function addressPeers(id: string): Complex[] {
  return peersById.get(id) ?? [];
}
