"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

// Stars a vendor in place: flips straight away, saves in the background, and flips back if saving fails.
// No navigation, so the page stays where it is.
export function StarButton({ id, name, starred: initial }: { id: string; name: string; starred: boolean }) {
  const router = useRouter();
  const [starred, setStarred] = useState(initial);
  const [error, setError] = useState("");

  const toggle = async (e: React.MouseEvent) => {
    // Keep the click from opening or closing the card.
    e.preventDefault();
    e.stopPropagation();
    const next = !starred;
    setStarred(next);
    setError("");
    try {
      const res = await fetch("/api/admin/star", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, starred: next }),
        cache: "no-store",
      });
      if (!res.ok) throw new Error((await res.json().catch(() => null))?.error ?? "Couldn't save the star.");
      // Updates other cards for the same vendor (e.g. under another date) without moving the page.
      router.refresh();
    } catch (err) {
      setStarred(!next);
      setError(err instanceof Error ? err.message : "Couldn't save the star.");
    }
  };

  return (
    <span className="relative -ml-1 shrink-0">
      <button
        type="button"
        onClick={toggle}
        title={starred ? "Starred for consideration (click to remove)" : "Star for consideration"}
        aria-label={starred ? `Remove star from ${name}` : `Star ${name} for consideration`}
        aria-pressed={starred}
        className={`flex h-7 w-7 items-center justify-center rounded-full text-xl leading-none hover:scale-110 ${
          starred ? "text-gold" : "text-muted/60 hover:text-gold"
        }`}
      >
        {starred ? "★" : "☆"}
      </button>
      {error && (
        <span
          role="alert"
          className="absolute left-0 top-8 z-10 w-64 rounded-md border border-pink bg-navy-deep px-2 py-1 text-xs !text-pink"
        >
          {error}
        </span>
      )}
    </span>
  );
}
