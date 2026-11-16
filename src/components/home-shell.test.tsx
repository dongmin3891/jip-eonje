import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ByRoleMatcher, ByRoleOptions } from "@testing-library/dom";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";

import { HomeShell } from "@/components/home-shell";
import type { RentAreasResponse, RentResponse } from "@/lib/rent/types";
import { RECENT_COMPLEXES_KEY } from "@/lib/recent-complexes";
import { complexes, searchComplexes } from "@/lib/complexes";

const response: RentResponse = {
  complexId: "5d48b3157f",
  from: "2026-08-13",
  to: "2026-11-13",
  lawdCd: "11680",
  months: ["202611"],
  contracts: [
    { id: "new", contractDate: "2026-11-01", areaM2: 29, depositManwon: 5000, monthlyRentManwon: 30, floor: 3, contractType: "신규", aptNm: "강남센트럴아이파크", aptSeq: null },
    { id: "renewal", contractDate: "2026-11-02", areaM2: 59, depositManwon: 10000, monthlyRentManwon: 50, floor: 5, contractType: "갱신", aptNm: "강남센트럴아이파크", aptSeq: null },
  ],
  matchedAptNames: ["강남센트럴아이파크"],
  fetchedAt: "2026-11-13T00:00:00Z",
  source: { name: "테스트 출처", url: "https://example.com" },
};
const areasResponse: RentAreasResponse = {
  complexId: "5d48b3157f",
  areasM2: [29, 45, 59],
  fetchedAt: "2026-11-13T00:00:00Z",
};

const originalFetch = global.fetch;
const fetchMock = jest.fn();
const clients: QueryClient[] = [];

function isAreasRequest(input: RequestInfo | URL): boolean {
  return String(input).startsWith("/api/rent/areas?");
}

function apiResponse(body: unknown, ok = true) {
  return { ok, json: async () => body };
}

function mount(hasRentKey = true) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  clients.push(client);
  render(<QueryClientProvider client={client}><HomeShell mapKey="" hasRentKey={hasRentKey} /></QueryClientProvider>);
}

function chooseDistrict(name: string) {
  fireEvent.click(screen.getByRole("button", { name: /^지역 선택:/ }));
  fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: name || "서울 모든 지역" }));
}

function selectComplex() {
  fireEvent.click(screen.getByRole("button", { name: /강남센트럴아이파크 강남구/ }));
}

it("서울 전체 검색은 8개를 넘어 모두 표시하고 상세 왕복 뒤 검색 스크롤을 유지한다", () => {
  mount();
  chooseDistrict("용산구");
  fireEvent.change(screen.getByRole("searchbox"), { target: { value: "래미안" } });
  const results = searchComplexes("래미안", complexes.length);
  expect(results.length).toBeGreaterThan(8);
  const list = screen.getByRole("region", { name: "단지 목록" });
  expect(within(list).getAllByRole("listitem")).toHaveLength(results.length);
  expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  expect(fetchMock).not.toHaveBeenCalled();
  fireEvent.scroll(list, { target: { scrollTop: 240 } });
  fireEvent.keyDown(screen.getByRole("searchbox"), { key: "ArrowDown" });
  const first = within(list).getAllByRole("button")[0];
  expect(first).toHaveFocus();
  fireEvent.click(first);
  expect(screen.getByRole("searchbox")).toHaveValue("래미안");
  expect(screen.getByRole("button", { name: "← 검색 결과" })).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: /^← / }));
  expect(screen.getByRole("region", { name: "단지 목록" }).scrollTop).toBe(240);
  expect(screen.getByRole("heading", { name: `‘래미안’ 검색 결과 · ${results.length}곳` })).toBeInTheDocument();
});

it("관심·지역 조건은 검색 동안 숨기고 결과가 없어도 검색 종료 후 복원한다", () => {
  mount();
  fireEvent.click(screen.getByRole("button", { name: "강남센트럴아이파크 관심 단지 저장" }));
  fireEvent.click(screen.getByRole("button", { name: "관심 1" }));
  chooseDistrict("강남구");
  fireEvent.change(screen.getByRole("searchbox"), { target: { value: "녹번" } });
  expect(screen.getByRole("heading", { name: /‘녹번’ 검색 결과/ })).toBeInTheDocument();
  expect(screen.queryByRole("group", { name: "단지 찾기와 관심 목록" })).not.toBeInTheDocument();
  fireEvent.change(screen.getByRole("searchbox"), { target: { value: "zzzz-none" } });
  expect(screen.getByText(/검색 결과가 없습니다/)).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "검색 종료하고 이전 목록 보기" }));
  expect(screen.getByRole("searchbox")).toHaveValue("");
  expect(screen.getByRole("button", { name: "지역 선택: 강남구" })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "관심 1" })).toHaveAttribute("aria-pressed", "true");
  expect(screen.getByRole("heading", { name: "관심 단지 1곳" })).toBeInTheDocument();
  expect(fetchMock).not.toHaveBeenCalled();
});

it("상세에서 검색하면 검색 목록을 열고 상세 왕복과 검색 종료 후 이전 목록을 복원한다", () => {
  mount(false);
  chooseDistrict("용산구");
  fireEvent.scroll(screen.getByRole("region", { name: "단지 목록" }), { target: { scrollTop: 320 } });
  fireEvent.click(screen.getByRole("button", { name: /용산롯데캐슬센터포레 용산구/ }));
  expect(screen.getByRole("button", { name: "← 용산구 목록" })).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "펼치기" }));
  fireEvent.change(screen.getByRole("searchbox", { name: "단지명 또는 지역 검색" }), { target: { value: "녹번" } });
  fireEvent.click(within(screen.getByRole("region", { name: "단지 목록" })).getByRole("button", { name: /^힐스테이트\(녹번제1-1구역\) 은평구/ }));
  expect(screen.getByRole("button", { name: "기본" })).toHaveAttribute("aria-pressed", "true");
  fireEvent.click(screen.getByRole("button", { name: /^← / }));
  expect(screen.getByRole("searchbox")).toHaveValue("녹번");
  expect(screen.getByRole("heading", { name: /‘녹번’ 검색 결과/ })).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: /^지역 선택:/ })).not.toBeInTheDocument();
  expect(screen.getByRole("region", { name: "단지 목록" }).scrollTop).toBe(0);
  fireEvent.click(screen.getByRole("button", { name: "검색어 지우기" }));
  expect(screen.getByRole("button", { name: "지역 선택: 용산구" })).toBeInTheDocument();
  expect(screen.getByRole("region", { name: "단지 목록" }).scrollTop).toBe(320);
});

function rentSection() {
  const region = document.querySelector<HTMLElement>('section[aria-label="공개된 전월세 계약"]')!;
  const queries = within(screen.queryByRole("dialog") ?? region);
  function getByRole<T extends HTMLElement = HTMLElement>(role: ByRoleMatcher, options?: ByRoleOptions): T {
    return role === "status"
      ? within(region).getByRole<T>(role, { ...options, hidden: true })
      : queries.getByRole<T>(role, options);
  }
  return { ...queries, getByRole };
}

it("첫 화면은 기간·면적·건수와 내역 보기만 노출한다", async () => {
  mount(); selectComplex();
  await waitFor(() => expect(rentSection().getByRole("status")).toHaveTextContent("2건"));
  expect(rentSection().getAllByRole("button")).toHaveLength(2);
  expect(screen.getByRole("button", { name: "계약 내역 보기 · 2건" })).toBeEnabled();
  expect(rentSection().queryByRole("checkbox")).not.toBeInTheDocument();
  fireEvent.click(rentSection().getByRole("button", { name: /면적 변경/ }));
  fireEvent.click(await rentSection().findByRole("checkbox", { name: /45\.00㎡/ }));
  expect(rentSection().getByRole("status")).toHaveTextContent("2건");
  expect(localStorage.getItem("jip-eonje:rent-preferences:5d48b3157f")).toBeNull();
  fireEvent.click(rentSection().getByRole("button", { name: "적용" }));
  expect(rentSection().getByRole("status")).toHaveTextContent("0건");
  expect(rentSection().queryByRole("checkbox")).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "계약 내역 보기 · 0건" }));
  expect(screen.getByRole("dialog", { name: "계약 내역" })).toBeInTheDocument();
  expect(rentSection().getByText("조건에 맞는 공개 계약이 없습니다.")).toBeInTheDocument();
});

it("0건 내역에서 면적을 바꾸고 적용·취소하면 같은 팝업의 내역으로 돌아온다", async () => {
  localStorage.setItem("jip-eonje:rent-preferences:5d48b3157f", JSON.stringify({ areas: ["45.00"] }));
  mount(); selectComplex();
  const trigger = await screen.findByRole("button", { name: "계약 내역 보기 · 0건" });
  fireEvent.click(trigger);
  const dialog = screen.getByRole("dialog", { name: "계약 내역" });
  expect(within(dialog).getByRole("group", { name: "적용된 조회 조건" })).toHaveTextContent("45.00㎡");
  fireEvent.click(within(dialog).getByRole("button", { name: "면적 변경" }));
  expect(screen.getByRole("dialog", { name: "관심 면적 선택" })).toBe(dialog);
  expect(screen.getAllByRole("dialog")).toHaveLength(1);
  fireEvent.click(within(dialog).getByRole("button", { name: "모든 면적으로" }));
  fireEvent.click(within(dialog).getByRole("button", { name: "취소" }));
  expect(screen.getByRole("dialog", { name: "계약 내역" })).toBe(dialog);
  expect(within(dialog).getByRole("group", { name: "적용된 조회 조건" })).toHaveTextContent("45.00㎡");
  fireEvent.click(within(dialog).getByRole("button", { name: "면적 변경" }));
  expect(within(dialog).getByRole("checkbox", { name: /45.00㎡/ })).toBeChecked();
  fireEvent.click(within(dialog).getByRole("button", { name: "모든 면적으로" }));
  fireEvent.click(within(dialog).getByRole("button", { name: "적용하고 내역 보기" }));
  expect(within(dialog).getByRole("group", { name: "적용된 조회 조건" })).toHaveTextContent("모든 면적모든 계약 유형2건");
  expect(within(dialog).getAllByRole("listitem")).toHaveLength(2);
  fireEvent.click(within(dialog).getByRole("button", { name: "닫기" }));
  await waitFor(() => expect(trigger).toHaveFocus());
  expect(trigger).toHaveAccessibleName("계약 내역 보기 · 2건");
});

it("0건 내역에서 기간을 바꿔 재조회할 때 로딩과 실패를 0건으로 표시하지 않는다", async () => {
  fetchMock.mockImplementation(async (input: RequestInfo | URL) => isAreasRequest(input) ? apiResponse(areasResponse) : apiResponse({ ...response, contracts: [] }));
  mount(); selectComplex();
  fireEvent.click(await screen.findByRole("button", { name: "계약 내역 보기 · 0건" }));
  const dialog = screen.getByRole("dialog", { name: "계약 내역" });
  fireEvent.click(within(dialog).getByRole("button", { name: "기간 변경" }));
  expect(screen.getByRole("dialog", { name: "조회 기간" })).toBe(dialog);
  fireEvent.click(within(dialog).getByRole("button", { name: "직접 선택" }));
  fireEvent.change(within(dialog).getByLabelText("시작일"), { target: { value: "2099-01-01" } });
  expect(within(dialog).getByRole("button", { name: "적용하고 내역 보기" })).toBeDisabled();
  let resolveContracts!: (value: ReturnType<typeof apiResponse>) => void;
  const pending = new Promise<ReturnType<typeof apiResponse>>((resolve) => { resolveContracts = resolve; });
  fetchMock.mockImplementation(async (input: RequestInfo | URL) => isAreasRequest(input) ? apiResponse(areasResponse) : pending);
  fireEvent.click(within(dialog).getByRole("button", { name: "6개월" }));
  fireEvent.click(within(dialog).getByRole("button", { name: "적용하고 내역 보기" }));
  expect(screen.getAllByRole("dialog")).toHaveLength(1);
  expect(within(dialog).getByRole("status")).toHaveTextContent("계약 불러오는 중…");
  expect(within(dialog).queryByText("조건에 맞는 공개 계약이 없습니다.")).not.toBeInTheDocument();
  await act(async () => { resolveContracts(apiResponse({ code: "UPSTREAM", message: "테스트 조회 실패" }, false)); });
  expect(await within(dialog).findByRole("alert")).toHaveTextContent("테스트 조회 실패");
  fetchMock.mockImplementation(async () => apiResponse(response));
  fireEvent.click(within(dialog).getByRole("button", { name: "다시 시도" }));
  await waitFor(() => expect(within(dialog).getAllByRole("listitem")).toHaveLength(2));
});

it("플로팅 버튼은 스크롤 영역 밖에 하나만 있고 팝업을 닫으면 초점을 복원한다", async () => {
  let resolveContracts!: (value: ReturnType<typeof apiResponse>) => void;
  const pendingContracts = new Promise<ReturnType<typeof apiResponse>>((resolve) => { resolveContracts = resolve; });
  fetchMock.mockImplementation(async (input: RequestInfo | URL) => isAreasRequest(input) ? apiResponse(areasResponse) : pendingContracts);
  mount(); selectComplex();
  expect(screen.getByRole("button", { name: "계약 불러오는 중…" })).toBeDisabled();
  await act(async () => { resolveContracts(apiResponse(response)); });
  const trigger = await screen.findByRole("button", { name: "계약 내역 보기 · 2건" });
  expect(screen.getAllByRole("button", { name: /계약 내역 보기/ })).toHaveLength(1);
  expect(trigger.closest("[data-detail-scroll]")).toBeNull();
  expect(screen.getByRole("region", { name: "계약 내역 바로가기" })).toContainElement(trigger);
  const scroll = document.querySelector<HTMLElement>("[data-detail-scroll]")!;
  scroll.scrollTop = 300;
  fireEvent.click(trigger);
  expect(screen.getByRole("dialog", { name: "계약 내역" })).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: /계약 내역 보기/ })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "닫기" }));
  await waitFor(() => expect(trigger).toHaveFocus());
  expect(scroll.scrollTop).toBe(300);
  fireEvent.click(screen.getByRole("button", { name: /^← / }));
  expect(screen.queryByRole("region", { name: "계약 내역 바로가기" })).not.toBeInTheDocument();
});

it("단지별 기간과 적용한 관심 면적을 복원하며 취소한 변경은 저장하지 않는다", async () => {
  localStorage.setItem("jip-eonje:rent-preferences:5d48b3157f", JSON.stringify({
    period: { kind: "custom", from: "2026-11-01", to: "2026-11-10" }, area: "29.00",
  }));
  mount(); selectComplex();
  await waitFor(() => expect(rentSection().getByRole("status")).toHaveTextContent("1건"));
  fireEvent.click(rentSection().getByRole("button", { name: /기간 변경/ }));
  expect(rentSection().getByLabelText("시작일")).toHaveValue("2026-11-01");
  fireEvent.change(rentSection().getByLabelText("종료일"), { target: { value: "2026-11-12" } });
  fireEvent.click(rentSection().getByRole("button", { name: "적용" }));
  fireEvent.click(rentSection().getByRole("button", { name: /면적 변경/ }));
  expect(rentSection().queryByLabelText("시작일")).not.toBeInTheDocument();
  fireEvent.click(rentSection().getByRole("checkbox", { name: /59\.00㎡/ }));
  fireEvent.click(rentSection().getByRole("button", { name: "취소" }));
  fireEvent.click(rentSection().getByRole("button", { name: /면적 변경/ }));
  expect(rentSection().getByRole("checkbox", { name: /59\.00㎡/ })).not.toBeChecked();
  fireEvent.click(rentSection().getByRole("checkbox", { name: /59\.00㎡/ }));
  fireEvent.click(rentSection().getByRole("button", { name: "적용" }));
  expect(JSON.parse(localStorage.getItem("jip-eonje:rent-preferences:5d48b3157f")!)).toEqual({
    period: { kind: "custom", from: "2026-11-01", to: "2026-11-12" }, areas: ["29.00", "59.00"], contractType: "all",
  });
  fireEvent.click(screen.getByRole("button", { name: /^← / }));
  selectComplex();
  await waitFor(() => expect(rentSection().getByRole("status")).toHaveTextContent("2건"));
  expect(rentSection().getByRole("button", { name: /면적 변경/ })).toHaveTextContent("29.00㎡ 외 1개");
  expect(rentSection().getByRole("button", { name: /기간 변경/ })).toHaveTextContent("2026.11.12");
});

it("면적과 계약 유형은 적용해야 반영되고 모든 면적으로 복귀할 수 있다", async () => {
  mount(); selectComplex();
  await waitFor(() => expect(rentSection().getByRole("status")).toHaveTextContent("2건"));
  fireEvent.click(rentSection().getByRole("button", { name: /면적 변경/ }));
  fireEvent.click(rentSection().getByRole("checkbox", { name: /29\.00㎡/ }));
  fireEvent.click(rentSection().getByRole("checkbox", { name: /59\.00㎡/ }));
  fireEvent.click(rentSection().getByText("계약 유형 · 전체"));
  fireEvent.click(rentSection().getByRole("button", { name: "신규" }));
  expect(rentSection().getByRole("status")).toHaveTextContent("2건");
  fireEvent.click(rentSection().getByRole("button", { name: "적용" }));
  expect(rentSection().getByRole("status")).toHaveTextContent("1건");
  expect(rentSection().getByRole("heading", { name: "공개 계약 · 신규" })).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "계약 내역 보기 · 1건" }));
  const applied = screen.getByRole("group", { name: "적용된 조회 조건" });
  expect(applied).toHaveTextContent("29.00㎡");
  expect(applied).toHaveTextContent("59.00㎡");
  expect(applied).toHaveTextContent("신규1건");
  expect(rentSection().getByRole("list", { name: "개별 계약 내역" })).toHaveTextContent("5,000만원");
  fireEvent.click(rentSection().getByRole("button", { name: "닫기" }));
  fireEvent.click(rentSection().getByRole("button", { name: /면적 변경/ }));
  fireEvent.click(rentSection().getByRole("button", { name: "모든 면적으로" }));
  fireEvent.click(rentSection().getByText("계약 유형 · 신규"));
  fireEvent.click(rentSection().getByRole("button", { name: "전체" }));
  fireEvent.click(rentSection().getByRole("button", { name: "적용" }));
  expect(rentSection().getByRole("status")).toHaveTextContent("2건");
  expect(JSON.parse(localStorage.getItem("jip-eonje:rent-preferences:5d48b3157f")!).areas).toEqual([]);
});

beforeEach(() => {
  window.history.replaceState(null, "", "/");
  localStorage.clear();
  fetchMock.mockReset();
  fetchMock.mockImplementation(async (input: RequestInfo | URL) =>
    isAreasRequest(input) ? apiResponse(areasResponse) : apiResponse(response),
  );
  global.fetch = fetchMock;
});

it("팝업을 닫으면 기본 패널과 스크롤을 유지하고 초점을 돌리며 미적용 선택을 버린다", async () => {
  mount(); selectComplex();
  await waitFor(() => expect(rentSection().getByRole("status")).toHaveTextContent("2건"));
  const trigger = rentSection().getByRole("button", { name: /면적 변경/ });
  const panel = document.querySelector<HTMLElement>("[data-detail-scroll]")!;
  panel.scrollTop = 20;
  fireEvent.click(trigger);
  const dialog = screen.getByRole("dialog", { name: "관심 면적 선택" });
  expect(dialog.closest("section")).toBeNull();
  expect(screen.queryByRole("button", { name: "기본" })).not.toBeInTheDocument();
  fireEvent.click(within(dialog).getByRole("checkbox", { name: /29.00㎡/ }));
  fireEvent.keyDown(dialog, { key: "Escape", code: "Escape" });
  await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  await waitFor(() => expect(trigger).toHaveFocus());
  expect(screen.getByRole("button", { name: "기본" })).toHaveAttribute("aria-pressed", "true");
  expect(panel.scrollTop).toBe(20);
  fireEvent.click(trigger);
  expect(rentSection().getByRole("checkbox", { name: /29.00㎡/ })).not.toBeChecked();
  fireEvent.click(rentSection().getByRole("button", { name: "팝업 닫기" }));
});

it("공유 URL이 최근 단지보다 우선하고 뒤로가기·앞으로가기로 선택을 복원한다", async () => {
  localStorage.setItem("jip-eonje:last-complex", "45e8591f50");
  window.history.replaceState(null, "", "/?complex=5d48b3157f&source=share");
  mount(false);
  expect(screen.getByRole("heading", { name: "강남센트럴아이파크" })).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: /^← / }));
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
  fireEvent.focus(screen.getByRole("searchbox"));
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
  fireEvent.click(rentSection().getByRole("button", { name: /기간 변경/ }));
  expect(rentSection().getByRole("button", { name: "3개월" })).toHaveAttribute("aria-pressed", "true");
  fireEvent.click(rentSection().getByRole("button", { name: "취소" }));
  const shLink = screen.getByRole("link", { name: "이 단지 SH 상세정보 보기 ↗" });
  const rent = screen.getByRole("region", { name: "공개된 전월세 계약" });
  expect(rent.compareDocumentPosition(shLink) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: /^← / }));
  expect(screen.getByRole("searchbox", { name: "단지명 또는 지역 검색" })).toHaveValue("");
  expect(screen.queryByRole("region", { name: "공개된 전월세 계약" })).not.toBeInTheDocument();
});

it("기간은 적용할 때만 조회하고 취소·잘못된 기간은 현재 조건을 바꾸지 않는다", async () => {
  mount(); selectComplex();
  await waitFor(() => expect(rentSection().getByRole("status")).toHaveTextContent("2건"));
  fireEvent.click(rentSection().getByRole("button", { name: /기간 변경/ }));
  expect(rentSection().queryByRole("checkbox")).not.toBeInTheDocument();
  fireEvent.click(rentSection().getByRole("button", { name: "1년" }));
  expect(fetchMock).toHaveBeenCalledTimes(2);
  expect(localStorage.getItem("jip-eonje:rent-preferences:5d48b3157f")).toBeNull();
  fireEvent.click(rentSection().getByRole("button", { name: "취소" }));
  fireEvent.click(rentSection().getByRole("button", { name: /기간 변경/ }));
  expect(rentSection().getByRole("button", { name: "3개월" })).toHaveAttribute("aria-pressed", "true");
  fireEvent.click(rentSection().getByRole("button", { name: "1년" }));
  fireEvent.click(rentSection().getByRole("button", { name: "적용" }));
  await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(3));
  await waitFor(() => expect(rentSection().getByRole("status")).toHaveTextContent("2건"));
  fireEvent.click(rentSection().getByRole("button", { name: /기간 변경/ }));
  fireEvent.click(rentSection().getByRole("button", { name: "직접 선택" }));
  fireEvent.change(rentSection().getByLabelText("시작일"), { target: { value: "2099-01-01" } });
  expect(rentSection().getByRole("alert")).toHaveTextContent("시작일이 종료일보다 늦습니다.");
  expect(rentSection().getByRole("button", { name: "적용" })).toBeDisabled();
  expect(fetchMock).toHaveBeenCalledTimes(3);
  fireEvent.click(rentSection().getByRole("button", { name: "일주일" }));
  expect(fetchMock).toHaveBeenCalledTimes(3);
  fireEvent.click(rentSection().getByRole("button", { name: "적용" }));
  await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(4));
  expect(fetchMock.mock.calls.filter(([input]) => isAreasRequest(input))).toHaveLength(1);
});

it("오류 상태에서도 기간을 바꾸거나 재시도할 수 있다", async () => {
  let contractAttempts = 0;
  fetchMock.mockImplementation(async (input: RequestInfo | URL) => {
    if (isAreasRequest(input)) return apiResponse(areasResponse);
    contractAttempts += 1;
    return contractAttempts === 1
      ? apiResponse({ code: "UPSTREAM", message: "잠시 후 다시 시도해 주세요." }, false)
      : apiResponse(response);
  });
  mount();
  selectComplex();
  expect(await rentSection().findByRole("alert")).toHaveTextContent("잠시 후 다시 시도해 주세요.");
  expect(screen.getByRole("button", { name: "계약 조회 실패" })).toBeDisabled();
  fireEvent.click(rentSection().getByRole("button", { name: /기간 변경/ }));
  expect(rentSection().getByRole("button", { name: "6개월" })).toBeEnabled();
  fireEvent.click(rentSection().getByRole("button", { name: "취소" }));
  fireEvent.click(rentSection().getByRole("button", { name: "다시 시도" }));
  await waitFor(() => expect(rentSection().getByRole("status")).toHaveTextContent("2건"));
  expect(fetchMock).toHaveBeenCalledTimes(3);
});

it("면적 조회가 느려도 계약을 먼저 보여주고 면적 선택만 잠시 비활성화한다", async () => {
  let resolveAreas!: (value: ReturnType<typeof apiResponse>) => void;
  const pendingAreas = new Promise<ReturnType<typeof apiResponse>>((resolve) => { resolveAreas = resolve; });
  fetchMock.mockImplementation(async (input: RequestInfo | URL) =>
    isAreasRequest(input) ? pendingAreas : apiResponse(response),
  );
  mount();
  selectComplex();
  await waitFor(() => expect(rentSection().getByRole("status")).toHaveTextContent("2건"));
  fireEvent.click(rentSection().getByRole("button", { name: /면적 변경/ }));
  const areaSelect = rentSection().getByRole("checkbox", { name: /29\.00㎡/ });
  expect(areaSelect).toBeDisabled();
  expect(rentSection().getByText("면적 정보 불러오는 중…")).toBeInTheDocument();
  expect(screen.getByRole("dialog", { name: "관심 면적 선택" })).toBeInTheDocument();
  await act(async () => { resolveAreas(apiResponse(areasResponse)); });
  await waitFor(() => expect(areaSelect).toBeEnabled());
});

it("면적 조회가 실패해도 계약과 현재 기간의 면적 필터를 사용한다", async () => {
  fetchMock.mockImplementation(async (input: RequestInfo | URL) =>
    isAreasRequest(input)
      ? apiResponse({ code: "UPSTREAM", message: "면적 실패" }, false)
      : apiResponse(response),
  );
  mount();
  selectComplex();
  await waitFor(() => expect(rentSection().getByRole("status")).toHaveTextContent("2건"));
  expect(rentSection().queryByRole("alert")).not.toBeInTheDocument();
  fireEvent.click(rentSection().getByRole("button", { name: /면적 변경/ }));
  expect(rentSection().getByText(/현재 기간의 면적과 저장한 관심 면적/)).toBeInTheDocument();
  expect(rentSection().getByRole("checkbox", { name: /29\.00㎡.*1건/ })).toBeEnabled();
});

it("패널 크기를 바꿔도 조회 조건을 유지하고, 접은 상태에서 검색하면 다시 연다", async () => {
  mount();
  selectComplex();
  await waitFor(() => expect(rentSection().getByRole("status")).toHaveTextContent("2건"));
  fireEvent.click(rentSection().getByRole("button", { name: /면적 변경/ }));
  fireEvent.click(rentSection().getByRole("checkbox", { name: /29\.00㎡/ }));
  fireEvent.click(rentSection().getByRole("button", { name: "적용" }));
  fireEvent.click(screen.getByRole("button", { name: "펼치기" }));
  expect(screen.getByRole("button", { name: "펼치기" })).toHaveAttribute("aria-pressed", "true");
  fireEvent.click(screen.getByRole("button", { name: "접기" }));
  expect(screen.getByRole("button", { name: "접기" })).toHaveAttribute("aria-pressed", "true");
  fireEvent.click(screen.getByRole("button", { name: "기본" }));
  expect(rentSection().getByRole("button", { name: /면적 변경/ })).toHaveTextContent("29.00㎡");
  expect(rentSection().getByRole("status")).toHaveTextContent("1건");
  fireEvent.click(screen.getByRole("button", { name: "접기" }));
  fireEvent.change(screen.getByRole("searchbox", { name: "단지명 또는 지역 검색" }), { target: { value: "강남센트럴" } });
  fireEvent.click(within(screen.getByRole("region", { name: "단지 목록" })).getByRole("button", { name: /^강남센트럴아이파크 강남구/ }));
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
  chooseDistrict("강남구");
  fireEvent.click(screen.getByRole("button", { name: "강남센트럴아이파크 관심 단지 저장" }));
  expect(JSON.parse(localStorage.getItem("jip-eonje:favorite-complexes")!)).toEqual(["5d48b3157f"]);
  expect(screen.queryByRole("heading", { name: "강남센트럴아이파크" })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "관심 1" }));
  expect(screen.getByRole("heading", { name: "관심 단지 1곳" })).toBeInTheDocument();
  selectComplex();
  expect(screen.getByRole("button", { name: "← 관심 단지" })).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: /^← / }));
  expect(screen.getByRole("button", { name: "지역 선택: 지역으로 찾기 (서울 모든 지역)" })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "관심 1" })).toHaveAttribute("aria-pressed", "true");
  fireEvent.click(screen.getByRole("button", { name: "단지 찾기" }));
  expect(screen.getByRole("button", { name: "지역 선택: 강남구" })).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "관심 1" }));
  fireEvent.click(screen.getByRole("button", { name: "강남센트럴아이파크 관심 단지 해제" }));
  expect(screen.getByText(/아직 관심 단지가 없습니다/)).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "조건 초기화하고 단지 찾기" }));
  expect(screen.getByRole("button", { name: "지역 선택: 지역으로 찾기 (서울 모든 지역)" })).toBeInTheDocument();
});

it("상세에서 목록으로 돌아오면 스크롤 위치를 복원한다", () => {
  mount(false);
  fireEvent.scroll(screen.getByRole("region", { name: "단지 목록" }), { target: { scrollTop: 320 } });
  selectComplex();
  fireEvent.click(screen.getByRole("button", { name: /^← / }));
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
  fireEvent.change(screen.getByRole("searchbox", { name: "단지명 또는 지역 검색" }), { target: { value: "녹번" } });
  fireEvent.click(within(screen.getByRole("region", { name: "단지 목록" })).getByRole("button", { name: /^힐스테이트\(녹번제1-1구역\) 은평구/ }));
  fireEvent.click(screen.getByRole("button", { name: "검색어 지우기" }));
  fireEvent.focus(screen.getByRole("searchbox"));
  const recent = within(screen.getByRole("listbox", { name: "최근 본 단지" }));
  const options = recent.getAllByRole("option");
  expect(options).toHaveLength(2);
  expect(options[0]).toHaveTextContent("힐스테이트(녹번제1-1구역)");
  expect(options[1]).toHaveTextContent("강남센트럴아이파크");
  const input = screen.getByRole("searchbox", { name: "단지명 또는 지역 검색" });
  fireEvent.keyDown(input, { key: "ArrowDown" });
  fireEvent.keyDown(input, { key: "ArrowDown" });
  fireEvent.keyDown(input, { key: "Enter" });
  expect(screen.getByRole("heading", { name: "강남센트럴아이파크" })).toBeInTheDocument();
  expect(JSON.parse(localStorage.getItem(RECENT_COMPLEXES_KEY)!)).toEqual(["5d48b3157f", "ef052f991b"]);
  fireEvent.click(screen.getByRole("button", { name: /^← / }));
  expect(screen.getByRole("button", { name: "지역 선택: 지역으로 찾기 (서울 모든 지역)" })).toBeInTheDocument();
});

it("저장된 최근 기록을 복원하고 기록 삭제는 관심 단지를 유지한다", () => {
  localStorage.setItem(RECENT_COMPLEXES_KEY, JSON.stringify(["ef052f991b", "missing", "ef052f991b", "5d48b3157f"]));
  localStorage.setItem("jip-eonje:favorite-complexes", JSON.stringify(["5d48b3157f"]));
  mount(false);
  fireEvent.focus(screen.getByRole("searchbox", { name: "단지명 또는 지역 검색" }));
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
    fireEvent.change(screen.getByRole("searchbox", { name: "단지명 또는 지역 검색" }), { target: { value: "녹번" } });
    fireEvent.click(within(screen.getByRole("region", { name: "단지 목록" })).getByRole("button", { name: /^힐스테이트\(녹번제1-1구역\) 은평구/ }));
    fireEvent.click(screen.getByRole("button", { name: "검색어 지우기" }));
    fireEvent.focus(screen.getByRole("searchbox"));
    expect(within(screen.getByRole("listbox", { name: "최근 본 단지" })).getAllByRole("option")).toHaveLength(2);
    expect(screen.getByText(/최근 기록은 이번 화면에서만 유지됩니다/)).toBeInTheDocument();
  } finally { storage.mockRestore(); }
});
