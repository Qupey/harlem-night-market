import "server-only";
import { randomUUID } from "node:crypto";
import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import type { ApplicationData } from "./schema";
import type { ApplicationStore, Selection, SelectionResult, StoredApplication, StoredFile, Upload } from "./store";

// Local file storage: keeps everything in ./data so the site runs on a laptop
// with no outside services. Used when Supabase isn't configured.

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

async function saveApplication(eventSlug: string, data: ApplicationData, uploads: Upload[]): Promise<StoredApplication> {
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

async function listApplications(eventSlug?: string): Promise<StoredApplication[]> {
  await writeQueue;
  const apps = await readAll();
  return apps
    .filter((a) => !eventSlug || a.eventSlug === eventSlug)
    .sort((a, b) => b.submittedAt.localeCompare(a.submittedAt));
}

async function readUpload(applicationId: string, fileName: string) {
  const apps = await readAll();
  const app = apps.find((a) => a.id === applicationId);
  const meta = app?.files.find((f) => f.fileName === fileName);
  if (!app || !meta) return null;
  return { meta, data: await readFile(path.join(UPLOAD_DIR, app.id, meta.fileName)) };
}

async function updateSelection(applicationId: string, selection: Selection): Promise<SelectionResult> {
  return updateFields(applicationId, selection);
}

async function updateFields(applicationId: string, fields: Partial<StoredApplication>): Promise<SelectionResult> {
  let found = false;
  const job = writeQueue.then(async () => {
    const apps = await readAll();
    const app = apps.find((a) => a.id === applicationId);
    if (!app) return;
    Object.assign(app, fields);
    found = true;
    await writeAll(apps);
  });
  writeQueue = job.catch(() => {});
  await job;
  return { ok: found };
}

async function setStarred(applicationId: string, starred: boolean): Promise<SelectionResult> {
  return updateFields(applicationId, { starred });
}

async function deleteApplication(applicationId: string): Promise<boolean> {
  let found = false;
  const job = writeQueue.then(async () => {
    const apps = await readAll();
    const rest = apps.filter((a) => a.id !== applicationId);
    if (rest.length === apps.length) return;
    found = true;
    await writeAll(rest);
    await rm(path.join(UPLOAD_DIR, safeName(applicationId)), { recursive: true, force: true });
  });
  writeQueue = job.catch(() => {});
  await job;
  return found;
}

export const localStore: ApplicationStore = {
  saveApplication,
  listApplications,
  readUpload,
  updateSelection,
  setStarred,
  deleteApplication,
};
