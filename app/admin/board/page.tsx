import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { dateLabel, events, getEvent } from "@/lib/events";
import { HOT_FOOD_FEE_CENTS, PAYMENT_STATE_LABELS, paymentState, STANDARD_FEE_CENTS } from "@/lib/payments";
import { isFoodVendor } from "@/lib/schema";
import { getCapacities, getSpaces, listApplications } from "@/lib/store";
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
        Every vendor booked on a market date, plus starred vendors waiting for one. Drag a card to another date to move it there, hold Alt (Option on a Mac) while
        dropping to add that date instead, or drag it to Unplaced to take it off that date. Drop a card on a numbered space to
        put it there, or on a taken space to swap the two; the numbers stay with the spaces to match the market map. Tap a card
        to edit its dates, spaces and category. Changes save right away; no emails are sent.
      </p>
      <Suspense fallback={<p className="mt-8 text-muted">Loading...</p>}>
        <BoardData />
      </Suspense>
    </main>
  );
}

async function BoardData() {
  await connection();
  const [apps, capacities, spaces] = await Promise.all([listApplications(), getCapacities(), getSpaces()]);

  const vendors: BoardVendor[] = apps
    // Everyone booked on a market date, whatever their status, plus starred vendors waiting for a date.
    .filter((a) => a.starred || (a.assignedDates ?? []).some((d) => ALL_DATES.some((x) => x.id === d)))
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
      preferredDates: [a.firstChoice, a.secondChoice, a.thirdChoice].map((d) => (d ? dateLabel(getEvent(a.eventSlug), d) : "")),
      appliedCategories: [...a.categories.filter((c) => c !== "Other"), ...(a.otherCategory ? [a.otherCategory] : a.categories.includes("Other") ? ["Other"] : [])],
      instagram: a.instagram ?? "",
      website: a.website ?? "",
      details: a.productDetails ?? "",
      foodTypes: isFoodVendor(a.categories) ? [...a.foodTypes.filter((t) => t !== "Other"), ...(a.otherFoodType ? [a.otherFoodType] : [])] : [],
      menuItems: isFoodVendor(a.categories) ? a.menuItems.map((m) => m.name) : [],
      availabilityNotes: a.availabilityNotes ?? "",
      electricityDetails: a.electricityDetails ?? "",
      setupNotes: a.setupNotes ?? "",
    }));

  return (
    <Board
      initialVendors={vendors}
      initialCapacities={capacities ?? {}}
      capacityTableMissing={capacities === null}
      initialSpaces={spaces}
      dates={ALL_DATES.map((d) => ({ id: d.id, label: d.label, short: `${d.weekday} ${d.short}` }))}
      fees={{ hotFood: HOT_FOOD_FEE_CENTS, standard: STANDARD_FEE_CENTS }}
    />
  );
}
