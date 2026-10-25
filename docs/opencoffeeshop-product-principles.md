# OpenCoffeeShop product principles

## Product thesis
OpenCoffeeShop helps people make a better next espresso by connecting the coffee being brewed, what the machine observed, what the person tasted, and the next change worth trying.

It should feel like a beautifully composed coffee companion, a precise scientific instrument, and a dependable machine-control skin.

## The core loop
1. **Choose a coffee.** Keep origin, roaster, roast date, process, recipe and relevant machine capability together. Unknown data stays unknown.
2. **Brew.** Prioritize readiness, the selected recipe, the live extraction, and safe machine controls.
3. **Observe.** Preserve raw telemetry and label derived metrics, gaps and calibration assumptions.
4. **Taste.** Sensory notes come from the person, not telemetry pretending to taste the cup.
5. **Experiment.** Recommend one explainable adjustment and state what should remain constant.
6. **Learn.** Compare outcomes and update coffee-specific guidance only when evidence warrants it.

## Evidence contract
- **Measured:** directly reported by Decaid or a connected device.
- **Calculated:** computed from measured inputs with documented formula and units.
- **Observed pattern:** reproducible pattern across comparable shots.
- **Hypothesis:** plausible explanation that may be wrong.
- **Recommendation:** proposed next experiment, with rationale and uncertainty.
- **Applied:** setting change confirmed by the machine, not merely sent by the UI.

Do not infer taste from pressure or flow alone. Do not report extraction yield without suitable dissolved-solids measurement. Do not treat missing telemetry as zero. Confidence must reflect data quality, calibration and repeatability.

## Autocorrection and user agency
- Automatic analysis and recipe suggestions are encouraged.
- Machine-setting changes are explicit by default; future opt-in automation must be bounded, reversible and limited to safe between-shot workflows.
- Never silently change a live extraction or bypass machine safety constraints.
- Distinguish requested, pending, confirmed, failed and unknown command outcomes.
- Explain which variable is changing and why; prefer one controlled adjustment over changing multiple variables.
- Let users inspect, correct and reset learned coffee preferences.

## Visual principles
- **Brew mode:** calm, legible at a glance, action-oriented.
- **Lab mode:** deep detail, synchronized timelines, annotated curves and inspectable calculations.
- Use typography, spacing, line weight and color to encode hierarchy—not decorative noise.
- Keep pressure, flow, temperature and mass visually consistent across live shots, history and comparisons.
- Design connection loss, stale data, uncertainty, command failure and recovery as carefully as the ideal state.
- Preserve Decaid workflow power while progressively revealing advanced controls.

## Architecture guardrails
- Keep the React/Vite/TypeScript modular monolith until a concrete requirement proves it insufficient.
- Keep domain analysis deterministic and independent of React, network calls and browser storage.
- Treat Decaid as authority for live machine state and machine-side records; local storage owns only explicitly local preferences and coffee context or cache.
- Separate UI composition from workflows such as applying advice, reconciling history and issuing commands.
- Test formulas, command lifecycles, storage migrations, missing telemetry and regressions.
- Do not promote predictive claims to default recommendations until validated against representative real shots.

## Success measures
- A person can tell whether the machine is ready and what to do next without interpreting a chart.
- Comparable shots use the same definitions, units and time alignment.
- A recommendation names its evidence, expected effect, uncertainty and one proposed change.
- A setting is never shown as applied without confirmation.
- Returning users can recover what worked for a coffee and continue from there.
