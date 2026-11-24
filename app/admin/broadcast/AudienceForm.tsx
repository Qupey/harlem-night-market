"use client";

import type { ReactNode } from "react";

// The audience choices. Changing one reloads the page with the new list of recipients.
export function AudienceForm({ children }: { children: ReactNode }) {
  return (
    <form
      method="get"
      action="/admin/broadcast"
      onChange={(e) => e.currentTarget.requestSubmit()}
      className="mt-6 flex flex-wrap items-end gap-3 rounded-2xl border border-line bg-panel p-5"
    >
      {children}
    </form>
  );
}
