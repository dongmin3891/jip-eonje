interface KakaoLatLng {
  getLat(): number;
  getLng(): number;
}

interface KakaoLatLngBounds {
  extend(latlng: KakaoLatLng): void;
  contain(latlng: KakaoLatLng): boolean;
  getSouthWest(): KakaoLatLng;
  getNorthEast(): KakaoLatLng;
}

interface KakaoMap {
  setBounds(bounds: KakaoLatLngBounds): void;
  getBounds(): KakaoLatLngBounds;
  getCenter(): KakaoLatLng;
  setCenter(latlng: KakaoLatLng): void;
  setLevel(level: number): void;
  setDraggable(draggable: boolean): void;
  panBy(dx: number, dy: number, options?: { animate?: { duration?: number } }): void;
  panTo(latlng: KakaoLatLng): void;
  relayout(): void;
}

interface KakaoSize {
  width: number;
  height: number;
}

interface KakaoPoint {
  x: number;
  y: number;
}

interface KakaoMarkerImage {
  src: string;
}

interface KakaoMarker {
  setImage(image: KakaoMarkerImage): void;
  setZIndex(zIndex: number): void;
  getPosition(): KakaoLatLng;
}

interface KakaoMarkerClusterer {
  addMarkers(markers: KakaoMarker[]): void;
}

interface KakaoCustomOverlay {
  setMap(map: KakaoMap | null): void;
}

interface KakaoMapsNamespace {
  load(callback: () => void): void;
  LatLng: new (lat: number, lng: number) => KakaoLatLng;
  LatLngBounds: new () => KakaoLatLngBounds;
  Map: new (container: HTMLElement, options: { center: KakaoLatLng; level: number }) => KakaoMap;
  Marker: new (options: {
    position: KakaoLatLng;
    image?: KakaoMarkerImage;
    zIndex?: number;
    clickable?: boolean;
  }) => KakaoMarker;
  MarkerImage: new (
    src: string,
    size: KakaoSize,
    options?: { offset?: KakaoPoint },
  ) => KakaoMarkerImage;
  Size: new (width: number, height: number) => KakaoSize;
  Point: new (x: number, y: number) => KakaoPoint;
  MarkerClusterer: new (options: {
    map: KakaoMap;
    markers?: KakaoMarker[];
    minLevel?: number;
    averageCenter?: boolean;
    calculator?: number[];
    styles?: Array<Record<string, string>>;
  }) => KakaoMarkerClusterer;
  CustomOverlay: new (options: {
    map?: KakaoMap;
    position: KakaoLatLng;
    content: HTMLElement | string;
    xAnchor?: number;
    yAnchor?: number;
    zIndex?: number;
    clickable?: boolean;
  }) => KakaoCustomOverlay;
  event: {
    addListener(target: object, type: string, handler: () => void): void;
  };
}

interface Window {
  kakao?: {
    maps: KakaoMapsNamespace;
  };
}
