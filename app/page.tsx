import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { BrandLockup, DateTiles, SiteFooter } from "@/components/Brand";
import { SiteNav } from "@/components/SiteNav";
import { defaultEventSlug, getEvent } from "@/lib/events";

// Public event homepage. Photos live in public/photos (1152x768 JPGs).
const PHOTO_W = 1152;
const PHOTO_H = 768;
const photo = (n: number) => `/photos/hnm-${String(n).padStart(2, "0")}.jpg`;

const HERO = { n: 31, alt: "A crowd fills the lot under the Park Avenue Viaduct at night, lined with glowing vendor stalls" };

export const metadata: Metadata = {
  title: "Harlem Night Market | First three Saturdays in December at La Marqueta",
  description:
    "The original night market in Harlem returns! DJs, great food, Christmas trees, gifts, live music and crafting for the whole family. Saturdays Dec 5, 12 and 19, 3 to 7 PM, at the historic La Marqueta under the Park Ave Viaduct.",
  openGraph: {
    title: "The original night market in Harlem returns!",
    description: "Saturdays Dec 5, 12 and 19, 3 to 7 PM, at the historic La Marqueta under the Park Ave Viaduct.",
    images: [{ url: photo(HERO.n), width: PHOTO_W, height: PHOTO_H, alt: HERO.alt }],
    type: "website",
  },
  twitter: { card: "summary_large_image", images: [photo(HERO.n)] },
};

const STRIP = [
  { n: 15, alt: "A shopper browses handmade jewelry at a vendor table" },
  { n: 21, alt: "Shoppers line up at a lit-up food stall in an orange container" },
  { n: 23, alt: "Friends sharing food at a table inside the market" },
  { n: 13, alt: "Kids playing with hula hoops at the market" },
  { n: 2, alt: "Hand-knit hats and scarves on display" },
];

const LOCATIONS = [
  {
    name: "La Marqueta's Lot 2",
    where: "112th Street & Park Ave",
    what: "DJ Mainstage, Photo Booth & Food",
    main: true,
    n: 30,
    alt: "Market-goers gather in Lot 2 in front of the big HARLEM letters",
  },
  {
    name: "Urban Garden Center",
    where: "111th Street",
    what: "Christmas Trees, Makers & Grandscale Mural Project Artists",
    n: 7,
    alt: "A maker arranges her table among plants at the Urban Garden Center",
  },
  {
    name: "Year-Round Retail Market at La Marqueta",
    where: "115th Street",
    what: "Live Music, Craft Workshops & Year-Round Vendors",
    n: 27,
    alt: "A guitarist plays live music inside La Marqueta's year-round market",
  },
];

const LINEUP = [
  {
    date: "Dec 5",
    lot2: "DJs Delaceiba and Buddy of Uptown Vinyl Supreme",
    live: "Jazz with Bruce Edwards & Friends",
  },
  { date: "Dec 12", lot2: "Ted Smooth", live: "Kaushik Viswanath & Friends" },
  { date: "Dec 19", lot2: "Stormin' Norman", live: "Noel Simone Wippler & her Band of Friends" },
];

const TILE_COLORS = ["bg-orange", "bg-pink", "bg-teal"];
const TEXT_COLORS = ["text-orange", "text-pink", "text-teal"];

const STAMPS = [
  { street: "111th", label: "Urban Garden Center" },
  { street: "112th", label: "Lot 2" },
  { street: "115th", label: "La Marqueta" },
];

const GALLERY = [
  { n: 8, alt: "Yellow tents and café tables in the lot under the viaduct" },
  { n: 12, alt: "Shoppers at a jewelry booth under an orange tent" },
  { n: 20, alt: "Holiday baked goods at Lizzy's Treats NYC" },
  { n: 16, alt: "A performer in a red coat with hula hoops" },
  { n: 9, alt: "A vendor booth decorated with greenery" },
  { n: 24, alt: "Three friends smiling with their market purchases" },
  { n: 3, alt: "Puerto Rican themed art and cards at a vendor table" },
  { n: 22, alt: "Fresh hot apple cider at the Greenside Cider Club stall" },
  { n: 14, alt: "Customers buying handmade soap bars" },
  { n: 32, alt: "Market-goers taking a selfie at night" },
  { n: 17, alt: "Food truck and café seating on the street" },
  { n: 33, alt: "By Nature Beads crystal jewelry booth at night" },
  { n: 18, alt: "A yellow food truck under the viaduct" },
  { n: 34, alt: "Crocheted ornaments and hats at Crocheting in the City" },
  { n: 10, alt: "Muso Bijoux jewelry booth" },
  { n: 6, alt: "A vendor table of buttons and souvenirs" },
  { n: 1, alt: "Handmade earrings and crafts on a vendor table" },
  { n: 5, alt: "Handwoven bags on display" },
  { n: 4, alt: "Natural bar soaps stacked on a table" },
  { n: 11, alt: "Jewelry displayed on a draped table" },
];

function Photo({ n, alt, sizes, className = "", eager = false }: { n: number; alt: string; sizes: string; className?: string; eager?: boolean }) {
  return (
    <Image
      src={photo(n)}
      alt={alt}
      width={PHOTO_W}
      height={PHOTO_H}
      sizes={sizes}
      loading={eager ? "eager" : "lazy"}
      fetchPriority={eager ? "high" : undefined}
      className={`h-full w-full object-cover ${className}`}
    />
  );
}

function SectionHeading({ kicker, children }: { kicker?: string; children: React.ReactNode }) {
  return (
    <div className="text-center">
      {kicker && <p className="text-xs font-extrabold uppercase tracking-[0.35em] text-gold sm:text-sm">{kicker}</p>}
      <h2 className="display mt-3 text-5xl sm:text-7xl">{children}</h2>
    </div>
  );
}

export default function Home() {
  const event = getEvent(defaultEventSlug)!;
  const applyHref = `/events/${event.slug}/apply`;

  return (
    <>
      <SiteNav applyHref={applyHref} />

      <main className="w-full flex-1 overflow-x-clip">
        {/* 1. Hero */}
        <section className="mx-auto max-w-5xl px-4 pt-8 sm:px-6 sm:pt-12">
          <div className="flex justify-center">
            <BrandLockup event={event} href="/" />
          </div>
          <div className="relative mt-8 aspect-[3/2] overflow-hidden rounded-xl shadow-2xl shadow-black/40 ring-1 ring-line/60">
            <Photo n={HERO.n} alt={HERO.alt} sizes="(max-width: 1024px) 100vw, 1024px" eager />
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-navy-deep/70 via-transparent to-transparent" />
          </div>
          <div className="mx-auto max-w-3xl">
            <h1 className="display mt-8 text-center text-[13vw] sm:text-[6.5rem]">
              <span className="block text-orange">The original</span> <span className="block text-pink">night market</span>{" "}
              <span className="block text-cream">in Harlem returns!</span>
            </h1>
            <p className="mt-6 text-center text-lg font-extrabold uppercase tracking-wide text-teal sm:text-2xl">
              For the first three Saturdays in December, at the historic La Marqueta.
            </p>
            <div className="mt-5">
              <DateTiles event={event} />
            </div>
            <p className="mx-auto mt-6 max-w-xl text-center text-base text-cream sm:text-lg">
              Three lots full of DJs and great food, Christmas trees and gifts, plus live music and crafting for the whole family.
            </p>
            <div className="mt-8 flex flex-col items-center gap-4">
              <a href="#locations" className="btn-primary text-2xl">
                Plan your visit
              </a>
              <Link href={applyHref} className="text-sm font-semibold text-muted underline-offset-4 hover:text-teal hover:underline">
                Vendors: apply
              </Link>
            </div>
          </div>
        </section>

        {/* 2. Intro + photo strip */}
        <section className="mt-20">
          <p className="mx-auto max-w-3xl px-4 text-center text-xl leading-relaxed text-cream sm:px-6 sm:text-2xl">
            There&rsquo;ll be <span className="font-extrabold text-orange">food</span>,{" "}
            <span className="font-extrabold text-pink">music</span>, <span className="font-extrabold text-teal">makers</span> and
            more &ndash; so bring your appetite, your best two-step, and your gift list. It&rsquo;s a great way to support local
            businesses, and get your holiday shopping done the Harlem way.
          </p>
          <ul className="mx-auto mt-10 grid max-w-6xl grid-cols-2 gap-2 px-4 sm:grid-cols-5 sm:gap-3 sm:px-6">
            {STRIP.map((p, i) => (
              <li
                key={p.n}
                className={`aspect-[4/5] overflow-hidden rounded-lg ring-1 ring-line/60 ${i === STRIP.length - 1 ? "col-span-2 aspect-[2/1] sm:col-span-1 sm:aspect-[4/5]" : ""}`}
              >
                <Photo n={p.n} alt={p.alt} sizes="(max-width: 640px) 50vw, 20vw" />
              </li>
            ))}
          </ul>
        </section>

        {/* 3. Locations */}
        <section id="locations" className="mx-auto mt-24 max-w-5xl scroll-mt-16 px-4 sm:px-6">
          <SectionHeading kicker="Plan your visit">
            <span className="text-cream">Find the Harlem Night Market</span>{" "}
            <span className="text-teal">under the Park Avenue Viaduct at:</span>
          </SectionHeading>
          <ul className="mt-10 grid gap-6 md:grid-cols-3">
            {LOCATIONS.map((loc, i) => (
              <li
                key={loc.name}
                className={`flex flex-col overflow-hidden rounded-xl bg-panel shadow-xl shadow-black/30 ring-1 ${loc.main ? "ring-2 ring-orange" : "ring-line/70"}`}
              >
                <div className="relative aspect-[3/2]">
                  <Photo n={loc.n} alt={loc.alt} sizes="(max-width: 768px) 100vw, 33vw" />
                  {loc.main && (
                    <span className="absolute left-3 top-3 rounded-md bg-orange px-2.5 py-1 text-xs font-extrabold uppercase tracking-widest text-navy-deep shadow">
                      Main location
                    </span>
                  )}
                </div>
                <div className="flex flex-1 flex-col p-5">
                  <h3 className={`display text-3xl ${TEXT_COLORS[i % TEXT_COLORS.length]}`}>{loc.name}</h3>
                  <p className="mt-1 text-sm font-extrabold uppercase tracking-wider text-cream">{loc.where}</p>
                  <p className="mt-3 text-base text-muted">{loc.what}</p>
                </div>
              </li>
            ))}
          </ul>
          <p className="mt-6 text-center text-sm font-semibold text-muted">
            Saturdays, Dec 5, 12 &amp; 19 &middot; 3:00 to 7:00 PM
          </p>
        </section>

        {/* 4. DJs & Music */}
        <section id="music" className="mt-24 scroll-mt-16 bg-navy-deep/50 py-16">
          <div className="mx-auto max-w-5xl px-4 sm:px-6">
            <SectionHeading kicker="DJs & live music">
              <span className="text-orange">DJs</span> <span className="text-cream">&amp;</span> <span className="text-pink">Music</span>
            </SectionHeading>
            <div className="mt-10 grid items-center gap-8 md:grid-cols-2">
              <div className="space-y-4 text-base text-cream sm:text-lg">
                <p>
                  Orchestrating the sounds in Lot 2 will be DJs Delaceiba and Buddy of Uptown Vinyl Supreme (Dec 5), Ted Smooth
                  (Dec 12) and Stormin&rsquo; Norman (Dec 19).
                </p>
                <p>
                  There&rsquo;ll also be live music inside La Marqueta&rsquo;s year-round market at 115th Street: jazz with Bruce
                  Edwards &amp; Friends (Dec 5), Kaushik Viswanath &amp; Friends (Dec 12) and Noel Simone Wippler &amp; her Band of
                  Friends (Dec 19).
                </p>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="aspect-square overflow-hidden rounded-lg ring-1 ring-line/60">
                  <Photo n={19} alt="A DJ spinning records under a blue tent" sizes="(max-width: 768px) 50vw, 25vw" />
                </div>
                <div className="aspect-square overflow-hidden rounded-lg ring-1 ring-line/60">
                  <Photo n={28} alt="A jazz band with upright bass and drums playing inside La Marqueta" sizes="(max-width: 768px) 50vw, 25vw" />
                </div>
              </div>
            </div>
            <ul className="mt-10 grid gap-4 md:grid-cols-3">
              {LINEUP.map((l, i) => (
                <li key={l.date} className="overflow-hidden rounded-xl bg-panel ring-1 ring-line/70">
                  <p className={`${TILE_COLORS[i]} display px-4 py-2 text-center text-3xl text-navy-deep`}>Sat {l.date}</p>
                  <dl className="space-y-4 p-5">
                    <div>
                      <dt className="text-xs font-extrabold uppercase tracking-[0.25em] text-teal">Lot 2 mainstage</dt>
                      <dd className="mt-1 text-lg font-semibold text-cream">{l.lot2}</dd>
                    </div>
                    <div>
                      <dt className="text-xs font-extrabold uppercase tracking-[0.25em] text-gold">Live at 115th</dt>
                      <dd className="mt-1 text-lg font-semibold text-cream">{l.live}</dd>
                    </div>
                  </dl>
                </li>
              ))}
            </ul>
            <div className="mt-10 flex flex-col items-center gap-3 rounded-xl border border-line/70 bg-panel/60 px-5 py-6 text-center">
              <p className="display text-3xl sm:text-4xl">
                <span className="text-cream">Meet the</span> <span className="text-orange">makers</span>{" "}
                <span className="text-cream">&amp;</span> <span className="text-pink">food vendors</span>
              </p>
              <p className="text-sm text-muted sm:text-base">See who&rsquo;s selling at each Saturday&rsquo;s market.</p>
              <Link href="/vendors" className="btn-primary mt-2 text-xl">
                Vendors at the market
              </Link>
            </div>
          </div>
        </section>

        {/* 5. Live Art & Workshops */}
        <section className="mx-auto mt-24 max-w-5xl px-4 sm:px-6">
          <SectionHeading kicker="For the whole family">
            <span className="text-teal">Live Art</span> <span className="text-cream">&amp;</span> <span className="text-orange">Workshops</span>
          </SectionHeading>
          <div className="mt-10 grid items-center gap-8 md:grid-cols-2">
            <div className="grid grid-cols-2 gap-2 md:order-2">
              <div className="col-span-2 aspect-[3/2] overflow-hidden rounded-lg ring-1 ring-line/60">
                <Photo n={25} alt="A grandmother, mother and child crafting together at a workshop table" sizes="(max-width: 768px) 100vw, 50vw" />
              </div>
            </div>
            <p className="text-base leading-relaxed text-cream sm:text-lg">
              In addition to shopping, bring the whole family for make-your-own Charlie Brown Christmas trees at Urban Garden Center
              (each weekend), plus free craft workshops inside the year-round market. Also catch art in action with Grandscale Mural
              Project artists on 111th Street at the Graffiti Truck Gallery.
            </p>
          </div>
        </section>

        {/* 6. All Parts of the Market */}
        <section className="mx-auto mt-24 max-w-5xl px-4 sm:px-6">
          <div className="overflow-hidden rounded-2xl bg-plum/60 ring-1 ring-pink/40">
            <div className="grid md:grid-cols-2">
              <div className="relative aspect-[3/2] md:aspect-auto">
                <Photo n={29} alt="Friends riding a party bus lit in blue and green" sizes="(max-width: 768px) 100vw, 50vw" />
              </div>
              <div className="p-6 sm:p-8">
                <h2 className="display text-4xl sm:text-5xl">
                  <span className="text-cream">All parts of</span> <span className="text-gold">the market</span>
                </h2>
                <p className="mt-4 text-base leading-relaxed text-cream sm:text-lg">
                  We&rsquo;ll also have Busta Bounce party buses to shuttle you between all parts of the market, all market long. Get
                  your punchcard stamped at 111th, 112th and 115th streets, and you&rsquo;ll win $5 in La Marqueta Bucks (while
                  supplies last).
                </p>
                <ul className="mt-6 grid grid-cols-3 gap-3" aria-label="Punchcard stamps">
                  {STAMPS.map((s, i) => (
                    <li
                      key={s.street}
                      className={`flex aspect-square flex-col items-center justify-center rounded-full border-4 border-dashed text-center ${["-rotate-6 border-teal text-teal", "rotate-3 border-orange text-orange", "-rotate-3 border-pink text-pink"][i]}`}
                    >
                      <span className="display text-2xl sm:text-3xl">{s.street}</span>
                      <span className="px-1 text-[0.6rem] font-extrabold uppercase leading-tight tracking-wider sm:text-[0.65rem]">{s.label}</span>
                    </li>
                  ))}
                </ul>
                <p className="mt-4 text-center text-sm font-extrabold uppercase tracking-widest text-gold">= $5 La Marqueta Bucks</p>
              </div>
            </div>
          </div>
        </section>

        {/* 7. Gallery */}
        <section id="gallery" className="mx-auto mt-24 max-w-6xl scroll-mt-16 px-4 sm:px-6">
          <SectionHeading kicker="Scenes from the market">
            <span className="text-pink">Photo</span> <span className="text-cream">Gallery</span>
          </SectionHeading>
          <ul className="mt-10 grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-3 lg:grid-cols-4">
            {GALLERY.map((p) => (
              <li key={p.n} className="aspect-[3/2] overflow-hidden rounded-lg ring-1 ring-line/60">
                <Photo n={p.n} alt={p.alt} sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw" className="transition duration-300 hover:scale-105" />
              </li>
            ))}
          </ul>
        </section>

        {/* 8. Closing */}
        <section className="mx-auto mt-24 max-w-3xl px-4 text-center sm:px-6">
          <p className="text-xl leading-relaxed text-cream sm:text-2xl">
            We hope to see you there &ndash; bundled up, vibing with the DJs, eating good, and pouring your love back into the Harlem
            small businesses and makers that make this community beautiful.
          </p>
          <p className="display mt-6 text-5xl sm:text-7xl">
            <span className="text-orange">Pull up</span> <span className="text-pink">and be part</span>{" "}
            <span className="text-teal">of the magic.</span>
          </p>
          <div className="mt-8">
            <DateTiles event={event} />
          </div>
        </section>

        {/* 9. Vendor band */}
        <section className="mx-auto mt-16 max-w-3xl px-4 sm:px-6">
          <div className="flex flex-col items-center justify-between gap-3 rounded-xl border border-line/70 bg-panel/60 px-5 py-4 text-center sm:flex-row sm:text-left">
            <p className="text-sm text-cream sm:text-base">
              <span className="font-extrabold">Are you a vendor?</span> Apply to sell at the market.
            </p>
            <Link href={applyHref} className="btn-secondary shrink-0">
              Vendor application
            </Link>
          </div>
        </section>
      </main>

      {/* 10. Footer */}
      <SiteFooter
        event={event}
        hostedBy="Hosted by TBo Harlem and Uptown Grand Central, in partnership with the NYC EDC and Councilmember Elsie Encarnacion."
      />
    </>
  );
}
