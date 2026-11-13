import { render, screen } from "@testing-library/react";

import { ShInfo } from "@/components/sh-info";
import { getComplex } from "@/lib/complexes";
import { SH_HOUSE_INFO_MAIN, shHouseInfoUrl } from "@/lib/sh/link";

const linked = getComplex("5d48b3157f");
const gaepoXi = getComplex("0866f38c73");
const hillstateNokbeon = getComplex("ef052f991b");
const unlinked = getComplex("45e8591f50");

describe("SH 주택정보 링크", () => {
  it("검증된 단지는 공식 상세페이지로 연결한다", () => {
    if (!linked) throw new Error("fixture");
    render(<ShInfo complex={linked} />);
    const link = screen.getByRole("link", { name: "이 단지 SH 상세정보 보기 ↗" });
    expect(link).toHaveAttribute(
      "href",
      "https://www.i-sh.co.kr/houseinfo/main/selectHouseImgInfo.do?ctgrCd=10&biznsCd=70536",
    );
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
    expect(screen.getByText("SH 공가·예비자 현황")).toBeInTheDocument();
    expect(screen.getByText("상세페이지 연결")).toBeInTheDocument();
    expect(screen.queryByText(/7세대/)).not.toBeInTheDocument();
  });

  it("이름 표기가 다른 힐스테이트 녹번도 검증된 상세페이지로 연결한다", () => {
    if (!hillstateNokbeon) throw new Error("fixture");

    expect(hillstateNokbeon).toMatchObject({
      name: "힐스테이트(녹번제1-1구역)",
      district: "은평구",
      address: "통일로610 (녹번동 282)",
      rentalUnits: 182,
    });

    render(<ShInfo complex={hillstateNokbeon} />);
    expect(screen.getByRole("link", { name: "이 단지 SH 상세정보 보기 ↗" })).toHaveAttribute(
      "href",
      "https://www.i-sh.co.kr/houseinfo/main/selectHouseImgInfo.do?ctgrCd=10&biznsCd=70388",
    );
  });

  it("지번과 도로명 표기가 다른 개포자이프레지던스도 상세페이지로 연결한다", () => {
    if (!gaepoXi) throw new Error("fixture");

    expect(gaepoXi).toMatchObject({
      name: "개포자이프레지던스",
      address: "강남구 개포동 189번지",
      rentalUnits: 220,
    });
    expect(shHouseInfoUrl(gaepoXi.id)).toBe(
      "https://www.i-sh.co.kr/houseinfo/main/selectHouseImgInfo.do?ctgrCd=10&biznsCd=70547",
    );
  });

  it("검증된 상세 주소가 없으면 주택정보 메인으로 연결한다", () => {
    if (!unlinked) throw new Error("fixture");
    render(<ShInfo complex={unlinked} />);
    expect(screen.getByText("상세 링크 미확인")).toBeInTheDocument();
    expect(
      screen.getByText(
        "확인된 SH 단지 코드가 없어 주택정보 메인으로 이동합니다. SH에서 단지명을 검색해 주세요.",
      ),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "SH 주택정보 메인에서 찾기 ↗" })).toHaveAttribute(
      "href",
      SH_HOUSE_INFO_MAIN,
    );
    expect(shHouseInfoUrl("missing")).toBe(SH_HOUSE_INFO_MAIN);
  });
});
