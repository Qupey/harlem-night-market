import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { BrandLockup, SiteFooter } from "@/components/Brand";
import { SiteNav } from "@/components/SiteNav";
import { defaultEventSlug, getEvent } from "@/lib/events";
import { getPublicVendorsByDate, type PublicVendor } from "@/lib/public-vendors";

export const metadata: Metadata = {
  title: "Vendors at the market | Harlem Night Market",
  description:
    "The makers, artists and food vendors selling at each Harlem Night Market: Saturdays Dec 5, 12 and 19 at the historic La Marqueta.",
  openGraph: {
    title: "Vendors at the Harlem Night Market",
    description: "See who's selling at each Saturday's market.",
    images: [{ url: "/photos/hnm-12.jpg", width: 1152, height: 768, alt: "Shoppers at a jewelry booth under an orange tent" }],
  },
};

// Same colors as the market board in /admin. Full class names so Tailwind picks them up.
const CATEGORY_DOT: Record<string, string> = {
  "Hot Food": "bg-orange",
  "Food Truck": "bg-red-400",
  Sweets: "bg-pink",
  "Packaged Foods": "bg-teal",
  Makers: "bg-plum ring-1 ring-cream/40",
  Drinks: "bg-gold",
  Art: "bg-sky-300",
  "": "bg-muted/60",
};
const CATEGORY_STRIPE: Record<string, string> = {
  "Hot Food": "border-l-orange",
  "Food Truck": "border-l-red-400",
  Sweets: "border-l-pink",
  "Packaged Foods": "border-l-teal",
  Makers: "border-l-plum",
  Drinks: "border-l-gold",
  Art: "border-l-sky-300",
  "": "border-l-muted/60",
};
const TILE_COLORS = ["bg-orange", "bg-pink", "bg-teal"];

export default function VendorsPage() {
  const event = getEvent(defaultEventSlug)!;
  const applyHref = `/events/${event.slug}/apply`;

  return (
    <>
      <SiteNav applyHref={applyHref} />
      <main className="mx-auto w-full max-w-5xl flex-1 overflow-x-clip px-4 pt-8 sm:px-6 sm:pt-12">
        <div className="flex justify-center">
          <BrandLockup event={event} size="sm" href="/" />
        </div>
        <p className="mt-8 text-center text-xs font-extrabold uppercase tracking-[0.35em] text-gold sm:text-sm">
          Shop local, shop Harlem
        </p>
        <h1 className="display mt-3 text-center text-[15vw] sm:text-[6.5rem]">
          <span className="text-orange">Vendors</span> <span className="text-cream">at the</span> <span className="text-pink">market</span>
        </h1>
        <p className="mx-auto mt-5 max-w-xl text-center text-base text-cream sm:text-lg">
          The makers, artists and food vendors joining us each Saturday, 3:00 to 8:00 PM, under the Park Ave Viaduct.
        </p>

        <ul className="mt-8 grid grid-cols-3 gap-2 sm:gap-4">
          {event.dates.map((d, i) => (
            <li key={d.id}>
              <a
                href={`#date-${d.id}`}
                className={`${TILE_COLORS[i % TILE_COLORS.length]} block rounded-md px-2 py-3 text-center text-navy-deep shadow-lg transition hover:brightness-110`}
              >
                <span className="block text-xs font-extrabold uppercase tracking-[0.3em]">{d.weekday}</span>
                <span className="display block whitespace-nowrap text-3xl sm:text-5xl">{d.short}</span>
              </a>
            </li>
          ))}
        </ul>

        <Suspense fallback={<p className="mt-12 text-center text-muted">Loading vendors...</p>}>
          <VendorLists slug={event.slug} />
        </Suspense>

        <div className="mt-16 flex flex-col items-center justify-between gap-3 rounded-xl border border-line/70 bg-panel/60 px-5 py-4 text-center sm:flex-row sm:text-left">
          <p className="text-sm text-cream sm:text-base">
            <span className="font-extrabold">Are you a vendor?</span> Apply to sell at the market.
          </p>
          <Link href={applyHref} className="btn-secondary shrink-0">
            Vendor application
          </Link>
        </div>
      </main>
      <SiteFooter event={event} />
    </>
  );
}

async function VendorLists({ slug }: { slug: string }) {
  const dates = await getPublicVendorsByDate(slug);
  return (
    <div className="mt-12 space-y-14">
      {dates.map((d, i) => (
        <section key={d.id} id={`date-${d.id}`} className="scroll-mt-16">
          <h2 className="display text-4xl sm:text-5xl">
            <span className={["text-orange", "text-pink", "text-teal"][i % 3]}>Sat {d.short}</span>
            {d.vendors.length > 0 && (
              <span className="ml-3 align-middle font-sans text-sm font-semibold normal-case tracking-normal text-muted">
                {d.vendors.length} {d.vendors.length === 1 ? "vendor" : "vendors"}
              </span>
            )}
          </h2>
          {d.vendors.length === 0 ? (
            <p className="mt-4 rounded-xl border border-dashed border-line/80 bg-panel/40 px-5 py-8 text-center font-extrabold uppercase tracking-wider text-muted">
              Vendor lineup coming soon
            </p>
          ) : (
            <ul className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {d.vendors.map((v, j) => (
                <VendorCard key={`${v.name}-${j}`} v={v} />
              ))}
            </ul>
          )}
        </section>
      ))}
    </div>
  );
}

function VendorCard({ v }: { v: PublicVendor }) {
  return (
    <li className={`rounded-lg border-l-4 bg-panel px-4 py-3 ring-1 ring-line/70 ${CATEGORY_STRIPE[v.category] ?? CATEGORY_STRIPE[""]}`}>
      <p className="text-lg font-extrabold leading-snug text-cream">{v.name}</p>
      {v.category && (
        <p className="mt-1 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted">
          <span className={`h-2.5 w-2.5 rounded-full ${CATEGORY_DOT[v.category] ?? CATEGORY_DOT[""]}`} aria-hidden />
          {v.category}
        </p>
      )}
      {(v.instagramUrl || v.websiteUrl) && (
        <p className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm">
          {v.instagramUrl && (
            <a href={v.instagramUrl} target="_blank" rel="noopener noreferrer nofollow" className="break-all text-teal hover:underline">
              {v.instagramHandle}
            </a>
          )}
          {v.websiteUrl && (
            <a href={v.websiteUrl} target="_blank" rel="noopener noreferrer nofollow" className="text-teal hover:underline">
              Website
            </a>
          )}
        </p>
      )}
    </li>
  );
}
