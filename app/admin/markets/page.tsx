import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { events } from "@/lib/events";
import { vendorsForDate } from "@/lib/export";
import { MARKET_CATEGORIES } from "@/lib/selection";
import { listApplications } from "@/lib/store";

export const metadata = { title: "Markets | Harlem Night Market admin" };

const ALL_DATES = events.flatMap((e) => e.dates);

export default function MarketsPage() {
  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6">
      <p className="text-xs font-extrabold uppercase tracking-[0.3em] text-gold">Harlem Night Market admin</p>
      <div className="mt-2 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <h1 className="display text-4xl text-orange">Vendors by market</h1>
        <div className="flex flex-wrap items-center gap-3">
          <a href="/api/admin/market-export?format=xlsx" className="btn-primary px-5 py-2 text-sm">
            All markets (.xlsx)
          </a>
          <Link href="/admin" className="text-sm text-muted underline">
            ← Back to applications
          </Link>
        </div>
      </div>
      <p className="mt-3 text-sm text-muted">
        Accepted vendors assigned to each market date, by category. Assign dates and categories on the applications page.
        The all-markets Excel file has one sheet per date.
      </p>
      <Suspense fallback={<p className="mt-8 text-muted">Loading...</p>}>
        <Markets />
      </Suspense>
    </main>
  );
}

async function Markets() {
  await connection();
  const apps = await listApplications();

  return (
    <div className="mt-8 space-y-8">
      {ALL_DATES.map((d) => {
        const vendors = vendorsForDate(apps, d.id);
        const groups = [...MARKET_CATEGORIES, ""]
          .map((c) => ({ category: c || "No category", vendors: vendors.filter((a) => (a.marketCategory ?? "") === c) }))
          .filter((g) => g.vendors.length > 0);
        return (
          <section key={d.id} className="rounded-2xl border border-line bg-panel p-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <h2 className="display text-2xl text-teal">
                {d.label} <span className="text-base text-muted">· {vendors.length} vendor{vendors.length === 1 ? "" : "s"}</span>
              </h2>
              <div className="flex gap-2">
                <a href={`/api/admin/market-export?date=${d.id}&format=xlsx`} className="btn-secondary">
                  Excel (.xlsx)
                </a>
                <a href={`/api/admin/market-export?date=${d.id}&format=csv`} className="btn-secondary">
                  CSV
                </a>
              </div>
            </div>
            {groups.length === 0 && <p className="mt-4 text-sm text-muted">No accepted vendors assigned to this date yet.</p>}
            {groups.map((g) => (
              <div key={g.category} className="mt-5">
                <h3 className="font-semibold text-orange">
                  {g.category} <span className="text-sm font-normal text-muted">({g.vendors.length})</span>
                </h3>
                <div className="mt-2 overflow-x-auto">
                  <table className="w-full min-w-[36rem] text-left text-sm">
                    <thead className="text-xs uppercase tracking-wide text-muted">
                      <tr>
                        <th className="py-1 pr-4 font-medium">Business</th>
                        <th className="py-1 pr-4 font-medium">Contact</th>
                        <th className="py-1 pr-4 font-medium">Email</th>
                        <th className="py-1 font-medium">Phone</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-line text-cream">
                      {g.vendors.map((a) => (
                        <tr key={a.id}>
                          <td className="py-1.5 pr-4 font-semibold">{a.businessName}</td>
                          <td className="py-1.5 pr-4">{a.contactName}</td>
                          <td className="py-1.5 pr-4">
                            <a className="underline" href={`mailto:${a.email}`}>
                              {a.email}
                            </a>
                          </td>
                          <td className="py-1.5">{a.phone}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </section>
        );
      })}
    </div>
  );
}
