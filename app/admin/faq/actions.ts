"use server";

import { updateTag } from "next/cache";
import { headers } from "next/headers";
import { isAdminAuthorization } from "@/lib/admin-auth";
import { getEvent } from "@/lib/events";
import { createFaq, deleteFaq, FAQ_TAG, moveFaq, updateFaq } from "@/lib/faq";

async function requireAdmin() {
  if (!isAdminAuthorization((await headers()).get("authorization"))) throw new Error("Not authorized");
}

function text(form: FormData, key: string, max: number): string {
  return String(form.get(key) ?? "").trim().slice(0, max);
}

export async function addFaqAction(form: FormData) {
  await requireAdmin();
  const event = getEvent(text(form, "eventSlug", 100));
  const question = text(form, "question", 300);
  const answer = text(form, "answer", 4000);
  if (!event || !question || !answer) return;
  await createFaq(event.slug, question, answer);
  updateTag(FAQ_TAG);
}

export async function saveFaqAction(form: FormData) {
  await requireAdmin();
  const question = text(form, "question", 300);
  const answer = text(form, "answer", 4000);
  if (!question || !answer) return;
  await updateFaq(text(form, "id", 100), question, answer);
  updateTag(FAQ_TAG);
}

export async function deleteFaqAction(form: FormData) {
  await requireAdmin();
  await deleteFaq(text(form, "id", 100));
  updateTag(FAQ_TAG);
}

export async function moveFaqAction(form: FormData) {
  await requireAdmin();
  const event = getEvent(text(form, "eventSlug", 100));
  if (!event) return;
  await moveFaq(event.slug, text(form, "id", 100), form.get("direction") === "up" ? -1 : 1);
  updateTag(FAQ_TAG);
}
