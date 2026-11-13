"use client";

import { useEffect, useId, useRef, useState } from "react";

import { Input } from "@/components/ui/input";
import { searchComplexes, type Complex } from "@/lib/complexes";
import { ShLinkBadge } from "@/components/sh-link-badge";

type ComplexSearchProps = {
  initialQuery?: string;
  recentComplexes?: Complex[];
  recentMessage?: string;
  onClearRecents?: () => void;
  onSelect: (complex: Complex) => void;
};

export function ComplexSearch({ initialQuery = "", recentComplexes = [], recentMessage = "", onClearRecents, onSelect }: ComplexSearchProps) {
  const [query, setQuery] = useState(initialQuery);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listId = useId();
  const showingRecent = !query.trim();
  const results = showingRecent ? recentComplexes : searchComplexes(query);
  const showResults = open && (!!query.trim() || recentComplexes.length > 0 || !!recentMessage);

  useEffect(() => {
    if (showResults && activeIndex >= 0) {
      document.getElementById(`${listId}-${activeIndex}`)?.scrollIntoView?.({ block: "nearest" });
    }
  }, [activeIndex, showResults, listId]);

  useEffect(() => {
    function onPointerDown(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, []);

  function choose(complex: Complex) {
    setQuery(complex.name);
    setOpen(false);
    onSelect(complex);
  }

  function clearQuery() {
    setQuery("");
    setActiveIndex(-1);
    setOpen(true);
    inputRef.current?.focus();
  }

  return (
    <div ref={rootRef} className="relative" onBlur={(event) => {
      if (!rootRef.current?.contains(event.relatedTarget)) setOpen(false);
    }}>
      <Input
        ref={inputRef}
        role="combobox"
        aria-expanded={showResults}
        aria-controls={showResults ? listId : undefined}
        aria-activedescendant={showResults && activeIndex >= 0 && results[activeIndex] ? `${listId}-${activeIndex}` : undefined}
        aria-autocomplete="list"
        aria-label="단지명 또는 지역 검색"
        placeholder="단지 검색 · 최근 본 단지"
        className={query ? "h-10 pr-10 text-base" : "h-10 text-base"}
        value={query}
        onChange={(event) => {
          setQuery(event.target.value);
          setActiveIndex(-1);
          setOpen(true);
        }}
        onFocus={() => { setOpen(true); setActiveIndex(-1); }}
        onKeyDown={(event) => {
          if (event.nativeEvent.isComposing || event.keyCode === 229) return;
          if (event.key === "Escape") setOpen(false);
          if ((event.key === "ArrowDown" || event.key === "ArrowUp") && results.length) {
            event.preventDefault();
            setOpen(true);
            setActiveIndex((current) => {
              if (!showResults || current < 0) return event.key === "ArrowDown" ? 0 : results.length - 1;
              return (current + (event.key === "ArrowDown" ? 1 : -1) + results.length) % results.length;
            });
          }
          if (event.key === "Enter" && showResults && results[activeIndex < 0 ? 0 : activeIndex]) {
            event.preventDefault();
            choose(results[activeIndex < 0 ? 0 : activeIndex]);
          }
        }}
      />
      {query ? (
        <button
          type="button"
          aria-label="검색어 지우기"
          className="absolute top-1/2 right-1.5 grid size-7 -translate-y-1/2 place-items-center rounded-md text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700"
          onMouseDown={(event) => event.preventDefault()}
          onClick={clearQuery}
        >
          <svg viewBox="0 0 16 16" className="size-3.5" aria-hidden="true">
            <path
              d="M4 4l8 8M12 4l-8 8"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
          </svg>
        </button>
      ) : null}
      {showResults ? (
        <div
          className="absolute top-full z-30 mt-1 max-h-[min(20rem,50dvh)] w-full overflow-auto overscroll-contain rounded-xl border border-black/10 bg-white shadow-[0_8px_24px_oklch(0_0_0/0.08)]"
        >
          {showingRecent ? (
            <div className="flex items-center justify-between border-b border-neutral-100 px-3">
              <p className="text-sm font-medium">최근 본 단지</p>
              {results.length > 0 && onClearRecents ? <button type="button" className="min-h-11 px-2 text-xs text-neutral-500 hover:text-neutral-900" onMouseDown={(event) => event.preventDefault()} onClick={() => { setActiveIndex(-1); onClearRecents(); }}>기록 지우기</button> : null}
            </div>
          ) : null}
          <div id={listId} role="listbox" aria-label={showingRecent ? "최근 본 단지" : "단지 검색 결과"}>
          {results.length === 0 ? (
            <p className="px-3 py-3 text-sm text-neutral-500" role="status">
              {showingRecent ? "최근 본 단지가 없습니다." : "해당하는 단지가 없습니다."}
            </p>
          ) : (
            results.map((complex, index) => (
              <button
                key={complex.id}
                type="button"
                role="option"
                id={`${listId}-${index}`}
                tabIndex={-1}
                aria-selected={activeIndex === index}
                className={`block w-full border-b border-neutral-100 px-3 py-2 text-left last:border-b-0 hover:bg-neutral-50 ${activeIndex === index ? "bg-neutral-100 ring-1 ring-inset ring-neutral-300" : ""}`}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => choose(complex)}
              >
                <span className="block text-sm font-medium text-neutral-900">{complex.name}</span>
                <ShLinkBadge complexId={complex.id} />
                <span className="block text-xs text-neutral-500">
                  {complex.district} · {complex.address}
                </span>
              </button>
            ))
          )}
          </div>
          {showingRecent ? <p className="border-t border-neutral-100 px-3 py-2 text-xs leading-5 text-neutral-500" role="status">{recentMessage || "이 브라우저에 최근 본 단지 10곳까지 저장합니다."}</p> : null}
        </div>
      ) : null}
    </div>
  );
}
