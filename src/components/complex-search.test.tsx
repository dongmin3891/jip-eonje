import { fireEvent, render, screen } from "@testing-library/react";
import { ComplexSearch } from "@/components/complex-search";
import { complexes } from "@/lib/complexes";

it("입력은 부모 목록에 전달하고 검색 드롭다운 없이 키보드로 목록에 접근한다", () => {
  const onQueryChange = jest.fn();
  const onNavigateResults = jest.fn();
  const props = { query: "", onQueryChange, onNavigateResults, onSelect: jest.fn() };
  const view = render(<ComplexSearch {...props} />);
  const input = screen.getByRole("searchbox");
  fireEvent.change(input, { target: { value: "래미안" } });
  expect(onQueryChange).toHaveBeenCalledWith("래미안");
  view.rerender(<ComplexSearch {...props} query="래미안" />);
  expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  fireEvent.keyDown(input, { key: "Enter", isComposing: true });
  expect(onNavigateResults).not.toHaveBeenCalled();
  fireEvent.keyDown(input, { key: "ArrowDown" });
  expect(onNavigateResults).toHaveBeenCalledTimes(1);
  fireEvent.click(screen.getByRole("button", { name: "검색어 지우기" }));
  expect(onQueryChange).toHaveBeenLastCalledWith("");
});

it("검색어가 없을 때 최근 기록의 키보드 선택을 유지한다", () => {
  const onSelect = jest.fn();
  render(<ComplexSearch query="" onQueryChange={jest.fn()} onNavigateResults={jest.fn()} onSelect={onSelect} recentComplexes={complexes.slice(0, 2)} />);
  const input = screen.getByRole("searchbox");
  fireEvent.focus(input);
  fireEvent.keyDown(input, { key: "ArrowDown" });
  fireEvent.keyDown(input, { key: "ArrowDown" });
  const options = screen.getAllByRole("option");
  expect(input).toHaveAttribute("aria-activedescendant", options[1].id);
  fireEvent.keyDown(input, { key: "Enter" });
  expect(onSelect).toHaveBeenCalledWith(complexes[1]);
  expect(input).toHaveValue("");
  fireEvent.focus(input);
  fireEvent.keyDown(input, { key: "Escape" });
  expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
});
