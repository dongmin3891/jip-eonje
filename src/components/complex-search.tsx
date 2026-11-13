"use client";

import { useEffect, useId, useRef, useState } from "react";

import { Input } from "@/components/ui/input";
import { searchComplexes, type Complex } from "@/lib/complexes";

type ComplexSearchProps = {
  onSelect: (complex: Complex) => void;
};

export function ComplexSearch({ onSelect }: ComplexSearchProps) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const listId = useId();
  const results = searchComplexes(query);

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

  return (
    <div ref={rootRef} className="relative">
      <Input
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-label="단지명 또는 지역 검색"
        placeholder="단지명, 자치구, 동"
        value={query}
        onChange={(event) => {
          setQuery(event.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={(event) => {
          if (event.key === "Escape") setOpen(false);
          if (event.key === "Enter" && results[0]) {
            event.preventDefault();
            choose(results[0]);
          }
        }}
      />
      {open && query.trim() ? (
        <div
          id={listId}
          role="listbox"
          className="absolute top-full z-30 mt-1 max-h-80 w-full overflow-auto rounded-lg border border-neutral-200 bg-white shadow-lg"
        >
          {results.length === 0 ? (
            <p className="px-3 py-3 text-sm text-neutral-500" role="status">
              해당하는 단지가 없습니다.
            </p>
          ) : (
            results.map((complex) => (
              <button
                key={complex.id}
                type="button"
                role="option"
                aria-selected={false}
                className="block w-full border-b border-neutral-100 px-3 py-2 text-left last:border-b-0 hover:bg-neutral-50"
                onClick={() => choose(complex)}
              >
                <span className="block text-sm font-medium text-neutral-900">{complex.name}</span>
                <span className="block text-xs text-neutral-500">
                  {complex.district} · {complex.address}
                </span>
              </button>
            ))
          )}
        </div>
      ) : null}
    </div>
  );
}
