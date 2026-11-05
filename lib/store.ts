import "server-only";
import type { ApplicationData, UploadField } from "./schema";
import { localStore } from "./store-local";
import { supabaseConfigured, supabaseStore } from "./store-supabase";

// Where applications are saved. With SUPABASE_URL and SUPABASE_SECRET_KEY set
// they go to Supabase (database + file storage); otherwise to ./data on this
// machine, which is handy for local testing but doesn't survive on most hosts.

export type StoredFile = {
  field: UploadField;
  fileName: string; // file name inside this application's upload folder
  originalName: string;
  size: number;
  type: string;
};

export type StoredApplication = ApplicationData & {
  id: string;
  eventSlug: string;
  status: "pending" | "accepted" | "rejected" | "waitlisted" | "needs_info";
  submittedAt: string;
  files: StoredFile[];
  assignedDates?: string[]; // market dates this vendor is booked for (event date ids)
  marketCategory?: string; // one of MARKET_CATEGORIES
  starred?: boolean; // organizers like this vendor but haven't placed them yet
} & Partial<PaymentFields>;

// Vendor fee tracking, added with supabase/add-payments.sql.
export type PaymentFields = {
  inviteToken: string | null; // secret part of the vendor's /pay/<token> link
  invitedAt: string | null;
  reminderSentAt: string | null;
  paid: boolean;
  amountPaidCents: number | null;
  paidAt: string | null;
  paymentId: string | null; // Stripe payment intent / checkout session id, or a note for manual payments
  paymentMethod: string | null; // "stripe", "cash", "zelle", "other"
  declineEmailedAt: string | null;
};

export type Selection = Pick<StoredApplication, "status"> & { assignedDates: string[]; marketCategory: string };

// columnsMissing: the status was saved, but dates and category weren't because
// supabase/add-vendor-selection.sql hasn't been run yet.
export type SelectionResult = { ok: boolean; columnsMissing?: boolean };

export type MarketSpaces = Record<string, Record<string, number>>;

export type Upload = { field: UploadField; file: File };

export type ApplicationStore = {
  saveApplication(eventSlug: string, data: ApplicationData, uploads: Upload[]): Promise<StoredApplication>;
  listApplications(eventSlug?: string): Promise<StoredApplication[]>;
  readUpload(applicationId: string, fileName: string): Promise<{ meta: StoredFile; data: Buffer } | null>;
  updateSelection(applicationId: string, selection: Selection): Promise<SelectionResult>;
  // columnsMissing: supabase/add-vendor-star.sql hasn't been run yet, so nothing was saved.
  setStarred(applicationId: string, starred: boolean): Promise<SelectionResult>;
  // Removes the application, its dates/menu/document rows and its uploaded files for good.
  deleteApplication(applicationId: string): Promise<boolean>;
  // columnsMissing: supabase/add-payments.sql hasn't been run yet, so nothing was saved.
  updatePayment(applicationId: string, fields: Partial<PaymentFields>): Promise<SelectionResult>;
  // Vendor capacity per market date (date id -> number of vendors). Dates without a row have no limit.
  // null: supabase/add-market-capacity.sql hasn't been run yet.
  getCapacities(): Promise<Record<string, number> | null>;
  // capacity null removes the limit. columnsMissing: the market_capacity table doesn't exist yet.
  setCapacity(dateId: string, capacity: number | null): Promise<SelectionResult>;
  // Space numbers per market date (date id -> vendor id -> space number).
  // null: supabase/add-market-spaces.sql hasn't been run yet.
  getSpaces(): Promise<MarketSpaces | null>;
  // Applies the changes together. ok false: a space is already taken, so nothing was saved.
  // columnsMissing: the market_spaces table doesn't exist yet.
  saveSpaces(dateId: string, changes: Record<string, number | null>): Promise<SelectionResult>;
};

const store: ApplicationStore = supabaseConfigured() ? supabaseStore : localStore;

export const {
  saveApplication,
  listApplications,
  readUpload,
  updateSelection,
  setStarred,
  deleteApplication,
  updatePayment,
  getCapacities,
  setCapacity,
  getSpaces,
  saveSpaces,
} = store;
