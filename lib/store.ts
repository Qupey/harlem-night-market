import "server-only";
import { randomUUID } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import type { ApplicationData, UploadField } from "./schema";

// Local file storage for applications. It keeps everything in ./data so the
// form works with no outside services. When Supabase is set up, replace the
// functions in this file with Supabase calls (see supabase/schema.sql); the
// rest of the app only uses saveApplication, listApplications and readUpload.

export type StoredFile = {
  field: UploadField;
  fileName: string; // name on disk, inside data/uploads/<applicationId>/
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

const DATA_DIR = process.env.DATA_DIR ?? path.join(process.cwd(), "data");
const DB_FILE = path.join(DATA_DIR, "applications.json");
const UPLOAD_DIR = path.join(DATA_DIR, "uploads");

// Serialize writes so two submissions arriving together can't overwrite each other.
let writeQueue: Promise<unknown> = Promise.resolve();

async function readAll(): Promise<StoredApplication[]> {
  try {
    return JSON.parse(await readFile(DB_FILE, "utf8")) as StoredApplication[];
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw err;
  }
}

async function writeAll(apps: StoredApplication[]) {
  await mkdir(DATA_DIR, { recursive: true });
  const tmp = `${DB_FILE}.${process.pid}.tmp`;
  await writeFile(tmp, JSON.stringify(apps, null, 2));
  await rename(tmp, DB_FILE);
}

function safeName(name: string): string {
  const base = path.basename(name).replace(/[^a-zA-Z0-9._-]+/g, "_").slice(-80);
  return base || "file";
}

export async function saveApplication(
  eventSlug: string,
  data: ApplicationData,
  uploads: { field: UploadField; file: File }[],
): Promise<StoredApplication> {
  const id = randomUUID();
  const dir = path.join(UPLOAD_DIR, id);
  const files: StoredFile[] = [];

  if (uploads.length > 0) await mkdir(dir, { recursive: true });
  for (const [i, { field, file }] of uploads.entries()) {
    const fileName = `${field}-${i + 1}-${safeName(file.name)}`;
    await writeFile(path.join(dir, fileName), Buffer.from(await file.arrayBuffer()));
    files.push({ field, fileName, originalName: file.name, size: file.size, type: file.type });
  }

  const app: StoredApplication = {
    ...data,
    id,
    eventSlug,
    status: "pending",
    submittedAt: new Date().toISOString(),
    files,
  };

  const job = writeQueue.then(async () => {
    const apps = await readAll();
    apps.push(app);
    await writeAll(apps);
  });
  writeQueue = job.catch(() => {});
  await job;
  return app;
}

export async function listApplications(eventSlug?: string): Promise<StoredApplication[]> {
  await writeQueue;
  const apps = await readAll();
  return apps
    .filter((a) => !eventSlug || a.eventSlug === eventSlug)
    .sort((a, b) => b.submittedAt.localeCompare(a.submittedAt));
}

export async function readUpload(applicationId: string, fileName: string) {
  const apps = await readAll();
  const app = apps.find((a) => a.id === applicationId);
  const meta = app?.files.find((f) => f.fileName === fileName);
  if (!app || !meta) return null;
  return { meta, data: await readFile(path.join(UPLOAD_DIR, app.id, meta.fileName)) };
}
