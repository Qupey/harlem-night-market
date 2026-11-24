"use client";

import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";

export type Slide = { src: string; alt: string };

const INTERVAL_MS = 5500;

// Full-bleed crossfading photo carousel with a slow zoom, progress bars, arrows and swipe.
// Pauses on hover/focus and while the tab is hidden; no autoplay or zoom with reduced motion.
export function HeroCarousel({ slides, children }: { slides: Slide[]; children?: React.ReactNode }) {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [reduced, setReduced] = useState(false);
  const touchX = useRef<number | null>(null);
  const count = slides.length;

  const go = useCallback((i: number) => setIndex(((i % count) + count) % count), [count]);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduced(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    if (paused || reduced || count < 2) return;
    const t = setTimeout(() => {
      if (!document.hidden) go(index + 1);
    }, INTERVAL_MS);
    return () => clearTimeout(t);
  }, [index, paused, reduced, count, go]);

  const playing = !paused && !reduced;

  return (
    <div
      className="group relative h-[64svh] max-h-[52rem] min-h-[26rem] sm:h-[78svh] overflow-hidden bg-navy-deep"
      role="region"
      aria-roledescription="carousel"
      aria-label="Photos from the Harlem Night Market"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
      onKeyDown={(e) => {
        if (e.key === "ArrowLeft") go(index - 1);
        if (e.key === "ArrowRight") go(index + 1);
      }}
      onTouchStart={(e) => {
        touchX.current = e.touches[0].clientX;
        setPaused(true);
      }}
      onTouchEnd={(e) => {
        if (touchX.current == null) return;
        const dx = e.changedTouches[0].clientX - touchX.current;
        if (Math.abs(dx) > 40) go(index + (dx < 0 ? 1 : -1));
        touchX.current = null;
        setPaused(false);
      }}
    >
      {slides.map((s, i) => {
        const active = i === index;
        return (
          <div
            key={s.src}
            className={`absolute inset-0 transition-opacity duration-1000 ease-out ${active ? "opacity-100" : "opacity-0"}`}
            aria-hidden={!active}
            role="group"
            aria-roledescription="slide"
            aria-label={`${i + 1} of ${count}`}
          >
            <Image
              src={s.src}
              alt={s.alt}
              fill
              sizes="100vw"
              loading={i === 0 ? "eager" : "lazy"}
              fetchPriority={i === 0 ? "high" : undefined}
              className={`object-cover transition-transform ease-linear ${
                active && !reduced ? "scale-110 duration-[7000ms]" : "scale-100 duration-0"
              }`}
            />
          </div>
        );
      })}

      {/* Shade so the controls read on bright photos */}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-navy via-navy-deep/45 to-navy-deep/10" />

      {children && <div className="absolute inset-x-0 bottom-14 px-4 sm:bottom-16 sm:px-6">{children}</div>}

      {/* Arrows */}
      <button
        type="button"
        onClick={() => go(index - 1)}
        aria-label="Previous photo"
        className="absolute left-3 top-1/2 hidden h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-navy-deep/50 text-2xl text-cream opacity-0 ring-1 ring-cream/30 backdrop-blur transition hover:bg-orange hover:text-navy-deep focus-visible:opacity-100 group-hover:opacity-100 sm:flex"
      >
        ‹
      </button>
      <button
        type="button"
        onClick={() => go(index + 1)}
        aria-label="Next photo"
        className="absolute right-3 top-1/2 hidden h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-navy-deep/50 text-2xl text-cream opacity-0 ring-1 ring-cream/30 backdrop-blur transition hover:bg-orange hover:text-navy-deep focus-visible:opacity-100 group-hover:opacity-100 sm:flex"
      >
        ›
      </button>

      {/* Progress bars, one per photo */}
      <div className="absolute inset-x-4 bottom-5 mx-auto flex max-w-md gap-1.5 sm:bottom-6 sm:gap-2">
        {slides.map((s, i) => (
          <button
            key={s.src}
            type="button"
            onClick={() => go(i)}
            aria-label={`Show photo ${i + 1}`}
            aria-current={i === index}
            className="relative h-1.5 flex-1 overflow-hidden rounded-full bg-cream/30 py-0 transition hover:bg-cream/50"
          >
            <span
              key={i === index ? `on-${index}-${playing}` : "off"}
              className={`absolute inset-y-0 left-0 rounded-full bg-orange ${
                i < index ? "w-full" : i === index ? (playing ? "hnm-progress" : "w-full") : "w-0"
              }`}
              style={i === index && playing ? { animationDuration: `${INTERVAL_MS}ms` } : undefined}
            />
          </button>
        ))}
      </div>
    </div>
  );
}
