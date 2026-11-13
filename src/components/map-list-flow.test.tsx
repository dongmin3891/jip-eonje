import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen } from "@testing-library/react";
import { HomeShell } from "@/components/home-shell";
import { complexes, hasCoordinates } from "@/lib/complexes";

const mapRender = jest.fn();
jest.mock("./housing-map", () => {
  const actual = jest.requireActual("./housing-map");
  return {
    ...actual,
    HousingMap: (props: { onBounds: (bounds: unknown) => void }) => {
      mapRender(props);
      return <button onClick={() => props.onBounds({ sw: { lat: 0, lng: 0 }, ne: { lat: 1, lng: 1 } })}>지도 이동 테스트</button>;
    },
  };
});

it("지도 이동은 목록에 반영되고 전체 위치·자치구·관심 선택은 지도에도 전달된다", () => {
  localStorage.clear();
  history.replaceState(null, "", "/");
  const client = new QueryClient();
  const view = render(<QueryClientProvider client={client}><HomeShell mapKey="test" hasRentKey={false} /></QueryClientProvider>);
  const latest = () => mapRender.mock.calls.at(-1)![0];
  expect(screen.queryByRole("button", { name: "지도 영역" })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "지도 이동 테스트" }));
  const missing = complexes.filter((item) => !hasCoordinates(item));
  expect(screen.getByRole("heading", { name: "지도 안의 단지 0곳" })).toBeInTheDocument();
  expect(screen.getByText(`지도 위치 미확보 ${missing.length}곳`)).toBeInTheDocument();
  const missingList = screen.getByText(`지도 위치 미확보 ${missing.length}곳`).closest("details")!;
  expect(missingList).not.toHaveAttribute("open");
  missingList.open = true;
  fireEvent(missingList, new Event("toggle"));
  fireEvent.click(screen.getByRole("button", { name: new RegExp(`^${missing[0].name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")} SH`) }));
  // 상세를 보는 동안 발생한 지도 이동은 돌아갈 목록 범위를 바꾸지 않는다.
  fireEvent.click(screen.getByRole("button", { name: "지도 이동 테스트" }));
  fireEvent.click(screen.getByRole("button", { name: "← 단지 목록" }));
  expect(screen.getByRole("heading", { name: "지도 안의 단지 0곳" })).toBeInTheDocument();
  expect(screen.getByText(`지도 위치 미확보 ${missing.length}곳`).closest("details")).toHaveAttribute("open");
  const priorReset = latest().resetView;
  fireEvent.click(screen.getByRole("button", { name: "서울 단지 위치 보기" }));
  expect(latest().resetView).toBe(priorReset + 1);
  expect(screen.getByRole("heading", { name: `위치 확인된 단지 ${complexes.filter(hasCoordinates).length}곳` })).toBeInTheDocument();
  fireEvent.change(screen.getByRole("combobox", { name: "자치구 필터" }), { target: { value: "강남구" } });
  expect(latest().complexes).toEqual(complexes.filter((item) => item.district === "강남구"));
  fireEvent.click(screen.getByRole("button", { name: "강남센트럴아이파크 관심 단지 저장" }));
  fireEvent.click(screen.getByRole("button", { name: "관심 1" }));
  expect(latest().complexes.map((item: { id: string }) => item.id)).toEqual(["5d48b3157f"]);
  fireEvent.click(screen.getByRole("button", { name: "지도 이동 테스트" }));
  expect(screen.getByRole("heading", { name: "관심 단지 1곳" })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: /강남센트럴아이파크 SH 상세 연결/ })).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "단지 찾기" }));
  expect(latest().complexes).toEqual(complexes.filter((item) => item.district === "강남구"));
  view.unmount();
  client.clear();
});
