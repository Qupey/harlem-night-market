import { dateLabel, events, getEvent } from "@/lib/events";
import { isFoodVendor, UPLOAD_FIELDS } from "@/lib/schema";
import { MARKET_CATEGORIES, STATUS_CHOICES, STATUS_LABELS } from "@/lib/selection";
import type { StoredApplication } from "@/lib/store";
import { saveSelectionAction, toggleStarAction } from "./actions";

// An expandable applicant card with the status / dates / category form, shared by /admin and /admin/requests.

const ALL_DATES = events.flatMap((e) => e.dates);
const shortDate = (id: string) => ALL_DATES.find((d) => d.id === id)?.short ?? id;

type CardProps = {
  app: StoredApplication;
  back: string; // query string to restore after saving
  returnTo: "/admin" | "/admin/requests";
  anchor: string; // element id, unique on the page
  open?: boolean;
  badge?: React.ReactNode; // extra badge before the status
  forDate?: string; // on a per-date list, only a booking for this date counts
};

export function VendorCard({ app: a, back, returnTo, anchor, open, badge, forDate }: CardProps) {
  const dates = a.assignedDates ?? [];
  const booked = forDate ? dates.includes(forDate) : dates.length > 0;
  // Booked for a market date: solid teal row. Accepted but not booked here: gold outline. Declined: faded.
  const needsDate = !booked && (a.status === "accepted" || dates.length > 0);
  const tone = booked
    ? "border-2 border-teal bg-panel shadow-lg shadow-teal/30"
    : needsDate
      ? "border-2 border-gold bg-panel"
      : a.status === "rejected"
        ? "border-line bg-panel opacity-45"
        : "border-line bg-panel";
  // On the teal row, every piece of text, badge and the arrow turns navy so it stays readable.
  const summaryTone = booked
    ? "bg-teal group-open:rounded-b-none [&_*]:!border-navy/50 [&_*]:!text-navy [&_.rounded-full]:!bg-navy/10"
    : "hover:bg-navy-deep/30";
  const event = getEvent(a.eventSlug);
  const prefs = [a.firstChoice, a.secondChoice, a.thirdChoice].filter(Boolean).map((d) => dateLabel(event, d));
  return (
    <li id={anchor} className={`scroll-mt-4 rounded-xl border ${tone}`}>
      {/* The star button sits in the summary row; its form lives out here because forms can't go inside <summary>. */}
      <form id={`star-${anchor}`} action={toggleStarAction} className="hidden">
        <input type="hidden" name="id" value={a.id} />
        <input type="hidden" name="starred" value={a.starred ? "0" : "1"} />
        <input type="hidden" name="back" value={back} />
        <input type="hidden" name="returnTo" value={returnTo} />
        <input type="hidden" name="anchor" value={anchor} />
      </form>
      <details data-app className="group" open={open}>
        <summary
          className={`flex cursor-pointer list-none items-start gap-3 rounded-[10px] px-4 py-3 [&::-webkit-details-marker]:hidden ${summaryTone}`}
        >
          <button
            type="submit"
            form={`star-${anchor}`}
            title={a.starred ? "Starred for consideration (click to remove)" : "Star for consideration"}
            aria-label={a.starred ? `Remove star from ${a.businessName}` : `Star ${a.businessName} for consideration`}
            aria-pressed={!!a.starred}
            className={`-ml-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xl leading-none hover:scale-110 ${
              a.starred ? "text-gold" : "text-muted/60 hover:text-gold"
            }`}
          >
            {a.starred ? "★" : "☆"}
          </button>
          <span className="flex min-w-0 flex-1 flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
            <span>
              <span className={`font-semibold text-cream ${booked ? "text-lg font-extrabold" : ""}`}>
                {a.businessName}
              </span>
              <span className="text-muted"> · {a.contactName}</span>
              {isFoodVendor(a.categories) && (
                <span className="ml-2 rounded-full bg-orange/20 px-2 py-0.5 text-xs font-medium text-orange">Food</span>
              )}
              {badge}
              <StatusBadge status={a.status} />
              <AssignmentChips app={a} />
            </span>
            <span className="text-sm text-muted">
              {a.categories.join(", ")} ·{" "}
              {new Date(a.submittedAt).toLocaleDateString("en-US", {
                timeZone: "America/New_York",
              })}
            </span>
          </span>
          {booked && (
            <span className="shrink-0 rounded-lg border-2 bg-cream px-3 py-1 text-sm font-extrabold uppercase tracking-wider">
              ✓ Booked · {dates.map(shortDate).join(", ")}
            </span>
          )}
          {needsDate && (
            <span className="shrink-0 rounded-lg bg-gold px-3 py-1 text-sm font-extrabold uppercase tracking-wider text-navy-deep">
              {dates.length > 0 ? `Booked other date · ${dates.map(shortDate).join(", ")}` : "Accepted · Needs date"}
            </span>
          )}
          <span className="shrink-0 pt-1 text-xs font-medium text-teal underline">
            <span className="group-open:hidden">Expand</span>
            <span className="hidden group-open:inline">Collapse</span>
          </span>
        </summary>
        <SelectionForm app={a} back={back} returnTo={returnTo} anchor={anchor} />
        <dl className="grid gap-x-6 gap-y-2 border-t border-line px-4 py-4 text-sm sm:grid-cols-2">
          <Row
            label="Email"
            value={
              <a className="underline" href={`mailto:${a.email}`}>
                {a.email}
              </a>
            }
          />
          <Row label="Phone" value={a.phone} />
          <Row label="Instagram" value={a.instagram} />
          <Row label="Website" value={a.website} />
          <Row label="Other category" value={a.otherCategory} />
          <Row
            label="Additional details"
            wide
            value={a.productDetails && <span className="whitespace-pre-line">{a.productDetails}</span>}
          />
          <Row label="Preferred dates" value={prefs.join(" → ")} />
          <Row label="Availability notes" value={a.availabilityNotes} />
          <Row
            label="Electricity"
            value={
              a.needsElectricity === "yes" ? `Yes${a.electricityDetails ? ` · ${a.electricityDetails}` : ""}` : "No"
            }
          />
          <Row label="Setup notes" value={a.setupNotes} />
          {isFoodVendor(a.categories) && (
            <>
              <Row
                label="Food types"
                value={a.foodTypes.join(", ") + (a.otherFoodType ? ` (${a.otherFoodType})` : "")}
              />
              <Row
                label="Food handler license"
                value={[
                  a.foodHandlerLicense?.replace("_", " "),
                  a.licenseNumber,
                  a.licenseExpiration && `exp. ${a.licenseExpiration}`,
                ]
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

export function SavedNotice({ saved }: { saved?: string }) {
  if (saved === "status-only") {
    return (
      <p className="mt-6 rounded-lg border border-pink bg-pink/10 px-4 py-3 text-sm text-cream">
        Status saved, but market dates and category were not: run supabase/add-vendor-selection.sql in the Supabase SQL
        Editor first, then save again.
      </p>
    );
  }
  if (saved === "star-missing") {
    return (
      <p className="mt-6 rounded-lg border border-pink bg-pink/10 px-4 py-3 text-sm text-cream">
        Star not saved: run supabase/add-vendor-star.sql in the Supabase SQL Editor first, then try again.
      </p>
    );
  }
  if (saved) return <p className="mt-6 rounded-lg bg-teal/15 px-4 py-3 text-sm text-cream">Saved.</p>;
  return null;
}

export function StatusBadge({ status }: { status: StoredApplication["status"] }) {
  const color =
    status === "accepted"
      ? "bg-teal/20 text-teal"
      : status === "rejected"
        ? "bg-pink/20 text-pink"
        : "bg-line text-muted";
  return (
    <span className={`ml-2 rounded-full px-2 py-0.5 text-xs font-medium ${color}`}>
      {status === "accepted" && "✓ "}
      {status === "rejected" && "✕ "}
      {STATUS_LABELS[status] ?? status}
    </span>
  );
}

// Shown on the collapsed row: market dates (for accepted vendors) and category.
function AssignmentChips({ app }: { app: StoredApplication }) {
  const dates = app.assignedDates ?? [];
  const chip = "ml-1.5 rounded-full px-2 py-0.5 text-xs font-medium";
  return (
    <>
      {app.status !== "accepted" && dates.length === 0 ? null : dates.length === 0 ? (
        <span className={`${chip} border border-dashed border-line text-muted`}>No dates yet</span>
      ) : (
        dates.map((d) => (
          <span key={d} className={`${chip} bg-gold/20 text-gold`}>
            {shortDate(d)}
          </span>
        ))
      )}
      {app.marketCategory && <span className={`${chip} bg-orange/20 text-orange`}>{app.marketCategory}</span>}
    </>
  );
}

function SelectionForm({
  app,
  back,
  returnTo,
  anchor,
}: {
  app: StoredApplication;
  back: string;
  returnTo: string;
  anchor: string;
}) {
  const dates = getEvent(app.eventSlug)?.dates ?? [];
  const statuses: StoredApplication["status"][] = STATUS_CHOICES.includes(app.status as (typeof STATUS_CHOICES)[number])
    ? [...STATUS_CHOICES]
    : [app.status, ...STATUS_CHOICES];

  return (
    <form
      action={saveSelectionAction}
      className="flex flex-wrap items-end gap-x-6 gap-y-3 border-t border-line bg-navy-deep/30 px-4 py-4 text-sm"
    >
      <input type="hidden" name="id" value={app.id} />
      <input type="hidden" name="back" value={back} />
      <input type="hidden" name="returnTo" value={returnTo} />
      <input type="hidden" name="anchor" value={anchor} />
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
        <legend className="field-label">Market dates (optional)</legend>
        <div className="mt-1 flex flex-wrap gap-3">
          {dates.map((d) => (
            <label key={d.id} className="flex items-center gap-1.5 text-cream">
              <input
                type="checkbox"
                name="assignedDates"
                value={d.id}
                defaultChecked={(app.assignedDates ?? []).includes(d.id)}
              />
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
