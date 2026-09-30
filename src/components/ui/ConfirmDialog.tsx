"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";

import { Button } from "@/components/ui/Button";

/**
 * ConfirmDialog —— 破坏操作二次确认（UX R3 / R4 / C7）。
 *
 * 与 AdminModal 同构：Portal 到 body、Esc 关闭、关闭后焦点归还触发按钮。
 * 不使用 `window.confirm`。视觉复用 `.admin-modal` 令牌，避免第三套浮层样式。
 */
export function ConfirmDialog({
  title,
  children,
  confirmLabel,
  cancelLabel,
  closeLabel = "关闭",
  onConfirm,
  onClose,
  busy = false,
  confirmVariant = "solid",
}: {
  title: string;
  children: ReactNode;
  confirmLabel: string;
  cancelLabel: string;
  /** 标题栏关闭按钮文案（默认可访问名「关闭」） */
  closeLabel?: string;
  onConfirm: () => void;
  onClose: () => void;
  busy?: boolean;
  confirmVariant?: "solid" | "outline" | "ghost";
}) {
  const titleId = useId();
  const windowRef = useRef<HTMLDivElement>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    returnFocusRef.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    document.body.style.overflow = "hidden";
    windowRef.current?.focus();

    return () => {
      document.body.style.overflow = "";
      returnFocusRef.current?.focus();
    };
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !busy) onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [busy, onClose]);

  if (typeof document === "undefined") return null;

  return createPortal(
    <div className="admin-modal">
      <div
        className="admin-modal__veil"
        aria-hidden="true"
        onClick={() => {
          if (!busy) onClose();
        }}
      />
      <div
        ref={windowRef}
        className="admin-modal__window"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
      >
        <header className="admin-modal__head">
          <div>
            <h2 className="admin-modal__title" id={titleId}>
              {title}
            </h2>
          </div>
          <Button variant="ghost" icon="close" onClick={onClose} disabled={busy}>
            {closeLabel}
          </Button>
        </header>
        <div className="admin-modal__body">
          {children}
          <div className="signup__actions">
            <Button type="button" variant="ghost" onClick={onClose} disabled={busy}>
              {cancelLabel}
            </Button>
            <Button
              type="button"
              variant={confirmVariant}
              disabled={busy}
              onClick={onConfirm}
            >
              {confirmLabel}
            </Button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
