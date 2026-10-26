import { reminderEmail, sendEmail } from "@/lib/email";
import { reminderDue } from "@/lib/payments";
import { listApplications, updatePayment } from "@/lib/store";

// Runs daily (vercel.json): emails one reminder to each vendor invited 7+ days ago who hasn't paid.
// Vercel sends "Authorization: Bearer <CRON_SECRET>"; anything else is turned away.
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return new Response("Unauthorized", { status: 401 });
  }
  if (!process.env.RESEND_API_KEY) return Response.json({ skipped: "RESEND_API_KEY is not set" });

  const due = (await listApplications()).filter((a) => reminderDue(a));
  const results = [];
  for (const a of due) {
    const sent = await sendEmail(a.email, reminderEmail(a));
    if (sent.sent) await updatePayment(a.id, { reminderSentAt: new Date().toISOString() });
    results.push({ business: a.businessName, sent: sent.sent });
  }
  return Response.json({ reminders: results });
}
