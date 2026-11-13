import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";

import { ShInfo, ShInfoView } from "@/components/sh-info";
import { SH_STATUS } from "@/lib/sh/status";

describe("SH 주택정보", () => {
  it("자동 조회 미지원과 공식 링크만 보여 준다", () => {
    render(<ShInfoView status={SH_STATUS} />);
    expect(screen.getByText("자동 조회 미지원")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "SH 주택정보" })).toHaveAttribute("href", SH_STATUS.linkUrl);
    expect(screen.getByText(/공가, 예비자, 퇴거 수는 표시하지 않습니다/)).toBeInTheDocument();
    expect(screen.queryByText(/7세대/)).not.toBeInTheDocument();
  });

  it("상태 API가 같은 미지원 응답을 주면 그 문구를 보여 준다", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => SH_STATUS,
    }) as jest.Mock;
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={client}>
        <ShInfo />
      </QueryClientProvider>,
    );
    expect(await screen.findByText("자동 조회 미지원")).toBeInTheDocument();
    expect(global.fetch).toHaveBeenCalledWith("/api/sh-status");
  });
});
