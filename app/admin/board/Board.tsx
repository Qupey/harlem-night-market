"use client";

import { useEffect, useState } from "react";
import { MARKET_CATEGORIES, STATUS_LABELS } from "@/lib/selection";
import type { StoredApplication } from "@/lib/store";

// Drag-and-drop planner for /admin/board. Every change shows straight away, saves in the
// background (POST /api/admin/board) and is undone with a message if saving fails.

export type BoardVendor = {
  id: string;
  name: string;
  category: string;
  status: StoredApplication["status"];
  paymentLabel: string | null; // accepted vendors only
  paymentState: "not-invited" | "invited" | "overdue" | "paid" | null;
  needsElectricity: boolean;
  assignedDates: string[];
  eventDates: string[]; // the dates this vendor's event runs on
  amountPaidCents: number | null; // paid vendors only
};

type MarketDate = { id: string; label: string; short: string };
type Fees = { hotFood: number; standard: number };

// Full class names so Tailwind picks them up.
const CATEGORY_STYLES: Record<string, { stripe: string; tint: string; dot: string }> = {
  "Hot Food": { stripe: "border-l-orange", tint: "bg-orange/10", dot: "bg-orange" },
  Sweets: { stripe: "border-l-pink", tint: "bg-pink/10", dot: "bg-pink" },
  "Packaged Foods": { stripe: "border-l-teal", tint: "bg-teal/10", dot: "bg-teal" },
  Makers: { stripe: "border-l-plum", tint: "bg-plum/30", dot: "bg-plum ring-1 ring-cream/40" },
  Drinks: { stripe: "border-l-gold", tint: "bg-gold/10", dot: "bg-gold" },
  "": { stripe: "border-l-muted/60", tint: "bg-navy-deep/40", dot: "bg-muted/60" },
};
const CATEGORY_ORDER = [...MARKET_CATEGORIES, ""] as string[];
const categoryName = (c: string) => c || "No category";
const style = (c: string) => CATEGORY_STYLES[c] ?? CATEGORY_STYLES[""];

const PAYMENT_BADGE: Record<string, { label: string; tone: string }> = {
  paid: { label: "Paid", tone: "bg-teal text-navy-deep" },
  invited: { label: "Invited", tone: "bg-gold/20 text-gold" },
  overdue: { label: "Overdue", tone: "bg-pink text-cream" },
  "not-invited": { label: "Invite not sent", tone: "bg-navy-deep/60 text-muted" },
};

// Same format as dollars() in lib/payments.ts, which is server-only.
const dollars = (cents: number) => `$${(cents / 100).toFixed(cents % 100 === 0 ? 0 : 2)}`;

const byCategoryThenName = (a: BoardVendor, b: BoardVendor) =>
  CATEGORY_ORDER.indexOf(a.category) - CATEGORY_ORDER.indexOf(b.category) || a.name.localeCompare(b.name);

const DRAG_TYPE = "application/x-hnm-vendor";

export function Board({
  initialVendors,
  initialCapacities,
  capacityTableMissing,
  hidden,
  dates,
  fees,
}: {
  initialVendors: BoardVendor[];
  initialCapacities: Record<string, number>;
  capacityTableMissing: boolean;
  hidden: { name: string; dates: string[] }[];
  dates: MarketDate[];
  fees: Fees;
}) {
  const [vendors, setVendors] = useState(initialVendors);
  const [capacities, setCapacities] = useState(initialCapacities);
  const [tableMissing, setTableMissing] = useState(capacityTableMissing);
  const [toast, setToast] = useState("");
  const [editing, setEditing] = useState<string | null>(null);
  const [over, setOver] = useState<string | null>(null); // drop zone under the pointer

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(""), 6000);
    return () => clearTimeout(t);
  }, [toast]);

  const save = async (id: string, assignedDates: string[], marketCategory?: string) => {
    const before = vendors.find((v) => v.id === id);
    if (!before) return;
    const ordered = before.eventDates.filter((d) => assignedDates.includes(d));
    setVendors((vs) =>
      vs.map((v) => (v.id === id ? { ...v, assignedDates: ordered, category: marketCategory ?? v.category } : v)),
    );
    try {
      const res = await fetch("/api/admin/board", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, assignedDates: ordered, marketCategory }),
        cache: "no-store",
      });
      if (!res.ok) throw new Error((await res.json().catch(() => null))?.error ?? "Saving failed.");
    } catch (err) {
      setVendors((vs) => vs.map((v) => (v.id === id ? before : v)));
      setToast(`Couldn't save ${before.name}: ${err instanceof Error ? err.message : "Saving failed."}`);
    }
  };

  const saveCapacity = async (date: string, capacity: number | null) => {
    const before = capacities[date];
    if ((before ?? null) === capacity) return;
    setCapacities((c) => {
      const next = { ...c };
      if (capacity === null) delete next[date];
      else next[date] = capacity;
      return next;
    });
    try {
      const res = await fetch("/api/admin/board/capacity", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date, capacity }),
        cache: "no-store",
      });
      const body = await res.json().catch(() => null);
      if (body?.tableMissing) setTableMissing(true);
      if (!res.ok) throw new Error(body?.error ?? "Saving failed.");
      setTableMissing(false);
    } catch (err) {
      setCapacities((c) => {
        const next = { ...c };
        if (before === undefined) delete next[date];
        else next[date] = before;
        return next;
      });
      setToast(`Couldn't save the market size: ${err instanceof Error ? err.message : "Saving failed."}`);
    }
  };

  // Drop on a date column (target) or the Unplaced tray (target null).
  const drop = (e: React.DragEvent, target: string | null) => {
    e.preventDefault();
    setOver(null);
    let data: { id: string; from: string | null };
    try {
      data = JSON.parse(e.dataTransfer.getData(DRAG_TYPE));
    } catch {
      return;
    }
    const v = vendors.find((x) => x.id === data.id);
    if (!v || data.from === target) return;
    if (target && !v.eventDates.includes(target)) {
      setToast(`${v.name} applied for a different event, so they can't go on that date.`);
      return;
    }
    const add = e.altKey && target !== null;
    const next = new Set(v.assignedDates);
    if (data.from && !add) next.delete(data.from);
    if (target) next.add(target);
    if (next.size === v.assignedDates.length && v.assignedDates.every((d) => next.has(d))) return;
    save(v.id, [...next]);
  };

  const zone = (target: string | null) => ({
    onDragOver: (e: React.DragEvent) => {
      if (!e.dataTransfer.types.includes(DRAG_TYPE)) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = e.altKey && target !== null ? "copy" : "move";
      setOver(target ?? "unplaced");
    },
    onDragLeave: (e: React.DragEvent) => {
      if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setOver(null);
    },
    onDrop: (e: React.DragEvent) => drop(e, target),
  });

  const unplaced = vendors.filter((v) => !v.assignedDates.some((d) => dates.some((x) => x.id === d))).sort(byCategoryThenName);
  const editingVendor = vendors.find((v) => v.id === editing);

  return (
    <div className="mt-6">
      <Legend />

      {tableMissing && (
        <p className="mt-4 rounded-lg border border-gold bg-gold/10 px-3 py-2 text-sm text-gold">
          Run supabase/add-market-capacity.sql to save market sizes.
        </p>
      )}

      <div className="mt-5 grid gap-4 lg:grid-cols-[14rem_1fr]">
        <section
          {...zone(null)}
          aria-label="Unplaced vendors"
          className={`rounded-2xl border-2 border-dashed p-3 lg:self-start ${
            over === "unplaced" ? "border-gold bg-gold/10" : "border-line bg-navy-deep/40"
          }`}
        >
          <h2 className="display text-xl text-cream">
            Unplaced <span className="text-sm text-muted">· {unplaced.length}</span>
          </h2>
          <p className="mt-1 text-xs text-muted">Starred, not booked for a date yet. Drop a card here to take it off that date.</p>
          <ul className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-1">
            {unplaced.map((v) => (
              <Card key={v.id} vendor={v} from={null} fees={fees} onOpen={() => setEditing(v.id)} />
            ))}
          </ul>
        </section>

        <div className="grid gap-4 md:grid-cols-3">
          {dates.map((d) => {
            const inColumn = vendors.filter((v) => v.assignedDates.includes(d.id)).sort(byCategoryThenName);
            const hiddenCount = hidden.filter((h) => h.dates.includes(d.id)).length;
            return (
              <section
                key={d.id}
                {...zone(d.id)}
                aria-label={d.label}
                className={`flex flex-col rounded-2xl border-2 p-3 ${
                  over === d.id ? "border-gold bg-gold/10" : "border-line bg-panel"
                }`}
              >
                <ColumnHeader
                  date={d}
                  vendors={inColumn}
                  hiddenCount={hiddenCount}
                  capacity={capacities[d.id]}
                  onCapacity={(c) => saveCapacity(d.id, c)}
                  onInvalid={() => setToast("Market size must be a whole number above 0, or blank for no limit.")}
                />
                <ul className="mt-3 flex min-h-24 flex-1 flex-col gap-2">
                  {inColumn.map((v) => (
                    <Card key={v.id} vendor={v} from={d.id} fees={fees} onOpen={() => setEditing(v.id)} />
                  ))}
                  {inColumn.length === 0 && <li className="py-6 text-center text-xs text-muted">Drop vendors here</li>}
                </ul>
              </section>
            );
          })}
        </div>
      </div>

      {hidden.length > 0 && (
        <p className="mt-5 text-sm text-muted">
          {hidden.length} accepted vendor{hidden.length === 1 ? "" : "s"} booked on these days {hidden.length === 1 ? "isn't" : "aren't"}{" "}
          starred, so {hidden.length === 1 ? "it's" : "they're"} not shown: {hidden.map((h) => h.name).join(", ")}.
        </p>
      )}

      {editingVendor && (
        <EditPanel
          key={editingVendor.id}
          vendor={editingVendor}
          dates={dates.filter((d) => editingVendor.eventDates.includes(d.id))}
          onClose={() => setEditing(null)}
          onSave={(assignedDates, category) => {
            setEditing(null);
            save(editingVendor.id, assignedDates, category);
          }}
        />
      )}

      {toast && (
        <div
          role="alert"
          className="fixed inset-x-4 bottom-4 z-50 mx-auto flex max-w-md items-start gap-3 rounded-lg border border-pink bg-navy-deep px-4 py-3 text-sm text-pink shadow-xl"
        >
          <span className="flex-1">{toast}</span>
          <button type="button" onClick={() => setToast("")} aria-label="Dismiss" className="text-cream">
            ✕
          </button>
        </div>
      )}
    </div>
  );
}

function Legend() {
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-2 text-xs text-cream">
      {CATEGORY_ORDER.map((c) => (
        <li key={c} className="flex items-center gap-1.5">
          <span className={`h-3 w-3 rounded-full ${style(c).dot}`} />
          {categoryName(c)}
        </li>
      ))}
    </ul>
  );
}

function ColumnHeader({
  date,
  vendors,
  hiddenCount,
  capacity,
  onCapacity,
  onInvalid,
}: {
  date: MarketDate;
  vendors: BoardVendor[];
  hiddenCount: number;
  capacity: number | undefined;
  onCapacity: (capacity: number | null) => void;
  onInvalid: () => void;
}) {
  const count = vendors.length;
  const pct = capacity ? count / capacity : 0;
  const bar = count > (capacity ?? Infinity) ? "bg-red-500" : pct >= 0.8 ? "bg-gold" : "bg-emerald-400";

  const commit = (input: HTMLInputElement) => {
    const raw = input.value.trim();
    if (raw === "") return onCapacity(null);
    const n = Number(raw);
    if (!Number.isInteger(n) || n <= 0) {
      input.value = capacity ? String(capacity) : "";
      return onInvalid();
    }
    onCapacity(n);
  };

  return (
    <div>
      <h2 className="display text-xl text-teal">{date.short}</h2>
      <div className="mt-1 flex items-center justify-between gap-2 text-sm">
        <span className="font-semibold text-cream">
          {count}
          {capacity ? ` / ${capacity}` : ""} vendor{(capacity ?? count) === 1 ? "" : "s"}
        </span>
        <label className="flex items-center gap-1 text-xs text-muted">
          Size
          <input
            key={capacity ?? "none"}
            type="number"
            min={1}
            inputMode="numeric"
            defaultValue={capacity ?? ""}
            placeholder="No limit"
            onBlur={(e) => commit(e.currentTarget)}
            onKeyDown={(e) => {
              if (e.key === "Enter") e.currentTarget.blur();
            }}
            aria-label={`Market size for ${date.label} (blank for no limit)`}
            className="w-20 rounded-md border border-line bg-field px-2 py-1 text-right text-cream placeholder:text-muted/60"
          />
        </label>
      </div>
      {capacity ? (
        <div className="mt-2">
          <div className="h-2 overflow-hidden rounded-full bg-navy-deep">
            <div className={`h-full ${bar}`} style={{ width: `${Math.min(100, pct * 100)}%` }} />
          </div>
          {count > capacity && <p className="mt-1 text-xs font-bold text-red-400">Over by {count - capacity}</p>}
        </div>
      ) : null}
      <ul className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted">
        {CATEGORY_ORDER.map((c) => {
          const n = vendors.filter((v) => v.category === c).length;
          if (!n) return null;
          return (
            <li key={c} className="flex items-center gap-1" title={categoryName(c)}>
              <span className={`h-2 w-2 rounded-full ${style(c).dot}`} />
              {categoryName(c)} {n}
            </li>
          );
        })}
      </ul>
      {hiddenCount > 0 && (
        <p className="mt-1 text-xs text-muted/80">
          +{hiddenCount} accepted, not starred (not counted)
        </p>
      )}
    </div>
  );
}

// A paid vendor whose booked dates no longer match what they paid for.
function paymentMismatch(v: BoardVendor, fees: Fees): string | null {
  if (v.amountPaidCents === null) return null;
  const fee = v.category === "Hot Food" ? fees.hotFood : fees.standard;
  const paidDays = Math.round(v.amountPaidCents / fee);
  const booked = v.assignedDates.length;
  if (paidDays === booked) return null;
  const diff = booked * fee - v.amountPaidCents;
  const head = `Paid for ${paidDays} day${paidDays === 1 ? "" : "s"}, booked ${booked}`;
  return diff > 0 ? `${head}: owes ${dollars(diff)}` : `${head}: ${dollars(-diff)} over`;
}

function Card({
  vendor: v,
  from,
  fees,
  onOpen,
}: {
  vendor: BoardVendor;
  from: string | null;
  fees: Fees;
  onOpen: () => void;
}) {
  const s = style(v.category);
  const mismatch = paymentMismatch(v, fees);
  const pay = v.paymentState ? PAYMENT_BADGE[v.paymentState] : null;
  return (
    <li
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData(DRAG_TYPE, JSON.stringify({ id: v.id, from }));
        e.dataTransfer.effectAllowed = "copyMove";
      }}
      onClick={onOpen}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onOpen();
        }
      }}
      role="button"
      tabIndex={0}
      aria-label={`${v.name}, ${categoryName(v.category)}. Open to edit dates and category.`}
      className={`cursor-grab rounded-lg border border-line border-l-4 px-3 py-2 text-left active:cursor-grabbing hover:border-cream/50 focus-visible:outline-2 focus-visible:outline-gold ${s.stripe} ${s.tint}`}
    >
      <div className="flex items-start justify-between gap-2">
        <span className="font-semibold leading-tight text-cream">{v.name}</span>
        {v.needsElectricity && (
          <span title="Needs electricity" aria-label="Needs electricity">
            ⚡
          </span>
        )}
      </div>
      <p className="text-xs text-muted">{categoryName(v.category)}</p>
      <div className="mt-1 flex flex-wrap gap-1 text-[11px] font-semibold">
        {v.status !== "accepted" && (
          <span className="rounded-full border border-muted/40 px-2 py-0.5 text-muted">{STATUS_LABELS[v.status]}</span>
        )}
        {pay && <span className={`rounded-full px-2 py-0.5 ${pay.tone}`}>{v.paymentLabel ?? pay.label}</span>}
        {mismatch && <span className="rounded-full bg-pink/20 px-2 py-0.5 text-pink">⚠ {mismatch}</span>}
      </div>
    </li>
  );
}

function EditPanel({
  vendor,
  dates,
  onClose,
  onSave,
}: {
  vendor: BoardVendor;
  dates: MarketDate[];
  onClose: () => void;
  onSave: (assignedDates: string[], category: string) => void;
}) {
  const [picked, setPicked] = useState(new Set(vendor.assignedDates));
  const [category, setCategory] = useState(vendor.category);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-navy-deep/70 p-4 sm:items-center" onClick={onClose}>
      <form
        role="dialog"
        aria-modal="true"
        aria-label={`Edit ${vendor.name}`}
        onClick={(e) => e.stopPropagation()}
        onSubmit={(e) => {
          e.preventDefault();
          onSave([...picked], category);
        }}
        className="w-full max-w-sm rounded-2xl border border-line bg-panel p-5 shadow-2xl"
      >
        <h2 className="display text-2xl text-orange">{vendor.name}</h2>
        <fieldset className="mt-4">
          <legend className="text-xs font-bold uppercase tracking-wide text-muted">Market dates</legend>
          <div className="mt-2 space-y-2">
            {dates.map((d) => (
              <label key={d.id} className="flex items-center gap-2 text-cream">
                <input
                  type="checkbox"
                  checked={picked.has(d.id)}
                  onChange={(e) => {
                    const next = new Set(picked);
                    if (e.target.checked) next.add(d.id);
                    else next.delete(d.id);
                    setPicked(next);
                  }}
                  className="h-4 w-4 accent-teal"
                />
                {d.label}
              </label>
            ))}
          </div>
        </fieldset>
        <label className="mt-4 block text-xs font-bold uppercase tracking-wide text-muted">
          Category
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="mt-1 block w-full rounded-md border border-line bg-field px-2 py-2 text-sm normal-case tracking-normal text-cream"
          >
            <option value="">No category</option>
            {MARKET_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>
        <div className="mt-5 flex items-center justify-between gap-3">
          <a href={`/admin#app-${vendor.id}`} className="text-sm text-muted underline">
            Full application
          </a>
          <div className="flex gap-2">
            <button type="button" onClick={onClose} className="rounded-lg px-3 py-2 text-sm text-muted hover:text-cream">
              Cancel
            </button>
            <button type="submit" className="btn-primary px-5 py-2 text-base">
              Save
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
