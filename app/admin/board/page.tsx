import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { events } from "@/lib/events";
import { HOT_FOOD_FEE_CENTS, PAYMENT_STATE_LABELS, paymentState, STANDARD_FEE_CENTS } from "@/lib/payments";
import { getCapacities, listApplications } from "@/lib/store";
import { Board, type BoardVendor } from "./Board";

export const metadata = { title: "Market board | Harlem Night Market admin" };

const ALL_DATES = events.flatMap((e) => e.dates);

export default function MarketBoardPage() {
  return (
    <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-8 sm:px-6">
      <p className="text-xs font-extrabold uppercase tracking-[0.3em] text-gold">Harlem Night Market admin</p>
      <div className="mt-2 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <h1 className="display text-4xl text-orange">Market board</h1>
        <div className="flex flex-wrap items-center gap-3">
          <Link href="/admin/markets" className="btn-secondary">
            Vendors by market
          </Link>
          <Link href="/admin" className="text-sm text-muted underline">
            ← Back to applications
          </Link>
        </div>
      </div>
      <p className="mt-3 text-sm text-muted">
        Starred vendors by market date. Drag a card to another date to move it there, hold Alt (Option on a Mac) while
        dropping to add that date instead, or drag it to Unplaced to take it off that date. Tap a card to edit its dates
        and category. Changes save right away; no emails are sent.
      </p>
      <Suspense fallback={<p className="mt-8 text-muted">Loading...</p>}>
        <BoardData />
      </Suspense>
    </main>
  );
}

async function BoardData() {
  await connection();
  const [apps, capacities] = await Promise.all([listApplications(), getCapacities()]);

  const vendors: BoardVendor[] = apps
    .filter((a) => a.starred)
    .map((a) => ({
      id: a.id,
      name: a.businessName,
      category: a.marketCategory ?? "",
      status: a.status,
      paymentLabel: a.status === "accepted" ? PAYMENT_STATE_LABELS[paymentState(a)] : null,
      paymentState: a.status === "accepted" ? paymentState(a) : null,
      needsElectricity: a.needsElectricity === "yes",
      assignedDates: a.assignedDates ?? [],
      eventDates: events.find((e) => e.slug === a.eventSlug)?.dates.map((d) => d.id) ?? [],
      amountPaidCents: a.paid ? (a.amountPaidCents ?? 0) : null,
    }));

  // Accepted vendors booked on a market date who aren't on the board because they aren't starred.
  const hidden = apps
    .filter((a) => !a.starred && a.status === "accepted" && (a.assignedDates ?? []).some((d) => ALL_DATES.some((x) => x.id === d)))
    .map((a) => ({ name: a.businessName, dates: a.assignedDates ?? [] }));

  return (
    <Board
      initialVendors={vendors}
      initialCapacities={capacities ?? {}}
      capacityTableMissing={capacities === null}
      hidden={hidden}
      dates={ALL_DATES.map((d) => ({ id: d.id, label: d.label, short: `${d.weekday} ${d.short}` }))}
      fees={{ hotFood: HOT_FOOD_FEE_CENTS, standard: STANDARD_FEE_CENTS }}
    />
  );
}
