import { toCsv, toXlsx } from "@/lib/export";
import { listApplications } from "@/lib/store";

// Download all applications. ?format=xlsx (default) or ?format=csv.
// Protected by the admin password check in proxy.ts.
export async function GET(request: Request) {
  const url = new URL(request.url);
  const format = url.searchParams.get("format") === "csv" ? "csv" : "xlsx";
  const apps = await listApplications(url.searchParams.get("event") ?? undefined);
  const stamp = new Date().toISOString().slice(0, 10);
  const name = `vendor-applications-${stamp}.${format}`;

  const headers = {
    "Content-Disposition": `attachment; filename="${name}"`,
    "Cache-Control": "no-store",
  };
  if (format === "csv") {
    return new Response(toCsv(apps), { headers: { ...headers, "Content-Type": "text/csv; charset=utf-8" } });
  }
  const body = await toXlsx(apps);
  return new Response(new Uint8Array(body), {
    headers: { ...headers, "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" },
  });
}
