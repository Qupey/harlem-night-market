import Link from "next/link";
import { notFound } from "next/navigation";
import { BrandLockup, DateTiles, SiteFooter, Venue } from "@/components/Brand";
import { events, getEvent } from "@/lib/events";

export function generateStaticParams() {
  return events.map((e) => ({ slug: e.slug }));
}

export default async function EventPage({ params }: PageProps<"/events/[slug]">) {
  const { slug } = await params;
  const event = getEvent(slug);
  if (!event) notFound();

  return (
    <>
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 pb-6 pt-10 sm:px-6 sm:pt-14">
        <div className="flex justify-center">
          <BrandLockup event={event} />
        </div>

        <p className="mt-8 text-center text-xs font-extrabold uppercase tracking-[0.35em] text-gold sm:text-sm">
          {event.registrationOpen ? "Now accepting applications" : "Applications closed"}
        </p>
        <h1 className="display mt-3 text-center text-[19vw] sm:text-[8.5rem]">
          <span className="text-orange">Call</span> <span className="text-pink">for</span>
          <span className="block text-cream">Vendors</span>
        </h1>

        <p className="mt-8 text-center text-base font-extrabold uppercase tracking-wide text-teal sm:text-xl">
          The first three Saturdays in December
        </p>
        <div className="mt-4">
          <DateTiles event={event} />
        </div>
        <div className="mt-6">
          <Venue event={event} />
        </div>

        <p className="mx-auto mt-8 max-w-xl text-center text-base text-muted sm:text-lg">{event.description}</p>

        <div className="mt-8 flex justify-center">
          {event.registrationOpen ? (
            <Link href={`/events/${event.slug}/apply`} className="btn-primary text-2xl">
              Apply now
            </Link>
          ) : (
            <p className="rounded-lg bg-panel px-4 py-3 text-cream">Vendor applications are closed.</p>
          )}
        </div>
      </main>
      <SiteFooter event={event} />
    </>
  );
}
