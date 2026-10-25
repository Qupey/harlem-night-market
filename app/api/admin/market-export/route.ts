import { events } from "@/lib/events";
import { toMarketCsv, toMarketXlsx, vendorsForDate } from "@/lib/export";
import { listApplications } from "@/lib/store";

// Accepted vendors per market date. ?date=2026-12-05 for one market (omit for
// all markets, one sheet each in the .xlsx); ?format=xlsx (default) or csv.
// Protected by the admin password check in proxy.ts.
export async function GET(request: Request) {
  const url = new URL(request.url);
  const format = url.searchParams.get("format") === "csv" ? "csv" : "xlsx";
  const dateId = url.searchParams.get("date");
  const dates = events.flatMap((e) => e.dates).filter((d) => !dateId || d.id === dateId);
  if (dates.length === 0) return new Response("Unknown market date", { status: 404 });
  if (format === "csv" && dates.length > 1) return new Response("Pick one date for CSV", { status: 400 });

  const apps = await listApplications();
  const markets = dates.map((d) => ({ name: d.short, apps: vendorsForDate(apps, d.id) }));
  const name = `market-vendors-${dateId ?? "all-dates"}.${format}`;
  const headers = { "Content-Disposition": `attachment; filename="${name}"`, "Cache-Control": "no-store" };

  if (format === "csv") {
    return new Response(toMarketCsv(markets[0].apps), { headers: { ...headers, "Content-Type": "text/csv; charset=utf-8" } });
  }
  const body = await toMarketXlsx(markets);
  return new Response(new Uint8Array(body), {
    headers: { ...headers, "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" },
  });
}
