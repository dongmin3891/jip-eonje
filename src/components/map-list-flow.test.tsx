import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { HomeShell } from "@/components/home-shell";
import { complexes, hasCoordinates, searchComplexes } from "@/lib/complexes";

const mapRender = jest.fn();
jest.mock("./housing-map", () => ({
  HousingMap: (props: { onBounds?: (bounds: unknown) => void }) => {
    mapRender(props);
    return <button onClick={() => props.onBounds?.({ sw: { lat: 0, lng: 0 }, ne: { lat: 1, lng: 1 } })}>지도 이동 테스트</button>;
  },
}));

it("지도 전환과 이동은 목록을 바꾸지 않고 지역·관심 조건은 지도와 목록에 함께 적용된다", () => {
  localStorage.clear();
  history.replaceState(null, "", "/");
  const client = new QueryClient();
  const view = render(<QueryClientProvider client={client}><HomeShell mapKey="test" hasRentKey={false} /></QueryClientProvider>);
  const latest = () => mapRender.mock.calls.at(-1)![0];
  const rows = () => within(screen.getByRole("region", { name: "단지 목록" })).getAllByRole("listitem");
  expect(rows()).toHaveLength(complexes.length);
  expect(screen.getByRole("heading", { name: `단지 ${complexes.length}곳` })).toBeInTheDocument();
  expect(screen.queryByRole("group", { name: "패널 크기" })).not.toBeInTheDocument();
  fireEvent.scroll(screen.getByRole("region", { name: "단지 목록" }), { target: { scrollTop: 320 } });
  fireEvent.click(screen.getByRole("button", { name: "지도 보기" }));
  fireEvent.click(screen.getByRole("button", { name: "지도 이동 테스트" }));
  fireEvent.click(screen.getByRole("button", { name: "목록 보기" }));
  expect(rows()).toHaveLength(complexes.length);
  expect(screen.getByRole("region", { name: "단지 목록" }).scrollTop).toBe(320);

  // 좌표 없는 단지도 별도 펼치기 없이 열 수 있다.
  const missing = complexes.find((item) => !hasCoordinates(item))!;
  const row = rows().find((item) => within(item).queryByText(missing.name))!;
  expect(within(row).getByText("지도 표시 없음")).toBeInTheDocument();
  fireEvent.click(within(row).getAllByRole("button")[0]);
  expect(screen.getByRole("heading", { name: missing.name })).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: /^← / }));
  expect(screen.getByText("방금 본 단지").closest("li")).toHaveTextContent(missing.name);
  expect(rows()).toHaveLength(complexes.length);

  const priorReset = latest().resetView;
  fireEvent.click(screen.getByRole("button", { name: /^지역 선택:/ }));
  fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "강남구" }));
  expect(latest().resetView).toBe(priorReset + 1);
  const gangnam = complexes.filter((item) => item.district === "강남구");
  expect(latest().complexes).toEqual(gangnam);
  expect(rows()).toHaveLength(gangnam.length);
  expect(screen.getByRole("region", { name: "단지 목록" }).scrollTop).toBe(0);
  fireEvent.click(screen.getByRole("button", { name: "강남센트럴아이파크 관심 단지 저장" }));
  fireEvent.click(screen.getByRole("button", { name: "관심 1" }));
  expect(latest().complexes.map((item: { id: string }) => item.id)).toEqual(["5d48b3157f"]);
  expect(rows()).toHaveLength(1);
  fireEvent.click(screen.getByRole("button", { name: "단지 찾기" }));
  expect(latest().complexes).toEqual(gangnam);
  expect(rows()).toHaveLength(gangnam.length);
  fireEvent.change(screen.getByRole("searchbox"), { target: { value: "녹번" } });
  const results = searchComplexes("녹번", complexes.length);
  expect(latest().complexes).toEqual(results);
  expect(rows()).toHaveLength(results.length);
  fireEvent.click(screen.getByRole("button", { name: "검색어 지우기" }));
  expect(latest().complexes).toEqual(gangnam);
  expect(rows()).toHaveLength(gangnam.length);
  view.unmount();
  client.clear();
});
