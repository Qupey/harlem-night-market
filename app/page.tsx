import { redirect } from "next/navigation";
import { defaultEventSlug } from "@/lib/events";

export default function Home() {
  redirect(`/events/${defaultEventSlug}`);
}
