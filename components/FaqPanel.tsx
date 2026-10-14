import { getPublicFaqs } from "@/lib/faq";

export async function FaqPanel({ eventSlug }: { eventSlug: string }) {
  const faqs = await getPublicFaqs(eventSlug);
  if (faqs.length === 0) return null;

  return (
    <section className="mt-12 rounded-2xl border border-line/80 bg-panel/70 p-5 shadow-xl shadow-navy-deep/40 backdrop-blur-sm sm:p-6">
      <h2 className="display text-center text-3xl text-orange sm:text-4xl">FAQ</h2>
      <div className="mt-5 divide-y divide-line">
        {faqs.map((f) => (
          <details key={f.id} className="group py-3">
            <summary className="flex cursor-pointer list-none items-start justify-between gap-4 font-semibold text-cream">
              <span>{f.question}</span>
              <span aria-hidden className="text-xl leading-none text-orange transition group-open:rotate-45">
                +
              </span>
            </summary>
            <p className="mt-2 whitespace-pre-line text-sm text-muted sm:text-base">{f.answer}</p>
          </details>
        ))}
      </div>
    </section>
  );
}
