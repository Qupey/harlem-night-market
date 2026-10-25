"use client";

// Opens or closes every application card in the list at once.
export function ExpandAll() {
  const setAll = (open: boolean) =>
    document.querySelectorAll<HTMLDetailsElement>("details[data-app]").forEach((d) => (d.open = open));
  return (
    <span className="flex gap-3 text-sm">
      <button type="button" onClick={() => setAll(true)} className="text-teal underline">
        Expand all
      </button>
      <button type="button" onClick={() => setAll(false)} className="text-teal underline">
        Collapse all
      </button>
    </span>
  );
}
