import { BrandLockup, SiteFooter } from "@/components/Brand";
import { events } from "@/lib/events";

// Page frame shared by the vendor payment pages.
export function PayShell({ children }: { children: React.ReactNode }) {
  const event = events[0];
  return (
    <>
      <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-12 sm:px-6">
        <div className="flex justify-center">
          <BrandLockup event={event} size="sm" />
        </div>
        {children}
      </main>
      <SiteFooter event={event} />
    </>
  );
}

export function ContactLine() {
  return (
    <p className="mt-6 text-center text-sm text-muted">
      Questions? Email{" "}
      <a className="underline" href="mailto:info@harlemnightmarket.com">
        info@harlemnightmarket.com
      </a>
      .
    </p>
  );
}
