# BanaTrack — Build Prompt for Claude Code

Paste this whole document as your first message to Claude Code once logged in. It reflects the panel's post-outline-defense revision requirements and matches the clickable hi-fi prototype we already reviewed as a group — treat the prototype as the reference for layout/flow, not a locked spec. Flag any section below you want changed before building; nothing here is final.

---

## 1. Project Summary

BanaTrack is a web-based, multimodal, uncertainty-aware disease screening and decision-support system for a banana plantation in Tagum City, Davao del Norte, focused on **Moko** (bacterial wilt) and **Panama disease** (Fusarium wilt). It is a screening/triage tool, not a diagnostic authority — AI output always routes through human confirmation.

Per panel direction, the system must answer, in order of ambition:
1. What disease-related visual pattern is in the image?
2. Where are the symptoms, and how extensive (severity)?
3. Does combining image + weather + field observations improve screening/triage vs. image alone?
4. When should the system abstain and ask for human review?
5. Why did it produce that result, how uncertain is it, and what did the human reviewer decide?

**Wording constraint (panel-mandated):** never say "predicts disease" or "probability of infection." Use "screening result," "severity estimate," "case-review priority," "escalation recommendation."

---

## 2. Objectives, Features, and Tech (Tier 1 — build this first)

This is the panel's stated **minimum acceptable version**. Build this fully before attempting anything further.

| # | Objective/Feature | Tech |
|---|---|---|
| 1 | User & role management (Admin, Supervisor, Disease In-Charge, Field Personnel) | Next.js + Supabase (auth + RBAC) |
| 2 | Weather module — 7-day forecast + disease-favorable-conditions risk banner (contextual indicator, not a diagnosis) | Open-Meteo API |
| 3 | Disease localization & severity estimation (not plain classification) | YOLOv8 (Ultralytics) trained on Roboflow-annotated images, via Google Colab |
| 4 | Multimodal fusion — combine image features + weather + field observations + incident history | PyTorch (image side) + scikit-learn/XGBoost (tabular side) fused at feature level |
| 5 | Confidence-aware case-review priority (High/Medium/Low), not a spread-prediction | Rule/score combining calibrated confidence + severity + field notes + weather |
| 6 | Calibration + abstention ("inconclusive" state when confidence is low or image is unusable) | scikit-learn calibration tools (Platt/isotonic) + defined threshold |
| 7 | Human-in-the-loop review (confirm / correct / reject / escalate), logged with model version + timestamp | Supabase table for review actions |
| 8 | Explainability (why did the model decide this) | Grad-CAM (image) + SHAP (tabular factors) |
| 9 | Incident recording & area-based mapping (block-level, not per-tree) | Supabase (incident data + photo storage) + Leaflet.js/react-leaflet or a simple styled block-grid map |
| 10 | Field robustness testing (blur, poor lighting, distance, clutter) held out from training | `albumentations` for generating test perturbations; a dedicated field-only holdout set |
| 11 | Reports + model version/performance tracking | react-pdf/jsPDF for exports; Supabase table logging model version + accuracy per version |
| 12 | ISO/IEC 25010 software quality evaluation (functional suitability, reliability, usability) | Manual test plan + System Usability Scale (SUS) survey with end-users |

**Baselines required for the core experiment (panel-mandated):** build and compare (a) image-only model, (b) weather+observations-only (tabular) model, (c) the fused multimodal model — this comparison is the actual research contribution, not a UI feature. Track this as its own deliverable, separate from the app.

---

## 3. Two-Codebase Architecture

- **Web app** (Next.js + Supabase + Leaflet + Vercel) — everything user-facing: dashboards, forms, review queue, map, reports.
- **ML service** (Python: YOLOv8/PyTorch training scripts + a FastAPI inference endpoint) — trained separately (Colab), served via FastAPI hosted on Render/Railway/Hugging Face Spaces, called by the web app when a photo is submitted.

Do not try to run the vision/fusion model in-browser (TensorFlow.js) — it's no longer just a simple classifier, so it needs a real backend service.

---

## 4. Reference: Hi-Fi Prototype Screens

Use this as the UX reference (link: the BanaTrack prototype artifact already shared with the team), but treat it as a **flexible starting point** — the team may request layout, copy, or flow changes before or during build:

1. **Login** — role selection (Admin/Supervisor/Disease In-Charge/Field Personnel), role determines visible features
2. **Dashboard** — 7-day weather + risk banner, incident stats, top review-priority cases, (Admin-only) model governance card
3. **Disease Screening** — upload photo → predicted class, calibrated confidence, severity %, localization overlay, contributing evidence (image+weather+history), abstention/inconclusive state
4. **Incident Log** — recording form (date, block, symptoms, personnel, action, notes) + history table
5. **Review Queue** — AI-flagged cases sorted by priority, confirm/correct/reject/escalate actions, expandable evidence detail
6. **Plantation Map** — block-level severity visualization, clickable block detail
7. **Reports** — filterable report generator, chart, PDF export, model version/accuracy footer

Note: the evaluation/baseline-comparison work (Section 2's required experiment) was deliberately **not** put in the prototype UI, since it needs real results, not mockup numbers — treat it as a backend/analysis deliverable and a section in the written report, not a screen.

---

## 5. Suggested Build Order

1. Next.js project setup + Supabase (auth, roles, database schema)
2. Weather module (Open-Meteo integration)
3. Incident recording + photo storage
4. Data audit + collection + annotation (Roboflow) — confirm what's actually available from the plantation before committing further
5. Train baseline vision model (image-only, YOLOv8) in Colab
6. Train tabular-only baseline (weather + observations)
7. Build and train the fused multimodal model; compare against both baselines
8. Add calibration + abstention logic
9. FastAPI serving layer connecting the web app to the trained model
10. Human-in-the-loop review queue + logging
11. Explainability layer (Grad-CAM + SHAP)
12. Map view
13. Field robustness testing with a held-out, never-trained-on test set
14. Reports + model version tracking
15. ISO/IEC 25010 testing (functional test plan + SUS survey)

---

## 6. Open Items to Confirm With the Team Before/During Build

- Confirm actual data availability from the plantation (labeled images, weather-aligned records, expert review capacity) — this determines whether the full Tier 1 scope is realistic or needs to shrink further per the panel's own feasibility decision tree
- Confirm any prototype changes the team wants before Claude Code starts building the real UI
- Confirm hosting choice for the FastAPI service (Render vs. Railway vs. Hugging Face Spaces)
