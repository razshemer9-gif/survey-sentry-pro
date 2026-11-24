import { useLayoutEffect, useRef } from "react";
import { Textarea, type TextareaProps } from "@/components/ui/textarea";

/**
 * A textarea that is always as tall as what is in it.
 *
 * A fixed `rows` is a guess about how much text will arrive, and the
 * disclaimer clauses are long enough that six of the nine standard ones came
 * out with their last line cut off. Somebody deciding whether to keep a
 * clause has to be able to read it without scrolling a box three lines tall.
 *
 * Measured rather than estimated: counting characters would have to assume a
 * width and a font, and would be wrong on the next screen size. Setting the
 * height to scrollHeight asks the browser what it actually came to.
 *
 * The height is cleared before it is read, because scrollHeight of an
 * element with an explicit height is that height — leave it set and the box
 * can only ever grow, never shrink back when text is deleted.
 */
export function GrowingTextarea({ value, ...props }: TextareaProps) {
  const ref = useRef<HTMLTextAreaElement>(null);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    // scrollHeight covers the content and its padding but not the border,
    // while box-sizing: border-box makes the height we set include it. Set
    // scrollHeight alone and every box ends up exactly its two borders short
    // — which is one clipped line, the bug this exists to fix.
    const borders = el.offsetHeight - el.clientHeight;
    el.style.height = `${el.scrollHeight + borders}px`;
  }, [value]);

  return (
    <Textarea
      ref={ref}
      value={value}
      {...props}
      // After the spread, not before: props carries a style of its own, and
      // spread last it would replace this one instead of merging with it.
      // Growing to fit means there is nothing left to scroll to, and a
      // scrollbar track on every clause is noise.
      style={{ overflowY: "hidden", ...props.style }}
    />
  );
}
