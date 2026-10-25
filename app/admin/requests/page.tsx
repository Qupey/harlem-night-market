import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { events } from "@/lib/events";
import { listApplications, type StoredApplication } from "@/lib/store";
import { ExpandAll } from "../ExpandAll";
import { SavedNotice, VendorCard } from "../VendorCard";

export const metadata = { title: "Requested dates | Harlem Night Market admin" };

type Params = { saved?: string; open?: string };

const ALL_DATES = events.flatMap((e) => e.dates);
const RANKS = ["1st choice", "2nd choice", "3rd choice"];

// 0 for first choice, 1 for second, 2 for third, -1 if the vendor didn't pick this date.
const choiceRank = (a: StoredApplication, dateId: string) =>
  [a.firstChoice, a.secondChoice, a.thirdChoice].indexOf(dateId);

export default function RequestsPage({ searchParams }: PageProps<"/admin/requests">) {
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
        Every applicant who picked each market date as one of their choices, first choices on top. Open a vendor to see
        their details and set their status, market dates and category.
      </p>
      <Suspense fallback={<p className="mt-8 text-muted">Loading...</p>}>
        <Requests searchParams={searchParams as Promise<Params>} />
      </Suspense>
    </main>
  );
}

async function Requests({ searchParams }: { searchParams: Promise<Params> }) {
  await connection();
  const params = await searchParams;
  const apps = await listApplications();

  return (
    <>
      <SavedNotice saved={params.saved} />
      <div className="mt-6 flex justify-end">
        <ExpandAll />
      </div>
      <div className="mt-3 space-y-8">
        {ALL_DATES.map((d) => {
          const vendors = apps
            .filter((a) => choiceRank(a, d.id) >= 0)
            .sort((x, y) => choiceRank(x, d.id) - choiceRank(y, d.id) || x.businessName.localeCompare(y.businessName));
          const firsts = vendors.filter((a) => choiceRank(a, d.id) === 0).length;
          return (
            <section key={d.id} id={d.id} className="scroll-mt-4 rounded-2xl border border-line bg-navy-deep/20 p-5">
              <h2 className="display text-2xl text-teal">
                {d.label}{" "}
                <span className="text-base text-muted">
                  · {vendors.length} requested · {firsts} as 1st choice
                </span>
              </h2>
              {vendors.length === 0 ? (
                <p className="mt-4 text-sm text-muted">No applicants picked this date yet.</p>
              ) : (
                <ul className="mt-4 space-y-3">
                  {vendors.map((a) => {
                    const rank = choiceRank(a, d.id);
                    const anchor = `${d.id}-app-${a.id}`;
                    return (
                      <VendorCard
                        key={a.id}
                        app={a}
                        back=""
                        returnTo="/admin/requests"
                        anchor={anchor}
                        open={params.open === anchor}
                        badge={
                          <span
                            className={`ml-2 rounded-full px-2 py-0.5 text-xs font-medium ${
                              rank === 0 ? "bg-gold/20 text-gold" : "bg-line text-muted"
                            }`}
                          >
                            {rank === 0 && "★ "}
                            {RANKS[rank]}
                          </span>
                        }
                      />
                    );
                  })}
                </ul>
              )}
            </section>
          );
        })}
      </div>
    </>
  );
}
