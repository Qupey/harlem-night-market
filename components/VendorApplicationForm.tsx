"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm, useWatch, type FieldErrors, type FieldPath } from "react-hook-form";
import type { EventDate } from "@/lib/events";
import {
  AGREEMENTS,
  applicationSchema,
  CATEGORIES,
  isFoodVendor,
  SPACE_OPTIONS,
  UPLOAD_FIELDS,
  type ApplicationData,
  type ApplicationInput,
  type UploadField,
} from "@/lib/schema";
import { FileUploadField } from "./FileUploadField";
import { FoodVendorFields } from "./FoodVendorFields";
import { Choice, ErrorText, Field, Section } from "./form-ui";

const CHOICES = [
  { name: "firstChoice", label: "First choice date" },
  { name: "secondChoice", label: "Second choice date" },
  { name: "thirdChoice", label: "Third choice date" },
] as const;

const YES_NO_FIELDS = [
  { name: "needsElectricity", label: "Do you need electricity?" },
  { name: "needsTable", label: "Do you need a table?" },
  { name: "needsChairs", label: "Do you need chairs?" },
] as const;

export function VendorApplicationForm({ eventSlug, dates }: { eventSlug: string; dates: EventDate[] }) {
  const router = useRouter();
  const [files, setFiles] = useState<Partial<Record<UploadField, File[]>>>({});
  const [submitError, setSubmitError] = useState<string | null>(null);

  const form = useForm<ApplicationInput, unknown, ApplicationData>({
    resolver: zodResolver(applicationSchema),
    defaultValues: {
      categories: [],
      foodTypes: [],
      menuItems: [],
      availableAllDates: false,
      agreements: {
        noGuarantee: false as unknown as true,
        followRules: false as unknown as true,
        accurateInfo: false as unknown as true,
        foodPermits: false,
        contactConsent: false as unknown as true,
      },
    },
  });
  const {
    register,
    handleSubmit,
    control,
    setError,
    formState: { errors, isSubmitting },
  } = form;

  const categories = useWatch({ control, name: "categories" });
  const food = isFoodVendor(categories);
  const spaceNeeded = useWatch({ control, name: "spaceNeeded" });
  const availableAll = useWatch({ control, name: "availableAllDates" });

  async function onSubmit(data: ApplicationData) {
    setSubmitError(null);
    const body = new FormData();
    body.set("eventSlug", eventSlug);
    body.set("data", JSON.stringify(data));
    for (const [field, list] of Object.entries(files) as [UploadField, File[]][]) {
      if (UPLOAD_FIELDS[field].foodOnly && !food) continue;
      for (const f of list) body.append(field, f);
    }

    try {
      const res = await fetch("/api/applications", { method: "POST", body });
      if (res.ok) {
        router.push("/application/thank-you");
        return;
      }
      const json = (await res.json().catch(() => ({}))) as {
        error?: string;
        issues?: { path: (string | number)[]; message: string }[];
      };
      for (const issue of json.issues ?? []) {
        setError(issue.path.join(".") as FieldPath<ApplicationInput>, { message: issue.message });
      }
      setSubmitError(json.error ?? "Something went wrong. Please try again.");
    } catch {
      setSubmitError("We couldn't reach the server. Check your connection and try again.");
    }
  }

  const hasErrors = Object.keys(errors).length > 0;

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-8">
      <Section title="Contact information">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Contact name" required error={errors.contactName}>
            <input className="field-input" autoComplete="name" {...register("contactName")} />
          </Field>
          <Field label="Business name" required error={errors.businessName}>
            <input className="field-input" autoComplete="organization" {...register("businessName")} />
          </Field>
          <Field label="Email" required error={errors.email}>
            <input className="field-input" type="email" autoComplete="email" {...register("email")} />
          </Field>
          <Field label="Phone number" required error={errors.phone}>
            <input className="field-input" type="tel" autoComplete="tel" {...register("phone")} />
          </Field>
          <Field label="Instagram" error={errors.instagram}>
            <input className="field-input" placeholder="@yourbusiness" {...register("instagram")} />
          </Field>
          <Field label="Website" error={errors.website}>
            <input className="field-input" type="url" placeholder="https://" {...register("website")} />
          </Field>
          <div className="sm:col-span-2">
            <Field label="Business address" error={errors.businessAddress}>
              <input className="field-input" autoComplete="street-address" {...register("businessAddress")} />
            </Field>
          </div>
        </div>
      </Section>

      <Section title="What do you sell?" description="Choose all that apply.">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {CATEGORIES.map((c) => (
            <Choice key={c} type="checkbox" value={c} label={c} {...register("categories")} />
          ))}
        </div>
        <ErrorText error={errors.categories} />
        {categories?.includes("Other") && (
          <div className="mt-4">
            <Field label="What else do you sell?" required error={errors.otherCategory}>
              <input className="field-input" {...register("otherCategory")} />
            </Field>
          </div>
        )}
      </Section>

      {food && (
        <Section title="Food vendor details" description="Because you selected a food category.">
          <FoodVendorFields form={form} files={files} setFiles={setFiles} />
        </Section>
      )}

      <Section title="Event preferences" description="Rank the market dates that work best for you.">
        <div className="grid gap-4 sm:grid-cols-3">
          {CHOICES.map(({ name, label }) => (
            <Field key={name} label={label} required={name === "firstChoice" && !availableAll} error={errors[name]}>
              <select className="field-input" {...register(name)}>
                <option value="">No preference</option>
                {dates.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.label}
                  </option>
                ))}
              </select>
            </Field>
          ))}
        </div>
        <div className="mt-4">
          <Choice type="checkbox" label="I'm available for all dates" {...register("availableAllDates")} />
        </div>
        <div className="mt-4">
          <Field label="Notes about availability" error={errors.availabilityNotes}>
            <textarea className="field-input" rows={2} {...register("availabilityNotes")} />
          </Field>
        </div>
      </Section>

      <Section title="Setup details">
        <Field label="How much space do you need?" required group error={errors.spaceNeeded}>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {SPACE_OPTIONS.map((s) => (
              <Choice key={s} type="radio" value={s} label={s} {...register("spaceNeeded")} />
            ))}
          </div>
        </Field>
        {spaceNeeded === "Other" && (
          <div className="mt-4">
            <Field label="Describe the space you need" required error={errors.spaceOther}>
              <input className="field-input" {...register("spaceOther")} />
            </Field>
          </div>
        )}
        <div className="mt-6 grid gap-4 sm:grid-cols-3">
          {YES_NO_FIELDS.map(({ name, label }) => (
            <Field key={name} label={label} required group error={errors[name]}>
              <div className="flex gap-2">
                <Choice type="radio" value="yes" label="Yes" className="flex-1" {...register(name)} />
                <Choice type="radio" value="no" label="No" className="flex-1" {...register(name)} />
              </div>
            </Field>
          ))}
        </div>
        <div className="mt-6">
          <Field label="Special setup notes" error={errors.setupNotes}>
            <textarea className="field-input" rows={3} {...register("setupNotes")} />
          </Field>
        </div>
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <FileUploadField field="logo" files={files} setFiles={setFiles} />
          <FileUploadField field="productImages" files={files} setFiles={setFiles} />
        </div>
      </Section>

      <Section title="Agreements">
        <div className="space-y-2">
          {AGREEMENTS.filter((a) => food || a.key !== "foodPermits").map((a) => (
            <div key={a.key}>
              <Choice type="checkbox" label={a.label} {...register(`agreements.${a.key}`)} />
              <ErrorText error={(errors.agreements as FieldErrors<ApplicationInput["agreements"]> | undefined)?.[a.key]} />
            </div>
          ))}
        </div>
      </Section>

      <div className="border-t border-line pt-6">
        {(submitError || hasErrors) && (
          <p role="alert" className="mb-4 rounded-lg border border-pink bg-pink/15 px-4 py-3 text-sm text-cream">
            {submitError ?? "Some fields need attention. Please check the highlighted items above."}
          </p>
        )}
        <button type="submit" className="btn-primary w-full sm:w-auto" disabled={isSubmitting}>
          {isSubmitting ? "Submitting..." : "Submit application"}
        </button>
      </div>
    </form>
  );
}
