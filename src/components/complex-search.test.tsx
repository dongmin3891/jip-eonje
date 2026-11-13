import { fireEvent, render, screen } from "@testing-library/react";

import { ComplexSearch } from "@/components/complex-search";

describe("ComplexSearch", () => {
  it("단지명으로 고르고, 없으면 안내한다", () => {
    const onSelect = jest.fn();
    render(<ComplexSearch onSelect={onSelect} />);
    const input = screen.getByRole("combobox", { name: "단지명 또는 지역 검색" });

    fireEvent.change(input, { target: { value: "강남센트럴" } });
    fireEvent.click(screen.getByRole("option", { name: /강남센트럴아이파크/ }));
    expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({ id: "5d48b3157f", district: "강남구" }));

    fireEvent.change(input, { target: { value: "zzzz-none" } });
    expect(screen.getByRole("status")).toHaveTextContent("해당하는 단지가 없습니다.");

    fireEvent.click(screen.getByRole("button", { name: "검색어 지우기" }));
    expect(input).toHaveValue("");
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "검색어 지우기" })).not.toBeInTheDocument();
  });
});
