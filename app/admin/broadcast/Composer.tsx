"use client";

import { useActionState, useState } from "react";
import { broadcastAction, type BroadcastResult } from "./actions";

type Recipient = { id: string; name: string; contact: string };

// Writing the message, previewing it, sending a test, and sending it to the chosen vendors.
export function Composer({
  recipients,
  audience,
  audienceLabel,
  testTo,
}: {
  recipients: Recipient[];
  audience: Record<string, string>;
  audienceLabel: string;
  testTo: string;
}) {
  const [state, action, pending] = useActionState<BroadcastResult, FormData>(broadcastAction, { kind: "idle" });
  const [excluded, setExcluded] = useState<Set<string>>(new Set());
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [to, setTo] = useState(testTo);
  const [confirming, setConfirming] = useState(false);
  const count = recipients.length - excluded.size;

  if (state.kind === "sent") {
    return (
      <section className="mt-6 rounded-2xl border border-teal bg-teal/10 p-5 text-cream">
        <h2 className="text-lg font-extrabold">
          Sent to {state.sent} vendor{state.sent === 1 ? "" : "s"}.
        </h2>
        {state.failed.length > 0 && (
          <p className="mt-2 text-pink">
            {state.failed.length} didn&apos;t send: {state.failed.join(", ")}. Check the Resend dashboard, then send to them
            again by leaving everyone else out.
          </p>
        )}
        <a href="/admin/broadcast" className="btn-secondary mt-4 inline-block">
          Write another message
        </a>
      </section>
    );
  }

  const toggle = (id: string) =>
    setExcluded((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return (
    <form action={action} className="mt-6 space-y-5">
      {Object.entries(audience).map(([k, v]) => (
        <input key={k} type="hidden" name={k} value={v} />
      ))}
      {[...excluded].map((id) => (
        <input key={id} type="hidden" name="exclude" value={id} />
      ))}
      <input type="hidden" name="expected" value={count} />

      <details className="rounded-2xl border border-line bg-panel p-5">
        <summary className="cursor-pointer font-extrabold text-cream">
          {count} of {recipients.length} vendor{recipients.length === 1 ? "" : "s"} will get this ({audienceLabel}). Show list
        </summary>
        {recipients.length === 0 ? (
          <p className="mt-3 text-sm text-muted">No vendors match. Change the audience above.</p>
        ) : (
          <ul className="mt-3 grid gap-1 text-sm sm:grid-cols-2">
            {recipients.map((r) => (
              <li key={r.id}>
                <label className="flex items-center gap-2 text-cream">
                  <input type="checkbox" checked={!excluded.has(r.id)} onChange={() => toggle(r.id)} className="accent-orange" />
                  {r.name} <span className="text-muted">· {r.contact}</span>
                </label>
              </li>
            ))}
          </ul>
        )}
      </details>

      <label className="block">
        <span className="field-label">Subject</span>
        <input className="field-input" name="subject" value={subject} onChange={(e) => setSubject(e.target.value)} maxLength={200} required />
      </label>
      <label className="block">
        <span className="field-label">Message</span>
        <textarea
          className="field-input"
          name="body"
          rows={10}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          maxLength={10000}
          required
        />
        <span className="mt-1 block text-xs text-muted">
          Starts with &quot;Hi [contact name],&quot; and ends with the Harlem Night Market sign-off. Leave a blank line between
          paragraphs. Type {"{business_name}"} to put in each vendor&apos;s business name.
        </span>
      </label>

      <div className="flex flex-wrap items-end gap-3">
        <button type="submit" name="intent" value="preview" disabled={pending} className="btn-secondary disabled:opacity-40">
          Preview
        </button>
        <label className="block">
          <span className="field-label">Test address</span>
          <input className="field-input py-1.5" type="email" name="testTo" value={to} onChange={(e) => setTo(e.target.value)} />
        </label>
        <button type="submit" name="intent" value="test" disabled={pending} className="btn-secondary disabled:opacity-40">
          Send me a test
        </button>
        {!confirming && (
          <button
            type="button"
            disabled={pending || count === 0 || !subject.trim() || !body.trim()}
            onClick={() => setConfirming(true)}
            className="btn-primary px-5 py-2 text-sm disabled:opacity-40"
          >
            Send to {count} vendor{count === 1 ? "" : "s"}
          </button>
        )}
      </div>

      {confirming && (
        <div className="rounded-lg border border-gold bg-gold/10 px-4 py-3 text-sm text-gold">
          <p>
            Send &quot;{subject.trim()}&quot; to {count} vendor{count === 1 ? "" : "s"}? Each gets their own email. This can&apos;t be
            undone.
          </p>
          <div className="mt-2 flex gap-2">
            <button type="submit" name="intent" value="send" disabled={pending} className="btn-primary px-4 py-1.5 text-sm disabled:opacity-40">
              {pending ? "Sending..." : `Yes, send to ${count}`}
            </button>
            <button type="button" disabled={pending} onClick={() => setConfirming(false)} className="px-3 py-1.5 text-sm text-muted hover:text-cream">
              Not now
            </button>
          </div>
        </div>
      )}

      {state.kind === "error" && (
        <p role="alert" className="text-sm font-semibold text-pink">
          {state.text}
        </p>
      )}
      {state.kind === "test" && (
        <p role="status" className={`text-sm font-semibold ${state.ok ? "text-teal" : "text-pink"}`}>
          {state.text}
        </p>
      )}
      {state.kind === "preview" && (
        <section className="rounded-2xl border border-line bg-panel p-4">
          <p className="text-sm text-muted">
            Preview for the first vendor on the list · Subject: <strong className="text-cream">{state.subject}</strong>
          </p>
          <iframe title="Email preview" sandbox="" srcDoc={state.html} className="mt-3 h-[480px] w-full rounded-lg bg-white" />
        </section>
      )}
    </form>
  );
}
