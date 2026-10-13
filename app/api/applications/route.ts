import { NextResponse } from "next/server";
import { getEvent } from "@/lib/events";
import {
  ALLOWED_FILE_TYPES,
  applicationSchema,
  isFoodVendor,
  MAX_FILE_BYTES,
  MAX_FILES_PER_FIELD,
  UPLOAD_FIELDS,
  type UploadField,
} from "@/lib/schema";
import { saveApplication } from "@/lib/store";

// Receives the vendor application form: a JSON "data" field plus optional files.
export async function POST(request: Request) {
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ error: "Invalid submission." }, { status: 400 });
  }

  const event = getEvent(String(form.get("eventSlug") ?? ""));
  if (!event) return NextResponse.json({ error: "Unknown event." }, { status: 404 });
  if (!event.registrationOpen) {
    return NextResponse.json({ error: "Registration for this event is closed." }, { status: 403 });
  }

  let raw: unknown;
  try {
    raw = JSON.parse(String(form.get("data") ?? ""));
  } catch {
    return NextResponse.json({ error: "Invalid submission." }, { status: 400 });
  }

  const parsed = applicationSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Some fields need attention.", issues: parsed.error.issues.map((i) => ({ path: i.path, message: i.message })) },
      { status: 422 },
    );
  }
  const data = parsed.data;

  const validDates = new Set(event.dates.map((d) => d.id));
  for (const choice of [data.firstChoice, data.secondChoice, data.thirdChoice]) {
    if (choice && !validDates.has(choice)) {
      return NextResponse.json({ error: "One of the selected dates is not available." }, { status: 422 });
    }
  }

  if (data.needsElectricity !== "yes") data.electricityDetails = "";

  // Drop food-only data and files for non-food vendors.
  const food = isFoodVendor(data.categories);
  if (!food) {
    Object.assign(data, {
      foodTypes: [],
      otherFoodType: "",
      menuItems: [],
      foodHandlerLicense: undefined,
      licenseNumber: "",
      licenseExpiration: "",
    });
  }

  const uploads: { field: UploadField; file: File }[] = [];
  for (const [field, cfg] of Object.entries(UPLOAD_FIELDS) as [UploadField, (typeof UPLOAD_FIELDS)[UploadField]][]) {
    if (cfg.retired || (cfg.foodOnly && !food)) continue;
    const files = form.getAll(field).filter((v): v is File => v instanceof File && v.size > 0);
    if (files.length > (cfg.multiple ? MAX_FILES_PER_FIELD : 1)) {
      return NextResponse.json({ error: `Too many files for ${cfg.label}.` }, { status: 422 });
    }
    for (const file of files) {
      if (file.size > MAX_FILE_BYTES) {
        return NextResponse.json({ error: `${file.name} is larger than 10 MB.` }, { status: 422 });
      }
      if (!ALLOWED_FILE_TYPES.includes(file.type)) {
        return NextResponse.json({ error: `${file.name} must be a PDF or an image.` }, { status: 422 });
      }
      uploads.push({ field, file });
    }
  }

  try {
    const saved = await saveApplication(event.slug, data, uploads);
    return NextResponse.json({ id: saved.id }, { status: 201 });
  } catch (err) {
    console.error("Saving vendor application failed:", err);
    return NextResponse.json(
      { error: "We couldn't save your application just now. Please try again in a few minutes." },
      { status: 500 },
    );
  }
}
