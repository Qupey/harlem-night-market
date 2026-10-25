import { connection } from "next/server";
import { Suspense } from "react";
import { dateLabel, events, getEvent } from "@/lib/events";
import { isFoodVendor, UPLOAD_FIELDS } from "@/lib/schema";
import { MARKET_CATEGORIES, STATUS_CHOICES, STATUS_LABELS } from "@/lib/selection";
import { listApplications, type StoredApplication } from "@/lib/store";
import { saveSelectionAction } from "./actions";

type Filters = { status?: string; date?: string; category?: string; saved?: string };

const ALL_DATES = events.flatMap((e) => e.dates);
const shortDate = (id: string) => ALL_DATES.find((d) => d.id === id)?.short ?? id;

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
          <a href="/admin/faq" className="btn-secondary">
            Manage FAQ
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
        For Google Sheets, download the Excel file, then in Google Drive choose New, File upload, and open it with Google
        Sheets.
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
      (!filters.category || a.marketCategory === filters.category),
  );
  const back = new URLSearchParams(
    Object.entries({ status: filters.status, date: filters.date, category: filters.category }).filter(
      (e): e is [string, string] => !!e[1],
    ),
  ).toString();

  return (
    <>
      <SavedNotice saved={filters.saved} />
      <AcceptedCounts apps={all} />
      <FilterBar filters={filters} />
      <p className="mt-6 text-sm font-medium text-muted">
        {apps.length === all.length ? all.length : `${apps.length} of ${all.length}`} application{all.length === 1 ? "" : "s"}
      </p>
      <ul className="mt-3 space-y-3">
        {apps.map((a) => {
          const event = getEvent(a.eventSlug);
          const prefs = [a.firstChoice, a.secondChoice, a.thirdChoice].filter(Boolean).map((d) => dateLabel(event, d));
          return (
            <li key={a.id} id={`app-${a.id}`} className="scroll-mt-4 rounded-xl border border-line bg-panel">
              <details>
                <summary className="flex cursor-pointer list-none flex-col gap-1 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                  <span>
                    <span className="font-semibold text-cream">{a.businessName}</span>
                    <span className="text-muted"> · {a.contactName}</span>
                    {isFoodVendor(a.categories) && (
                      <span className="ml-2 rounded-full bg-orange/20 px-2 py-0.5 text-xs font-medium text-orange">Food</span>
                    )}
                    <StatusBadge status={a.status} />
                    {a.status === "accepted" && (a.marketCategory || (a.assignedDates ?? []).length > 0) && (
                      <span className="ml-2 text-xs text-teal">
                        {[a.marketCategory, (a.assignedDates ?? []).map(shortDate).join(", ")].filter(Boolean).join(" · ")}
                      </span>
                    )}
                  </span>
                  <span className="text-sm text-muted">
                    {a.categories.join(", ")} · {new Date(a.submittedAt).toLocaleDateString("en-US", { timeZone: "America/New_York" })}
                  </span>
                </summary>
                <SelectionForm app={a} back={back} />
                <dl className="grid gap-x-6 gap-y-2 border-t border-line px-4 py-4 text-sm sm:grid-cols-2">
                  <Row label="Email" value={<a className="underline" href={`mailto:${a.email}`}>{a.email}</a>} />
                  <Row label="Phone" value={a.phone} />
                  <Row label="Instagram" value={a.instagram} />
                  <Row label="Website" value={a.website} />
                  <Row label="Other category" value={a.otherCategory} />
                  <Row label="Additional details" wide value={a.productDetails && <span className="whitespace-pre-line">{a.productDetails}</span>} />
                  <Row label="Preferred dates" value={prefs.join(" → ")} />
                  <Row label="Availability notes" value={a.availabilityNotes} />
                  <Row
                    label="Electricity"
                    value={a.needsElectricity === "yes" ? `Yes${a.electricityDetails ? ` · ${a.electricityDetails}` : ""}` : "No"}
                  />
                  <Row label="Setup notes" value={a.setupNotes} />
                  {isFoodVendor(a.categories) && (
                    <>
                      <Row label="Food types" value={a.foodTypes.join(", ") + (a.otherFoodType ? ` (${a.otherFoodType})` : "")} />
                      <Row
                        label="Food handler license"
                        value={[a.foodHandlerLicense?.replace("_", " "), a.licenseNumber, a.licenseExpiration && `exp. ${a.licenseExpiration}`]
                          .filter(Boolean)
                          .join(" · ")}
                      />
                      <Row
                        label="Menu"
                        wide
                        value={
                          <ul className="list-disc pl-5">
                            {a.menuItems.map((m, i) => (
                              <li key={i}>
                                {m.name}
                                {m.price && ` ($${m.price.replace(/^\$/, "")})`}
                                {m.description && ` · ${m.description}`}
                                {m.dietaryTags.length > 0 && ` · ${m.dietaryTags.join(", ")}`}
                              </li>
                            ))}
                          </ul>
                        }
                      />
                    </>
                  )}
                  {a.files.length > 0 && (
                    <Row
                      label="Uploads"
                      wide
                      value={
                        <ul className="space-y-1">
                          {a.files.map((f) => (
                            <li key={f.fileName}>
                              <span className="text-muted">{UPLOAD_FIELDS[f.field].label}: </span>
                              <a
                                className="underline"
                                href={`/api/admin/files/${a.id}/${encodeURIComponent(f.fileName)}`}
                                target="_blank"
                                rel="noreferrer"
                              >
                                {f.originalName}
                              </a>
                            </li>
                          ))}
                        </ul>
                      }
                    />
                  )}
                </dl>
              </details>
            </li>
          );
        })}
      </ul>
    </>
  );
}

function Row({ label, value, wide }: { label: string; value: React.ReactNode; wide?: boolean }) {
  if (value === undefined || value === null || value === "") return null;
  return (
    <div className={wide ? "sm:col-span-2" : undefined}>
      <dt className="text-xs font-medium uppercase tracking-wide text-muted">{label}</dt>
      <dd className="mt-0.5 text-cream">{value}</dd>
    </div>
  );
}

function SavedNotice({ saved }: { saved?: string }) {
  if (saved === "status-only") {
    return (
      <p className="mt-6 rounded-lg border border-pink bg-pink/10 px-4 py-3 text-sm text-cream">
        Status saved, but market dates and category were not: run supabase/add-vendor-selection.sql in the Supabase SQL
        Editor first, then save again.
      </p>
    );
  }
  if (saved) return <p className="mt-6 rounded-lg bg-teal/15 px-4 py-3 text-sm text-cream">Saved.</p>;
  return null;
}

function AcceptedCounts({ apps }: { apps: StoredApplication[] }) {
  const accepted = apps.filter((a) => a.status === "accepted");
  const onDate = (id: string) => accepted.filter((a) => (a.assignedDates ?? []).includes(id)).length;
  const inCategory = (c: string) => accepted.filter((a) => a.marketCategory === c).length;
  const tile = "rounded-xl border border-line bg-panel px-4 py-3";

  return (
    <section className="mt-8 grid gap-3 sm:grid-cols-[auto_1fr_1fr]">
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
      <button type="submit" className="btn-secondary">
        Filter
      </button>
      {(filters.status || filters.date || filters.category) && (
        <a href="/admin" className="pb-2 text-sm text-muted underline">
          Clear
        </a>
      )}
    </form>
  );
}

function StatusBadge({ status }: { status: StoredApplication["status"] }) {
  const color =
    status === "accepted" ? "bg-teal/20 text-teal" : status === "rejected" ? "bg-pink/20 text-pink" : "bg-line text-muted";
  return <span className={`ml-2 rounded-full px-2 py-0.5 text-xs font-medium ${color}`}>{STATUS_LABELS[status] ?? status}</span>;
}

function SelectionForm({ app, back }: { app: StoredApplication; back: string }) {
  const dates = getEvent(app.eventSlug)?.dates ?? [];
  const statuses: StoredApplication["status"][] = STATUS_CHOICES.includes(app.status as (typeof STATUS_CHOICES)[number])
    ? [...STATUS_CHOICES]
    : [app.status, ...STATUS_CHOICES];

  return (
    <form action={saveSelectionAction} className="flex flex-wrap items-end gap-x-6 gap-y-3 border-t border-line bg-navy-deep/30 px-4 py-4 text-sm">
      <input type="hidden" name="id" value={app.id} />
      <input type="hidden" name="back" value={back} />
      <label className="block">
        <span className="field-label">Status</span>
        <select name="status" defaultValue={app.status} className="field-input">
          {statuses.map((s) => (
            <option key={s} value={s}>
              {STATUS_LABELS[s]}
            </option>
          ))}
        </select>
      </label>
      <fieldset>
        <legend className="field-label">Market dates (if accepted)</legend>
        <div className="mt-1 flex flex-wrap gap-3">
          {dates.map((d) => (
            <label key={d.id} className="flex items-center gap-1.5 text-cream">
              <input type="checkbox" name="assignedDates" value={d.id} defaultChecked={(app.assignedDates ?? []).includes(d.id)} />
              {d.short}
            </label>
          ))}
        </div>
      </fieldset>
      <label className="block">
        <span className="field-label">Market category</span>
        <select name="marketCategory" defaultValue={app.marketCategory ?? ""} className="field-input">
          <option value="">Not set</option>
          {MARKET_CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </label>
      <button type="submit" className="btn-primary px-5 py-2 text-sm">
        Save
      </button>
    </form>
  );
}
