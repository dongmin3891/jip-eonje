import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { HousingMap } from "./housing-map";
import { complexes, hasCoordinates } from "@/lib/complexes";

function createSdk() {
  class LatLng {
    constructor(private lat: number, private lng: number) {}
    getLat() { return this.lat; }
    getLng() { return this.lng; }
  }
  class Bounds {
    extend() {}
    getSouthWest() { return new LatLng(37, 126); }
    getNorthEast() { return new LatLng(38, 128); }
  }
  let center = new LatLng(37.55, 127.01);
  let level = 7;
  const map = {
    getCenter: () => center,
    getLevel: () => level,
    setCenter: jest.fn((value: KakaoLatLng) => { center = new LatLng(value.getLat(), value.getLng()); }),
    setLevel: jest.fn((value: number) => { level = value; }),
    getBounds: () => new Bounds(),
    setBounds: jest.fn(),
    relayout: jest.fn(),
  };
  const cluster = { clear: jest.fn(), addMarkers: jest.fn() };
  const MapConstructor = jest.fn(function () { return map; });
  const sdk = {
    load: (callback: () => void) => callback(),
    Map: MapConstructor,
    LatLng,
    LatLngBounds: Bounds,
    Marker: class {
      constructor(private options: { position: KakaoLatLng }) {}
      getPosition() { return this.options.position; }
      setImage() {}
      setZIndex() {}
    },
    MarkerImage: class {},
    Size: class {},
    Point: class {},
    MarkerClusterer: class { constructor() { return cluster; } },
    CustomOverlay: class { setMap() {} },
    event: { addListener: jest.fn() },
  } as unknown as KakaoMapsNamespace;
  return { sdk, map, cluster, MapConstructor, LatLng };
}

const originalObserver = global.ResizeObserver;
beforeEach(() => {
  global.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} };
  jest.spyOn(window, "requestAnimationFrame").mockImplementation((callback) => { callback(0); return 1; });
});
afterEach(() => {
  delete window.kakao;
  global.ResizeObserver = originalObserver;
  jest.restoreAllMocks();
});

it("여러 상세를 오간 뒤 보던 지도 중심과 확대 수준으로 돌아온다", async () => {
  const { sdk, map, LatLng, MapConstructor } = createSdk();
  window.kakao = { maps: sdk };
  const located = complexes.filter(hasCoordinates);
  const props = { mapKey: "test", complexes, selectedId: null as string | null, onSelect: jest.fn(), onBounds: jest.fn() };
  const view = render(<HousingMap {...props} />);
  await waitFor(() => expect(screen.queryByText("지도를 불러오는 중입니다.")).not.toBeInTheDocument());
  map.setCenter(new LatLng(37.61, 127.03));
  map.setLevel(6);
  const fitsBeforeDetail = map.setBounds.mock.calls.length;
  view.rerender(<HousingMap {...props} selectedId={located[0].id} />);
  expect(map.getLevel()).toBe(4);
  map.setCenter(new LatLng(37.7, 127.1));
  map.setLevel(9);
  fireEvent.click(screen.getByRole("button", { name: "선택 단지 위치로" }));
  expect(map.getCenter().getLat()).toBe(located[0].lat);
  expect(map.getCenter().getLng()).toBe(located[0].lng);
  expect(map.getLevel()).toBe(4);
  view.rerender(<HousingMap {...props} selectedId={located[1].id} />);
  view.rerender(<HousingMap {...props} />);
  expect(map.getCenter().getLat()).toBe(37.61);
  expect(map.getCenter().getLng()).toBe(127.03);
  expect(map.getLevel()).toBe(6);
  expect(map.setBounds).toHaveBeenCalledTimes(fitsBeforeDetail);
  expect(MapConstructor).toHaveBeenCalledTimes(1);
  expect(screen.queryByRole("button", { name: "선택 단지 위치로" })).not.toBeInTheDocument();
});

it("위치가 없는 단지에는 지도 복귀 버튼을 표시하지 않는다", async () => {
  const { sdk } = createSdk();
  window.kakao = { maps: sdk };
  const missing = complexes.find((complex) => !hasCoordinates(complex))!;
  render(<HousingMap mapKey="test" complexes={complexes} selectedId={missing.id} onSelect={jest.fn()} onBounds={jest.fn()} />);
  await waitFor(() => expect(screen.queryByText("지도를 불러오는 중입니다.")).not.toBeInTheDocument());
  expect(screen.queryByRole("button", { name: "선택 단지 위치로" })).not.toBeInTheDocument();
});

it("관심 단지 변경은 지도를 재생성하거나 이동하지 않고 명시적 전체 위치 요청만 범위를 바꾼다", async () => {
  const { sdk, map, cluster, MapConstructor } = createSdk();
  window.kakao = { maps: sdk };
  const located = complexes.filter(hasCoordinates);
  const props = { mapKey: "test", complexes, selectedId: null, resetView: 0, onSelect: jest.fn(), onBounds: jest.fn() };
  const view = render(<HousingMap {...props} />);
  await waitFor(() => expect(screen.queryByText("지도를 불러오는 중입니다.")).not.toBeInTheDocument());
  const fits = map.setBounds.mock.calls.length;
  view.rerender(<HousingMap {...props} complexes={[located[0]]} />);
  expect(cluster.addMarkers.mock.calls.at(-1)![0]).toHaveLength(1);
  expect(map.setBounds).toHaveBeenCalledTimes(fits);
  expect(MapConstructor).toHaveBeenCalledTimes(1);
  view.rerender(<HousingMap {...props} complexes={[located[0]]} resetView={1} />);
  expect(map.setBounds).toHaveBeenCalledTimes(fits + 1);
  // 검색으로 지역 필터 밖의 단지를 열어도 해당 마커를 표시한다.
  view.rerender(<HousingMap {...props} complexes={[located[0]]} resetView={1} selectedId={located[1].id} />);
  expect(cluster.addMarkers.mock.calls.at(-1)![0]).toHaveLength(2);
  expect(map.getCenter().getLat()).toBe(located[1].lat);
});

it("용산 상세에서 녹번 검색으로 이동하면 목록 복귀 위치도 녹번으로 바뀐다", async () => {
  const { sdk, map } = createSdk();
  window.kakao = { maps: sdk };
  const nokbeon = complexes.find((item) => item.id === "ef052f991b")!;
  const props = { mapKey: "test", complexes, selectedId: null as string | null, searchRevision: 0, onSelect: jest.fn(), onBounds: jest.fn() };
  const view = render(<HousingMap {...props} />);
  await waitFor(() => expect(screen.queryByText("지도를 불러오는 중입니다.")).not.toBeInTheDocument());
  view.rerender(<HousingMap {...props} selectedId="1046227b67" />);
  view.rerender(<HousingMap {...props} selectedId={nokbeon.id} searchRevision={1} />);
  view.rerender(<HousingMap {...props} searchRevision={1} />);
  expect(map.getCenter().getLat()).toBe(nokbeon.lat);
  expect(map.getCenter().getLng()).toBe(nokbeon.lng);
  expect(map.getLevel()).toBe(4);
});

it("모바일 패널 높이가 바뀌면 지도 크기를 다시 계산하고 선택 단지를 중심에 유지한다", async () => {
  const { sdk, map } = createSdk();
  window.kakao = { maps: sdk };
  let resize = () => {};
  const observe = jest.fn();
  global.ResizeObserver = class {
    constructor(callback: ResizeObserverCallback) { resize = () => callback([], this); }
    observe = observe;
    unobserve() {}
    disconnect() {}
  };
  jest.replaceProperty(window, "innerWidth", 390);
  const complex = complexes.find((item) => item.id === "ef052f991b")!;
  const view = render(<HousingMap mapKey="test" complexes={complexes} selectedId={complex.id} onSelect={jest.fn()} onBounds={jest.fn()} />);
  await waitFor(() => expect(screen.queryByText("지도를 불러오는 중입니다.")).not.toBeInTheDocument());
  const mapArea = view.container.firstElementChild!;
  expect(observe).toHaveBeenCalledWith(mapArea);
  const canvas = mapArea.firstElementChild!;
  Object.defineProperty(canvas, "clientWidth", { configurable: true, value: 390 });
  Object.defineProperty(canvas, "clientHeight", { configurable: true, value: 280 });
  map.relayout.mockClear();
  await act(async () => { resize(); });
  await waitFor(() => expect(map.relayout).toHaveBeenCalled());
  expect(map.getCenter().getLat()).toBe(complex.lat);
  expect(map.getCenter().getLng()).toBe(complex.lng);
});
