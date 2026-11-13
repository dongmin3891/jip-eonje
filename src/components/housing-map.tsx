"use client";

import { useEffect, useRef, useState } from "react";

import { hasCoordinates, type Complex } from "@/lib/complexes";

export type MapBounds = {
  sw: { lat: number; lng: number };
  ne: { lat: number; lng: number };
};

type MapStatus = "loading" | "ready" | "error";

type HousingMapProps = {
  mapKey: string;
  complexes: Complex[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onBounds: (bounds: MapBounds) => void;
};

const scriptLoads = new Map<string, Promise<void>>();
/** 클러스터가 풀리는 수준. 카카오 레벨은 숫자가 작을수록 가깝다. */
const FOCUS_LEVEL = 4;

function loadKakao(appKey: string): Promise<void> {
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

function markerImage(maps: KakaoMapsNamespace, selected: boolean): KakaoMarkerImage {
  const width = selected ? 32 : 26;
  const height = selected ? 40 : 34;
  const stroke = selected ? 2.6 : 1.8;
  const dot = selected ? 4.6 : 3.6;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 32 40"><path d="M16 38.2c.5 0 11.2-10 11.2-19.8a11.2 11.2 0 1 0-22.4 0C4.8 28.2 15.5 38.2 16 38.2z" fill="#171717" stroke="#fff" stroke-width="${stroke}"/><circle cx="16" cy="18.2" r="${dot}" fill="#fff"/></svg>`;
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

/** 크롬 기기 모드는 터치를 보내지만, 카카오맵은 크롬에서 마우스만 받는다. */
function bindChromeTouchDrag(container: HTMLElement, map: KakaoMap): () => void {
  const chrome = navigator.userAgent.includes("Chrome");
  const android = navigator.userAgent.includes("Android");
  if (!chrome || android) return () => {};

  let dragging = false;
  let lastX = 0;
  let lastY = 0;

  const onStart = (event: TouchEvent) => {
    if (event.touches.length !== 1) return;
    const touch = event.touches[0];
    const target = document.elementFromPoint(touch.clientX, touch.clientY);
    // 지도 칸은 하단 시트 뒤까지 차지해서, 좌표만 보면 목록 탭까지 지도 드래그가 된다.
    if (!target || !container.contains(target)) return;
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
    if (dx === 0 && dy === 0) return;
    event.preventDefault();
    // duration 0은 카카오 쪽에서 300으로 바뀌고, 그 애니메이션이 나머지 드래그를 먹는다.
    map.panBy(-dx, -dy, { animate: { duration: -1 } });
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

export function HousingMap({ mapKey, complexes, selectedId, onSelect, onBounds }: HousingMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<KakaoMap | null>(null);
  const mapsRef = useRef<KakaoMapsNamespace | null>(null);
  const markersRef = useRef<Map<string, KakaoMarker>>(new Map());
  const labelRef = useRef<KakaoCustomOverlay | null>(null);
  const hoveredIdRef = useRef<string | null>(null);
  const selectedIdRef = useRef<string | null>(selectedId);
  const showLabelRef = useRef<(id: string | null) => void>(() => {});
  const onSelectRef = useRef(onSelect);
  const onBoundsRef = useRef(onBounds);
  const [status, setStatus] = useState<MapStatus>("loading");

  showLabelRef.current = (id) => {
    const map = mapRef.current;
    const maps = mapsRef.current;
    labelRef.current?.setMap(null);
    labelRef.current = null;
    if (!map || !maps || !id) return;
    const complex = complexes.find((item) => item.id === id);
    const marker = markersRef.current.get(id);
    if (!complex || !marker) return;
    labelRef.current = new maps.CustomOverlay({
      map,
      position: marker.getPosition(),
      content: nameTag(complex.name),
      xAnchor: 0.5,
      yAnchor: 1,
      zIndex: 20,
      clickable: false,
    });
  };

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
          const located = complexes.filter(hasCoordinates);
          const markers = located.flatMap((complex) => {
            if (complex.lat == null || complex.lng == null) return [];
            const marker = new maps.Marker({
              position: new maps.LatLng(complex.lat, complex.lng),
              image: markerImage(maps, false),
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
          new maps.MarkerClusterer({
            map,
            markers,
            minLevel: 6,
            averageCenter: true,
            calculator: [10, 30],
            styles: [clusterStyle(36), clusterStyle(44), clusterStyle(52)],
          });
          mapRef.current = map;
          mapsRef.current = maps;
          unbindTouch = bindChromeTouchDrag(container, map);

          const emit = () => {
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
      markersRef.current = new Map();
      mapRef.current = null;
      mapsRef.current = null;
      container.replaceChildren();
    };
  }, [mapKey, complexes]);

  useEffect(() => {
    const map = mapRef.current;
    const maps = mapsRef.current;
    if (!map || !maps || status !== "ready") return;
    for (const [id, marker] of markersRef.current) {
      const selected = id === selectedId;
      marker.setImage(markerImage(maps, selected));
      marker.setZIndex(selected ? 10 : 0);
    }
    showLabelRef.current(hoveredIdRef.current ?? selectedId);
    const complex = complexes.find((item) => item.id === selectedId);
    if (!complex || complex.lat == null || complex.lng == null) return;
    const position = new maps.LatLng(complex.lat, complex.lng);
    map.setLevel(FOCUS_LEVEL);
    map.setCenter(position);
    if (window.innerWidth < 768) {
      const bounds = map.getBounds();
      const span = bounds.getNorthEast().getLat() - bounds.getSouthWest().getLat();
      map.setCenter(new maps.LatLng(complex.lat - span * 0.22, complex.lng));
    }
  }, [selectedId, status, complexes]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let timer = 0;
    let attempts = 0;
    const column = container.parentElement?.parentElement ?? container.parentElement;

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
        map.relayout();
        map.setCenter(map.getCenter());
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

  return (
    <div className="relative h-full w-full bg-neutral-100">
      <div ref={containerRef} className="h-full w-full touch-none overflow-hidden" />
      {status === "loading" ? (
        <p className="pointer-events-none absolute inset-x-0 top-16 text-center text-sm text-neutral-500">
          지도를 불러오는 중입니다.
        </p>
      ) : null}
      {status === "error" ? (
        <div className="absolute inset-0 flex items-center justify-center bg-neutral-50 px-6 text-center">
          <p className="max-w-sm text-sm leading-6 text-neutral-600">
            카카오맵을 불러오지 못했습니다. JavaScript 키와 등록된 도메인을 확인해 주세요.
          </p>
        </div>
      ) : null}
    </div>
  );
}
