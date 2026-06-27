import { useEffect } from "react";

// Shared stack of active Escape handlers across the whole app. Only the
// topmost (most recently mounted) one fires — so closing a modal opened on
// top of a drawer closes just the modal, not both layers at once.
const stack: (() => void)[] = [];
let attached = false;

function handleKeyDown(e: KeyboardEvent) {
  if (e.key !== "Escape" || stack.length === 0) return;
  stack[stack.length - 1]();
}

/**
 * Calls onEscape when the user presses Escape, as long as this is the
 * topmost registered handler. Pass `active = false` (or omit onEscape) to
 * skip registering — e.g. for a modal that isn't currently open.
 */
export function useEscapeKey(onEscape: (() => void) | undefined, active = true): void {
  useEffect(() => {
    if (!active || !onEscape) return;

    stack.push(onEscape);
    if (!attached) {
      document.addEventListener("keydown", handleKeyDown);
      attached = true;
    }

    return () => {
      const idx = stack.lastIndexOf(onEscape);
      if (idx !== -1) stack.splice(idx, 1);
      if (stack.length === 0 && attached) {
        document.removeEventListener("keydown", handleKeyDown);
        attached = false;
      }
    };
  }, [onEscape, active]);
}
