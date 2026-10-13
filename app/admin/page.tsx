import { connection } from "next/server";
import { Suspense } from "react";
import { dateLabel, getEvent } from "@/lib/events";
import { isFoodVendor, UPLOAD_FIELDS } from "@/lib/schema";
import { listApplications } from "@/lib/store";

export const metadata = { title: "Vendor applications | Harlem Night Market" };

export default function AdminPage() {
  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-extrabold uppercase tracking-[0.3em] text-gold">Harlem Night Market admin</p>
          <h1 className="mt-2 display text-4xl text-orange">Vendor applications</h1>
        </div>
        <div className="flex flex-wrap gap-2">
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
        <ApplicationList />
      </Suspense>
    </main>
  );
}

async function ApplicationList() {
  await connection();
  const apps = await listApplications();

  if (apps.length === 0) {
    return <p className="mt-8 rounded-xl border border-line bg-panel px-4 py-6 text-muted">No applications yet.</p>;
  }

  return (
    <>
      <p className="mt-8 text-sm font-medium text-muted">
        {apps.length} application{apps.length === 1 ? "" : "s"}
      </p>
      <ul className="mt-3 space-y-3">
        {apps.map((a) => {
          const event = getEvent(a.eventSlug);
          const prefs = [a.firstChoice, a.secondChoice, a.thirdChoice].filter(Boolean).map((d) => dateLabel(event, d));
          return (
            <li key={a.id} className="rounded-xl border border-line bg-panel">
              <details>
                <summary className="flex cursor-pointer list-none flex-col gap-1 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                  <span>
                    <span className="font-semibold text-cream">{a.businessName}</span>
                    <span className="text-muted"> · {a.contactName}</span>
                    {isFoodVendor(a.categories) && (
                      <span className="ml-2 rounded-full bg-orange/20 px-2 py-0.5 text-xs font-medium text-orange">Food</span>
                    )}
                  </span>
                  <span className="text-sm text-muted">
                    {a.categories.join(", ")} · {new Date(a.submittedAt).toLocaleDateString("en-US", { timeZone: "America/New_York" })}
                  </span>
                </summary>
                <dl className="grid gap-x-6 gap-y-2 border-t border-line px-4 py-4 text-sm sm:grid-cols-2">
                  <Row label="Email" value={<a className="underline" href={`mailto:${a.email}`}>{a.email}</a>} />
                  <Row label="Phone" value={a.phone} />
                  <Row label="Instagram" value={a.instagram} />
                  <Row label="Website" value={a.website} />
                  <Row label="Other category" value={a.otherCategory} />
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
