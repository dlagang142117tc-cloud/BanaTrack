# Weather and Moko / Panama disease — sources

Background for the dashboard's "Weather context" panel. The panel used to
show "Disease-favorable conditions: Low / Moderate / Elevated" from humidity,
temperature and rain thresholds that no source supports. It was replaced with
a neutral placeholder (forecast rain totals for the next 3 and 7 days) until
we consult our adviser.

## Sources

| Source | What it supports |
| --- | --- |
| PestNet, *Banana Fusarium wilt* fact sheet — <https://www.pestnet.org/fact_sheets/banana_fusarium_wilt_176.htm> | Panama disease (Fusarium wilt) spreads in surface run-off water and in soil carried on vehicles, tools and footwear; the fungus survives a long time in soil. |
| FAO / TR4 Global Network brochure — <https://www.fao.org/documents/card/zh/c/ca4534zh> | TR4 spreads through drainage water, surface run-off and floods. |
| Viljoen, A., FAO presentation, *Current status of Fusarium wilt disease of banana and future risks* — <https://fao.org/fileadmin/templates/banana/documents/Docs_Resources_2015/TR4/Current_status_of_Fusarium_wilt_disease_of_banana_and_future_risks-Altus_Viljoen.pdf> | Run-off water is a major source of TR4 spread; flooding and poor drainage contribute. |
| Australian Banana Growers' Council (ABGC), *Moko* — <https://abgc.org.au/?p=8181> | Moko spreads via plant material, soil, water and insects. |
| Farm Biosecurity, *Moko* fact sheet — <https://www.farmbiosecurity.com.au/wp-content/uploads/2019/03/Moko-FS.pdf> | Moko persists year-round; it spreads via soil and water run-off. |
| Dita, M., et al. (2018). Fusarium wilt of banana: current knowledge on epidemiology and research needs toward sustainable disease management. *Frontiers in Plant Science* — <https://www.ncbi.nlm.nih.gov/pmc/articles/PMC6202804/> | Review of Fusarium wilt epidemiology (spread, survival in soil, management). |

## Notes

- **No validated numeric thresholds.** None of these sources gives a rain,
  humidity or temperature threshold that has been validated for Moko or
  Panama disease. What they support is that water movement (run-off,
  drainage, floods) and soil movement spread the pathogens.
- **Humidity isn't linked.** No source links air humidity to these soil-borne
  wilts, so humidity should not drive any indicator.
- **Moko and water.** One source (the PestNet fact sheet on bugtok) says there
  is no evidence that *Ralstonia* spreads in water. That conflicts with the
  ABGC and Farm Biosecurity sheets, so water-related wording for Moko needs
  care.

## Options to discuss with the adviser

a. **Keep the panel as context only.** Show forecast rain with no
   interpretation (the current placeholder).

b. **A cited wet-conditions biosecurity reminder.** For example: "Heavy rain
   forecast: check drainage and clean tools, boots and vehicles between
   blocks." It would show when forecast rain passes a trigger that the team
   sets and documents. The trigger would be a team decision, not a validated
   threshold, and the reminder would cite the sources above.

c. **Test weather's contribution in the model.** The incident weather
   snapshots (3-day and 7-day rain, mean humidity, mean temperature) can be
   tested as an input in the multimodal model's ablation study, instead of
   assuming a link up front.

The feature title "Weather Risk Monitoring" may also need to change (see the
suggestions in §12 of the panel paper).
