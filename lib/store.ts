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
};

export type Upload = { field: UploadField; file: File };

export type ApplicationStore = {
  saveApplication(eventSlug: string, data: ApplicationData, uploads: Upload[]): Promise<StoredApplication>;
  listApplications(eventSlug?: string): Promise<StoredApplication[]>;
  readUpload(applicationId: string, fileName: string): Promise<{ meta: StoredFile; data: Buffer } | null>;
};

const store: ApplicationStore = supabaseConfigured() ? supabaseStore : localStore;

export const { saveApplication, listApplications, readUpload } = store;
