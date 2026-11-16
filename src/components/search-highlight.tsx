import type { ReactNode } from "react";

/** 검색과 동일하게 공백·대소문자를 무시하되 표시할 원문은 보존한다. */
export function SearchHighlight({ text, query }: { text: string; query: string }) {
  const needle = query.toLowerCase().replace(/\s+/g, "");
  if (!needle) return text;

  let compact = "";
  const positions: number[] = [];
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index].toLowerCase();
    if (/\s/.test(char)) continue;
    compact += char;
    for (let offset = 0; offset < char.length; offset += 1) positions.push(index);
  }

  const parts: ReactNode[] = [];
  let cursor = 0;
  let match = compact.indexOf(needle);
  while (match !== -1) {
    const start = positions[match];
    const end = positions[match + needle.length - 1] + 1;
    parts.push(text.slice(cursor, start));
    parts.push(<mark key={start} className="rounded-sm bg-amber-100 text-inherit">{text.slice(start, end)}</mark>);
    cursor = end;
    match = compact.indexOf(needle, match + needle.length);
  }
  parts.push(text.slice(cursor));
  return <>{parts}</>;
}
