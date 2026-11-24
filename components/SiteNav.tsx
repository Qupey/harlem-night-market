import Link from "next/link";

// Slim top bar for the public pages. "Vendors" lists who's selling; "Apply" is the small vendor sign-up link.
export function SiteNav({ applyHref }: { applyHref: string }) {
  return (
    <nav className="sticky top-0 z-20 border-b border-line/60 bg-navy-deep/85 backdrop-blur">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-2.5 sm:px-6">
        <Link href="/" className="display shrink-0 text-lg text-cream sm:text-xl">
          Harlem <span className="text-orange">Night</span> <span className="text-pink">Market</span>
        </Link>
        <ul className="flex items-center gap-3 text-xs font-semibold uppercase tracking-wider sm:gap-6 sm:text-sm">
          <li className="hidden md:block">
            <Link href="/#locations" className="text-cream hover:text-teal">Visit</Link>
          </li>
          <li className="hidden md:block">
            <Link href="/#music" className="text-cream hover:text-teal">Music</Link>
          </li>
          <li>
            <Link href="/vendors" className="text-cream hover:text-teal">
              Vendors<span className="hidden sm:inline"> at the market</span>
            </Link>
          </li>
          <li>
            <Link href={applyHref} className="text-teal hover:text-cream">Apply</Link>
          </li>
        </ul>
      </div>
    </nav>
  );
}
