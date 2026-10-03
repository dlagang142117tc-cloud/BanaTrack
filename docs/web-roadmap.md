# BanaTrack Web Roadmap

Goal: finish every web feature that needs neither plantation data nor the ML model. Placeholders (block list A1–D6, symptom list, severity scale) must stay easy to replace once the plantation provides the real ones. Wording rules from CLAUDE.md apply to every task.

## Incident Log
Make the Incident Log save real data.
Done means:
- [ ] A new incident saves to the database and survives a page refresh
- [ ] Multiple photos per incident upload to a private storage bucket and show as thumbnails in the history
- [ ] Personnel is the signed-in user from profiles, not hard-coded names
- [ ] Symptoms are stored as structured rows (one per symptom), not free text
- [ ] A weather snapshot (3-day and 7-day rainfall, mean humidity, mean temperature) is saved with each incident from Open-Meteo
- [ ] The history table reads real incidents, newest first, and search works
- [ ] Signed-in active users can read and create incidents; edit/delete is limited (for example reporter, supervisors, admins); deactivated users can do nothing
- [ ] Block list, symptom list and severity scale are easy to change later
- [ ] The "Sample data" tag is removed from the Incident Log only

## Dashboard and Reports
Requires Incident Log to be merged first.
Done means:
- [ ] Dashboard incident stat cards show real numbers
- [ ] Report filters (date range, area, disease) actually filter real incidents
- [ ] The report chart and table come from real data
- [ ] An empty state shows when there are no matching incidents
- [ ] "Sample data" tags are removed wherever data is now real; "Top review priority" stays sample until Screening and Review Queue is done

## Role-based access
Done means:
- [ ] A role matrix (which pages and actions each role gets) is written in docs/role-matrix.md and approved by Denns BEFORE coding
- [ ] The sidebar shows only the pages a role is allowed to use
- [ ] Typing a blocked page's URL redirects to the dashboard
- [ ] Server actions and database rules enforce the same limits, not just the UI
- [ ] Tested with each demo account (admin, supervisor, disease in-charge, field personnel)

## Screening and Review Queue
Uses the existing mock result; the real model is swapped in later.
Done means:
- [ ] New tables for screenings, review actions and model versions (tell Denns before adding the migration)
- [ ] Uploading a photo on Disease Screening saves the image, the mock result, the model version ("fusion-v0.0-mock"), the block and a timestamp
- [ ] Each screening creates a Review Queue item, sorted by case-review priority
- [ ] Confirm / Correct / Reject / Escalate are saved with reviewer, decision, corrected label and timestamp; the original AI output is never overwritten
- [ ] The Reviewed tab shows past decisions
- [ ] Only reviewer roles can act on cases
- [ ] The "Mock result" label stays on AI output; "not saved" demo wording is removed only where data is now saved

## Reports PDF export
Requires Dashboard and Reports to be merged first.
Done means:
- [ ] "Download PDF" produces a real PDF file (not the browser print dialog)
- [ ] The PDF includes the filters used, summary numbers, chart, table, date generated and who generated it

## Weather risk banner
Done means:
- [ ] At least two credible sources (peer-reviewed papers, FAO, or Philippine agencies such as DA, BPI or PCAARRD) on weather conditions linked to Moko or Panama disease are listed with links in docs/weather-sources.md
- [ ] The banner thresholds are updated to match the sources and cited in a code comment and in the banner, OR the banner is relabeled "Weather context" if no defensible thresholds are found
- [ ] The banner never claims to predict disease

## Plantation Map
Do this last. Requires Incident Log to be merged first.
Done means:
- [ ] Blocks are colored by real incident data (count or highest severity) using the placeholder block list
- [ ] Clicking a block shows its real incidents
- [ ] The layout is easy to replace with the plantation's real block layout later
