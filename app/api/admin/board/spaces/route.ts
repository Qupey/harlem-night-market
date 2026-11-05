import { events } from "@/lib/events";
import { listApplications, saveSpaces } from "@/lib/store";

const ALL_DATES = events.flatMap((e) => e.dates.map((d) => d.id));

// Market spaces: POST { date, changes } where changes maps a vendor id to a space number, or null to clear it.
// Protected by the admin password check in proxy.ts.
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const changes = body?.changes;
  const values: unknown[] = changes && typeof changes === "object" && !Array.isArray(changes) ? Object.values(changes) : [];
  if (
    !ALL_DATES.includes(body?.date) ||
    values.length === 0 ||
    !values.every((n) => n === null || (Number.isInteger(n) && (n as number) > 0 && (n as number) <= 10000))
  ) {
    return Response.json({ error: "Expected { date, changes } with each change a whole number above 0, or null" }, {
      status: 400,
    });
  }
  const numbers = values.filter((n) => n !== null);
  if (new Set(numbers).size !== numbers.length) {
    return Response.json({ error: "Two vendors can't share a space" }, { status: 400 });
  }

  const apps = await listApplications();
  for (const [id, n] of Object.entries(changes as Record<string, number | null>)) {
    const app = apps.find((a) => a.id === id);
    if (!app) return Response.json({ error: "Vendor not found" }, { status: 404 });
    if (n !== null && !(app.assignedDates ?? []).includes(body.date)) {
      return Response.json({ error: `${app.businessName} isn't booked for that date` }, { status: 400 });
    }
  }

  const result = await saveSpaces(body.date, changes);
  if (result.columnsMissing) {
    return Response.json(
      { error: "Run supabase/add-market-spaces.sql to save space numbers", tableMissing: true },
      { status: 409 },
    );
  }
  if (!result.ok) {
    return Response.json({ error: "That space was just taken. Reload the board and try again." }, { status: 409 });
  }
  return Response.json({ changes }, { headers: { "Cache-Control": "no-store" } });
}
