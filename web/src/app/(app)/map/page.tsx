import { requirePage } from "@/lib/auth";
import { MapView } from "./map-view";

export default async function MapPage() {
  await requirePage("map");
  return <MapView />;
}
