import type { NextRequest } from "next/server";
import { getActiveUser } from "@/lib/auth";
import { getReport, parseReportFilters } from "@/lib/incident-stats";
import { can } from "@/lib/permissions";
import { ROLE_LABELS, isRole } from "@/lib/roles";
import { reportFileName, reportSeries } from "@/lib/report-view";
import { renderReportPdf } from "../report-pdf";

/**
 * GET /reports/export?from=&to=&area=&disease=&status= — the Reports page as
 * a PDF download. Takes the same filters as the page and checks the role here,
 * so the report can't be downloaded by calling the URL directly.
 */
export async function GET(request: NextRequest) {
  const me = await getActiveUser();
  if (!me) return text("Sign in again to download the report.", 401);
  if (!can(me.role, "reports.view")) return text("Your role can't download reports.", 403);

  const parsed = parseReportFilters(Object.fromEntries(request.nextUrl.searchParams));
  if (!parsed) return text("Choose report filters first.", 400);
  if (parsed.error) return text(parsed.error, 400);

  const report = await getReport(me.supabase, parsed.filters);
  if (!report) return text("The report couldn't be loaded. Check your connection and try again.", 500);

  const pdf = await renderReportPdf({
    filters: parsed.filters,
    report,
    series: reportSeries(parsed.filters, report),
    generatedAt: new Date(),
    generatedBy: {
      name: me.profile.full_name || me.user.email || "Unknown user",
      role: isRole(me.role) ? ROLE_LABELS[me.role] : me.role,
    },
  });

  return new Response(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${reportFileName(parsed.filters)}"`,
      "Cache-Control": "private, no-store",
    },
  });
}

function text(message: string, status: number) {
  return new Response(message, { status, headers: { "Content-Type": "text/plain; charset=utf-8" } });
}
