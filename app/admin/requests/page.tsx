import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { events } from "@/lib/events";
import { MARKET_CATEGORIES, STATUS_LABELS } from "@/lib/selection";
import { listApplications, type StoredApplication } from "@/lib/store";
import { ExpandAll } from "../ExpandAll";
import { ScrollToCard } from "../ScrollToCard";
import { SavedNotice, VendorCard } from "../VendorCard";
import { ParamSelect } from "./ParamSelect";

export const metadata = { title: "Requested dates | Harlem Night Market admin" };

type Params = { date?: string; status?: string; category?: string; saved?: string; open?: string };

const STATUS_OPTIONS = [
  ["", "All vendors"],
  ["pending", "Pending"],
  ["accepted", "Accepted"],
  ["rejected", "Declined"],
] as const;

const CATEGORY_OPTIONS = [["", "All categories"], ...MARKET_CATEGORIES.map((c) => [c, c] as const)] as const;

// Picked-on-the-application category → market category, for vendors not given one yet.
const APPLIED_TO_MARKET: Record<string, (typeof MARKET_CATEGORIES)[number]> = {
  "Hot food": "Hot Food",
  Dessert: "Sweets",
  "Packaged food": "Packaged Foods",
  Beverages: "Drinks",
};

// The assigned market category wins; otherwise every category the vendor picked
// (food ones mapped as above, anything non-food counts as Makers).
function marketCategoriesOf(a: StoredApplication): string[] {
  if (a.marketCategory) return [a.marketCategory];
  return a.categories.map((c) => APPLIED_TO_MARKET[c] ?? "Makers");
}

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
  const selected = ALL_DATES.find((d) => d.id === params.date);
  const status = ["pending", "accepted", "rejected"].includes(params.status ?? "") ? params.status! : "";
  const category = (MARKET_CATEGORIES as readonly string[]).includes(params.category ?? "") ? params.category! : "";
  const back = new URLSearchParams(
    Object.entries({ date: selected?.id, status, category }).filter((e): e is [string, string] => !!e[1]),
  ).toString();
  // Date tabs keep the chosen status and category.
  const tabHref = (date?: string) => {
    const qs = new URLSearchParams(Object.entries({ date, status, category }).filter((e): e is [string, string] => !!e[1]));
    return qs.size ? `/admin/requests?${qs}` : "/admin/requests";
  };
  const tab = "rounded-full px-4 py-1.5 text-sm font-medium";
  const tabClass = (active: boolean) =>
    `${tab} ${active ? "bg-orange text-navy-deep" : "border border-line text-cream hover:border-orange"}`;

  return (
    <>
      <SavedNotice saved={params.saved} />
      <ScrollToCard />
      <div className="mt-6 flex flex-wrap items-center justify-between gap-4">
        <nav className="flex flex-wrap gap-2" aria-label="Market date">
          <Link href={tabHref()} className={tabClass(!selected)} aria-current={!selected ? "page" : undefined}>
            All
          </Link>
          {ALL_DATES.map((d) => (
            <Link
              key={d.id}
              href={tabHref(d.id)}
              className={tabClass(selected?.id === d.id)}
              aria-current={selected?.id === d.id ? "page" : undefined}
            >
              {d.short}
            </Link>
          ))}
        </nav>
        <div className="flex flex-wrap items-center gap-4">
          <ParamSelect param="status" label="Show" value={status} options={STATUS_OPTIONS} />
          <ParamSelect
            param="category"
            label="Category"
            value={category}
            options={CATEGORY_OPTIONS}
          />
          <ExpandAll />
        </div>
      </div>
      <div className="mt-6 space-y-8">
        {(selected ? [selected] : ALL_DATES).map((d) => {
          const vendors = apps
            .filter((a) => choiceRank(a, d.id) >= 0 && (!status || a.status === status) && (!category || marketCategoriesOf(a).includes(category)))
            .sort((x, y) => choiceRank(x, d.id) - choiceRank(y, d.id) || x.businessName.localeCompare(y.businessName));
          const firsts = vendors.filter((a) => choiceRank(a, d.id) === 0).length;
          return (
            <section key={d.id} id={d.id} className="scroll-mt-4 rounded-2xl border border-line bg-navy-deep/20 p-5">
              <h2 className="display text-2xl text-teal">
                {d.label}{" "}
                <span className="text-base text-muted">
                  · {vendors.length} {status ? STATUS_LABELS[status as StoredApplication["status"]].toLowerCase() : "requested"} ·{" "}
                  {firsts} as 1st choice{category && ` · ${category}`}
                </span>
              </h2>
              {vendors.length === 0 ? (
                <p className="mt-4 text-sm text-muted">{status || category ? "No vendors match these filters for this date." : "No applicants picked this date yet."}</p>
              ) : (
                <ul className="mt-4 space-y-3">
                  {vendors.map((a) => {
                    const rank = choiceRank(a, d.id);
                    const anchor = `${d.id}-app-${a.id}`;
                    return (
                      <VendorCard
                        key={a.id}
                        app={a}
                        back={back}
                        returnTo="/admin/requests"
                        anchor={anchor}
                        open={params.open === anchor}
                        forDate={d.id}
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
