import { requirePage } from "@/lib/auth";
import { ScreeningView } from "./screening-view";

export default async function ScreeningPage() {
  const { user } = await requirePage("screening");
  return <ScreeningView userId={user.id} />;
}
