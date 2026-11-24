import "server-only";
import { events } from "./events";
import { MARKET_CATEGORIES } from "./selection";
import type { StoredApplication } from "./store";

// Who a message on /admin/broadcast goes to. Kept in the page's URL, and worked out again on
// the server when sending, so the list can't be changed from the browser.

export const AUDIENCES = {
  all: "All vendors",
  accepted: "Accepted",
  invited: "Invited, not yet paid",
  paid: "Paid",
  declined: "Declined",
} as const;

export type Audience = { who: keyof typeof AUDIENCES; date: string; category: string; declined: boolean };

const DATES = events.flatMap((e) => e.dates);

export function parseAudience(get: (key: string) => string | null | undefined): Audience {
  const who = get("who") ?? "";
  const date = get("date") ?? "";
  const category = get("category") ?? "";
  return {
    who: who in AUDIENCES ? (who as Audience["who"]) : "all",
    date: DATES.some((d) => d.id === date) ? date : "",
    category: (MARKET_CATEGORIES as readonly string[]).includes(category) ? category : "",
    declined: get("declined") === "1",
  };
}

export function describeAudience(a: Audience): string {
  return [
    AUDIENCES[a.who],
    a.date && DATES.find((d) => d.id === a.date)?.short,
    a.category,
    a.declined && a.who !== "declined" && "including declined",
  ]
    .filter(Boolean)
    .join(" · ");
}

function matches(app: StoredApplication, a: Audience): boolean {
  if (a.who === "declined") {
    if (app.status !== "rejected") return false;
  } else if (app.status === "rejected" && !a.declined) return false;
  if (a.who === "accepted" && app.status !== "accepted") return false;
  if (a.who === "invited" && !(app.invitedAt && !app.paid)) return false;
  if (a.who === "paid" && !app.paid) return false;
  if (a.date && !(app.assignedDates ?? []).includes(a.date)) return false;
  if (a.category && app.marketCategory !== a.category) return false;
  return true;
}

// One email per address (a vendor who applied twice gets it once), in business-name order.
export function recipientsFor(apps: StoredApplication[], a: Audience): StoredApplication[] {
  const seen = new Set<string>();
  return apps
    .filter((app) => matches(app, a))
    .filter((app) => {
      const email = app.email.trim().toLowerCase();
      if (!email || seen.has(email)) return false;
      seen.add(email);
      return true;
    })
    .sort((x, y) => x.businessName.localeCompare(y.businessName, "en", { sensitivity: "base" }));
}
