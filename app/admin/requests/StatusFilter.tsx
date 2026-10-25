"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";

const OPTIONS = [
  ["", "All vendors"],
  ["pending", "Pending"],
  ["accepted", "Accepted"],
  ["rejected", "Declined"],
] as const;

// Pulldown that limits the requested-dates list to one status, kept in the ?status= query param.
export function StatusFilter({ value }: { value: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  const onChange = (status: string) => {
    const next = new URLSearchParams(params);
    if (status) next.set("status", status);
    else next.delete("status");
    next.delete("saved");
    next.delete("open");
    const qs = next.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname);
  };

  return (
    <label className="flex items-center gap-2 text-sm">
      <span className="text-muted">Show</span>
      <select value={value} onChange={(e) => onChange(e.target.value)} className="field-input py-1.5">
        {OPTIONS.map(([v, l]) => (
          <option key={v} value={v}>
            {l}
          </option>
        ))}
      </select>
    </label>
  );
}
