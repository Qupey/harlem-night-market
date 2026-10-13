import type { InputHTMLAttributes, ReactNode } from "react";
import type { FieldError } from "react-hook-form";

type AnyError = FieldError | { message?: unknown; root?: { message?: unknown } } | undefined;

function messageOf(error: AnyError): string | undefined {
  if (!error) return undefined;
  if (typeof error.message === "string") return error.message;
  if ("root" in error && typeof error.root?.message === "string") return error.root.message;
  return undefined;
}

export function Section({ title, description, children }: { title: string; description?: string; children: ReactNode }) {
  return (
    <section className="rounded-2xl border border-line/80 bg-panel/70 p-5 shadow-xl shadow-navy-deep/40 backdrop-blur-sm sm:p-6">
      <h2 className="display text-2xl text-orange sm:text-3xl">{title}</h2>
      {description && <p className="mt-1 text-sm text-muted">{description}</p>}
      <div className="mt-5">{children}</div>
    </section>
  );
}

export function Field({
  label,
  required,
  error,
  group,
  children,
}: {
  label: string;
  required?: boolean;
  error?: AnyError;
  /** Set for a group of radio buttons or checkboxes, which carry their own labels. */
  group?: boolean;
  children: ReactNode;
}) {
  const Wrapper = group ? "fieldset" : "label";
  const Label = group ? "legend" : "span";
  return (
    <Wrapper className="block">
      <Label className="field-label">
        {label}
        {required && <span className="text-orange"> *</span>}
      </Label>
      {children}
      <ErrorText error={error} />
    </Wrapper>
  );
}

export function ErrorText({ error }: { error?: AnyError }) {
  const message = messageOf(error);
  return message ? <span className="field-error block">{message}</span> : null;
}

export function Choice({ label, className = "", ...props }: InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  return (
    <label className={`choice ${className}`}>
      <input {...props} />
      <span>{label}</span>
    </label>
  );
}
