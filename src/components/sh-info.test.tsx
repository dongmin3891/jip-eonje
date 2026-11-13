import { render, screen } from "@testing-library/react";

import { ShInfo } from "@/components/sh-info";
import { getComplex } from "@/lib/complexes";
import { SH_HOUSE_INFO_MAIN, shHouseInfoUrl } from "@/lib/sh/link";

const linked = getComplex("5d48b3157f");
const unlinked = getComplex("0866f38c73");

describe("SH 주택정보 링크", () => {
  it("검증된 단지는 공식 상세페이지로 연결한다", () => {
    if (!linked) throw new Error("fixture");
    render(<ShInfo complex={linked} />);
    const link = screen.getByRole("link", { name: "SH 주택정보 확인 →" });
    expect(link).toHaveAttribute(
      "href",
      "https://www.i-sh.co.kr/houseinfo/main/selectHouseImgInfo.do?ctgrCd=10&biznsCd=70536",
    );
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
    expect(screen.getByText("SH 공가·예비자 현황")).toBeInTheDocument();
    expect(screen.queryByText(/7세대/)).not.toBeInTheDocument();
  });

  it("검증된 상세 주소가 없으면 주택정보 메인으로 연결한다", () => {
    if (!unlinked) throw new Error("fixture");
    render(<ShInfo complex={unlinked} />);
    expect(screen.getByRole("link", { name: "SH 주택정보 확인 →" })).toHaveAttribute(
      "href",
      SH_HOUSE_INFO_MAIN,
    );
    expect(shHouseInfoUrl("missing")).toBe(SH_HOUSE_INFO_MAIN);
  });
});
