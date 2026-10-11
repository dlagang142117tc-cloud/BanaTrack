import { requirePage } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { ReviewQueue } from "./review-queue";

export default async function ReviewQueuePage() {
  const { profile } = await requirePage("review");
  return <ReviewQueue canAct={can(profile?.role, "review.act")} />;
}
