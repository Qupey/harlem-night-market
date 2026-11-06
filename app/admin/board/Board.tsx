"use client";

import { useEffect, useState } from "react";
import { MARKET_CATEGORIES, paysHotFoodRate, STATUS_CHOICES, STATUS_LABELS } from "@/lib/selection";
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
  invitedAt: string | null;
  // From the application, shown in the edit panel. Email and phone stay off the board.
  preferredDates: string[]; // 1st, 2nd and 3rd choice; "" when not picked
  appliedCategories: string[]; // what the vendor picked when applying, not the market category
  instagram: string;
  website: string;
  details: string;
  foodTypes: string[];
  menuItems: string[];
  availabilityNotes: string;
  electricityDetails: string;
  setupNotes: string;
};

type MarketDate = { id: string; label: string; short: string };
type Fees = { hotFood: number; standard: number };
type Spaces = Record<string, Record<string, number>>; // date id -> vendor id -> space number
type SpaceChanges = Record<string, number | null>; // vendor id -> space number, or null to clear

// Full class names so Tailwind picks them up.
const CATEGORY_STYLES: Record<string, { stripe: string; tint: string; dot: string }> = {
  "Hot Food": { stripe: "border-l-orange", tint: "bg-orange/10", dot: "bg-orange" },
  "Food Truck": { stripe: "border-l-red-400", tint: "bg-red-400/10", dot: "bg-red-400" },
  Sweets: { stripe: "border-l-pink", tint: "bg-pink/10", dot: "bg-pink" },
  "Packaged Foods": { stripe: "border-l-teal", tint: "bg-teal/10", dot: "bg-teal" },
  Makers: { stripe: "border-l-plum", tint: "bg-plum/30", dot: "bg-plum ring-1 ring-cream/40" },
  Drinks: { stripe: "border-l-gold", tint: "bg-gold/10", dot: "bg-gold" },
  Art: { stripe: "border-l-sky-300", tint: "bg-sky-300/10", dot: "bg-sky-300" },
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

const applySpaces = (all: Spaces, date: string, changes: SpaceChanges): Spaces => {
  const day = { ...all[date] };
  for (const [id, space] of Object.entries(changes)) {
    if (space === null) delete day[id];
    else day[id] = space;
  }
  return { ...all, [date]: day };
};

const DRAG_TYPE = "application/x-hnm-vendor";

export function Board({
  initialVendors,
  initialCapacities,
  capacityTableMissing,
  initialSpaces,
  dates,
  fees,
}: {
  initialVendors: BoardVendor[];
  initialCapacities: Record<string, number>;
  capacityTableMissing: boolean;
  initialSpaces: Spaces | null; // null: the market_spaces table doesn't exist yet
  dates: MarketDate[];
  fees: Fees;
}) {
  const [vendors, setVendors] = useState(initialVendors);
  const [capacities, setCapacities] = useState(initialCapacities);
  const [tableMissing, setTableMissing] = useState(capacityTableMissing);
  const [spaces, setSpaces] = useState<Spaces>(initialSpaces ?? {});
  const [spacesMissing, setSpacesMissing] = useState(initialSpaces === null);
  const [toast, setToast] = useState("");
  const [editing, setEditing] = useState<string | null>(null);
  const [over, setOver] = useState<string | null>(null); // drop zone under the pointer: a date id, "unplaced" or "date#space"

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(""), 6000);
    return () => clearTimeout(t);
  }, [toast]);

  const save = async (
    id: string,
    assignedDates: string[],
    marketCategory?: string,
    status?: BoardVendor["status"],
  ): Promise<boolean> => {
    const before = vendors.find((v) => v.id === id);
    if (!before) return false;
    const ordered = before.eventDates.filter((d) => assignedDates.includes(d));
    // Leaving a date frees the space; the server does the same when it saves the booking.
    const freed = before.assignedDates.filter((d) => !ordered.includes(d) && spaces[d]?.[id] !== undefined);
    const freedFrom = freed.map((d) => [d, spaces[d][id]] as const);
    setSpaces((s) => freed.reduce((all, d) => applySpaces(all, d, { [id]: null }), s));
    setVendors((vs) =>
      vs.map((v) =>
        v.id === id ? { ...v, assignedDates: ordered, category: marketCategory ?? v.category, status: status ?? v.status } : v,
      ),
    );
    try {
      const res = await fetch("/api/admin/board", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, assignedDates: ordered, marketCategory, status }),
        cache: "no-store",
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) throw new Error(body?.error ?? "Saving failed.");
      setVendors((vs) =>
        vs.map((v) => (v.id === id ? { ...v, paymentState: body.paymentState, paymentLabel: body.paymentLabel } : v)),
      );
      return true;
    } catch (err) {
      setVendors((vs) => vs.map((v) => (v.id === id ? before : v)));
      setSpaces((s) => freedFrom.reduce((all, [d, space]) => applySpaces(all, d, { [id]: space }), s));
      setToast(`Couldn't save ${before.name}: ${err instanceof Error ? err.message : "Saving failed."}`);
      return false;
    }
  };

  // Resolves to the error text, or null once the email has gone. The server looks up the address.
  const sendInvite = async (id: string): Promise<string | null> => {
    try {
      const res = await fetch("/api/admin/board/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
        cache: "no-store",
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) return body?.error ?? "The invite didn't send.";
      setVendors((vs) =>
        vs.map((v) =>
          v.id === id ? { ...v, invitedAt: body.invitedAt, paymentState: body.paymentState, paymentLabel: body.paymentLabel } : v,
        ),
      );
      return null;
    } catch {
      return "The invite didn't send. Check your connection and try again.";
    }
  };

  // Shows the new spaces straight away. booking, if given, is the date change that has to save first.
  const saveSpaces = async (date: string, changes: SpaceChanges, booking?: Promise<boolean>) => {
    const day = spaces[date] ?? {};
    const undo = Object.fromEntries(Object.keys(changes).map((id) => [id, day[id] ?? null]));
    setSpaces((s) => applySpaces(s, date, changes));
    if (booking && !(await booking)) {
      setSpaces((s) => applySpaces(s, date, undo));
      return;
    }
    try {
      const res = await fetch("/api/admin/board/spaces", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date, changes }),
        cache: "no-store",
      });
      const body = await res.json().catch(() => null);
      if (body?.tableMissing) setSpacesMissing(true);
      if (!res.ok) throw new Error(body?.error ?? "Saving failed.");
    } catch (err) {
      setSpaces((s) => applySpaces(s, date, undo));
      setToast(`Couldn't save the space: ${err instanceof Error ? err.message : "Saving failed."}`);
    }
  };

  // Puts a vendor in a space. If it's taken, the two swap: the other vendor gets this vendor's
  // old space on that date, or waits for a new one if this vendor didn't have one there.
  const placeInSpace = (v: BoardVendor, date: string, space: number, booking?: Promise<boolean>) => {
    const day = spaces[date] ?? {};
    const current = day[v.id];
    if (current === space && !booking) return;
    const occupant = Object.keys(day).find((id) => day[id] === space && id !== v.id);
    const changes: SpaceChanges = { [v.id]: space };
    if (occupant) changes[occupant] = current ?? null;
    saveSpaces(date, changes, booking);
  };

  const autoFill = (date: string, waiting: BoardVendor[]) => {
    const used = new Set(Object.values(spaces[date] ?? {}));
    const changes: SpaceChanges = {};
    let space = 1;
    for (const v of [...waiting].sort(byCategoryThenName)) {
      while (used.has(space)) space++;
      changes[v.id] = space;
      used.add(space);
    }
    saveSpaces(date, changes);
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

  // Drop on a date column (target), a numbered space in one (target and space) or the Unplaced tray (target null).
  const drop = (e: React.DragEvent, target: string | null, space?: number) => {
    e.preventDefault();
    e.stopPropagation();
    setOver(null);
    let data: { id: string; from: string | null };
    try {
      data = JSON.parse(e.dataTransfer.getData(DRAG_TYPE));
    } catch {
      return;
    }
    const v = vendors.find((x) => x.id === data.id);
    if (!v) return;
    if (data.from === target) {
      if (target && space) placeInSpace(v, target, space);
      return;
    }
    if (target && !v.eventDates.includes(target)) {
      setToast(`${v.name} applied for a different event, so they can't go on that date.`);
      return;
    }
    const add = e.altKey && target !== null;
    const next = new Set(v.assignedDates);
    if (data.from && !add) next.delete(data.from);
    if (target) next.add(target);
    const unchanged = next.size === v.assignedDates.length && v.assignedDates.every((d) => next.has(d));
    const booking = unchanged ? undefined : save(v.id, [...next]);
    if (target && space) placeInSpace(v, target, space, booking);
  };

  const zone = (target: string | null, space?: number) => ({
    onDragOver: (e: React.DragEvent) => {
      if (!e.dataTransfer.types.includes(DRAG_TYPE)) return;
      e.preventDefault();
      e.stopPropagation();
      e.dataTransfer.dropEffect = e.altKey && target !== null ? "copy" : "move";
      setOver(space ? `${target}#${space}` : (target ?? "unplaced"));
    },
    onDragLeave: (e: React.DragEvent) => {
      if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setOver(null);
    },
    onDrop: (e: React.DragEvent) => drop(e, target, space),
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
      {spacesMissing && (
        <p className="mt-4 rounded-lg border border-gold bg-gold/10 px-3 py-2 text-sm text-gold">
          Run supabase/add-market-spaces.sql to number the market spaces.
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
          <p className="mt-1 text-xs text-muted">Not booked for a date yet. Drop a card here to take it off that date. Only starred vendors stay here after a reload.</p>
          <ul className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-1">
            {unplaced.map((v) => (
              <li key={v.id}>
                <Card vendor={v} from={null} fees={fees} onOpen={() => setEditing(v.id)} />
              </li>
            ))}
          </ul>
        </section>

        <div className="grid gap-4 md:grid-cols-3">
          {dates.map((d) => {
            const inColumn = vendors.filter((v) => v.assignedDates.includes(d.id)).sort(byCategoryThenName);
            const day = spaces[d.id] ?? {};
            const waiting = inColumn.filter((v) => day[v.id] === undefined);
            const placed = new Map(inColumn.flatMap((v) => (day[v.id] !== undefined ? [[day[v.id], v] as const] : [])));
            const highest = Math.max(0, ...placed.keys());
            const capacity = capacities[d.id];
            const spaceCount = capacity ? Math.max(capacity, highest) : Math.max(highest, inColumn.length) + 1;
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
                  capacity={capacities[d.id]}
                  onCapacity={(c) => saveCapacity(d.id, c)}
                  onInvalid={() => setToast("Market size must be a whole number above 0, or blank for no limit.")}
                />
                {spacesMissing ? (
                  <ul className="mt-3 flex min-h-24 flex-1 flex-col gap-2">
                    {inColumn.map((v) => (
                      <li key={v.id}>
                        <Card vendor={v} from={d.id} fees={fees} onOpen={() => setEditing(v.id)} />
                      </li>
                    ))}
                    {inColumn.length === 0 && <li className="py-6 text-center text-xs text-muted">Drop vendors here</li>}
                  </ul>
                ) : (
                  <>
                    {waiting.length > 0 && (
                      <div className="mt-3 rounded-lg border border-gold/50 bg-gold/5 p-2">
                        <div className="flex items-center justify-between gap-2">
                          <h3 className="text-xs font-bold uppercase tracking-wide text-gold">Needs a space · {waiting.length}</h3>
                          <button
                            type="button"
                            onClick={() => autoFill(d.id, waiting)}
                            className="rounded-md border border-gold/60 px-2 py-1 text-xs font-semibold text-gold hover:bg-gold/10"
                          >
                            Auto-fill spaces
                          </button>
                        </div>
                        <ul className="mt-2 flex flex-col gap-2">
                          {waiting.map((v) => (
                            <li key={v.id}>
                              <Card vendor={v} from={d.id} fees={fees} onOpen={() => setEditing(v.id)} />
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    <ol className="mt-3 flex flex-col gap-2">
                      {Array.from({ length: spaceCount }, (_, i) => i + 1).map((n) => {
                        const v = placed.get(n);
                        return (
                          <li
                            key={n}
                            {...zone(d.id, n)}
                            className={`flex items-stretch gap-2 rounded-lg ${over === `${d.id}#${n}` ? "bg-gold/20 outline-2 outline-gold" : ""}`}
                          >
                            <span className="display w-9 shrink-0 self-center text-center text-2xl text-gold" aria-hidden="true">
                              {n}
                            </span>
                            <div className="min-w-0 flex-1">
                              {v ? (
                                <Card vendor={v} from={d.id} space={n} fees={fees} onOpen={() => setEditing(v.id)} />
                              ) : (
                                <p className="rounded-lg border border-dashed border-line px-3 py-3 text-xs text-muted">Space {n} · open</p>
                              )}
                            </div>
                          </li>
                        );
                      })}
                    </ol>
                  </>
                )}
              </section>
            );
          })}
        </div>
      </div>

      {editingVendor && (
        <EditPanel
          key={editingVendor.id}
          vendor={editingVendor}
          fees={fees}
          onSendInvite={() => sendInvite(editingVendor.id)}
          dates={dates.filter((d) => editingVendor.eventDates.includes(d.id))}
          vendors={vendors}
          spaces={spacesMissing ? null : spaces}
          capacities={capacities}
          onClose={() => setEditing(null)}
          onSave={(assignedDates, category, status, spaceChanges) => {
            // Stay open after accepting a booked vendor, so the invite can go straight out.
            const justAccepted = status === "accepted" && editingVendor.status !== "accepted" && assignedDates.length > 0;
            if (!justAccepted) setEditing(null);
            const booking = save(editingVendor.id, assignedDates, category, status);
            for (const [date, changes] of Object.entries(spaceChanges)) saveSpaces(date, changes, booking);
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
  capacity,
  onCapacity,
  onInvalid,
}: {
  date: MarketDate;
  vendors: BoardVendor[];
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
    </div>
  );
}

// A paid vendor whose booked dates no longer match what they paid for.
function paymentMismatch(v: BoardVendor, fees: Fees): string | null {
  if (v.amountPaidCents === null) return null;
  const fee = paysHotFoodRate(v.category) ? fees.hotFood : fees.standard;
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
  space,
  fees,
  onOpen,
}: {
  vendor: BoardVendor;
  from: string | null;
  space?: number;
  fees: Fees;
  onOpen: () => void;
}) {
  const s = style(v.category);
  const mismatch = paymentMismatch(v, fees);
  const pay = v.paymentState ? PAYMENT_BADGE[v.paymentState] : null;
  return (
    <div
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
      aria-label={`${space ? `Space ${space}, ` : ""}${v.name}, ${categoryName(v.category)}. Open to edit dates and category.`}
      className={`cursor-grab rounded-lg border border-line border-l-4 px-3 py-2 text-left active:cursor-grabbing hover:border-cream/50 focus-visible:outline-2 focus-visible:outline-gold ${s.stripe} ${s.tint}`}
    >
      <div className="flex items-start justify-between gap-2">
        <span className="font-semibold leading-tight text-cream">
          {space && <span className="text-gold">#{space} </span>}
          {v.name}
        </span>
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
    </div>
  );
}

// Instagram is free text on the form: "@name", "name" or a full link. Reduced to the handle; null if it isn't one.
function instagramHandle(raw: string): string | null {
  const handle = raw
    .trim()
    .replace(/^(https?:\/\/)?(www\.|m\.)?instagram\.com\//i, "")
    .replace(/^@/, "")
    .replace(/[/?#].*$/, "");
  return /^[\w.]+$/.test(handle) ? handle : null;
}

const CHOICE_NAMES = ["1st", "2nd", "3rd"];

function Info({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs font-bold uppercase tracking-wide text-muted">{label}</dt>
      <dd className="mt-0.5 whitespace-pre-line break-words text-sm text-cream">{children}</dd>
    </div>
  );
}

function ApplicationInfo({ vendor: v }: { vendor: BoardVendor }) {
  const instagram = v.instagram.trim();
  const handle = instagramHandle(instagram);
  const website = v.website.trim();
  const choices = v.preferredDates.flatMap((d, i) => (d ? [`${CHOICE_NAMES[i]}: ${d}`] : []));
  return (
    <dl className="mt-3 space-y-3 rounded-lg border border-line bg-navy-deep/40 p-3">
      {instagram && (
        <Info label="Instagram">
          {handle ? (
            <a href={`https://instagram.com/${handle}`} target="_blank" rel="noopener noreferrer" className="underline">
              @{handle}
            </a>
          ) : (
            instagram
          )}
        </Info>
      )}
      {website && (
        <Info label="Website">
          {/^javascript:|^data:/i.test(website) ? (
            website
          ) : (
            <a
              href={/^https?:\/\//i.test(website) ? website : `https://${website}`}
              target="_blank"
              rel="noopener noreferrer"
              className="underline"
            >
              {website}
            </a>
          )}
        </Info>
      )}
      {choices.length > 0 && <Info label="Preferred dates">{choices.join("\n")}</Info>}
      {v.availabilityNotes && <Info label="Availability notes">{v.availabilityNotes}</Info>}
      {v.appliedCategories.length > 0 && <Info label="Applied categories">{v.appliedCategories.join(", ")}</Info>}
      {v.details && <Info label="What they sell">{v.details}</Info>}
      {v.foodTypes.length > 0 && <Info label="Food types">{v.foodTypes.join(", ")}</Info>}
      {v.menuItems.length > 0 && <Info label="Menu items">{v.menuItems.join(", ")}</Info>}
      {v.needsElectricity && <Info label="Electricity">{v.electricityDetails ? `Yes · ${v.electricityDetails}` : "Yes"}</Info>}
      {v.setupNotes && <Info label="Setup notes">{v.setupNotes}</Info>}
    </dl>
  );
}

function PaymentSection({
  vendor: v,
  dates,
  fees,
  unsaved,
  onSendInvite,
}: {
  vendor: BoardVendor;
  dates: MarketDate[];
  fees: Fees;
  unsaved: boolean; // dates or category edited in the panel but not saved yet
  onSendInvite: () => Promise<string | null>;
}) {
  const [confirming, setConfirming] = useState(false);
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);

  const booked = dates.filter((d) => v.assignedDates.includes(d.id));
  const perDate = paysHotFoodRate(v.category) ? fees.hotFood : fees.standard;
  const total = perDate * booked.length;
  const invited = v.invitedAt ? new Date(v.invitedAt).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "";
  const stateText =
    v.paymentState === "paid"
      ? `Paid${v.amountPaidCents ? ` ${dollars(v.amountPaidCents)}` : ""}`
      : v.paymentState === "overdue"
        ? `Overdue · invited ${invited}`
        : v.invitedAt
          ? `Invited ${invited}`
          : "Invite not sent";
  const blocked = unsaved
    ? "Save your changes first"
    : v.status !== "accepted"
      ? "Accept this vendor first"
      : booked.length === 0
        ? "Book at least one date first"
        : "";

  const send = async () => {
    setSending(true);
    const error = await onSendInvite();
    setSending(false);
    setConfirming(false);
    setResult(error ? { ok: false, text: error } : { ok: true, text: `Invite sent to ${v.name}.` });
  };

  return (
    <section className="mt-4 rounded-lg border border-line p-3">
      <h3 className="text-xs font-bold uppercase tracking-wide text-muted">Payment</h3>
      <p className="mt-1 text-sm font-semibold text-cream">{stateText}</p>
      {v.paymentState !== "paid" && booked.length > 0 && (
        <p className="text-sm text-muted">
          Due {dollars(total)} ({dollars(perDate)} × {booked.length} {booked.length === 1 ? "date" : "dates"})
        </p>
      )}
      {v.paymentState !== "paid" &&
        (confirming ? (
          <div className="mt-2 rounded-lg border border-gold bg-gold/10 px-3 py-2 text-sm text-gold">
            <p>
              Email an invite to {v.name} for {booked.map((d) => d.short).join(", ")}, total {dollars(total)}?
            </p>
            <div className="mt-2 flex gap-2">
              <button type="button" onClick={send} disabled={sending} className="btn-primary px-4 py-1.5 text-sm disabled:opacity-40">
                {sending ? "Sending..." : "Yes, send it"}
              </button>
              <button type="button" onClick={() => setConfirming(false)} disabled={sending} className="px-3 py-1.5 text-sm text-muted hover:text-cream">
                Not now
              </button>
            </div>
          </div>
        ) : (
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={!!blocked}
              onClick={() => {
                setResult(null);
                setConfirming(true);
              }}
              className="btn-secondary disabled:opacity-40"
            >
              {v.invitedAt ? "Resend invite" : "Send invite"}
            </button>
            {blocked && <span className="text-xs text-muted">{blocked}</span>}
          </div>
        ))}
      {result && (
        <p role={result.ok ? "status" : "alert"} className={`mt-2 text-sm font-semibold ${result.ok ? "text-teal" : "text-pink"}`}>
          {result.text}
        </p>
      )}
    </section>
  );
}

function EditPanel({
  vendor,
  fees,
  onSendInvite,
  dates,
  vendors,
  spaces,
  capacities,
  onClose,
  onSave,
}: {
  vendor: BoardVendor;
  fees: Fees;
  onSendInvite: () => Promise<string | null>;
  dates: MarketDate[];
  vendors: BoardVendor[];
  spaces: Spaces | null; // null: the market_spaces table doesn't exist yet
  capacities: Record<string, number>;
  onClose: () => void;
  onSave: (
    assignedDates: string[],
    category: string,
    status: BoardVendor["status"],
    spaceChanges: Record<string, SpaceChanges>,
  ) => void;
}) {
  const [picked, setPicked] = useState(new Set(vendor.assignedDates));
  const [category, setCategory] = useState(vendor.category);
  const [status, setStatus] = useState(vendor.status);
  const [spaceInputs, setSpaceInputs] = useState<Record<string, string>>(() =>
    Object.fromEntries(dates.map((d) => [d.id, spaces?.[d.id]?.[vendor.id]?.toString() ?? ""])),
  );
  const [spaceError, setSpaceError] = useState("");
  const [swaps, setSwaps] = useState<string[]>([]); // taken spaces, waiting for Save to confirm the swap
  const unsaved =
    status !== vendor.status ||
    category !== vendor.category ||
    picked.size !== vendor.assignedDates.length ||
    vendor.assignedDates.some((d) => !picked.has(d));

  const submit = () => {
    const changes: Record<string, SpaceChanges> = {};
    const taken: string[] = [];
    for (const d of dates) {
      if (!spaces || !picked.has(d.id)) continue;
      const raw = spaceInputs[d.id].trim();
      const space = raw === "" ? null : Number(raw);
      if (space !== null && (!Number.isInteger(space) || space <= 0 || space > 10000)) {
        return setSpaceError(`Space for ${d.short} must be a whole number above 0, or blank.`);
      }
      const day = spaces[d.id] ?? {};
      const current = day[vendor.id] ?? null;
      if (space === current) continue;
      if (space !== null && capacities[d.id] && space > capacities[d.id]) {
        return setSpaceError(`${d.short} only has ${capacities[d.id]} spaces.`);
      }
      const dayChanges: SpaceChanges = { [vendor.id]: space };
      const occupantId = space === null ? undefined : Object.keys(day).find((id) => day[id] === space);
      if (occupantId) {
        dayChanges[occupantId] = current;
        const occupant = vendors.find((x) => x.id === occupantId)?.name ?? "another vendor";
        taken.push(`Space ${space} on ${d.short} is taken by ${occupant}. They'll ${current ? `move to space ${current}` : "go to Needs a space"}.`);
      }
      changes[d.id] = dayChanges;
    }
    setSpaceError("");
    if (taken.length > 0 && swaps.join() !== taken.join()) return setSwaps(taken);
    setSwaps([]);
    onSave([...picked], category, status, changes);
  };

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
          submit();
        }}
        className="flex max-h-[85vh] w-full max-w-md flex-col rounded-2xl border border-line bg-panel p-5 shadow-2xl"
      >
        <h2 className="display text-2xl text-orange">{vendor.name}</h2>
        <div className="-mx-1 mt-1 min-h-0 flex-1 overflow-y-auto px-1">
          <ApplicationInfo vendor={vendor} />
          <label className="mt-4 block text-xs font-bold uppercase tracking-wide text-muted">
            Status
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as BoardVendor["status"])}
              className="mt-1 block w-full rounded-md border border-line bg-field px-2 py-2 text-sm normal-case tracking-normal text-cream"
            >
              {[...new Set([...STATUS_CHOICES, vendor.status])].map((s) => (
                <option key={s} value={s}>
                  {STATUS_LABELS[s]}
                </option>
              ))}
            </select>
          </label>
          <p className="mt-1 text-xs text-muted">Changing the status doesn&apos;t email the vendor.</p>
          <fieldset className="mt-4">
            <legend className="text-xs font-bold uppercase tracking-wide text-muted">Market dates</legend>
            <div className="mt-2 space-y-2">
              {dates.map((d) => (
                <div key={d.id} className="flex items-center justify-between gap-2">
                  <label className="flex items-center gap-2 text-cream">
                    <input
                      type="checkbox"
                      checked={picked.has(d.id)}
                      onChange={(e) => {
                        const next = new Set(picked);
                        if (e.target.checked) next.add(d.id);
                        else next.delete(d.id);
                        setPicked(next);
                        setSwaps([]);
                      }}
                      className="h-4 w-4 accent-teal"
                    />
                    {d.label}
                  </label>
                  {spaces && picked.has(d.id) && (
                    <label className="flex shrink-0 items-center gap-1 text-xs text-muted">
                      Space #
                      <input
                        type="number"
                        min={1}
                        inputMode="numeric"
                        value={spaceInputs[d.id]}
                        onChange={(e) => {
                          setSpaceInputs({ ...spaceInputs, [d.id]: e.target.value });
                          setSpaceError("");
                          setSwaps([]);
                        }}
                        aria-label={`Space number on ${d.label}`}
                        className="w-16 rounded-md border border-line bg-field px-2 py-1 text-right text-cream"
                      />
                    </label>
                  )}
                </div>
              ))}
            </div>
            {spaceError && <p role="alert" className="mt-2 text-sm font-semibold text-pink">{spaceError}</p>}
            {swaps.length > 0 && (
              <div role="alert" className="mt-2 rounded-lg border border-gold bg-gold/10 px-3 py-2 text-sm text-gold">
                {swaps.map((s) => (
                  <p key={s}>{s}</p>
                ))}
                <p className="mt-1 font-semibold">Save again to swap them, or change the number.</p>
              </div>
            )}
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
          <PaymentSection vendor={vendor} dates={dates} fees={fees} unsaved={unsaved} onSendInvite={onSendInvite} />
        </div>
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
