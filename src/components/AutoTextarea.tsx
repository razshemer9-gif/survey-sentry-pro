import * as React from "react";
import { Textarea, type TextareaProps } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

/**
 * A text box that grows to its content instead of scrolling inside itself.
 *
 * Used where what is already written matters as much as what is being typed —
 * a finding's suggested correction, say, which arrives from the template as a
 * paragraph the consultant then edits. A fixed-height box hides most of such
 * a paragraph behind a scrollbar on a phone, which is exactly when it needs
 * to be read whole.
 */
export const AutoTextarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, value, onChange, ...props }, forwarded) => {
    const inner = React.useRef<HTMLTextAreaElement | null>(null);

    const fit = React.useCallback(() => {
      const el = inner.current;
      if (!el) return;
      el.style.height = "auto";
      el.style.height = `${el.scrollHeight}px`;
    }, []);

    // Re-fit on every change of the value, including one made elsewhere, and
    // once on mount so a box that opens with text in it opens at full height.
    React.useLayoutEffect(fit, [fit, value]);

    return (
      <Textarea
        ref={(el) => {
          inner.current = el;
          if (typeof forwarded === "function") forwarded(el);
          else if (forwarded) forwarded.current = el;
        }}
        value={value}
        onChange={(e) => { onChange?.(e); fit(); }}
        className={cn("resize-none overflow-hidden", className)}
        {...props}
      />
    );
  },
);
AutoTextarea.displayName = "AutoTextarea";
