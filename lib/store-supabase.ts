import "server-only";
import { randomUUID } from "node:crypto";
import path from "node:path";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { isFoodVendor, type ApplicationData, type UploadField } from "./schema";
import type { ApplicationStore, Selection, SelectionResult, StoredApplication, StoredFile, Upload } from "./store";

// Supabase storage. Tables and the private "vendor-documents" bucket are created
// by supabase/schema.sql. The secret key stays on the server; Row Level Security
// keeps the tables closed to everyone else.

const BUCKET = "vendor-documents";

const DOCUMENT_TYPES: Record<UploadField, string> = {
  foodLicenseFile: "food_handler_license",
  dohPermitFile: "doh_permit",
  insuranceFile: "insurance",
  logo: "logo",
  productImages: "product_image",
};
const FIELDS_BY_TYPE = Object.fromEntries(Object.entries(DOCUMENT_TYPES).map(([f, t]) => [t, f])) as Record<
  string,
  UploadField
>;

export function supabaseConfigured(): boolean {
  return !!process.env.SUPABASE_URL && !!process.env.SUPABASE_SECRET_KEY;
}

let client: SupabaseClient | undefined;
function db(): SupabaseClient {
  client ??= createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return client;
}

function safeName(name: string): string {
  return path.basename(name).replace(/[^a-zA-Z0-9._-]+/g, "_").slice(-80) || "file";
}

const yes = (v: "yes" | "no") => v === "yes";

async function saveApplication(eventSlug: string, data: ApplicationData, uploads: Upload[]): Promise<StoredApplication> {
  const id = randomUUID();
  const files: StoredFile[] = [];

  // Upload files first, then save the application and its file records in one
  // transaction. If anything fails, remove the files so nothing is orphaned.
  try {
    for (const [i, { field, file }] of uploads.entries()) {
      const fileName = `${field}-${i + 1}-${safeName(file.name)}`;
      const { error } = await db()
        .storage.from(BUCKET)
        .upload(`${id}/${fileName}`, await file.arrayBuffer(), { contentType: file.type, upsert: false });
      if (error) throw new Error(`Upload failed: ${error.message}`);
      files.push({ field, fileName, originalName: file.name, size: file.size, type: file.type });
    }

    const food = isFoodVendor(data.categories);
    const preferences = [data.firstChoice, data.secondChoice, data.thirdChoice]
      .map((d, i) => (d ? { event_date: d, rank: i + 1 } : null))
      .filter(Boolean);

    const { error } = await db().rpc("submit_vendor_application", {
      app: {
        id,
        event_slug: eventSlug,
        contact_name: data.contactName,
        business_name: data.businessName,
        email: data.email,
        phone: data.phone,
        instagram: data.instagram || null,
        website: data.website || null,
        business_address: null,
        categories: data.categories,
        other_category: data.otherCategory || null,
        product_details: data.productDetails || null,
        available_all_dates: false,
        availability_notes: data.availabilityNotes || null,
        // Space, table and chairs are no longer asked; the columns stay for older applications.
        setup_type: "",
        setup_type_other: null,
        needs_electricity: yes(data.needsElectricity),
        needs_table: false,
        needs_chairs: false,
        setup_notes: joinSetupNotes(data.electricityDetails, data.setupNotes),
        agreements: data.agreements,
        date_preferences: preferences,
        food: food
          ? {
              food_types: data.foodTypes,
              other_food_type: data.otherFoodType || null,
              has_food_handler_license: data.foodHandlerLicense ?? null,
              license_number: data.licenseNumber || null,
              license_expiration: data.licenseExpiration || null,
            }
          : null,
        menu_items: data.menuItems.map((m) => ({
          name: m.name,
          description: m.description || null,
          price: m.price || null,
          dietary_tags: m.dietaryTags,
        })),
        documents: files.map((f) => ({
          document_type: DOCUMENT_TYPES[f.field],
          file_path: `${id}/${f.fileName}`,
          file_name: f.originalName,
          content_type: f.type,
          size_bytes: f.size,
        })),
      },
    });
    if (error) throw new Error(`Saving application failed: ${error.message}`);
  } catch (err) {
    if (files.length > 0) {
      await db()
        .storage.from(BUCKET)
        .remove(files.map((f) => `${id}/${f.fileName}`))
        .catch(() => {});
    }
    throw err;
  }

  return { ...data, id, eventSlug, status: "pending", submittedAt: new Date().toISOString(), files };
}

type FoodRow = {
  food_types: string[];
  other_food_type: string | null;
  has_food_handler_license: string | null;
  license_number: string | null;
  license_expiration: string | null;
};

type Row = {
  id: string;
  event_slug: string;
  contact_name: string;
  business_name: string;
  email: string;
  phone: string;
  instagram: string | null;
  website: string | null;
  business_address: string | null;
  categories: string[];
  other_category: string | null;
  product_details?: string | null; // added after launch; missing until the schema update is run
  available_all_dates: boolean;
  availability_notes: string | null;
  setup_type: string;
  setup_type_other: string | null;
  needs_electricity: boolean;
  needs_table: boolean;
  needs_chairs: boolean;
  setup_notes: string | null;
  agreements: ApplicationData["agreements"];
  status: StoredApplication["status"];
  assigned_dates?: string[]; // added with add-vendor-selection.sql; missing until it's run
  market_category?: string | null;
  starred?: boolean; // added with add-vendor-star.sql
  submitted_at: string;
  vendor_date_preferences: { event_date: string; rank: number }[];
  // One-to-one, so PostgREST returns an object (or null); accept an array too.
  food_vendor_details: FoodRow | FoodRow[] | null;
  menu_items: { position: number; name: string; description: string | null; price: string | null; dietary_tags: string[] }[];
  uploaded_documents: {
    document_type: string;
    file_path: string;
    file_name: string;
    content_type: string | null;
    size_bytes: number | null;
  }[];
};

const SELECT = `*,
  vendor_date_preferences(event_date, rank),
  food_vendor_details(food_types, other_food_type, has_food_handler_license, license_number, license_expiration),
  menu_items(position, name, description, price, dietary_tags),
  uploaded_documents(document_type, file_path, file_name, content_type, size_bytes)`;

// Electricity details share the setup_notes column (no schema change needed),
// stored as a labelled first paragraph and split back out when read.
const ELECTRICITY_PREFIX = "Electricity needs: ";

function joinSetupNotes(electricity: string | undefined, notes: string | undefined): string | null {
  const parts = [electricity && `${ELECTRICITY_PREFIX}${electricity.replace(/\s*\n\s*/g, " ")}`, notes].filter(Boolean);
  return parts.length > 0 ? parts.join("\n\n") : null;
}

function splitSetupNotes(stored: string | null): { electricityDetails: string; setupNotes: string } {
  if (!stored?.startsWith(ELECTRICITY_PREFIX)) return { electricityDetails: "", setupNotes: stored ?? "" };
  const end = stored.indexOf("\n\n");
  return end === -1
    ? { electricityDetails: stored.slice(ELECTRICITY_PREFIX.length), setupNotes: "" }
    : { electricityDetails: stored.slice(ELECTRICITY_PREFIX.length, end), setupNotes: stored.slice(end + 2) };
}

function toStored(r: Row): StoredApplication {
  const food = (Array.isArray(r.food_vendor_details) ? r.food_vendor_details[0] : r.food_vendor_details) ?? null;
  const pref = (rank: number) => r.vendor_date_preferences.find((p) => p.rank === rank)?.event_date;
  const yn = (b: boolean) => (b ? "yes" : "no") as "yes" | "no";

  return {
    id: r.id,
    eventSlug: r.event_slug,
    status: r.status,
    assignedDates: r.assigned_dates ?? [],
    marketCategory: r.market_category ?? "",
    starred: r.starred ?? false,
    submittedAt: r.submitted_at,
    contactName: r.contact_name,
    businessName: r.business_name,
    email: r.email,
    phone: r.phone,
    instagram: r.instagram ?? "",
    website: r.website ?? "",
    categories: r.categories as ApplicationData["categories"],
    otherCategory: r.other_category ?? "",
    productDetails: r.product_details ?? "",
    foodTypes: (food?.food_types ?? []) as ApplicationData["foodTypes"],
    otherFoodType: food?.other_food_type ?? "",
    menuItems: [...r.menu_items]
      .sort((a, b) => a.position - b.position)
      .map((m) => ({
        name: m.name,
        description: m.description ?? "",
        price: m.price ?? "",
        dietaryTags: m.dietary_tags as ApplicationData["menuItems"][number]["dietaryTags"],
      })),
    foodHandlerLicense: (food?.has_food_handler_license ?? undefined) as ApplicationData["foodHandlerLicense"],
    licenseNumber: food?.license_number ?? "",
    licenseExpiration: food?.license_expiration ?? "",
    firstChoice: pref(1),
    secondChoice: pref(2),
    thirdChoice: pref(3),
    availabilityNotes: r.availability_notes ?? "",
    needsElectricity: yn(r.needs_electricity),
    ...splitSetupNotes(r.setup_notes),
    agreements: r.agreements,
    files: r.uploaded_documents.map((d) => ({
      field: FIELDS_BY_TYPE[d.document_type] ?? "productImages",
      fileName: d.file_path.slice(d.file_path.indexOf("/") + 1),
      originalName: d.file_name,
      size: d.size_bytes ?? 0,
      type: d.content_type ?? "",
    })),
  };
}

async function listApplications(eventSlug?: string): Promise<StoredApplication[]> {
  let query = db().from("vendor_applications").select(SELECT).order("submitted_at", { ascending: false });
  if (eventSlug) query = query.eq("event_slug", eventSlug);
  const { data, error } = await query;
  if (error) throw new Error(`Loading applications failed: ${error.message}`);
  return (data as unknown as Row[]).map(toStored);
}

async function readUpload(applicationId: string, fileName: string) {
  const filePath = `${applicationId}/${fileName}`;
  const { data: doc } = await db()
    .from("uploaded_documents")
    .select("document_type, file_path, file_name, content_type, size_bytes")
    .eq("application_id", applicationId)
    .eq("file_path", filePath)
    .maybeSingle();
  if (!doc) return null;

  const { data, error } = await db().storage.from(BUCKET).download(filePath);
  if (error || !data) return null;
  const meta: StoredFile = {
    field: FIELDS_BY_TYPE[doc.document_type] ?? "productImages",
    fileName,
    originalName: doc.file_name,
    size: doc.size_bytes ?? data.size,
    type: doc.content_type ?? data.type,
  };
  return { meta, data: Buffer.from(await data.arrayBuffer()) };
}

async function updateSelection(applicationId: string, s: Selection): Promise<SelectionResult> {
  const updatedAt = new Date().toISOString();
  const { data, error } = await db()
    .from("vendor_applications")
    .update({ status: s.status, assigned_dates: s.assignedDates, market_category: s.marketCategory || null, updated_at: updatedAt })
    .eq("id", applicationId)
    .select("id");
  if (!error) return { ok: data.length > 0 };

  // Columns not added yet: save the status on its own so it isn't lost.
  if (/assigned_dates|market_category/.test(error.message)) {
    const retry = await db()
      .from("vendor_applications")
      .update({ status: s.status, updated_at: updatedAt })
      .eq("id", applicationId)
      .select("id");
    if (retry.error) throw new Error(`Saving vendor status failed: ${retry.error.message}`);
    return { ok: retry.data.length > 0, columnsMissing: true };
  }
  throw new Error(`Saving vendor selection failed: ${error.message}`);
}

async function setStarred(applicationId: string, starred: boolean): Promise<SelectionResult> {
  const { data, error } = await db()
    .from("vendor_applications")
    .update({ starred, updated_at: new Date().toISOString() })
    .eq("id", applicationId)
    .select("id");
  if (!error) return { ok: data.length > 0 };
  if (/starred/.test(error.message)) return { ok: false, columnsMissing: true };
  throw new Error(`Saving vendor star failed: ${error.message}`);
}

async function deleteApplication(applicationId: string): Promise<boolean> {
  const { data: docs } = await db().from("uploaded_documents").select("file_path").eq("application_id", applicationId);
  // Child rows (dates, food details, menu, documents) go with it via "on delete cascade".
  const { data, error } = await db().from("vendor_applications").delete().eq("id", applicationId).select("id");
  if (error) throw new Error(`Deleting application failed: ${error.message}`);
  // Everything under the vendor's folder, plus any listed path outside it.
  const { data: listed } = await db().storage.from(BUCKET).list(applicationId, { limit: 1000 });
  const paths = [
    ...new Set([
      ...(listed ?? []).map((f) => `${applicationId}/${f.name}`),
      ...(docs ?? []).map((d) => d.file_path as string),
    ]),
  ];
  if (paths.length > 0) await db().storage.from(BUCKET).remove(paths);
  return data.length > 0;
}

export const supabaseStore: ApplicationStore = {
  saveApplication,
  listApplications,
  readUpload,
  updateSelection,
  setStarred,
  deleteApplication,
};
