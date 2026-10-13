import Link from "next/link";
import { BrandLockup, SiteFooter } from "@/components/Brand";
import { events } from "@/lib/events";

export default function ThankYouPage() {
  const event = events[0];
  return (
    <>
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-12 text-center sm:px-6">
        <BrandLockup event={event} size="sm" />
        <h1 className="display mt-10 text-6xl sm:text-8xl">
          <span className="text-orange">You&apos;re</span> <span className="text-pink">in</span>{" "}
          <span className="text-cream">the queue</span>
        </h1>
        <p className="mx-auto mt-6 max-w-lg text-lg text-cream">
          Thank you. Your application has been received. We will review your submission and contact you if accepted.
        </p>
        <Link href={`/events/${event.slug}`} className="btn-secondary mt-10">
          Back to the market page
        </Link>
      </main>
      <SiteFooter event={event} />
    </>
  );
}
