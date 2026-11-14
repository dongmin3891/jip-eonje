import { XMLParser } from "fast-xml-parser";

import type { ContractType } from "./types.ts";

export type MolitErrorCode = "KEY_INVALID" | "QUOTA_EXCEEDED" | "UPSTREAM" | "KEY_MISSING";

export class MolitError extends Error {
  readonly code: MolitErrorCode;

  constructor(code: MolitErrorCode, message: string) {
    super(message);
    this.name = "MolitError";
    this.code = code;
  }
}

export type PublicDeal = {
  aptNm: string;
  aptSeq: string | null;
  legalDong: string;
  lotNumber: string | null;
  roadCompact: string | null;
  areaM2: number;
  contractDate: string;
  depositManwon: number;
  monthlyRentManwon: number;
  floor: number | null;
  contractType: ContractType | null;
  cancelled: boolean;
};

export type ParsedPage = {
  items: PublicDeal[];
  totalCount: number;
  pageNo: number;
  numOfRows: number;
};

const parser = new XMLParser({
  ignoreAttributes: true,
  isArray: (name) => name === "item",
  trimValues: false,
  parseTagValue: false,
  parseAttributeValue: false,
});

function text(value: unknown): string {
  if (value == null) return "";
  return String(value).trim();
}

function present(value: unknown): boolean {
  const valueText = text(value);
  return valueText !== "" && valueText !== "0" && valueText !== "-" && valueText !== "null";
}

function parseManwon(value: unknown): number | null {
  const normalized = text(value).replace(/,/g, "");
  if (!normalized) return null;
  const amount = Number(normalized);
  return Number.isFinite(amount) ? amount : null;
}

function stripZeros(value: string): string {
  if (!value) return "";
  return value.replace(/^0+/, "") || "0";
}

function composeBuildingNo(bonbun: string, bubun: string): string | null {
  const main = stripZeros(bonbun);
  if (!main || main === "0") return null;
  const sub = stripZeros(bubun);
  if (!sub || sub === "0") return main;
  return `${main}-${sub}`;
}

export function roadCompact(row: Record<string, unknown>): string | null {
  const road = text(row.roadnm).replace(/\s+/g, "");
  if (!road) return null;
  const building = composeBuildingNo(text(row.roadnmbonbun), text(row.roadnmbubun));
  if (!building || road.endsWith(building)) return road;
  return `${road}${building}`;
}

function contractType(value: unknown): ContractType | null {
  const type = text(value);
  if (type === "신규" || type === "갱신") return type;
  return null;
}

function findReason(node: unknown): { code: string } | null {
  if (!node || typeof node !== "object") return null;
  const record = node as Record<string, unknown>;
  if ("returnReasonCode" in record) return { code: text(record.returnReasonCode) };
  for (const value of Object.values(record)) {
    const found = findReason(value);
    if (found) return found;
  }
  return null;
}

const KEY_MESSAGES: Record<string, string> = {
  "30": "등록되지 않은 공공데이터포털 인증키입니다.",
  "31": "공공데이터포털 인증키가 만료되었습니다.",
  "32": "이 서버 IP가 인증키에 허용되어 있지 않습니다.",
};

function throwForReason(code: string): void {
  if (code === "22") {
    throw new MolitError(
      "QUOTA_EXCEEDED",
      "공공데이터포털 일일 호출 한도를 초과했습니다. 잠시 뒤에 다시 조회해 주세요.",
    );
  }
  if (code === "30" || code === "31" || code === "32") {
    throw new MolitError("KEY_INVALID", KEY_MESSAGES[code]);
  }
}

function asItems(value: unknown): Record<string, unknown>[] {
  if (!value || typeof value !== "object") return [];
  const items = (value as { item?: unknown }).item;
  if (!items) return [];
  const list = Array.isArray(items) ? items : [items];
  return list.filter((item): item is Record<string, unknown> => !!item && typeof item === "object");
}

function toDeal(row: Record<string, unknown>): PublicDeal | null {
  const year = text(row.dealYear);
  const month = text(row.dealMonth).padStart(2, "0");
  const day = text(row.dealDay).padStart(2, "0");
  if (!/^\d{4}$/.test(year) || !/^\d{2}$/.test(month) || !/^\d{2}$/.test(day)) return null;
  const deposit = parseManwon(row.deposit);
  const monthlyRent = parseManwon(row.monthlyRent);
  const area = Number(text(row.excluUseAr));
  if (deposit == null || monthlyRent == null || !Number.isFinite(area)) return null;
  const floorText = text(row.floor);
  const floor = floorText && Number.isFinite(Number(floorText)) ? Number(floorText) : null;
  const aptSeq = text(row.aptSeq);
  return {
    aptNm: text(row.aptNm),
    aptSeq: aptSeq || null,
    legalDong: text(row.umdNm).replace(/\s+/g, ""),
    lotNumber: text(row.jibun).replace(/\s+/g, "").replace(/번지$/, "") || null,
    roadCompact: roadCompact(row),
    areaM2: area,
    contractDate: `${year}-${month}-${day}`,
    depositManwon: deposit,
    monthlyRentManwon: monthlyRent,
    floor,
    contractType: contractType(row.contractType),
    cancelled: present(row.cdealType) || present(row.cdealDay),
  };
}

/** 국토부 XML을 정규화한다. 인증 오류와 호출 한도는 예외로 올린다. */
export function parseMolitXml(xml: string): ParsedPage {
  let parsed: unknown;
  try {
    parsed = parser.parse(xml);
  } catch {
    throw new MolitError("UPSTREAM", "실거래 응답을 읽지 못했습니다.");
  }
  if (!parsed || typeof parsed !== "object") {
    throw new MolitError("UPSTREAM", "실거래 응답을 읽지 못했습니다.");
  }

  const reason = findReason(parsed);
  if (reason?.code) throwForReason(reason.code);

  const response = (parsed as { response?: { header?: Record<string, unknown>; body?: Record<string, unknown> } })
    .response;
  const code = text(response?.header?.resultCode);
  const body = response?.body;
  const pageNo = Number(text(body?.pageNo)) || 1;
  const numOfRows = Number(text(body?.numOfRows)) || 0;
  const totalCount = Number(text(body?.totalCount)) || 0;

  if (code === "03" || code === "3") {
    return { items: [], totalCount: 0, pageNo, numOfRows };
  }
  if (code !== "000" && code !== "0") {
    throw new MolitError("UPSTREAM", `실거래 조회가 거절되었습니다.${code ? ` (코드 ${code})` : ""}`);
  }

  const items = asItems(body?.items).flatMap((row) => {
    const deal = toDeal(row);
    return deal ? [deal] : [];
  });
  return { items, totalCount, pageNo, numOfRows };
}
