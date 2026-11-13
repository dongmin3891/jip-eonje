import { fireEvent, render, screen } from "@testing-library/react";
import { CopyButton } from "@/components/copy-button";

const writeText = jest.fn();
beforeEach(() => {
  writeText.mockReset();
  Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText } });
});

it("사용자가 누를 때 이름을 복사하고 결과를 알린다", async () => {
  writeText.mockResolvedValue(undefined);
  render(<CopyButton label="단지명 복사" value="강동 리엔파크 11단지" />);
  expect(writeText).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button"));
  expect(await screen.findByText("복사했습니다.")).toBeInTheDocument();
  expect(writeText).toHaveBeenCalledWith("강동 리엔파크 11단지");
});

it("클립보드가 거부되면 직접 복사 안내를 표시한다", async () => {
  writeText.mockRejectedValue(new Error("denied"));
  render(<CopyButton label="단지 링크 복사" value={() => window.location.href} />);
  fireEvent.click(screen.getByRole("button"));
  expect(await screen.findByText(/복사하지 못했습니다/)).toBeInTheDocument();
});
