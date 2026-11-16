"use client";

import { Dialog } from "@base-ui/react/dialog";
import type { ReactNode, RefObject } from "react";

type BottomSheetProps = {
  open: boolean;
  onClose: () => void;
  title: string;
  description: string;
  returnFocus: RefObject<HTMLElement | null>;
  children: ReactNode;
  footer?: ReactNode;
  headerContent?: ReactNode;
};

/** 배경을 잠그고 내용만 스크롤하는 모달. 닫으면 누른 버튼으로 초점을 돌린다. */
export function BottomSheet({ open, onClose, title, description, returnFocus, children, footer, headerContent }: BottomSheetProps) {
  return (
    <Dialog.Root open={open} onOpenChange={(next) => { if (!next) onClose(); }}>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-40 bg-black/40 transition-opacity duration-200 data-[starting-style]:opacity-0 data-[ending-style]:opacity-0 motion-reduce:transition-none" />
        <Dialog.Popup finalFocus={returnFocus} className="fixed inset-x-0 bottom-0 z-50 mx-auto flex max-h-[85dvh] w-full max-w-xl flex-col overflow-hidden rounded-t-2xl bg-white text-neutral-900 shadow-xl outline-none transition-transform duration-200 data-[starting-style]:translate-y-full data-[ending-style]:translate-y-full motion-reduce:transition-none">
          <div className="shrink-0 border-b border-neutral-100 px-5 pt-4 pb-3">
            <div className="flex items-center justify-between gap-3">
              <Dialog.Title className="text-lg font-semibold">{title}</Dialog.Title>
              <Dialog.Close aria-label="팝업 닫기" className="flex size-11 shrink-0 items-center justify-center rounded-lg text-xl hover:bg-neutral-100 focus-visible:outline-2">×</Dialog.Close>
            </div>
            <Dialog.Description className="text-xs leading-5 text-neutral-500">{description}</Dialog.Description>
            {headerContent}
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-4">{children}</div>
          <div className="shrink-0 border-t border-neutral-100 bg-white px-5 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))]">
            {footer ?? <Dialog.Close className="h-11 w-full rounded-lg bg-neutral-900 text-sm font-medium text-white focus-visible:outline-2">닫기</Dialog.Close>}
          </div>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
