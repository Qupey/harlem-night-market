import "server-only";
import { randomUUID } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { cacheLife, cacheTag } from "next/cache";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// FAQ entries shown on the event page and managed at /admin/faq.
// Saved in Supabase (faqs table) when configured, otherwise in ./data/faqs.json.

export type Faq = { id: string; eventSlug: string; question: string; answer: string; position: number };

export const FAQ_TAG = "faqs";

const supabaseOn = () => !!process.env.SUPABASE_URL && !!process.env.SUPABASE_SECRET_KEY;

let client: SupabaseClient | undefined;
function db(): SupabaseClient {
  client ??= createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return client;
}

type Row = { id: string; event_slug: string; question: string; answer: string; position: number };
const fromRow = (r: Row): Faq => ({ id: r.id, eventSlug: r.event_slug, question: r.question, answer: r.answer, position: r.position });

const FILE = path.join(process.env.DATA_DIR ?? path.join(process.cwd(), "data"), "faqs.json");

async function readFileFaqs(): Promise<Faq[]> {
  try {
    return JSON.parse(await readFile(FILE, "utf8")) as Faq[];
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw err;
  }
}

async function writeFileFaqs(faqs: Faq[]) {
  await mkdir(path.dirname(FILE), { recursive: true });
  const tmp = `${FILE}.${process.pid}.tmp`;
  await writeFile(tmp, JSON.stringify(faqs, null, 2));
  await rename(tmp, FILE);
}

/** Uncached read, for the admin page. */
export async function listFaqs(eventSlug: string): Promise<Faq[]> {
  if (supabaseOn()) {
    const { data, error } = await db()
      .from("faqs")
      .select("id, event_slug, question, answer, position")
      .eq("event_slug", eventSlug)
      .order("position");
    if (error) throw new Error(`Loading FAQs failed: ${error.message}`);
    return (data as Row[]).map(fromRow);
  }
  return (await readFileFaqs()).filter((f) => f.eventSlug === eventSlug).sort((a, b) => a.position - b.position);
}

/** Cached read for the public page; admin changes refresh it via FAQ_TAG. */
export async function getPublicFaqs(eventSlug: string): Promise<Faq[]> {
  "use cache";
  cacheTag(FAQ_TAG);
  cacheLife("hours");
  try {
    return await listFaqs(eventSlug);
  } catch (err) {
    // Don't take the event page down if the FAQ table is missing or unreachable.
    console.error(err);
    return [];
  }
}

export async function createFaq(eventSlug: string, question: string, answer: string) {
  const existing = await listFaqs(eventSlug);
  const position = existing.length ? existing[existing.length - 1].position + 1 : 0;
  if (supabaseOn()) {
    const { error } = await db().from("faqs").insert({ event_slug: eventSlug, question, answer, position });
    if (error) throw new Error(`Saving FAQ failed: ${error.message}`);
    return;
  }
  const all = await readFileFaqs();
  all.push({ id: randomUUID(), eventSlug, question, answer, position });
  await writeFileFaqs(all);
}

export async function updateFaq(id: string, question: string, answer: string) {
  if (supabaseOn()) {
    const { error } = await db().from("faqs").update({ question, answer, updated_at: new Date().toISOString() }).eq("id", id);
    if (error) throw new Error(`Saving FAQ failed: ${error.message}`);
    return;
  }
  const all = await readFileFaqs();
  await writeFileFaqs(all.map((f) => (f.id === id ? { ...f, question, answer } : f)));
}

export async function deleteFaq(id: string) {
  if (supabaseOn()) {
    const { error } = await db().from("faqs").delete().eq("id", id);
    if (error) throw new Error(`Deleting FAQ failed: ${error.message}`);
    return;
  }
  await writeFileFaqs((await readFileFaqs()).filter((f) => f.id !== id));
}

/** Swaps an FAQ with its neighbour above (-1) or below (+1). */
export async function moveFaq(eventSlug: string, id: string, direction: -1 | 1) {
  const list = await listFaqs(eventSlug);
  const i = list.findIndex((f) => f.id === id);
  const j = i + direction;
  if (i === -1 || j < 0 || j >= list.length) return;
  [list[i], list[j]] = [list[j], list[i]];
  // Renumber everything so positions stay unique and gap-free.
  if (supabaseOn()) {
    for (const [position, f] of list.entries()) {
      if (f.position === position) continue;
      const { error } = await db().from("faqs").update({ position }).eq("id", f.id);
      if (error) throw new Error(`Reordering FAQs failed: ${error.message}`);
    }
    return;
  }
  const order = new Map(list.map((f, position) => [f.id, position]));
  await writeFileFaqs((await readFileFaqs()).map((f) => (order.has(f.id) ? { ...f, position: order.get(f.id)! } : f)));
}
