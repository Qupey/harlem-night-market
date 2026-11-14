import { requireAdmin, unauthorized } from "@/lib/admin-auth";
import { ALLOWED_FILE_TYPES } from "@/lib/schema";
import { readUpload } from "@/lib/store";

// Serve a vendor's uploaded document to an admin. Admins only.
export async function GET(request: Request, ctx: RouteContext<"/api/admin/files/[id]/[file]">) {
  if (!(await requireAdmin(request))) return unauthorized();
  const { id, file } = await ctx.params;
  const found = await readUpload(id, decodeURIComponent(file));
  if (!found) return new Response("Not found", { status: 404 });
  // Vendor files are untrusted. Only known image and PDF types open in the browser; anything
  // else downloads. Images also get a sandbox so they can never run scripts.
  const type = ALLOWED_FILE_TYPES.includes(found.meta.type) ? found.meta.type : "application/octet-stream";
  const inline = type !== "application/octet-stream";
  const name = found.meta.fileName.replace(/[^\w.-]/g, "_");
  return new Response(new Uint8Array(found.data), {
    headers: {
      "Content-Type": type,
      "Content-Disposition": `${inline ? "inline" : "attachment"}; filename="${name}"`,
      "X-Content-Type-Options": "nosniff",
      ...(type.startsWith("image/") ? { "Content-Security-Policy": "default-src 'none'; img-src 'self'; sandbox" } : { "Content-Security-Policy": "frame-ancestors 'none'" }),
      "Cache-Control": "no-store",
    },
  });
}
