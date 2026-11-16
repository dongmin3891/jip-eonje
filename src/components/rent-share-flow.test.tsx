import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { HomeShell } from "./home-shell";
import { readRentShare, rentShareUrl } from "@/lib/rent/share";
import { readRentFilters } from "@/lib/rent/preferences";

const id = "5d48b3157f";
const storageKey = `jip-eonje:rent-preferences:${id}`;
const saved = { period: { kind: "preset", key: "week" }, areas: ["45.00"], contractType: "갱신" };
const originalFetch = global.fetch;
const originalClipboard = Object.getOwnPropertyDescriptor(navigator, "clipboard");
const fetchMock = jest.fn();
const copy = jest.fn();
const clients: QueryClient[] = [];

function mount() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  clients.push(client);
  return render(<QueryClientProvider client={client}><HomeShell mapKey="" hasRentKey /></QueryClientProvider>);
}

beforeEach(() => {
  history.replaceState(null, "", "/");
  localStorage.clear();
  copy.mockReset().mockResolvedValue(undefined);
  Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText: copy } });
  fetchMock.mockReset().mockImplementation(async (input: RequestInfo | URL) => ({ ok: true, json: async () => String(input).startsWith("/api/rent/areas?")
    ? { complexId: id, areasM2: [29, 45, 59], fetchedAt: "2026-11-16T00:00:00Z" }
    : { complexId: id, contracts: [
      { id: "new", areaM2: 29, contractType: "신규", contractDate: "2026-11-01", depositManwon: 5000, monthlyRentManwon: 30, floor: 3 },
      { id: "renew", areaM2: 59, contractType: "갱신", contractDate: "2026-11-02", depositManwon: 6000, monthlyRentManwon: 40, floor: 4 },
    ], matchedAptNames: [], fetchedAt: "2026-11-16T00:00:00Z", source: { name: "테스트", url: "https://example.com" } },
  }));
  global.fetch = fetchMock;
});

afterEach(() => {
  clients.splice(0).forEach((client) => client.clear());
  global.fetch = originalFetch;
  if (originalClipboard) Object.defineProperty(navigator, "clipboard", originalClipboard);
  else Reflect.deleteProperty(navigator, "clipboard");
});

it("공유 링크는 저장값보다 우선하고 열거나 복사하는 것만으로 저장값을 덮어쓰지 않는다", async () => {
  localStorage.setItem(storageKey, JSON.stringify(saved));
  const url = rentShareUrl(window.location.origin + "/?source=cafe", id, "2026-11-01", "2026-11-10", { areas: ["29.00", "59.00"], contractType: "신규" });
  history.replaceState(null, "", url);
  mount();
  await screen.findByRole("button", { name: "계약 내역 보기 · 1건" });
  expect(screen.getByRole("button", { name: /기간 변경/ })).toHaveTextContent("2026.11.01 – 2026.11.10");
  expect(fetchMock.mock.calls.some(([input]) => String(input).includes("from=2026-11-01&to=2026-11-10"))).toBe(true);
  fireEvent.click(screen.getByRole("button", { name: "조회 조건 링크 복사" }));
  await waitFor(() => expect(copy).toHaveBeenCalledTimes(1));
  expect(readRentShare(new URL(copy.mock.calls[0][0]).searchParams)).toEqual(readRentShare(new URL(url).searchParams));
  expect(JSON.parse(localStorage.getItem(storageKey)!)).toEqual(saved);

  // 같은 단지의 다른 공유 조건으로 기록 이동해도 필터가 갱신된다.
  const next = rentShareUrl(url, id, "2026-11-02", "2026-11-12", { areas: ["59.00"], contractType: "갱신" });
  act(() => { history.pushState(null, "", next); window.dispatchEvent(new PopStateEvent("popstate")); });
  expect(screen.getByRole("button", { name: /면적 변경/ })).toHaveTextContent("59.00㎡");
  expect(screen.getByRole("heading", { name: "공개 계약 · 갱신" })).toBeInTheDocument();
  expect(JSON.parse(localStorage.getItem(storageKey)!)).toEqual(saved);
  fireEvent.click(screen.getByRole("button", { name: /^← / }));
  expect(window.location.search).toBe("?source=cafe");
});

it("전체 조건을 복사하면 받는 사람의 저장된 면적·유형에 제한되지 않는다", async () => {
  history.replaceState(null, "", `/?complex=${id}`);
  const first = mount();
  await screen.findByRole("button", { name: "계약 내역 보기 · 2건" });
  fireEvent.click(screen.getByRole("button", { name: "조회 조건 링크 복사" }));
  await waitFor(() => expect(copy).toHaveBeenCalledTimes(1));
  const url = copy.mock.calls[0][0];
  expect(readRentShare(new URL(url).searchParams)).toMatchObject({ areas: [], contractType: "all", period: { kind: "custom" } });
  first.unmount();
  localStorage.setItem(storageKey, JSON.stringify(saved));
  history.replaceState(null, "", url);
  mount();
  const trigger = await screen.findByRole("button", { name: "계약 내역 보기 · 2건" });
  fireEvent.click(trigger);
  expect(within(screen.getByRole("dialog")).getByRole("group", { name: "적용된 조회 조건" })).toHaveTextContent("모든 면적모든 계약 유형2건");
  expect(readRentFilters(id)).toEqual(saved);
});

it("잘못된 공유 날짜는 조회하지 않고 저장된 조건으로 복원한다", async () => {
  localStorage.setItem(storageKey, JSON.stringify(saved));
  history.replaceState(null, "", `/?complex=${id}&rent=1&from=2026-02-30&to=2026-11-10&areas=29.00&type=all`);
  mount();
  await screen.findByRole("button", { name: "계약 내역 보기 · 0건" });
  expect(screen.getByRole("button", { name: /면적 변경/ })).toHaveTextContent("45.00㎡");
  expect(fetchMock.mock.calls.every(([input]) => !String(input).includes("2026-02-30"))).toBe(true);
});
