import { MIN_PASSWORD_LENGTH } from "@/lib/admin-auth";

// Pieces shared by the sign-in and set-password pages.

export const MESSAGES: Record<string, { text: string; ok?: boolean }> = {
  wrong: { text: "Wrong email or password." },
  locked: { text: "Too many tries. Please wait 15 minutes and try again." },
  "wrong-shared": { text: "That isn't the current shared admin password." },
  "bad-email": { text: "Enter a valid email address." },
  short: { text: `Passwords need at least ${MIN_PASSWORD_LENGTH} characters.` },
  mismatch: { text: "The two passwords don't match." },
  sent: { text: "If that address is an admin, we've sent a link. It works once, for 24 hours.", ok: true },
  "link-expired": { text: "That link has expired or was already used. Ask for a new one below." },
  out: { text: "You're signed out.", ok: true },
};

export function Notice({ code }: { code?: string }) {
  const m = code ? MESSAGES[code] : undefined;
  if (!m) return null;
  return (
    <p role="status" className={`mt-6 rounded-lg px-4 py-3 text-sm text-cream ${m.ok ? "bg-teal/15" : "bg-orange/20"}`}>
      {m.text}
    </p>
  );
}

export function EmailField() {
  return (
    <label className="block">
      <span className="field-label">Email</span>
      <input className="field-input" type="email" name="email" autoComplete="username" required maxLength={254} />
    </label>
  );
}

export function PasswordField({ label, name, autoComplete }: { label: string; name: string; autoComplete: string }) {
  return (
    <label className="block">
      <span className="field-label">{label}</span>
      <input className="field-input" type="password" name={name} autoComplete={autoComplete} required maxLength={200} />
    </label>
  );
}
