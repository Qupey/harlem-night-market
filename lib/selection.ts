import type { StoredApplication } from "./store";

// Vendor selection in /admin: status, assigned market dates and market category.

export const MARKET_CATEGORIES = ["Hot Food", "Food Truck", "Sweets", "Packaged Foods", "Drinks", "Makers", "Art"] as const;

// These pay the higher vendor fee; every other category pays the standard one.
export const paysHotFoodRate = (category: string | undefined) => category === "Hot Food" || category === "Food Truck";

export const STATUS_LABELS: Record<StoredApplication["status"], string> = {
  pending: "Pending",
  accepted: "Accepted",
  rejected: "Declined",
  waitlisted: "Waitlisted",
  needs_info: "Needs info",
};

// Choices offered in the admin; older applications may still carry the others.
export const STATUS_CHOICES = ["pending", "accepted", "rejected"] as const satisfies StoredApplication["status"][];
