import { requirePage } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { QUEUE_LIMIT, getReviewQueue } from "@/lib/screenings";
import { ReviewQueue } from "./review-queue";

export default async function ReviewQueuePage() {
  const { supabase, user, profile } = await requirePage("review");
  const role = profile?.role;
  const { cases, error } = await getReviewQueue(supabase, { id: user.id, role });
  return (
    <ReviewQueue
      cases={cases}
      loadError={error}
      limit={QUEUE_LIMIT}
      canAct={can(role, "review.act")}
      isSupervisor={can(role, "review.decideEscalated")}
    />
  );
}
