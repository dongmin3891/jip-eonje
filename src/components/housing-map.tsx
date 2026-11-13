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
  const size = selected ? 22 : 14;
  const fill = selected ? "#111111" : "#737373";
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}"><circle cx="${size / 2}" cy="${size / 2}" r="${size / 2 - 1}" fill="${fill}"/></svg>`;
  const url = `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
  return new maps.MarkerImage(url, new maps.Size(size, size), {
    offset: new maps.Point(size / 2, size / 2),
  });
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
  const onSelectRef = useRef(onSelect);
  const onBoundsRef = useRef(onBounds);
  const [status, setStatus] = useState<MapStatus>("loading");

  useEffect(() => {
    onSelectRef.current = onSelect;
    onBoundsRef.current = onBounds;
  }, [onSelect, onBounds]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || !mapKey) return;
    let cancelled = false;
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
            markersRef.current.set(complex.id, marker);
            return [marker];
          });
          new maps.MarkerClusterer({
            map,
            markers,
            minLevel: 6,
            averageCenter: true,
          });
          mapRef.current = map;
          mapsRef.current = maps;

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
    const complex = complexes.find((item) => item.id === selectedId);
    if (!complex || complex.lat == null || complex.lng == null) return;
    const position = new maps.LatLng(complex.lat, complex.lng);
    if (!map.getBounds().contain(position)) map.panTo(position);
  }, [selectedId, status, complexes]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const observer = new ResizeObserver(() => mapRef.current?.relayout());
    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  return (
    <div className="relative h-full w-full bg-neutral-100">
      <div ref={containerRef} className="h-full w-full" />
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
