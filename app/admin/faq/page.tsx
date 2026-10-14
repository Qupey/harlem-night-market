import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { events } from "@/lib/events";
import { listFaqs } from "@/lib/faq";
import { addFaqAction, deleteFaqAction, moveFaqAction, saveFaqAction } from "./actions";
import { DeleteButton } from "./DeleteButton";

export const metadata = { title: "FAQ | Harlem Night Market admin" };

export default function AdminFaqPage() {
  return (
    <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-8 sm:px-6">
      <p className="text-xs font-extrabold uppercase tracking-[0.3em] text-gold">Harlem Night Market admin</p>
      <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <h1 className="display text-4xl text-orange">FAQ</h1>
        <Link href="/admin" className="text-sm text-muted underline">
          ← Back to applications
        </Link>
      </div>
      <p className="mt-3 text-sm text-muted">
        These questions appear under the Apply Now button on the event page, in this order. Changes show on the site right
        away.
      </p>
      <Suspense fallback={<p className="mt-8 text-muted">Loading...</p>}>
        {events.map((event) => (
          <FaqEditor key={event.slug} slug={event.slug} name={event.name} showName={events.length > 1} />
        ))}
      </Suspense>
    </main>
  );
}

async function FaqEditor({ slug, name, showName }: { slug: string; name: string; showName: boolean }) {
  await connection();
  const faqs = await listFaqs(slug);

  return (
    <section className="mt-8">
      {showName && <h2 className="display mb-4 text-2xl text-teal">{name}</h2>}

      {faqs.length === 0 && (
        <p className="rounded-xl border border-line bg-panel px-4 py-6 text-muted">
          No questions yet. Add the first one below. The FAQ panel stays hidden on the site until there is at least one.
        </p>
      )}

      <ol className="space-y-4">
        {faqs.map((f, i) => (
          <li key={f.id} className="rounded-xl border border-line bg-panel p-4">
            <form action={saveFaqAction} className="space-y-3">
              <input type="hidden" name="id" value={f.id} />
              <label className="block">
                <span className="field-label">Question {i + 1}</span>
                <input name="question" defaultValue={f.question} required maxLength={300} className="field-input" />
              </label>
              <label className="block">
                <span className="field-label">Answer</span>
                <textarea name="answer" defaultValue={f.answer} required maxLength={4000} rows={4} className="field-input" />
              </label>
              <button type="submit" className="btn-secondary">
                Save changes
              </button>
            </form>
            <div className="mt-3 flex flex-wrap items-center gap-4 border-t border-line pt-3">
              <form action={moveFaqAction}>
                <input type="hidden" name="eventSlug" value={slug} />
                <input type="hidden" name="id" value={f.id} />
                <input type="hidden" name="direction" value="up" />
                <button type="submit" disabled={i === 0} className="text-sm text-cream underline disabled:opacity-30">
                  ↑ Move up
                </button>
              </form>
              <form action={moveFaqAction}>
                <input type="hidden" name="eventSlug" value={slug} />
                <input type="hidden" name="id" value={f.id} />
                <input type="hidden" name="direction" value="down" />
                <button
                  type="submit"
                  disabled={i === faqs.length - 1}
                  className="text-sm text-cream underline disabled:opacity-30"
                >
                  ↓ Move down
                </button>
              </form>
              <form action={deleteFaqAction} className="ml-auto">
                <input type="hidden" name="id" value={f.id} />
                <DeleteButton />
              </form>
            </div>
          </li>
        ))}
      </ol>

      <form action={addFaqAction} className="mt-6 space-y-3 rounded-xl border border-dashed border-orange/60 bg-panel/60 p-4">
        <h3 className="font-semibold text-orange">Add a question</h3>
        <input type="hidden" name="eventSlug" value={slug} />
        <label className="block">
          <span className="field-label">Question</span>
          <input name="question" required maxLength={300} className="field-input" />
        </label>
        <label className="block">
          <span className="field-label">Answer</span>
          <textarea name="answer" required maxLength={4000} rows={4} className="field-input" />
        </label>
        <button type="submit" className="btn-primary px-5 py-2 text-base">
          Add question
        </button>
      </form>
    </section>
  );
}
