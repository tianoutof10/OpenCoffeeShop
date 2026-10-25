# Approved translation terminology

French, Italian, Traditional Chinese and Simplified Chinese · 20 September 2026

All user-facing messages now have contextual draft translations: **1,000 of 1,002 catalog entries per language**. The two deliberately absent entries are date-format templates, not untranslated UI text. Their absence enables native locale formatting.

The owner approved the following terminology and subsequently approved release in v0.1.32. Draft translations still require native-speaker review; approval of product meaning is not native-language certification.

## 1. Early-stop calibration

**Where:** Settings → Prepare drinks → Early-stop calibration.

**Labels:** “Espresso” and “Hot water.”

**Helper:** “Compensates for liquid still reaching the cup after stopping. Higher values stop earlier.”

These controls adjust predictive stopping, not target beverage weight. The existing `weightFlowMultiplier` and `hotWaterFlowMultiplier` bindings, units, limits and defaults remain unchanged. The existing hot-water hint still explains that zero selects the default prediction instead of disabling it.

English, German and all four new languages now use the approved meaning. Stable translation keys `settings.prepare.espressoYield` and `settings.prepare.hotWaterYield` are retained despite the clearer visible labels.

## 2. Limiter range

**Where:** Profile editor → advanced settings.

**Labels:** “Flow limiter range” and “Pressure limiter range.”

**Helper:** “Controls the limiter’s response around its limit.”

This is the limiter’s response range, not sensor accuracy, an acceptable finished-drink deviation, or another stage exit condition. A pressure-controlled stage limits flow; a flow-controlled stage limits pressure. Numeric ranges and execution logic remain unchanged. Validation/import messages retain the precise “limiter response range” wording.

Stable translation keys retain their previous internal names; no profile or API migration is required.

Gateway modes, “Two-tap stop” and “Thirsty” were translated as existing labels per the earlier decision. No unresolved product-meaning questions remain.

## Terminology already applied

| Concept | Interpretation used |
| --- | --- |
| Dose | Dry ground-coffee mass; Chinese 粉量, not whole-bean quantity. |
| Yield | Beverage mass in the cup; French “masse en tasse,” Italian “peso in tazza,” Chinese 出杯液重. Never extraction percentage. |
| Ratio | Ground-coffee-to-beverage ratio. |
| Flow | A flow rate; Italian “portata,” not a vague movement/stream term. |
| Stage yield exit | A weight threshold for advancing the stage; wording does not claim incremental weight collected only during that stage. |
| Final target yield | Whole-shot stopping target, distinct from stage advance. |
| Fast / Smooth | Immediate versus gradual target transition; not coffee texture or faster brewing. |
| Manual advance / Manual stop | Two separate actions; never interchangeable. |
| Shot / pull | An extraction, not a physical pull or a drinking shot. |
| Brews in insights | Preparations/沖煮, broader than espresso-only extraction. |
| Profile | A brewing recipe/control profile, not an account profile or computer file. User-authored names are unchanged. |
| Tare | Zero the scale, not recalibrate it. |
| Ristretto / Lungo / Lungo+ | Preserve recognised recipe-style names; do not invent new recipe definitions. |
| Source | Profile origin; not source code. |
| Timer | Elapsed time; not a scheduled switch. |

Traditional Chinese uses Taiwan-oriented interface terminology; Simplified Chinese uses Mainland-oriented terminology. Regional number/date preferences such as Hong Kong and Singapore still come from the device. Native-speaker proofreading remains recommended, especially compact labels.

## Intentional date-format omissions

`insights.period.dayMonth` and `insights.period.dayOnly` remain absent in these catalogs. Their absence selects `Intl.DateTimeFormat` date ranges, including Chinese ordering and regional punctuation. Filling them with English-shaped templates would be a regression. Existing tests protect this behaviour.

## Review status

Keep placeholders, comparison operators, units and API values unchanged. The translation review system flags the new drafts and changed English/German wording for review; no review baseline has been automatically acknowledged.
