import "server-only";
import ExcelJS from "exceljs";
import { dateLabel, getEvent } from "./events";
import { AGREEMENTS, isFoodVendor, LICENSE_OPTIONS, UPLOAD_FIELDS } from "./schema";
import { amountDueCents, dollars, PAYMENT_STATE_LABELS, paymentState } from "./payments";
import { MARKET_CATEGORIES, STATUS_LABELS } from "./selection";
import type { StoredApplication } from "./store";

type Column = { header: string; width: number; value: (a: StoredApplication) => string };

const money = (price: string) => `$${price.replace(/^\$/, "")}`;

const join = (xs: readonly string[] | undefined) => (xs ?? []).join(", ");

function filesFor(a: StoredApplication, field: keyof typeof UPLOAD_FIELDS) {
  return a.files
    .filter((f) => f.field === field)
    .map((f) => f.originalName)
    .join(", ");
}

// One row per application. Shared by the Excel and CSV exports.
const COLUMNS: Column[] = [
  { header: "Submitted", width: 20, value: (a) => new Date(a.submittedAt).toLocaleString("en-US", { timeZone: "America/New_York" }) },
  { header: "Status", width: 11, value: (a) => STATUS_LABELS[a.status] ?? a.status },
  {
    header: "Assigned Dates",
    width: 24,
    value: (a) => (a.assignedDates ?? []).map((d) => getEvent(a.eventSlug)?.dates.find((x) => x.id === d)?.short ?? d).join(", "),
  },
  { header: "Market Category", width: 16, value: (a) => a.marketCategory ?? "" },
  { header: "Payment", width: 16, value: (a) => (a.status === "accepted" || a.paid ? PAYMENT_STATE_LABELS[paymentState(a)] : "") },
  {
    header: "Fee Due",
    width: 10,
    value: (a) => (a.status === "accepted" && (a.assignedDates ?? []).length > 0 ? dollars(amountDueCents(a)) : ""),
  },
  { header: "Amount Paid", width: 12, value: (a) => (a.paid && a.amountPaidCents != null ? dollars(a.amountPaidCents) : "") },
  {
    header: "Paid On",
    width: 14,
    value: (a) => (a.paidAt ? new Date(a.paidAt).toLocaleDateString("en-US", { timeZone: "America/New_York" }) : ""),
  },
  { header: "Payment Method", width: 14, value: (a) => a.paymentMethod ?? "" },
  { header: "Payment ID", width: 30, value: (a) => a.paymentId ?? "" },
  {
    header: "Invite Sent",
    width: 14,
    value: (a) => (a.invitedAt ? new Date(a.invitedAt).toLocaleDateString("en-US", { timeZone: "America/New_York" }) : ""),
  },
  { header: "Event", width: 22, value: (a) => getEvent(a.eventSlug)?.name ?? a.eventSlug },
  { header: "Business Name", width: 26, value: (a) => a.businessName },
  { header: "Contact Name", width: 22, value: (a) => a.contactName },
  { header: "Email", width: 28, value: (a) => a.email },
  { header: "Phone", width: 16, value: (a) => a.phone },
  { header: "Instagram", width: 18, value: (a) => a.instagram ?? "" },
  { header: "Website", width: 24, value: (a) => a.website ?? "" },
  { header: "Categories", width: 28, value: (a) => join(a.categories) },
  { header: "Other Category", width: 18, value: (a) => a.otherCategory ?? "" },
  { header: "Additional Details", width: 40, value: (a) => a.productDetails ?? "" },
  { header: "Food Vendor", width: 12, value: (a) => (isFoodVendor(a.categories) ? "Yes" : "No") },
  { header: "Food Types", width: 24, value: (a) => join(a.foodTypes) + (a.otherFoodType ? ` (${a.otherFoodType})` : "") },
  {
    header: "Menu Items",
    width: 40,
    value: (a) =>
      a.menuItems.map((m) => `${m.name}${m.price ? ` (${money(m.price)})` : ""}`).join("; "),
  },
  {
    header: "Food Handler License",
    width: 14,
    value: (a) => LICENSE_OPTIONS.find((o) => o.value === a.foodHandlerLicense)?.label ?? "",
  },
  { header: "License Number", width: 16, value: (a) => a.licenseNumber ?? "" },
  { header: "License Expiration", width: 14, value: (a) => a.licenseExpiration ?? "" },
  { header: "1st Choice Date", width: 26, value: (a) => dateLabel(getEvent(a.eventSlug), a.firstChoice) },
  { header: "2nd Choice Date", width: 26, value: (a) => dateLabel(getEvent(a.eventSlug), a.secondChoice) },
  { header: "3rd Choice Date", width: 26, value: (a) => dateLabel(getEvent(a.eventSlug), a.thirdChoice) },
  { header: "Availability Notes", width: 30, value: (a) => a.availabilityNotes ?? "" },
  { header: "Electricity", width: 10, value: (a) => (a.needsElectricity === "yes" ? "Yes" : "No") },
  { header: "Electricity Details", width: 30, value: (a) => a.electricityDetails ?? "" },
  { header: "Setup Notes", width: 30, value: (a) => a.setupNotes ?? "" },
  { header: "Food License File", width: 20, value: (a) => filesFor(a, "foodLicenseFile") },
  { header: "DOH Permit File", width: 20, value: (a) => filesFor(a, "dohPermitFile") },
  { header: "Insurance File", width: 20, value: (a) => filesFor(a, "insuranceFile") },
  {
    header: "Agreements Accepted",
    width: 12,
    value: (a) => (AGREEMENTS.every((g) => g.key === "foodPermits" || a.agreements[g.key]) ? "Yes" : "No"),
  },
  { header: "Application ID", width: 38, value: (a) => a.id },
];

// In a CSV, spreadsheet apps run cell text that starts with these characters
// as a formula, so prefix it to keep vendor-typed text as plain text. Cells in
// the .xlsx are typed as text already, so it doesn't need this.
function plain(text: string): string {
  return /^[=+\-@\t\r]/.test(text) ? `'${text}` : text;
}

export async function toXlsx(apps: StoredApplication[]): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "Harlem Night Market";
  wb.created = new Date();

  const sheet = wb.addWorksheet("Applications", { views: [{ state: "frozen", ySplit: 1 }] });
  sheet.columns = COLUMNS.map((c) => ({ header: c.header, width: c.width }));
  for (const a of apps) sheet.addRow(COLUMNS.map((c) => c.value(a)));
  styleHeader(sheet);
  sheet.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: COLUMNS.length } };

  const menu = wb.addWorksheet("Menu Items", { views: [{ state: "frozen", ySplit: 1 }] });
  menu.columns = [
    { header: "Business Name", width: 26 },
    { header: "Item", width: 26 },
    { header: "Description", width: 40 },
    { header: "Price", width: 10 },
    { header: "Dietary Tags", width: 30 },
    { header: "Application ID", width: 38 },
  ];
  for (const a of apps) {
    for (const m of a.menuItems) {
      menu.addRow([a.businessName, m.name, m.description ?? "", m.price ? money(m.price) : "", join(m.dietaryTags), a.id]);
    }
  }
  styleHeader(menu);

  return Buffer.from(await wb.xlsx.writeBuffer());
}

function styleHeader(sheet: ExcelJS.Worksheet) {
  const header = sheet.getRow(1);
  header.font = { bold: true, color: { argb: "FFFFFFFF" } };
  header.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1F1A2E" } };
  header.alignment = { vertical: "middle", wrapText: true };
  header.height = 30;
}

export function toCsv(apps: StoredApplication[]): string {
  const cell = (v: string) => `"${plain(v).replace(/"/g, '""')}"`;
  const lines = [
    COLUMNS.map((c) => cell(c.header)).join(","),
    ...apps.map((a) => COLUMNS.map((c) => cell(c.value(a))).join(",")),
  ];
  // Leading BOM so Excel opens accented characters correctly.
  return "﻿" + lines.join("\r\n") + "\r\n";
}

// Per-market vendor lists: accepted vendors on one market date, by category.
const MARKET_HEADERS = ["Category", "Business Name", "Contact Name", "Email", "Phone"];
const MARKET_WIDTHS = [16, 30, 24, 32, 16];

const categoryRank = (c: string | undefined) => {
  const i = (MARKET_CATEGORIES as readonly string[]).indexOf(c ?? "");
  return i === -1 ? MARKET_CATEGORIES.length : i;
};

/** Accepted vendors assigned to a date, sorted by category then business name. */
export function vendorsForDate(apps: StoredApplication[], dateId: string): StoredApplication[] {
  return apps
    .filter((a) => a.status === "accepted" && (a.assignedDates ?? []).includes(dateId))
    .sort((a, b) => categoryRank(a.marketCategory) - categoryRank(b.marketCategory) || a.businessName.localeCompare(b.businessName));
}

const marketRow = (a: StoredApplication) => [a.marketCategory || "No category", a.businessName, a.contactName, a.email, a.phone];

export async function toMarketXlsx(markets: { name: string; apps: StoredApplication[] }[]): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "Harlem Night Market";
  wb.created = new Date();
  for (const m of markets) {
    const sheet = wb.addWorksheet(m.name, { views: [{ state: "frozen", ySplit: 1 }] });
    sheet.columns = MARKET_HEADERS.map((header, i) => ({ header, width: MARKET_WIDTHS[i] }));
    for (const a of m.apps) sheet.addRow(marketRow(a));
    styleHeader(sheet);
  }
  return Buffer.from(await wb.xlsx.writeBuffer());
}

export function toMarketCsv(apps: StoredApplication[]): string {
  const cell = (v: string) => `"${plain(v).replace(/"/g, '""')}"`;
  const lines = [MARKET_HEADERS.map(cell).join(","), ...apps.map((a) => marketRow(a).map(cell).join(","))];
  return "\uFEFF" + lines.join("\r\n") + "\r\n";
}
