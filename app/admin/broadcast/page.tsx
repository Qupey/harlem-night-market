import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { currentAdmin } from "@/lib/admin-auth";
import { AUDIENCES, describeAudience, parseAudience, recipientsFor } from "@/lib/broadcast";
import { emailConfigured } from "@/lib/payments";
import { events } from "@/lib/events";
import { MARKET_CATEGORIES } from "@/lib/selection";
import { listApplications } from "@/lib/store";
import { AudienceForm } from "./AudienceForm";
import { Composer } from "./Composer";

export const metadata = { title: "Message vendors | Harlem Night Market admin" };

const ALL_DATES = events.flatMap((e) => e.dates);

// Emails one message to a group of vendors: all of them, accepted, invited but unpaid, or paid,
// optionally narrowed to a market date and category.
export default function BroadcastPage({ searchParams }: PageProps<"/admin/broadcast">) {
  return (
    <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-8 sm:px-6">
      <p className="text-xs font-extrabold uppercase tracking-[0.3em] text-gold">Harlem Night Market admin</p>
      <div className="mt-2 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <h1 className="display text-4xl text-orange">Message vendors</h1>
        <Link href="/admin" className="text-sm text-muted underline">
          ← Back to applications
        </Link>
      </div>
      <Suspense fallback={<p className="mt-8 text-muted">Loading vendors...</p>}>
        <Broadcast searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

async function Broadcast({ searchParams }: Pick<PageProps<"/admin/broadcast">, "searchParams">) {
  await connection();
  const params = await searchParams;
  const audience = parseAudience((key) => {
    const v = params[key];
    return typeof v === "string" ? v : null;
  });
  const [apps, admin] = await Promise.all([listApplications(), currentAdmin()]);
  const recipients = recipientsFor(apps, audience);

  return (
    <>
      {!emailConfigured() && (
        <p className="mt-6 rounded-lg border border-gold bg-gold/10 px-4 py-3 text-sm text-cream">
          Email isn&apos;t set up yet (RESEND_API_KEY), so nothing can be sent.
        </p>
      )}
      <AudienceForm>
        <label className="block">
          <span className="field-label">Send to</span>
          <select name="who" defaultValue={audience.who} className="field-input">
            {Object.entries(AUDIENCES).map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="field-label">Market date</span>
          <select name="date" defaultValue={audience.date} className="field-input">
            <option value="">Any</option>
            {ALL_DATES.map((d) => (
              <option key={d.id} value={d.id}>
                {d.short}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="field-label">Market category</span>
          <select name="category" defaultValue={audience.category} className="field-input">
            <option value="">Any</option>
            {MARKET_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>
        {audience.who !== "declined" && (
          <label className="flex items-center gap-2 pb-2 text-sm text-cream">
            <input type="checkbox" name="declined" value="1" defaultChecked={audience.declined} className="accent-orange" />
            Include declined vendors
          </label>
        )}
        <noscript>
          <button type="submit" className="btn-secondary">
            Update
          </button>
        </noscript>
      </AudienceForm>
      <p className="mt-2 text-xs text-muted">
        Market date and category use what&apos;s set on each vendor&apos;s card. Declined vendors are left out unless you choose Declined or tick the box.
      </p>
      <Composer
        // A new audience starts a fresh message form, so its list and count always match.
        key={JSON.stringify(audience)}
        recipients={recipients.map((a) => ({ id: a.id, name: a.businessName, contact: a.contactName }))}
        audience={{
          who: audience.who,
          date: audience.date,
          category: audience.category,
          declined: audience.declined ? "1" : "",
        }}
        audienceLabel={describeAudience(audience)}
        testTo={admin?.via === "session" ? admin.email : ""}
      />
    </>
  );
}
