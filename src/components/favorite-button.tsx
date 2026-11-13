import { Star } from "lucide-react";
import { Button } from "@/components/ui/button";

export function FavoriteButton({ name, saved, onToggle }: { name: string; saved: boolean; onToggle: () => void }) {
  return (
    <Button type="button" variant="ghost" className="h-11 w-11 shrink-0" aria-label={`${name} 관심 단지 ${saved ? "해제" : "저장"}`} aria-pressed={saved} onClick={onToggle}>
      <Star aria-hidden="true" className={saved ? "fill-amber-400 text-amber-700" : "text-neutral-500"} />
    </Button>
  );
}
