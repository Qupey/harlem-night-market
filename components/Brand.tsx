import Image from "next/image";
import Link from "next/link";
import type { FooterLogo, MarketEvent } from "@/lib/events";

// The Harlem Night Market logo (neon lettering over the purple tagline banner).
export function BrandLockup({ event, size = "lg" }: { event: MarketEvent; size?: "lg" | "sm" }) {
  return (
    <Link href={`/events/${event.slug}`} className="inline-block">
      <Image
        src={event.logo}
        alt={`${event.name}: ${event.tagline.join(" + ")}`}
        width={1400}
        height={620}
        priority
        className={size === "lg" ? "h-auto w-[min(88vw,30rem)]" : "h-auto w-[min(72vw,20rem)]"}
      />
    </Link>
  );
}

const TILE_COLORS = ["bg-orange", "bg-pink", "bg-teal"];

export function DateTiles({ event }: { event: MarketEvent }) {
  return (
    <ul className="grid grid-cols-3 gap-2 sm:gap-4">
      {event.dates.map((d, i) => (
        <li key={d.id} className={`${TILE_COLORS[i % TILE_COLORS.length]} rounded-md px-2 py-3 text-center text-navy-deep shadow-lg`}>
          <span className="block text-xs font-extrabold uppercase tracking-[0.3em]">{d.weekday}</span>
          <span className="display block whitespace-nowrap text-3xl sm:text-5xl">{d.short}</span>
          {d.time && <span className="mt-1 block text-xs font-semibold">{d.time}</span>}
        </li>
      ))}
    </ul>
  );
}

export function Venue({ event }: { event: MarketEvent }) {
  return (
    <p className="text-center font-extrabold uppercase">
      <span className="block text-lg tracking-wide text-orange sm:text-2xl">{event.venueIntro}</span>
      <span className="block text-[2.4375rem] leading-tight tracking-wide text-teal sm:text-[3.9rem]">{event.venue}</span>
      <span className="block text-base tracking-wide text-cream sm:text-xl">{event.address}</span>
    </p>
  );
}

export function SiteFooter({ event }: { event: MarketEvent }) {
  return (
    <footer className="mt-16 border-t border-line/70 bg-navy-deep/40">
      <div className="mx-auto max-w-4xl space-y-10 px-4 py-10 text-center sm:px-6">
        <LogoRow title="Produced by" logos={event.producers} />
        <LogoRow title="In partnership with" logos={event.partners} />
      </div>
    </footer>
  );
}

function LogoRow({ title, logos }: { title: string; logos: FooterLogo[] }) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-[0.25em] text-muted">{title}</p>
      <ul className="mt-6 flex flex-wrap items-center justify-center gap-x-8 gap-y-6 sm:gap-x-10">
        {logos.map((p) => (
          <li key={p.name}>
            {/* eslint-disable-next-line @next/next/no-img-element -- small pre-sized logos */}
            <img src={p.logo} alt={p.name} style={{ height: p.height }} className="w-auto" />
          </li>
        ))}
      </ul>
    </div>
  );
}
