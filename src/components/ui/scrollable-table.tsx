import * as React from "react";
import { ArrowLeftRight } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * Wraps a wide <table> in a horizontally scrollable region with:
 * - edge fade/shadow indicators that appear only on the scrollable side(s)
 * - a "swipe to see more" hint shown while more content is off-screen
 * Pair with `stickyTableHeaderClass` on the table's <thead> for sticky headers.
 */
export function ScrollableTable({
  children,
  className,
  hint = "Swipe horizontally to see more",
}: {
  children: React.ReactNode;
  className?: string;
  hint?: string;
}) {
  const scrollRef = React.useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = React.useState(false);
  const [canScrollRight, setCanScrollRight] = React.useState(false);

  const update = React.useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const maxScroll = el.scrollWidth - el.clientWidth;
    setCanScrollLeft(el.scrollLeft > 1);
    setCanScrollRight(el.scrollLeft < maxScroll - 1);
  }, []);

  React.useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    update();
    el.addEventListener("scroll", update, { passive: true });
    const ro = new ResizeObserver(update);
    ro.observe(el);
    window.addEventListener("resize", update);
    return () => {
      el.removeEventListener("scroll", update);
      ro.disconnect();
      window.removeEventListener("resize", update);
    };
  }, [update]);

  const scrollable = canScrollLeft || canScrollRight;

  return (
    <div className={cn("relative", className)}>
      {/* Left fade indicator */}
      <div
        aria-hidden
        className={cn(
          "pointer-events-none absolute inset-y-0 left-0 z-20 w-8 bg-gradient-to-r from-background to-transparent transition-opacity duration-200",
          canScrollLeft ? "opacity-100" : "opacity-0",
        )}
      />
      {/* Right fade indicator */}
      <div
        aria-hidden
        className={cn(
          "pointer-events-none absolute inset-y-0 right-0 z-20 w-8 bg-gradient-to-l from-background to-transparent transition-opacity duration-200",
          canScrollRight ? "opacity-100" : "opacity-0",
        )}
      />

      <div ref={scrollRef} className="overflow-x-auto">
        {children}
      </div>

      {/* Swipe hint (mobile-oriented, only while more is off-screen to the right) */}
      {scrollable && (
        <div
          className={cn(
            "pointer-events-none flex items-center justify-center gap-1.5 pt-2 text-xs text-muted-foreground transition-opacity duration-200 sm:hidden",
            canScrollRight ? "opacity-100" : "opacity-0",
          )}
        >
          <ArrowLeftRight className="size-3.5" />
          <span>{hint}</span>
        </div>
      )}
    </div>
  );
}

/** Apply to a table's <thead> so its header row sticks while scrolling. */
export const stickyTableHeaderClass =
  "sticky top-0 z-10 [&_th]:sticky [&_th]:top-0";
