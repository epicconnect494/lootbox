"use client";
/** Horizontal scroll rail: scroll-snap, arrow-key navigation on the scroller, prev/next buttons for pointer users. */
import { useRef, type ReactNode } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import { cx } from "@/components/ui/primitives";

export function Rail({ title, sub, href, children, itemWidth = 224 }: { title: string; sub?: string; href?: string; children: ReactNode[]; itemWidth?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const id = `rail-${title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
  if (children.length === 0) return null;

  const scrollBy = (dir: 1 | -1) => {
    const el = ref.current;
    if (!el) return;
    el.scrollBy({ left: dir * Math.max(itemWidth, el.clientWidth * 0.8), behavior: "smooth" });
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.target !== e.currentTarget) return;
    if (e.key === "ArrowRight") {
      e.preventDefault();
      scrollBy(1);
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      scrollBy(-1);
    } else if (e.key === "Home") {
      e.preventDefault();
      ref.current?.scrollTo({ left: 0, behavior: "smooth" });
    } else if (e.key === "End") {
      e.preventDefault();
      ref.current?.scrollTo({ left: ref.current.scrollWidth, behavior: "smooth" });
    }
  };

  return (
    <section aria-labelledby={`${id}-title`} className="min-w-0">
      <div className="mb-2 flex items-end justify-between gap-3">
        <div className="min-w-0">
          <h2 id={`${id}-title`} className="font-display text-lg font-bold text-ink-100 md:text-xl">
            {href ? (
              <Link href={href} className="rounded-md hover:text-cyan-300">
                {title}
              </Link>
            ) : (
              title
            )}
          </h2>
          {sub && <p className="mt-0.5 text-sm text-ink-400">{sub}</p>}
        </div>
        <div className="hidden shrink-0 items-center gap-1 md:flex">
          <button type="button" onClick={() => scrollBy(-1)} className="tap inline-flex items-center justify-center rounded-xl text-ink-300 hover:bg-white/5" aria-label={`Scroll ${title} left`}>
            <ChevronLeft size={18} aria-hidden />
          </button>
          <button type="button" onClick={() => scrollBy(1)} className="tap inline-flex items-center justify-center rounded-xl text-ink-300 hover:bg-white/5" aria-label={`Scroll ${title} right`}>
            <ChevronRight size={18} aria-hidden />
          </button>
        </div>
      </div>
      <div
        ref={ref}
        tabIndex={0}
        role="group"
        aria-label={`${title} rail. Use left and right arrow keys to scroll.`}
        onKeyDown={onKeyDown}
        className={cx("-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-2 md:mx-0 md:px-0", "[scrollbar-width:thin]")}
      >
        {children.map((child, i) => (
          <div key={i} className="shrink-0 snap-start" style={{ width: itemWidth }}>
            {child}
          </div>
        ))}
      </div>
    </section>
  );
}
