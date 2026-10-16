import { useCallback, useEffect, useRef, type PointerEvent } from "react";

// Cursor angle and edge proximity adapted from React Bits Border Glow.
// See THIRD_PARTY_NOTICES.md for source and license.
export function useCardGlow() {
  const frame = useRef<number | null>(null);
  const active = useRef<HTMLElement | null>(null);
  const point = useRef({ x: 0, y: 0 });
  const resetGlow = useCallback(() => {
    if (frame.current !== null) cancelAnimationFrame(frame.current);
    frame.current = null;
    active.current?.style.removeProperty("--edge-proximity");
    active.current?.style.removeProperty("--cursor-angle");
    active.current = null;
  }, []);

  useEffect(() => {
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    motion.addEventListener("change", resetGlow);
    return () => {
      motion.removeEventListener("change", resetGlow);
      resetGlow();
    };
  }, [resetGlow]);

  const trackGlow = useCallback(
    (event: PointerEvent<HTMLElement>) => {
      if (
        event.pointerType === "touch" ||
        event.buttons !== 0 ||
        window.matchMedia("(prefers-reduced-motion: reduce)").matches ||
        !window.matchMedia("(any-hover: hover) and (any-pointer: fine)").matches
      )
        return;
      if (active.current !== event.currentTarget) resetGlow();
      active.current = event.currentTarget;
      point.current = { x: event.clientX, y: event.clientY };
      if (frame.current !== null) return;
      frame.current = requestAnimationFrame(() => {
        frame.current = null;
        const card = active.current;
        if (!card) return;
        const bounds = card.getBoundingClientRect();
        if (!bounds.width || !bounds.height) return;
        const dx = point.current.x - bounds.left - bounds.width / 2;
        const dy = point.current.y - bounds.top - bounds.height / 2;
        const edge = Math.min(
          1,
          Math.max(
            Math.abs(dx) / (bounds.width / 2),
            Math.abs(dy) / (bounds.height / 2),
          ),
        );
        const angle = (Math.atan2(dy, dx) * 180) / Math.PI + 90;
        card.style.setProperty("--edge-proximity", String(edge));
        card.style.setProperty("--cursor-angle", `${angle}deg`);
      });
    },
    [resetGlow],
  );

  return { trackGlow, resetGlow };
}
