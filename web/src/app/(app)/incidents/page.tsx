import { redirect } from "next/navigation";
import { PageHeader } from "@/components/ui";
import { createClient } from "@/lib/supabase/server";
import { PHOTO_BUCKET } from "@/lib/incident-options";
import { IncidentForm } from "./incident-form";
import { IncidentHistory, type IncidentRow } from "./incident-history";

const HISTORY_LIMIT = 500;
const PHOTO_URL_SECONDS = 60 * 60;

export default async function IncidentsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [{ data: profile }, { data, error }] = await Promise.all([
    supabase.from("profiles").select("full_name, role").eq("id", user.id).single(),
    supabase
      .from("incidents")
      .select(
        `id, incident_date, block, suspected_disease, severity, action_taken, notes, reported_by, reporter_name,
         weather_rain_3d_mm, weather_rain_7d_mm, weather_humidity_mean_pct, weather_temp_mean_c,
         incident_symptoms(symptom), incident_photos(id, storage_path, created_at)`,
      )
      .order("incident_date", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(HISTORY_LIMIT),
  ]);

  const canManageAll = profile?.role === "supervisor" || profile?.role === "admin";
  const incidents = data ?? [];

  // The bucket is private: thumbnails use short-lived signed URLs.
  const paths = incidents.flatMap((i) => i.incident_photos.map((p) => p.storage_path));
  const signed = new Map<string, string>();
  if (paths.length) {
    const { data: urls } = await supabase.storage.from(PHOTO_BUCKET).createSignedUrls(paths, PHOTO_URL_SECONDS);
    for (const u of urls ?? []) if (u.path && u.signedUrl) signed.set(u.path, u.signedUrl);
  }

  const rows: IncidentRow[] = incidents.map((i) => ({
    id: i.id,
    date: i.incident_date,
    block: i.block,
    suspected: i.suspected_disease,
    severity: i.severity,
    action: i.action_taken,
    notes: i.notes,
    personnel: i.reporter_name,
    symptoms: i.incident_symptoms.map((s) => s.symptom),
    photos: [...i.incident_photos]
      .sort((a, b) => a.created_at.localeCompare(b.created_at))
      .map((p) => ({ id: p.id, url: signed.get(p.storage_path) ?? null })),
    weather: {
      rain3dMm: i.weather_rain_3d_mm,
      rain7dMm: i.weather_rain_7d_mm,
      humidityMeanPct: i.weather_humidity_mean_pct,
      tempMeanC: i.weather_temp_mean_c,
    },
    canDelete: canManageAll || i.reported_by === user.id,
  }));

  const reporterName = profile?.full_name?.trim() || user.email || "You";

  return (
    <div className="space-y-6">
      <PageHeader
        title="Incident Log"
        description="Record field incidents by block and review the history of past reports."
      />
      <IncidentForm userId={user.id} reporterName={reporterName} />
      <IncidentHistory rows={rows} loadError={Boolean(error)} limit={HISTORY_LIMIT} />
    </div>
  );
}
