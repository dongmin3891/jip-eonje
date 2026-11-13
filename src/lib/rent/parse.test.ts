import { MolitError, parseMolitXml } from "@/lib/rent/parse";

const SAMPLE = `<?xml version="1.0" encoding="UTF-8"?>
<response>
  <header>
    <resultCode>000</resultCode>
    <resultMsg>OK</resultMsg>
  </header>
  <body>
    <items>
      <item>
        <sggCd>11110</sggCd>
        <umdNm>창신동</umdNm>
        <aptNm>창신동아파트</aptNm>
        <jibun>232</jibun>
        <excluUseAr>59.95</excluUseAr>
        <dealYear>2024</dealYear>
        <dealMonth>7</dealMonth>
        <dealDay>17</dealDay>
        <deposit>50,000</deposit>
        <monthlyRent>0</monthlyRent>
        <floor>5</floor>
        <contractType>신규</contractType>
        <roadnm>지봉로5길 7</roadnm>
        <aptSeq>11110-34</aptSeq>
        <dealingGbn>중개거래</dealingGbn>
      </item>
      <item>
        <umdNm>창신동</umdNm>
        <aptNm>창신동아파트</aptNm>
        <jibun>232번지</jibun>
        <excluUseAr>59.95</excluUseAr>
        <dealYear>2024</dealYear>
        <dealMonth>7</dealMonth>
        <dealDay>16</dealDay>
        <deposit>10000</deposit>
        <monthlyRent>53</monthlyRent>
        <floor>3</floor>
        <contractType>기타</contractType>
        <cdealType>O</cdealType>
        <cdealDay>15</cdealDay>
        <roadnm>지봉로5길</roadnm>
        <roadnmbonbun>00007</roadnmbonbun>
        <roadnmbubun>0</roadnmbubun>
      </item>
    </items>
    <numOfRows>10</numOfRows>
    <pageNo>1</pageNo>
    <totalCount>2</totalCount>
  </body>
</response>`;

describe("실거래 XML", () => {
  it("공식 샘플 필드를 읽고 취소 행을 표시한다", () => {
    const page = parseMolitXml(SAMPLE);
    expect(page.totalCount).toBe(2);
    expect(page.items[0]).toMatchObject({
      legalDong: "창신동",
      lotNumber: "232",
      roadCompact: "지봉로5길7",
      areaM2: 59.95,
      contractDate: "2024-07-17",
      depositManwon: 50000,
      monthlyRentManwon: 0,
      floor: 5,
      contractType: "신규",
      aptSeq: "11110-34",
      cancelled: false,
    });
    expect(page.items[1]).toMatchObject({
      lotNumber: "232",
      roadCompact: "지봉로5길7",
      contractType: null,
      cancelled: true,
      depositManwon: 10000,
      monthlyRentManwon: 53,
    });
  });

  it("인증키 오류 30은 키 문제로 올리고 원문 키를 담지 않는다", () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
      <OpenAPI_ServiceResponse>
        <cmmMsgHeader>
          <returnReasonCode>30</returnReasonCode>
          <returnAuthMsg>SERVICE_KEY_IS_NOT_REGISTERED_ERROR</returnAuthMsg>
        </cmmMsgHeader>
      </OpenAPI_ServiceResponse>`;
    expect(() => parseMolitXml(xml)).toThrow(MolitError);
    try {
      parseMolitXml(xml);
    } catch (error) {
      expect(error).toBeInstanceOf(MolitError);
      expect((error as MolitError).code).toBe("KEY_INVALID");
      expect((error as MolitError).message).toContain("등록되지 않은");
      expect((error as MolitError).message).not.toContain("SERVICE_KEY");
    }
  });
});
