import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";

import { HomeShell } from "@/components/home-shell";
import type { RentResponse } from "@/lib/rent/types";
import { RECENT_COMPLEXES_KEY } from "@/lib/recent-complexes";

const response: RentResponse = {
  complexId: "5d48b3157f",
  from: "2026-08-13",
  to: "2026-11-13",
  lawdCd: "11680",
  months: ["202611"],
  areasM2: [29, 59],
  contracts: [
    { id: "new", contractDate: "2026-11-01", areaM2: 29, depositManwon: 5000, monthlyRentManwon: 30, floor: 3, contractType: "신규", aptNm: "강남센트럴아이파크", aptSeq: null },
    { id: "renewal", contractDate: "2026-11-02", areaM2: 59, depositManwon: 10000, monthlyRentManwon: 50, floor: 5, contractType: "갱신", aptNm: "강남센트럴아이파크", aptSeq: null },
  ],
  matchedAptNames: ["강남센트럴아이파크"],
  fetchedAt: "2026-11-13T00:00:00Z",
  source: { name: "테스트 출처", url: "https://example.com" },
};

const originalFetch = global.fetch;
const fetchMock = jest.fn();
const clients: QueryClient[] = [];

function mount(hasRentKey = true) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  clients.push(client);
  render(<QueryClientProvider client={client}><HomeShell mapKey="" hasRentKey={hasRentKey} /></QueryClientProvider>);
}

function selectComplex() {
  fireEvent.click(screen.getByRole("button", { name: /강남센트럴아이파크 SH 상세 연결/ }));
}

it("용산 목록에서 연 상세를 녹번 검색으로 바꾸면 은평구 목록으로 돌아온다", () => {
  mount(false);
  fireEvent.change(screen.getByRole("combobox", { name: "자치구 필터" }), { target: { value: "용산구" } });
  fireEvent.scroll(screen.getByRole("region", { name: "단지 목록" }), { target: { scrollTop: 320 } });
  fireEvent.click(screen.getByRole("button", { name: /용산롯데캐슬센터포레 SH/ }));
  fireEvent.click(screen.getByRole("button", { name: "펼치기" }));
  fireEvent.change(screen.getByRole("combobox", { name: "단지명 또는 지역 검색" }), { target: { value: "녹번" } });
  fireEvent.click(screen.getByRole("option", { name: /힐스테이트\(녹번제1-1구역\)/ }));
  expect(screen.getByRole("button", { name: "기본" })).toHaveAttribute("aria-pressed", "true");
  fireEvent.click(screen.getByRole("button", { name: "← 단지 목록" }));
  expect(screen.getByRole("combobox", { name: "자치구 필터" })).toHaveValue("은평구");
  expect(screen.getByRole("region", { name: "단지 목록" }).scrollTop).toBe(0);
});

function rentSection() {
  return within(screen.getByRole("region", { name: "공개된 전월세 계약" }));
}

beforeEach(() => {
  window.history.replaceState(null, "", "/");
  localStorage.clear();
  fetchMock.mockReset();
  fetchMock.mockResolvedValue({ ok: true, json: async () => response });
  global.fetch = fetchMock;
});

it("공유 URL이 최근 단지보다 우선하고 뒤로가기·앞으로가기로 선택을 복원한다", async () => {
  localStorage.setItem("jip-eonje:last-complex", "45e8591f50");
  window.history.replaceState(null, "", "/?complex=5d48b3157f&source=share");
  mount(false);
  expect(screen.getByRole("heading", { name: "강남센트럴아이파크" })).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "← 단지 목록" }));
  expect(window.location.search).toBe("?source=share");
  window.history.back();
  await waitFor(() => expect(screen.getByRole("heading", { name: "강남센트럴아이파크" })).toBeInTheDocument());
  window.history.forward();
  await waitFor(() => expect(screen.queryByRole("heading", { name: "강남센트럴아이파크" })).not.toBeInTheDocument());
});

it("단지 선택 URL을 갱신하고 같은 단지를 다시 선택해도 기록을 중복 추가하지 않는다", () => {
  mount(false);
  selectComplex();
  expect(new URLSearchParams(window.location.search).get("complex")).toBe("5d48b3157f");
  const length = window.history.length;
  fireEvent.change(screen.getByRole("combobox", { name: "단지명 또는 지역 검색" }), { target: { value: "강남센트럴" } });
  fireEvent.click(screen.getByRole("option", { name: /강남센트럴아이파크/ }));
  expect(window.history.length).toBe(length);
});

afterEach(() => {
  clients.splice(0).forEach((client) => client.clear());
  global.fetch = originalFetch;
});

it("단지 선택 뒤 상세에서 조회하고, 목록으로 돌아가면 검색어를 비운다", async () => {
  mount();
  expect(within(screen.getByRole("banner")).getByRole("img", { name: "지도와 아파트 일러스트" })).toBeInTheDocument();
  expect(within(screen.getByRole("banner")).queryByRole("button", { name: "3개월" })).not.toBeInTheDocument();
  selectComplex();
  expect(await rentSection().findByRole("status")).toBeInTheDocument();
  await waitFor(() => expect(rentSection().getByRole("status")).toHaveTextContent("2건"));
  expect(rentSection().getByRole("button", { name: "3개월" })).toHaveAttribute("aria-pressed", "true");
  const shLink = screen.getByRole("link", { name: "이 단지 SH 상세정보 보기 ↗" });
  const rent = screen.getByRole("region", { name: "공개된 전월세 계약" });
  expect(shLink.compareDocumentPosition(rent) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "← 단지 목록" }));
  expect(screen.getByRole("combobox", { name: "단지명 또는 지역 검색" })).toHaveValue("");
  expect(screen.queryByRole("region", { name: "공개된 전월세 계약" })).not.toBeInTheDocument();
});

it("면적·유형 조합을 초기화하고 잘못된 기간은 조회하지 않는다", async () => {
  mount();
  selectComplex();
  await waitFor(() => expect(rentSection().getByRole("status")).toHaveTextContent("2건"));
  fireEvent.change(rentSection().getByRole("combobox", { name: "전용면적" }), { target: { value: "29.00" } });
  fireEvent.click(rentSection().getByRole("button", { name: "갱신" }));
  expect(rentSection().getByRole("status")).toHaveTextContent("0건");
  fireEvent.click(rentSection().getByRole("button", { name: "면적·유형 초기화" }));
  expect(rentSection().getByRole("status")).toHaveTextContent("2건");
  fireEvent.click(rentSection().getByRole("button", { name: "1년" }));
  await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
  await waitFor(() => expect(rentSection().getByRole("status")).toHaveTextContent("2건"));
  const request = new URL(fetchMock.mock.calls[1][0], "http://localhost");
  fireEvent.click(rentSection().getByRole("button", { name: "직접 선택" }));
  expect(rentSection().getByLabelText("시작일")).toHaveValue(request.searchParams.get("from"));
  expect(rentSection().getByLabelText("종료일")).toHaveValue(request.searchParams.get("to"));
  fireEvent.change(rentSection().getByLabelText("시작일"), { target: { value: "2099-01-01" } });
  expect(rentSection().getByRole("alert")).toHaveTextContent("시작일이 종료일보다 늦습니다.");
  expect(rentSection().getByRole("combobox", { name: "전용면적" })).toBeDisabled();
  expect(fetchMock).toHaveBeenCalledTimes(2);
  fireEvent.click(rentSection().getByRole("button", { name: "일주일" }));
  await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(3));
  await waitFor(() => expect(rentSection().getByRole("status")).toHaveTextContent("2건"));
});

it("오류 상태에서도 기간을 바꾸거나 재시도할 수 있다", async () => {
  fetchMock.mockResolvedValueOnce({ ok: false, json: async () => ({ code: "UPSTREAM", message: "잠시 후 다시 시도해 주세요." }) });
  mount();
  selectComplex();
  expect(await rentSection().findByRole("alert")).toHaveTextContent("잠시 후 다시 시도해 주세요.");
  expect(rentSection().getByRole("button", { name: "6개월" })).toBeEnabled();
  fireEvent.click(rentSection().getByRole("button", { name: "다시 시도" }));
  await waitFor(() => expect(rentSection().getByRole("status")).toHaveTextContent("2건"));
  expect(fetchMock).toHaveBeenCalledTimes(2);
});

it("패널 크기를 바꿔도 조회 조건을 유지하고, 접은 상태에서 검색하면 다시 연다", async () => {
  mount();
  selectComplex();
  await waitFor(() => expect(rentSection().getByRole("status")).toHaveTextContent("2건"));
  fireEvent.click(rentSection().getByRole("button", { name: "신규" }));
  fireEvent.click(screen.getByRole("button", { name: "펼치기" }));
  expect(screen.getByRole("button", { name: "펼치기" })).toHaveAttribute("aria-pressed", "true");
  fireEvent.click(screen.getByRole("button", { name: "접기" }));
  expect(screen.getByRole("button", { name: "접기" })).toHaveAttribute("aria-pressed", "true");
  fireEvent.click(screen.getByRole("button", { name: "기본" }));
  expect(rentSection().getByRole("button", { name: "신규" })).toHaveAttribute("aria-pressed", "true");
  expect(rentSection().getByRole("status")).toHaveTextContent("1건");
  fireEvent.click(screen.getByRole("button", { name: "접기" }));
  fireEvent.change(screen.getByRole("combobox", { name: "단지명 또는 지역 검색" }), { target: { value: "강남센트럴" } });
  fireEvent.click(screen.getByRole("option", { name: /강남센트럴아이파크/ }));
  expect(screen.getByRole("button", { name: "기본" })).toHaveAttribute("aria-pressed", "true");
  expect(rentSection().getByRole("status")).toHaveTextContent("1건");
});

it("조회 키가 없어도 단지 정보와 SH 링크는 사용할 수 있다", () => {
  mount(false);
  selectComplex();
  expect(screen.getByRole("link", { name: "이 단지 SH 상세정보 보기 ↗" })).toBeInTheDocument();
  expect(rentSection().getByText(/전월세 계약 조회를 준비 중/)).toBeInTheDocument();
  expect(fetchMock).not.toHaveBeenCalled();
});

it("목록에서 관심 단지를 저장하고 지역 필터를 상세 왕복 후에도 유지한다", () => {
  mount(false);
  fireEvent.change(screen.getByRole("combobox", { name: "자치구 필터" }), { target: { value: "강남구" } });
  fireEvent.click(screen.getByRole("button", { name: "강남센트럴아이파크 관심 단지 저장" }));
  expect(JSON.parse(localStorage.getItem("jip-eonje:favorite-complexes")!)).toEqual(["5d48b3157f"]);
  expect(screen.queryByRole("heading", { name: "강남센트럴아이파크" })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "관심 1" }));
  expect(screen.getByRole("heading", { name: "관심 단지 1곳" })).toBeInTheDocument();
  selectComplex();
  fireEvent.click(screen.getByRole("button", { name: "← 단지 목록" }));
  expect(screen.getByRole("combobox", { name: "자치구 필터" })).toHaveValue("");
  expect(screen.getByRole("button", { name: "관심 1" })).toHaveAttribute("aria-pressed", "true");
  fireEvent.click(screen.getByRole("button", { name: "단지 찾기" }));
  expect(screen.getByRole("combobox", { name: "자치구 필터" })).toHaveValue("강남구");
  fireEvent.click(screen.getByRole("button", { name: "관심 1" }));
  fireEvent.click(screen.getByRole("button", { name: "강남센트럴아이파크 관심 단지 해제" }));
  expect(screen.getByText(/아직 관심 단지가 없습니다/)).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "조건 초기화하고 단지 찾기" }));
  expect(screen.getByRole("combobox", { name: "자치구 필터" })).toHaveValue("");
});

it("상세에서 목록으로 돌아오면 스크롤 위치를 복원한다", () => {
  mount(false);
  fireEvent.scroll(screen.getByRole("region", { name: "단지 목록" }), { target: { scrollTop: 320 } });
  selectComplex();
  fireEvent.click(screen.getByRole("button", { name: "← 단지 목록" }));
  expect(screen.getByRole("region", { name: "단지 목록" }).scrollTop).toBe(320);
});

it("저장된 관심 목록에서 중복과 잘못된 ID를 걸러 복원한다", () => {
  localStorage.setItem("jip-eonje:favorite-complexes", JSON.stringify(["5d48b3157f", "missing", null, "5d48b3157f"]));
  mount(false);
  fireEvent.click(screen.getByRole("button", { name: "관심 1" }));
  expect(screen.getByRole("button", { name: "강남센트럴아이파크 관심 단지 해제" })).toHaveAttribute("aria-pressed", "true");
  expect(screen.getByRole("heading", { name: "관심 단지 1곳" })).toBeInTheDocument();
});

it("저장이 거부되어도 현재 화면에서 관심 선택을 유지하고 제한을 알린다", () => {
  mount(false);
  const storage = jest.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("denied"); });
  try {
    fireEvent.click(screen.getByRole("button", { name: "강남센트럴아이파크 관심 단지 저장" }));
    expect(screen.getByText(/이번 화면에서만 유지됩니다/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "관심 1" }));
    expect(screen.getByRole("heading", { name: "관심 단지 1곳" })).toBeInTheDocument();
  } finally { storage.mockRestore(); }
});

it("최근 본 단지를 검색창에서 키보드로 다시 열고 최신순으로 중복 없이 저장한다", () => {
  mount(false);
  selectComplex();
  fireEvent.change(screen.getByRole("combobox", { name: "단지명 또는 지역 검색" }), { target: { value: "녹번" } });
  fireEvent.click(screen.getByRole("option", { name: /힐스테이트\(녹번제1-1구역\)/ }));
  fireEvent.click(screen.getByRole("button", { name: "검색어 지우기" }));
  const recent = within(screen.getByRole("listbox", { name: "최근 본 단지" }));
  const options = recent.getAllByRole("option");
  expect(options).toHaveLength(2);
  expect(options[0]).toHaveTextContent("힐스테이트(녹번제1-1구역)");
  expect(options[1]).toHaveTextContent("강남센트럴아이파크");
  const input = screen.getByRole("combobox", { name: "단지명 또는 지역 검색" });
  fireEvent.keyDown(input, { key: "ArrowDown" });
  fireEvent.keyDown(input, { key: "ArrowDown" });
  fireEvent.keyDown(input, { key: "Enter" });
  expect(screen.getByRole("heading", { name: "강남센트럴아이파크" })).toBeInTheDocument();
  expect(JSON.parse(localStorage.getItem(RECENT_COMPLEXES_KEY)!)).toEqual(["5d48b3157f", "ef052f991b"]);
  fireEvent.click(screen.getByRole("button", { name: "← 단지 목록" }));
  expect(screen.getByRole("combobox", { name: "자치구 필터" })).toHaveValue("강남구");
});

it("저장된 최근 기록을 복원하고 기록 삭제는 관심 단지를 유지한다", () => {
  localStorage.setItem(RECENT_COMPLEXES_KEY, JSON.stringify(["ef052f991b", "missing", "ef052f991b", "5d48b3157f"]));
  localStorage.setItem("jip-eonje:favorite-complexes", JSON.stringify(["5d48b3157f"]));
  mount(false);
  fireEvent.focus(screen.getByRole("combobox", { name: "단지명 또는 지역 검색" }));
  expect(within(screen.getByRole("listbox", { name: "최근 본 단지" })).getAllByRole("option")).toHaveLength(2);
  fireEvent.click(screen.getByRole("button", { name: "기록 지우기" }));
  expect(localStorage.getItem(RECENT_COMPLEXES_KEY)).toBeNull();
  expect(screen.getByText("최근 본 단지 기록을 지웠습니다.")).toBeInTheDocument();
  expect(localStorage.getItem("jip-eonje:favorite-complexes")).toBe(JSON.stringify(["5d48b3157f"]));
});

it("저장 실패 후에도 최근 방문한 여러 단지를 현재 화면에서 유지한다", () => {
  mount(false);
  const storage = jest.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("denied"); });
  try {
    selectComplex();
    fireEvent.change(screen.getByRole("combobox", { name: "단지명 또는 지역 검색" }), { target: { value: "녹번" } });
    fireEvent.click(screen.getByRole("option", { name: /힐스테이트\(녹번제1-1구역\)/ }));
    fireEvent.click(screen.getByRole("button", { name: "검색어 지우기" }));
    expect(within(screen.getByRole("listbox", { name: "최근 본 단지" })).getAllByRole("option")).toHaveLength(2);
    expect(screen.getByText(/최근 기록은 이번 화면에서만 유지됩니다/)).toBeInTheDocument();
  } finally { storage.mockRestore(); }
});
