// Event configuration. Until the admin dashboard exists (spec Phase 1),
// events and their dates live here. Edit this file to change dates or details.

export type EventDate = {
  id: string; // stable id stored with each application (ISO date works well)
  label: string;
  weekday: string; // short form for the date tiles, e.g. "Sat"
  short: string; // e.g. "Dec 5"
  time?: string;
};

export type FooterLogo = { name: string; logo: string; height: number }; // height in px in the footer

export type MarketEvent = {
  slug: string;
  name: string;
  tagline: string[];
  venueIntro: string; // small line above the venue name, e.g. "At the Historic"
  venue: string;
  address: string;
  logo: string; // in public/
  producers: FooterLogo[]; // footer: "Produced by"
  partners: FooterLogo[]; // footer: "In partnership with"
  description: string;
  registrationOpen: boolean;
  applicationDeadline?: string;
  dates: EventDate[];
};

export const events: MarketEvent[] = [
  {
    slug: "harlem-night-market",
    name: "Harlem Night Market",
    tagline: ["Music", "Food", "Makers", "Culture", "Community"],
    venueIntro: "At the Historic",
    venue: "La Marqueta",
    address: "116th & Park Avenue",
    logo: "/logos/harlem-night-market.png",
    producers: [
      { name: "Uptown Grand Central", logo: "/logos/uptown-grand-central.png", height: 52 },
      { name: "TBO Harlem", logo: "/logos/tbo-harlem.png", height: 60 },
    ],
    partners: [
      { name: "La Marqueta", logo: "/logos/la-marqueta.png", height: 39 },
      { name: "NYC Public Markets", logo: "/logos/nyc-public-markets.png", height: 42 },
      { name: "NYC EDC", logo: "/logos/nyc-edc.png", height: 29 },
      { name: "Qupey", logo: "/logos/qupey.png", height: 45 },
    ],
    description:
      "We're looking for local makers, artists, and food vendors to join the Harlem Night Market on the first three Saturdays in December. Apply below and tell us which market nights work best for you.",
    registrationOpen: true,
    dates: [
      { id: "2026-12-05", label: "Saturday, December 5, 2026", weekday: "Sat", short: "Dec 5", time: "3:00 to 8:00 PM" },
      { id: "2026-12-12", label: "Saturday, December 12, 2026", weekday: "Sat", short: "Dec 12", time: "3:00 to 8:00 PM" },
      { id: "2026-12-19", label: "Saturday, December 19, 2026", weekday: "Sat", short: "Dec 19", time: "3:00 to 8:00 PM" },
    ],
  },
];

export const defaultEventSlug = events[0].slug;

export function getEvent(slug: string): MarketEvent | undefined {
  return events.find((e) => e.slug === slug);
}

export function dateLabel(event: MarketEvent | undefined, id: string | undefined): string {
  if (!id) return "";
  return event?.dates.find((d) => d.id === id)?.label ?? id;
}
