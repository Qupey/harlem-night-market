"use client";

import { useSearchParams } from "next/navigation";
import { useEffect } from "react";

// After saving a card, the page comes back with ?open=<card id>; scroll that card into view
// instead of leaving the page at the top.
export function ScrollToCard() {
  const open = useSearchParams().get("open");
  useEffect(() => {
    if (open) document.getElementById(open)?.scrollIntoView({ block: "start" });
  }, [open]);
  return null;
}
