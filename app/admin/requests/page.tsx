import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { events } from "@/lib/events";
import { STATUS_LABELS } from "@/lib/selection";
import { listApplications, type StoredApplication } from "@/lib/store";

export const metadata = { title: "Requested dates | Harlem Night Market admin" };

const ALL_DATES = events.flatMap((e) => e.dates);
const RANKS = ["1st choice", "2nd choice", "3rd choice"];

// 0 for first choice, 1 for second, 2 for third, -1 if the vendor didn't pick this date.
const choiceRank = (a: StoredApplication, dateId: string) => [a.firstChoice, a.secondChoice, a.thirdChoice].indexOf(dateId);

export default function RequestsPage() {
  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6">
      <p className="text-xs font-extrabold uppercase tracking-[0.3em] text-gold">Harlem Night Market admin</p>
      <div className="mt-2 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <h1 className="display text-4xl text-orange">Requested dates</h1>
        <Link href="/admin" className="text-sm text-muted underline">
          ← Back to applications
        </Link>
      </div>
      <p className="mt-3 text-sm text-muted">
        Every applicant who picked each market date as one of their choices, first choices on top. This is what vendors
        asked for, not what you assigned; see Vendors by market for that.
      </p>
      <Suspense fallback={<p className="mt-8 text-muted">Loading...</p>}>
        <Requests />
      </Suspense>
    </main>
  );
}

async function Requests() {
  await connection();
  const apps = await listApplications();

  return (
    <div className="mt-8 space-y-8">
      {ALL_DATES.map((d) => {
        const vendors = apps
          .filter((a) => choiceRank(a, d.id) >= 0)
          .sort((x, y) => choiceRank(x, d.id) - choiceRank(y, d.id) || x.businessName.localeCompare(y.businessName));
        const firsts = vendors.filter((a) => choiceRank(a, d.id) === 0).length;
        return (
          <section key={d.id} id={d.id} className="scroll-mt-4 rounded-2xl border border-line bg-panel p-5">
            <h2 className="display text-2xl text-teal">
              {d.label}{" "}
              <span className="text-base text-muted">
                · {vendors.length} requested · {firsts} as 1st choice
              </span>
            </h2>
            {vendors.length === 0 ? (
              <p className="mt-4 text-sm text-muted">No applicants picked this date yet.</p>
            ) : (
              <div className="mt-4 overflow-x-auto">
                <table className="w-full min-w-[40rem] text-left text-sm">
                  <thead className="text-xs uppercase tracking-wide text-muted">
                    <tr>
                      <th className="py-1 pr-4 font-medium">Priority</th>
                      <th className="py-1 pr-4 font-medium">Business</th>
                      <th className="py-1 pr-4 font-medium">Contact</th>
                      <th className="py-1 pr-4 font-medium">Categories</th>
                      <th className="py-1 font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line text-cream">
                    {vendors.map((a) => {
                      const rank = choiceRank(a, d.id);
                      return (
                        <tr key={a.id}>
                          <td className="py-1.5 pr-4">
                            <span
                              className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                                rank === 0 ? "bg-gold/20 text-gold" : "bg-line text-muted"
                              }`}
                            >
                              {rank === 0 && "★ "}
                              {RANKS[rank]}
                            </span>
                          </td>
                          <td className="py-1.5 pr-4 font-semibold">
                            <a className="underline" href={`/admin?open=${a.id}#app-${a.id}`}>
                              {a.businessName}
                            </a>
                          </td>
                          <td className="py-1.5 pr-4">{a.contactName}</td>
                          <td className="py-1.5 pr-4 text-muted">{a.categories.join(", ")}</td>
                          <td className="py-1.5">
                            <span
                              className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                                a.status === "accepted"
                                  ? "bg-teal/20 text-teal"
                                  : a.status === "rejected"
                                    ? "bg-pink/20 text-pink"
                                    : "bg-line text-muted"
                              }`}
                            >
                              {STATUS_LABELS[a.status] ?? a.status}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
}
