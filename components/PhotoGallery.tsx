"use client";

import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";

export type GalleryPhoto = { src: string; alt: string; width: number; height: number };

// Photo grid; tapping a photo opens it enlarged in a lightbox with previous/next,
// arrow keys, swipe, and Esc / backdrop click / × to close.
export function PhotoGallery({ photos }: { photos: GalleryPhoto[] }) {
  const [open, setOpen] = useState<number | null>(null);
  const closeBtn = useRef<HTMLButtonElement>(null);
  const lastTrigger = useRef<HTMLButtonElement | null>(null);
  const touchX = useRef<number | null>(null);
  const count = photos.length;

  const close = useCallback(() => {
    setOpen(null);
    lastTrigger.current?.focus();
  }, []);
  const step = useCallback((d: number) => setOpen((i) => (i == null ? i : (i + d + count) % count)), [count]);

  useEffect(() => {
    if (open == null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
      else if (e.key === "ArrowRight") step(1);
      else if (e.key === "ArrowLeft") step(-1);
    };
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    closeBtn.current?.focus();
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener("keydown", onKey);
    };
  }, [open, close, step]);

  const current = open == null ? null : photos[open];

  return (
    <>
      <ul className="mt-10 grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-3 lg:grid-cols-4">
        {photos.map((p, i) => (
          <li key={p.src} className="aspect-[3/2] overflow-hidden rounded-lg ring-1 ring-line/60">
            <button
              type="button"
              onClick={(e) => {
                lastTrigger.current = e.currentTarget;
                setOpen(i);
              }}
              className="block h-full w-full cursor-zoom-in focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal"
              aria-label={`Enlarge photo: ${p.alt}`}
            >
              <Image
                src={p.src}
                alt={p.alt}
                width={p.width}
                height={p.height}
                sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
                className="h-full w-full object-cover transition duration-300 hover:scale-105"
              />
            </button>
          </li>
        ))}
      </ul>

      {current && open != null && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`Photo ${open + 1} of ${count}`}
          className="fixed inset-0 z-50 flex items-center justify-center bg-navy-deep/95 p-3 backdrop-blur-sm sm:p-8"
          onClick={(e) => {
            if (e.target === e.currentTarget) close();
          }}
          onTouchStart={(e) => (touchX.current = e.touches[0].clientX)}
          onTouchEnd={(e) => {
            if (touchX.current == null) return;
            const dx = e.changedTouches[0].clientX - touchX.current;
            if (Math.abs(dx) > 40) step(dx < 0 ? 1 : -1);
            touchX.current = null;
          }}
        >
          <figure className="relative flex max-h-full w-full max-w-6xl flex-col items-center">
            <Image
              key={current.src}
              src={current.src}
              alt={current.alt}
              width={current.width}
              height={current.height}
              sizes="(max-width: 1200px) 100vw, 1152px"
              className="max-h-[80svh] w-auto rounded-lg object-contain shadow-2xl shadow-black/60"
            />
            <figcaption className="mt-3 text-center text-sm text-muted">
              {current.alt} <span className="text-muted/60">· {open + 1} / {count}</span>
            </figcaption>
          </figure>

          <button
            ref={closeBtn}
            type="button"
            onClick={close}
            aria-label="Close"
            className="absolute right-3 top-3 flex h-11 w-11 items-center justify-center rounded-full bg-panel text-2xl text-cream ring-1 ring-line hover:bg-orange hover:text-navy-deep sm:right-6 sm:top-6"
          >
            ×
          </button>
          <button
            type="button"
            onClick={() => step(-1)}
            aria-label="Previous photo"
            className="absolute left-2 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-panel/80 text-2xl text-cream ring-1 ring-line hover:bg-orange hover:text-navy-deep sm:left-6"
          >
            ‹
          </button>
          <button
            type="button"
            onClick={() => step(1)}
            aria-label="Next photo"
            className="absolute right-2 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-panel/80 text-2xl text-cream ring-1 ring-line hover:bg-orange hover:text-navy-deep sm:right-6"
          >
            ›
          </button>
        </div>
      )}
    </>
  );
}
