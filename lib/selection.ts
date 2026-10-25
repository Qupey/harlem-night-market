import type { StoredApplication } from "./store";

// Vendor selection in /admin: status, assigned market dates and market category.

export const MARKET_CATEGORIES = ["Hot Food", "Sweets", "Packaged Foods", "Makers", "Drinks"] as const;

export const STATUS_LABELS: Record<StoredApplication["status"], string> = {
  pending: "Pending",
  accepted: "Accepted",
  rejected: "Declined",
  waitlisted: "Waitlisted",
  needs_info: "Needs info",
};

// Choices offered in the admin; older applications may still carry the others.
export const STATUS_CHOICES = ["pending", "accepted", "rejected"] as const satisfies StoredApplication["status"][];
