import { connection } from "next/server";
import { Suspense } from "react";

import { HomeShell } from "@/components/home-shell";

async function Home() {
  await connection();
  const mapKey = process.env.KAKAO_MAP_JS_KEY?.trim() ?? "";
  const hasRentKey = Boolean(process.env.DATA_GO_KR_SERVICE_KEY?.trim());
  return <HomeShell mapKey={mapKey} hasRentKey={hasRentKey} />;
}

export default function Page() {
  return (
    <Suspense
      fallback={
        <div className="grid h-dvh place-items-center text-sm text-neutral-500">
          화면을 준비하고 있습니다.
        </div>
      }
    >
      <Home />
    </Suspense>
  );
}
