import { requirePage } from "@/lib/auth";
import { ScreeningView } from "./screening-view";

export default async function ScreeningPage() {
  await requirePage("screening");
  return <ScreeningView />;
}
