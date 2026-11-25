import "server-only";
import { cacheLife } from "next/cache";
import { getEvent } from "./events";
import { coveredCents, feePerDateCents } from "./payments";
import { MARKET_CATEGORIES } from "./selection";
import { listApplications, type StoredApplication } from "./store";

// The public "Vendors at the market" list. Only these fields ever leave the server:
// no contact names, emails, phones, notes or payment details.
export type PublicVendor = {
  name: string;
  category: string; // one of MARKET_CATEGORIES, or "" when not set yet
  instagramUrl: string | null;
  instagramHandle: string | null;
  websiteUrl: string | null;
};

export type PublicMarketDate = { id: string; label: string; short: string; vendors: PublicVendor[] };

// The market dates a vendor has paid for and is still booked on.
// - Accepted and marked paid only; pending, declined, waitlisted and unpaid vendors never show.
// - A date dropped after payment is no longer in assignedDates, so it drops off here too.
// - A date added after payment isn't paid yet. If the amount covered pays for every booked
//   date they all count; otherwise only the dates on the invite they paid (invitedDates).
// - Payments recorded by hand without an amount trust the paid flag.
export function paidDates(a: StoredApplication): string[] {
  if (a.status !== "accepted" || !a.paid) return [];
  const booked = a.assignedDates ?? [];
  const fee = feePerDateCents(a);
  if (a.amountPaidCents == null || fee <= 0) return booked;
  if (coveredCents(a) >= fee * booked.length) return booked;
  return Array.isArray(a.invitedDates) ? booked.filter((d) => a.invitedDates!.includes(d)) : [];
}

function instagram(raw: string | undefined): { url: string; handle: string } | null {
  const v = raw?.trim();
  if (!v) return null;
  const fromUrl = v.match(/instagram\.com\/([A-Za-z0-9._]{1,30})/i);
  const handle = fromUrl ? fromUrl[1] : v.replace(/^@/, "");
  if (!/^[A-Za-z0-9._]{1,30}$/.test(handle)) return null;
  return { url: `https://www.instagram.com/${handle}/`, handle: `@${handle}` };
}

function website(raw: string | undefined): string | null {
  const v = raw?.trim();
  if (!v || /\s/.test(v)) return null;
  try {
    const url = new URL(/^https?:\/\//i.test(v) ? v : `https://${v}`);
    if (!/^https?:$/.test(url.protocol) || !url.hostname.includes(".")) return null;
    if (/(^|\.)instagram\.com$/i.test(url.hostname)) return null; // shown as Instagram instead
    return url.toString();
  } catch {
    return null;
  }
}

const CATEGORY_ORDER: string[] = [...MARKET_CATEGORIES, ""];

// Booked on the board but not listed publicly (e.g. the organizers' own table). Lowercase business names.
const HIDDEN_FROM_PUBLIC = new Set(["tbo harlem"]);
const hidden = (a: StoredApplication) => HIDDEN_FROM_PUBLIC.has(a.businessName.trim().toLowerCase().replace(/\s+/g, " "));

// Cached for 5 minutes, so newly paid vendors show up without a deploy.
export async function getPublicVendorsByDate(eventSlug: string): Promise<PublicMarketDate[]> {
  "use cache";
  cacheLife({ stale: 300, revalidate: 300, expire: 3600 });

  const event = getEvent(eventSlug);
  if (!event) return [];
  const apps = await listApplications(eventSlug);

  return event.dates.map((d) => {
    const vendors = apps
      .filter((a) => !hidden(a) && paidDates(a).includes(d.id))
      .map((a): PublicVendor => {
        const ig = instagram(a.instagram) ?? (a.website ? instagram(a.website) : null);
        return {
          name: a.businessName.trim(),
          category: a.marketCategory && CATEGORY_ORDER.includes(a.marketCategory) ? a.marketCategory : "",
          instagramUrl: ig?.url ?? null,
          instagramHandle: ig?.handle ?? null,
          websiteUrl: website(a.website),
        };
      })
      .sort(
        (x, y) =>
          CATEGORY_ORDER.indexOf(x.category) - CATEGORY_ORDER.indexOf(y.category) ||
          x.name.localeCompare(y.name, "en", { sensitivity: "base" }),
      );
    return { id: d.id, label: d.label, short: d.short, vendors };
  });
}
