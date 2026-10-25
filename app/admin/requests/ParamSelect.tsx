"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";

export type Option = readonly [value: string, label: string];

// A pulldown that narrows the requested-dates list, kept in one query param (e.g. ?status=, ?category=).
export function ParamSelect({
  param,
  label,
  value,
  options,
}: {
  param: string;
  label: string;
  value: string;
  options: readonly Option[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  const onChange = (v: string) => {
    const next = new URLSearchParams(params);
    if (v) next.set(param, v);
    else next.delete(param);
    next.delete("saved");
    next.delete("open");
    const qs = next.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname);
  };

  return (
    <label className="flex items-center gap-2 text-sm">
      <span className="text-muted">{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)} className="field-input py-1.5">
        {options.map(([v, l]) => (
          <option key={v} value={v}>
            {l}
          </option>
        ))}
      </select>
    </label>
  );
}
