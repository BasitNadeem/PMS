import { useEffect } from "react";
import { cn } from "@/lib/cn";
import { useEscapeKey } from "@/hooks/useEscapeKey";

export interface DrawerProps {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
  width?: string;
  className?: string;
}

export function Drawer({ open, onClose, children, width = "max-w-lg", className }: DrawerProps) {
  useEscapeKey(onClose, open);

  useEffect(() => {
    if (!open) return;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end"
      onMouseDown={onClose}
    >
      <div className="absolute inset-0 bg-ink/35 backdrop-blur-[3px] anim-fade-in" />
      <div
        className={cn(
          "relative h-full w-full bg-mist shadow-float anim-slide-in flex flex-col",
          width,
          className,
        )}
        onMouseDown={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}
