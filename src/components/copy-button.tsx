"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

export function CopyButton({ label, value }: { label: string; value: string | (() => string) }) {
  const [message, setMessage] = useState("");
  return (
    <div>
      <Button type="button" variant="outline" className="h-11" onClick={async () => {
        try {
          await navigator.clipboard.writeText(typeof value === "function" ? value() : value);
          setMessage("복사했습니다.");
        } catch {
          setMessage("복사하지 못했습니다. 표시된 이름이나 주소창의 링크를 직접 복사해 주세요.");
        }
      }}>{label}</Button>
      <p role="status" className="mt-1 text-xs leading-5 text-neutral-600">{message}</p>
    </div>
  );
}
