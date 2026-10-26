import { connection } from "next/server";
import { Suspense } from "react";
import { events } from "@/lib/events";
import { MARKET_CATEGORIES, STATUS_LABELS } from "@/lib/selection";
import { listApplications, type StoredApplication } from "@/lib/store";
import { ExpandAll } from "./ExpandAll";
import { BulkInviteBar, FeesTile, matchesPaymentFilter, PAYMENT_FILTERS, PaymentsSetupNotice } from "./Payments";
import { ScrollToCard } from "./ScrollToCard";
import { SavedNotice, VendorCard } from "./VendorCard";

type Filters = {
  status?: string;
  date?: string;
  category?: string;
  payment?: string;
  saved?: string;
  open?: string;
};

const ALL_DATES = events.flatMap((e) => e.dates);

export const metadata = { title: "Vendor applications | Harlem Night Market" };

export default function AdminPage({ searchParams }: PageProps<"/admin">) {
  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-extrabold uppercase tracking-[0.3em] text-gold">Harlem Night Market admin</p>
          <h1 className="mt-2 display text-4xl text-orange">Vendor applications</h1>
        </div>
        <div className="flex flex-wrap gap-2">
          <a href="/admin/requests" className="btn-secondary">
            Requested dates
          </a>
          <a href="/admin/markets" className="btn-secondary">
            Vendors by market
          </a>
          <a href="/admin/faq" className="btn-secondary">
            Manage FAQ
          </a>
          <a href="/api/admin/email-preview?type=invite" target="_blank" rel="noreferrer" className="btn-secondary">
            Preview vendor emails
          </a>
          <a href="/api/admin/export?format=xlsx" className="btn-primary px-5 py-2 text-sm">
            Download Excel (.xlsx)
          </a>
          <a href="/api/admin/export?format=csv" className="btn-secondary">
            Download CSV
          </a>
        </div>
      </div>
      <p className="mt-3 text-sm text-muted">
        For Google Sheets, download the Excel file, then in Google Drive choose New, File upload, and open it with
        Google Sheets.
      </p>
      <Suspense fallback={<p className="mt-8 text-muted">Loading applications...</p>}>
        <ApplicationList searchParams={searchParams as Promise<Filters>} />
      </Suspense>
    </main>
  );
}

async function ApplicationList({ searchParams }: { searchParams: Promise<Filters> }) {
  await connection();
  const filters = await searchParams;
  const all = await listApplications();

  if (all.length === 0) {
    return <p className="mt-8 rounded-xl border border-line bg-panel px-4 py-6 text-muted">No applications yet.</p>;
  }

  const apps = all.filter(
    (a) =>
      (!filters.status || a.status === filters.status) &&
      (!filters.date || (a.assignedDates ?? []).includes(filters.date)) &&
      (!filters.category || a.marketCategory === filters.category) &&
      matchesPaymentFilter(a, filters.payment ?? ""),
  );
  const back = new URLSearchParams(
    Object.entries({
      status: filters.status,
      date: filters.date,
      category: filters.category,
      payment: filters.payment,
    }).filter((e): e is [string, string] => !!e[1]),
  ).toString();

  return (
    <>
      <SavedNotice saved={filters.saved} />
      <ScrollToCard />
      <PaymentsSetupNotice />
      <AcceptedCounts apps={all} />
      <FilterBar filters={filters} />
      <BulkInviteBar back={back} returnTo="/admin" />
      <div className="mt-6 flex items-center justify-between gap-4">
        <p className="text-sm font-medium text-muted">
          {apps.length === all.length ? all.length : `${apps.length} of ${all.length}`} application
          {all.length === 1 ? "" : "s"}
        </p>
        <ExpandAll />
      </div>
      <ul className="mt-3 space-y-3">
        {apps.map((a) => (
          <VendorCard
            key={a.id}
            app={a}
            back={back}
            returnTo="/admin"
            anchor={`app-${a.id}`}
            open={filters.open === `app-${a.id}`}
          />
        ))}
      </ul>
    </>
  );
}

function AcceptedCounts({ apps }: { apps: StoredApplication[] }) {
  const accepted = apps.filter((a) => a.status === "accepted");
  const onDate = (id: string) => accepted.filter((a) => (a.assignedDates ?? []).includes(id)).length;
  const inCategory = (c: string) => accepted.filter((a) => a.marketCategory === c).length;
  const tile = "rounded-xl border border-line bg-panel px-4 py-3";

  return (
    <section className="mt-8 grid gap-3 sm:grid-cols-[auto_1fr_1fr_auto]">
      <div className={`${tile} text-center`}>
        <p className="text-xs font-medium uppercase tracking-wide text-muted">Accepted vendors</p>
        <p className="display mt-1 text-4xl text-orange">{accepted.length}</p>
      </div>
      <div className={tile}>
        <p className="text-xs font-medium uppercase tracking-wide text-muted">Accepted by market date</p>
        <ul className="mt-2 space-y-1 text-sm">
          {ALL_DATES.map((d) => (
            <li key={d.id} className="flex justify-between gap-4">
              <span className="text-cream">{d.short}</span>
              <span className="font-semibold text-gold">{onDate(d.id)}</span>
            </li>
          ))}
        </ul>
      </div>
      <div className={tile}>
        <p className="text-xs font-medium uppercase tracking-wide text-muted">Accepted by category</p>
        <ul className="mt-2 space-y-1 text-sm">
          {MARKET_CATEGORIES.map((c) => (
            <li key={c} className="flex justify-between gap-4">
              <span className="text-cream">{c}</span>
              <span className="font-semibold text-gold">{inCategory(c)}</span>
            </li>
          ))}
        </ul>
      </div>
      <FeesTile apps={apps} />
    </section>
  );
}

function FilterBar({ filters }: { filters: Filters }) {
  return (
    <form method="get" action="/admin" className="mt-6 flex flex-wrap items-end gap-3">
      <label className="block">
        <span className="field-label">Status</span>
        <select name="status" defaultValue={filters.status ?? ""} className="field-input">
          <option value="">All</option>
          {Object.entries(STATUS_LABELS).map(([v, l]) => (
            <option key={v} value={v}>
              {l}
            </option>
          ))}
        </select>
      </label>
      <label className="block">
        <span className="field-label">Market date</span>
        <select name="date" defaultValue={filters.date ?? ""} className="field-input">
          <option value="">All</option>
          {ALL_DATES.map((d) => (
            <option key={d.id} value={d.id}>
              {d.short}
            </option>
          ))}
        </select>
      </label>
      <label className="block">
        <span className="field-label">Category</span>
        <select name="category" defaultValue={filters.category ?? ""} className="field-input">
          <option value="">All</option>
          {MARKET_CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </label>
      <label className="block">
        <span className="field-label">Payment</span>
        <select name="payment" defaultValue={filters.payment ?? ""} className="field-input">
          {PAYMENT_FILTERS.map(([v, l]) => (
            <option key={v} value={v}>
              {l}
            </option>
          ))}
        </select>
      </label>
      <button type="submit" className="btn-secondary">
        Filter
      </button>
      {(filters.status || filters.date || filters.category || filters.payment) && (
        <a href="/admin" className="pb-2 text-sm text-muted underline">
          Clear
        </a>
      )}
    </form>
  );
}
