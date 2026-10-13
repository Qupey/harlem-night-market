import { notFound } from "next/navigation";
import { BrandLockup, DateTiles, SiteFooter, Venue } from "@/components/Brand";
import { VendorApplicationForm } from "@/components/VendorApplicationForm";
import { events, getEvent } from "@/lib/events";

export function generateStaticParams() {
  return events.map((e) => ({ slug: e.slug }));
}

export default async function ApplyPage({ params }: PageProps<"/events/[slug]/apply">) {
  const { slug } = await params;
  const event = getEvent(slug);
  if (!event) notFound();

  return (
    <>
      <header className="mx-auto w-full max-w-3xl px-4 pt-8 sm:px-6 sm:pt-10">
        <div className="flex justify-center">
          <BrandLockup event={event} size="sm" />
        </div>
        <p className="mt-6 text-center text-xs font-extrabold uppercase tracking-[0.35em] text-gold sm:text-sm">
          Now accepting applications
        </p>
        <h1 className="display mt-2 text-center text-6xl sm:text-8xl">
          <span className="text-orange">Vendor</span> <span className="text-pink">Application</span>
        </h1>
        <div className="mt-6">
          <DateTiles event={event} />
        </div>
        <div className="mt-5">
          <Venue event={event} />
        </div>
        <p className="mt-6 text-center text-sm text-muted">
          It takes about 10 minutes. Fields marked <span className="text-orange">*</span> are required.
        </p>
      </header>
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-8 sm:px-6">
        {event.registrationOpen ? (
          <VendorApplicationForm eventSlug={event.slug} dates={event.dates} />
        ) : (
          <p className="rounded-lg bg-panel px-4 py-3 text-cream">Vendor applications are closed.</p>
        )}
      </main>
      <SiteFooter event={event} />
    </>
  );
}
