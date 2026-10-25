"use client";

export function DeleteVendorButton({ name }: { name: string }) {
  return (
    <button
      type="submit"
      className="rounded-lg border border-pink px-3 py-1.5 text-sm font-semibold text-pink hover:bg-pink/10"
      onClick={(e) => {
        if (!confirm(`Permanently delete ${name}? This can't be undone.`)) e.preventDefault();
      }}
    >
      Delete vendor
    </button>
  );
}
