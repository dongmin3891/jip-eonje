export type ContractType = "신규" | "갱신";

export type RentContract = {
  id: string;
  contractDate: string;
  areaM2: number;
  depositManwon: number;
  monthlyRentManwon: number;
  floor: number | null;
  contractType: ContractType | null;
  aptNm: string;
  aptSeq: string | null;
};

export type RentResponse = {
  complexId: string;
  from: string;
  to: string;
  lawdCd: string;
  months: string[];
  contracts: RentContract[];
  matchedAptNames: string[];
  fetchedAt: string;
  source: {
    name: string;
    url: string;
  };
};

export type ApiErrorBody = {
  code:
    | "KEY_MISSING"
    | "NOT_FOUND"
    | "BAD_PERIOD"
    | "KEY_INVALID"
    | "QUOTA_EXCEEDED"
    | "UPSTREAM";
  message: string;
};

export const MOLIT_SOURCE = {
  name: "국토교통부 아파트 전월세 실거래가",
  url: "https://www.data.go.kr/data/15126474/openapi.do",
} as const;

export const MOLIT_ENDPOINT =
  "https://apis.data.go.kr/1613000/RTMSDataSvcAptRent/getRTMSDataSvcAptRent";
