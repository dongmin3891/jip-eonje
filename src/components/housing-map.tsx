"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";

import { complexes as allComplexes, getComplex, hasCoordinates, type Complex } from "@/lib/complexes";

export type MapBounds = {
  sw: { lat: number; lng: number };
  ne: { lat: number; lng: number };
};

type MapStatus = "loading" | "ready" | "error";

type HousingMapProps = {
  mapKey: string;
  complexes: Complex[];
  selectedId: string | null;
  resetView?: number;
  searchRevision?: number;
  onSelect: (id: string) => void;
  onBounds: (bounds: MapBounds) => void;
};

const scriptLoads = new Map<string, Promise<void>>();
/** 클러스터가 풀리는 수준. 카카오 레벨은 숫자가 작을수록 가깝다. */
const FOCUS_LEVEL = 4;
/**
 * 카카오 스크립트가 평가될 때의 입력. 기기 모드를 나중에 바꿔도 이 값은 유지된다.
 * 크롬 데스크톱은 마우스를, 그 외 터치는 터치를 받는다.
 */
let kakaoUsesTouch: boolean | null = null;

function rememberKakaoInput() {
  if (kakaoUsesTouch !== null) return;
  const touch = "ontouchstart" in document.documentElement;
  const chrome = navigator.userAgent.includes("Chrome");
  const android = navigator.userAgent.includes("Android");
  kakaoUsesTouch = touch && (!chrome || android);
}

function loadKakao(appKey: string): Promise<void> {
  rememberKakaoInput();
  if (window.kakao?.maps?.load) return Promise.resolve();
  const existing = scriptLoads.get(appKey);
  if (existing) return existing;
  const promise = new Promise<void>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${encodeURIComponent(appKey)}&autoload=false&libraries=clusterer`;
    script.async = true;
    script.onload = () => {
      if (window.kakao?.maps?.load) resolve();
      else reject(new Error("kakao"));
    };
    script.onerror = () => reject(new Error("kakao"));
    document.head.appendChild(script);
  });
  scriptLoads.set(appKey, promise);
  return promise;
}

function markerImage(maps: KakaoMapsNamespace, selected: boolean, id: string): KakaoMarkerImage {
  const width = selected ? 32 : 26;
  const height = selected ? 40 : 34;
  const stroke = selected ? 2.6 : 1.8;
  const dot = selected ? 4.6 : 3.6;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 32 40" data-complex="${id}"><path d="M16 38.2c.5 0 11.2-10 11.2-19.8a11.2 11.2 0 1 0-22.4 0C4.8 28.2 15.5 38.2 16 38.2z" fill="#171717" stroke="#fff" stroke-width="${stroke}"/><circle cx="16" cy="18.2" r="${dot}" fill="#fff"/></svg>`;
  const url = `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
  return new maps.MarkerImage(url, new maps.Size(width, height), {
    offset: new maps.Point(width / 2, height - 1),
  });
}

function clusterStyle(size: number): Record<string, string> {
  return {
    width: `${size}px`,
    height: `${size}px`,
    background: "#171717",
    border: "2px solid #fff",
    borderRadius: `${size}px`,
    color: "#fff",
    textAlign: "center",
    fontWeight: "600",
    fontSize: size > 44 ? "14px" : "12px",
    lineHeight: `${size - 4}px`,
    boxShadow: "0 1px 4px rgba(0,0,0,.28)",
  };
}

function complexIdFromTarget(target: EventTarget | null): string | null {
  const image = target instanceof Element ? target.closest("img") : null;
  if (!image) return null;
  const source = decodeURIComponent(image.getAttribute("src") ?? image.src);
  return source.match(/data-complex="([^"]+)"/)?.[1] ?? null;
}

function panMap(map: KakaoMap, dx: number, dy: number) {
  if (dx === 0 && dy === 0) return;
  // duration 0은 카카오 쪽에서 300으로 바뀌고, 그 애니메이션이 나머지 드래그를 먹는다.
  map.panBy(-dx, -dy, { animate: { duration: -1 } });
}

function isMapTarget(container: HTMLElement, x: number, y: number) {
  const target = document.elementFromPoint(x, y);
  // 지도 칸은 하단 시트 뒤까지 차지해서, 좌표만 보면 목록 탭까지 지도 드래그가 된다.
  return !!target && container.contains(target);
}

/** 크롬 기기 모드는 터치를 보내지만, 카카오맵은 크롬에서 마우스만 받는다. */
function bindTouchDrag(container: HTMLElement, map: KakaoMap): () => void {
  const chrome = navigator.userAgent.includes("Chrome");
  const android = navigator.userAgent.includes("Android");
  if (!chrome || android) return () => {};

  let dragging = false;
  let lastX = 0;
  let lastY = 0;

  const onStart = (event: TouchEvent) => {
    if (event.touches.length !== 1) return;
    const touch = event.touches[0];
    if (!isMapTarget(container, touch.clientX, touch.clientY)) return;
    dragging = true;
    lastX = touch.clientX;
    lastY = touch.clientY;
  };
  const onMove = (event: TouchEvent) => {
    if (!dragging || event.touches.length !== 1) return;
    const touch = event.touches[0];
    const dx = touch.clientX - lastX;
    const dy = touch.clientY - lastY;
    lastX = touch.clientX;
    lastY = touch.clientY;
    event.preventDefault();
    panMap(map, dx, dy);
  };
  const onEnd = () => {
    dragging = false;
  };

  window.addEventListener("touchstart", onStart, { capture: true, passive: false });
  window.addEventListener("touchmove", onMove, { capture: true, passive: false });
  window.addEventListener("touchend", onEnd, { capture: true });
  window.addEventListener("touchcancel", onEnd, { capture: true });
  return () => {
    window.removeEventListener("touchstart", onStart, { capture: true });
    window.removeEventListener("touchmove", onMove, { capture: true });
    window.removeEventListener("touchend", onEnd, { capture: true });
    window.removeEventListener("touchcancel", onEnd, { capture: true });
  };
}

const CLICK_SLOP = 4;

type MouseEventWithCapabilities = MouseEvent & {
  sourceCapabilities?: { firesTouchEvents: boolean } | null;
};

/** 휴대폰 기기로 연 뒤에는 카카오가 마우스 드래그와 마커 클릭을 받지 않는다. */
function bindMouseDrag(container: HTMLElement, map: KakaoMap, onMarker: (id: string) => void): () => void {
  let dragging = false;
  let moved = false;
  let startX = 0;
  let startY = 0;
  let lastX = 0;
  let lastY = 0;

  const onStart = (event: MouseEventWithCapabilities) => {
    if (event.button !== 0 || event.sourceCapabilities?.firesTouchEvents) return;
    if (!isMapTarget(container, event.clientX, event.clientY)) return;
    dragging = true;
    moved = false;
    startX = lastX = event.clientX;
    startY = lastY = event.clientY;
  };
  const onMove = (event: MouseEventWithCapabilities) => {
    if (!dragging || event.sourceCapabilities?.firesTouchEvents) return;
    const travel = Math.hypot(event.clientX - startX, event.clientY - startY);
    if (!moved && travel < CLICK_SLOP) return;
    moved = true;
    const dx = event.clientX - lastX;
    const dy = event.clientY - lastY;
    lastX = event.clientX;
    lastY = event.clientY;
    event.preventDefault();
    panMap(map, dx, dy);
  };
  const onEnd = (event: MouseEvent) => {
    if (!dragging) return;
    dragging = false;
    if (moved) return;
    const id = complexIdFromTarget(document.elementFromPoint(event.clientX, event.clientY));
    if (id) onMarker(id);
  };

  window.addEventListener("mousedown", onStart, true);
  window.addEventListener("mousemove", onMove, true);
  window.addEventListener("mouseup", onEnd, true);
  return () => {
    window.removeEventListener("mousedown", onStart, true);
    window.removeEventListener("mousemove", onMove, true);
    window.removeEventListener("mouseup", onEnd, true);
  };
}

function bindMissingDrag(container: HTMLElement, map: KakaoMap, onMarker: (id: string) => void): () => void {
  return kakaoUsesTouch ? bindMouseDrag(container, map, onMarker) : bindTouchDrag(container, map);
}

function nameTag(name: string): HTMLDivElement {
  const wrap = document.createElement("div");
  wrap.style.paddingBottom = "42px";
  wrap.style.pointerEvents = "none";
  const label = document.createElement("div");
  label.textContent = name;
  label.style.cssText = [
    "max-width:11rem",
    "padding:4px 8px",
    "border:1px solid #e5e5e5",
    "border-radius:6px",
    "background:#fff",
    "box-shadow:0 1px 3px rgba(0,0,0,.12)",
    "color:#171717",
    "font-size:12px",
    "font-weight:600",
    "line-height:1.35",
    "text-align:center",
  ].join(";");
  wrap.append(label);
  return wrap;
}

export function isInside(complex: Complex, bounds: MapBounds): boolean {
  if (!hasCoordinates(complex) || complex.lat == null || complex.lng == null) return false;
  return (
    complex.lat >= bounds.sw.lat &&
    complex.lat <= bounds.ne.lat &&
    complex.lng >= bounds.sw.lng &&
    complex.lng <= bounds.ne.lng
  );
}

export function HousingMap({ mapKey, complexes, selectedId, resetView = 0, searchRevision = 0, onSelect, onBounds }: HousingMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<KakaoMap | null>(null);
  const mapsRef = useRef<KakaoMapsNamespace | null>(null);
  const clusterRef = useRef<KakaoMarkerClusterer | null>(null);
  const previousSelection = useRef<string | null>(null);
  const lastSearchRevision = useRef(0);
  const listView = useRef<{ center: KakaoLatLng; level: number } | null>(null);
  const fittedReset = useRef<number | null>(null);
  const markersRef = useRef<Map<string, KakaoMarker>>(new Map());
  const labelRef = useRef<KakaoCustomOverlay | null>(null);
  const hoveredIdRef = useRef<string | null>(null);
  const selectedIdRef = useRef<string | null>(selectedId);
  const showLabelRef = useRef<(id: string | null) => void>(() => {});
  const onSelectRef = useRef(onSelect);
  const onBoundsRef = useRef(onBounds);
  const [status, setStatus] = useState<MapStatus>("loading");

  useEffect(() => {
    showLabelRef.current = (id) => {
      const map = mapRef.current;
      const maps = mapsRef.current;
      labelRef.current?.setMap(null);
      labelRef.current = null;
      if (!map || !maps || !id) return;
      const complex = getComplex(id);
      const marker = markersRef.current.get(id);
      if (!complex || !marker) return;
      const content = nameTag(complex.name);
      labelRef.current = new maps.CustomOverlay({
        map,
        position: marker.getPosition(),
        content,
        xAnchor: 0.5,
        yAnchor: 1,
        zIndex: 20,
        clickable: false,
      });
      // 이름 칸의 여백이 핀 위를 덮는다. 클릭은 마커 이미지로 통과시킨다.
      if (content.parentElement) content.parentElement.style.pointerEvents = "none";
    };
  }, []);

  useEffect(() => {
    onSelectRef.current = onSelect;
    onBoundsRef.current = onBounds;
    selectedIdRef.current = selectedId;
  }, [onSelect, onBounds, selectedId]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || !mapKey) return;
    let cancelled = false;
    let unbindTouch = () => {};
    setStatus("loading");

    loadKakao(mapKey)
      .then(() => {
        const maps = window.kakao?.maps;
        if (!maps || cancelled) return;
        maps.load(() => {
          if (cancelled) return;
          const map = new maps.Map(container, {
            center: new maps.LatLng(37.5665, 126.978),
            level: 8,
          });
          const located = allComplexes.filter(hasCoordinates);
          const markers = located.flatMap((complex) => {
            if (complex.lat == null || complex.lng == null) return [];
            const marker = new maps.Marker({
              position: new maps.LatLng(complex.lat, complex.lng),
              image: markerImage(maps, false, complex.id),
              clickable: true,
            });
            maps.event.addListener(marker, "click", () => onSelectRef.current(complex.id));
            maps.event.addListener(marker, "mouseover", () => {
              hoveredIdRef.current = complex.id;
              showLabelRef.current(complex.id);
            });
            maps.event.addListener(marker, "mouseout", () => {
              if (hoveredIdRef.current === complex.id) hoveredIdRef.current = null;
              showLabelRef.current(hoveredIdRef.current ?? selectedIdRef.current);
            });
            markersRef.current.set(complex.id, marker);
            return [marker];
          });
          clusterRef.current = new maps.MarkerClusterer({
            map,
            markers,
            minLevel: 6,
            averageCenter: true,
            calculator: [10, 30],
            styles: [clusterStyle(36), clusterStyle(44), clusterStyle(52)],
          });
          mapRef.current = map;
          mapsRef.current = maps;
          unbindTouch = bindMissingDrag(container, map, (id) => onSelectRef.current(id));

          const emit = () => {
            if (cancelled) return;
            const mapBounds = map.getBounds();
            const sw = mapBounds.getSouthWest();
            const ne = mapBounds.getNorthEast();
            onBoundsRef.current({
              sw: { lat: sw.getLat(), lng: sw.getLng() },
              ne: { lat: ne.getLat(), lng: ne.getLng() },
            });
          };

          maps.event.addListener(map, "idle", emit);
          requestAnimationFrame(() => {
            if (cancelled) return;
            map.relayout();
            if (markers.length > 0) {
              const bounds = new maps.LatLngBounds();
              for (const marker of markers) bounds.extend(marker.getPosition());
              map.setBounds(bounds);
            }
            emit();
            setStatus("ready");
          });
        });
      })
      .catch(() => {
        if (!cancelled) setStatus("error");
      });

    return () => {
      cancelled = true;
      unbindTouch();
      labelRef.current?.setMap(null);
      labelRef.current = null;
      hoveredIdRef.current = null;
      clusterRef.current?.clear();
      clusterRef.current = null;
      previousSelection.current = null;
      listView.current = null;
      fittedReset.current = null;
      markersRef.current = new Map();
      mapRef.current = null;
      mapsRef.current = null;
      container.replaceChildren();
    };
  }, [mapKey]);

  useEffect(() => {
    const cluster = clusterRef.current;
    if (!cluster || status !== "ready") return;
    const ids = new Set(complexes.map((complex) => complex.id));
    if (selectedId) ids.add(selectedId);
    cluster.clear();
    cluster.addMarkers([...markersRef.current].filter(([id]) => ids.has(id)).map(([, marker]) => marker));
    hoveredIdRef.current = null;
    showLabelRef.current(selectedId);
  }, [complexes, selectedId, status]);

  useEffect(() => {
    const map = mapRef.current;
    const maps = mapsRef.current;
    if (!map || !maps || status !== "ready" || selectedId || fittedReset.current === resetView) return;
    fittedReset.current = resetView;
    const positions = complexes.filter(hasCoordinates);
    if (!positions.length) return;
    const bounds = new maps.LatLngBounds();
    for (const complex of positions) bounds.extend(new maps.LatLng(complex.lat!, complex.lng!));
    map.setBounds(bounds);
  }, [resetView, status, complexes, selectedId]);

  useEffect(() => {
    const map = mapRef.current;
    const maps = mapsRef.current;
    if (!map || !maps || status !== "ready") return;
    const fromSearch = searchRevision !== lastSearchRevision.current;
    lastSearchRevision.current = searchRevision;
    if (fromSearch) listView.current = null;
    if (selectedId && !previousSelection.current && !fromSearch) {
      listView.current = { center: map.getCenter(), level: map.getLevel() };
    }
    if (!selectedId && previousSelection.current && listView.current) {
      map.setLevel(listView.current.level);
      map.setCenter(listView.current.center);
      listView.current = null;
    }
    previousSelection.current = selectedId;
    for (const [id, marker] of markersRef.current) {
      const selected = id === selectedId;
      marker.setImage(markerImage(maps, selected, id));
      marker.setZIndex(selected ? 10 : 0);
    }
    showLabelRef.current(hoveredIdRef.current ?? selectedId);
    const complex = selectedId ? getComplex(selectedId) : null;
    if (!complex || complex.lat == null || complex.lng == null) return;
    const position = new maps.LatLng(complex.lat, complex.lng);
    map.setLevel(FOCUS_LEVEL);
    map.setCenter(position);
    if (fromSearch) {
      listView.current = { center: position, level: FOCUS_LEVEL };
    }
  }, [selectedId, status, searchRevision]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let timer = 0;
    let attempts = 0;
    const column = container.parentElement;

    const syncSize = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        const map = mapRef.current;
        if (!map) {
          if (container.isConnected && attempts < 50) {
            attempts += 1;
            timer = window.setTimeout(syncSize, 100);
          }
          return;
        }
        // 퍼센트로 한 번 풀었다가, 반영된 크기를 픽셀로 다시 고정한다.
        container.style.width = "100%";
        container.style.height = "100%";
        const width = container.clientWidth;
        const height = container.clientHeight;
        if (width === 0 || height === 0) return;
        container.style.width = `${width}px`;
        container.style.height = `${height}px`;
        const center = map.getCenter();
        map.relayout();
        map.setCenter(center);
        const mapBounds = map.getBounds();
        const sw = mapBounds.getSouthWest();
        const ne = mapBounds.getNorthEast();
        onBoundsRef.current({
          sw: { lat: sw.getLat(), lng: sw.getLng() },
          ne: { lat: ne.getLat(), lng: ne.getLng() },
        });
      }, 100);
    };

    const observer = new ResizeObserver(syncSize);
    if (column) observer.observe(column);
    window.addEventListener("resize", syncSize);
    window.visualViewport?.addEventListener("resize", syncSize);
    return () => {
      window.clearTimeout(timer);
      observer.disconnect();
      window.removeEventListener("resize", syncSize);
      window.visualViewport?.removeEventListener("resize", syncSize);
    };
  }, []);

  const selectedComplex = selectedId ? getComplex(selectedId) : undefined;
  function focusSelected() {
    const map = mapRef.current;
    const maps = mapsRef.current;
    if (!map || !maps || !selectedComplex || selectedComplex.lat == null || selectedComplex.lng == null) return;
    map.setLevel(FOCUS_LEVEL);
    map.setCenter(new maps.LatLng(selectedComplex.lat, selectedComplex.lng));
    hoveredIdRef.current = null;
    showLabelRef.current(selectedComplex.id);
  }

  return (
    <div className="relative h-full w-full bg-neutral-100">
      <div ref={containerRef} className="h-full w-full touch-none overflow-hidden" />
      {status === "ready" && selectedComplex && hasCoordinates(selectedComplex) ? (
        <Button type="button" variant="outline" className="absolute top-3 right-3 z-10 h-11 bg-white shadow-sm" title={`${selectedComplex.name} 위치로 이동`} onClick={focusSelected}>선택 단지 위치로</Button>
      ) : null}
      {status === "ready" && !selectedId && !complexes.some(hasCoordinates) ? (
        <p className="pointer-events-none absolute inset-x-4 top-4 rounded-lg bg-white/95 p-3 text-center text-sm text-neutral-600">선택한 조건에 지도에 표시할 단지가 없습니다. 목록에서 확인해 주세요.</p>
      ) : null}
      {status === "loading" ? (
        <p className="pointer-events-none absolute inset-x-0 top-16 text-center text-sm text-neutral-500">
          지도를 불러오는 중입니다.
        </p>
      ) : null}
      {status === "error" ? (
        <div className="absolute inset-0 flex items-center justify-center bg-neutral-50 px-6 text-center">
          <p className="max-w-sm text-sm leading-6 text-neutral-600">
            현재 지도를 불러올 수 없습니다. 검색과 단지 목록에서 계속 이용해 주세요.
          </p>
        </div>
      ) : null}
    </div>
  );
}
