import { render } from "@testing-library/react";
import { SearchHighlight } from "./search-highlight";

it.each([
  ["힐스테이트(녹번제1-1구역)", "녹번", ["녹번"]],
  ["은평구 · 통일로 610 (녹번동)", "통일로610", ["통일로 610"]],
  ["센트럴 IPARK", "i park", ["IPARK"]],
  ["녹번역 녹번동", "녹번", ["녹번", "녹번"]],
  ["힐스테이트(녹번)", "(녹번)", ["(녹번)"]],
  ["래미안", "   ", []],
  ["래미안", ".*", []],
])("원문 %s에서 검색어 %s의 일치 부분만 강조한다", (text, query, expected) => {
  const { container } = render(<SearchHighlight text={text} query={query} />);
  expect(container.textContent).toBe(text);
  expect([...container.querySelectorAll("mark")].map((mark) => mark.textContent)).toEqual(expected);
});
