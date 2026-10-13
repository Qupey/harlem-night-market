import { readUpload } from "@/lib/store";

// Serve a vendor's uploaded document to an admin. Protected by proxy.ts.
export async function GET(_request: Request, ctx: RouteContext<"/api/admin/files/[id]/[file]">) {
  const { id, file } = await ctx.params;
  const found = await readUpload(id, decodeURIComponent(file));
  if (!found) return new Response("Not found", { status: 404 });
  return new Response(new Uint8Array(found.data), {
    headers: {
      "Content-Type": found.meta.type || "application/octet-stream",
      "Content-Disposition": `inline; filename="${found.meta.fileName}"`,
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "no-store",
    },
  });
}
