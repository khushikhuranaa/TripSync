"use client";

import type { ReactNode } from "react";
import { Button, type ButtonSize, type ButtonVariant } from "@/components/ui/button";
import { usePreviewNotice } from "@/components/preview/preview-provider";

export function PreviewButton({
  action,
  description,
  phase,
  children,
  variant = "primary",
  size = "md",
  className,
  disabled,
}: {
  action: string;
  description: string;
  phase?: string;
  children: ReactNode;
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
  disabled?: boolean;
}) {
  const { openNotice } = usePreviewNotice();

  return (
    <Button
      variant={variant}
      size={size}
      className={className}
      disabled={disabled}
      onClick={() => openNotice({ action, description, phase })}
    >
      {children}
    </Button>
  );
}
