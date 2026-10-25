# Hot water and steam card integration

The approved counterproposal is integrated into the real homescreen on
`design/quiet-utility-cards`. Reservoir, scale, profiles, insights, and history
retain their existing layout and behavior.

## Controls and data

| Card control | Existing Decaid workflow field |
| --- | --- |
| Hot water — Temperature | `hotWaterData.targetTemperature` |
| Hot water — Volume | `hotWaterData.volume` |
| Hot water — Max duration | `hotWaterData.duration` |
| Steam — Temperature target | `steamSettings.targetTemperature` |
| Steam — Flow | `steamSettings.flow` |
| Steam — Max duration | `steamSettings.duration` |

All controls use the existing value-adjustment overlay and persistence paths,
not a second settings store. Hot-water changes use the shared synchronization
queue and machine readback. Its new duration shortcut uses the Settings range
of 5–120 seconds in 5-second steps. Older two-metric water models receive the
duration metric when their workflow is applied.

Steam on/off retains the previous target and sends zero while off. The actual
heater reading comes from the existing machine snapshot stream. The arc maps
40–170°C independently of the allowed 135–170°C target range. Fahrenheit only
changes display and adjustment units; the gateway receives Celsius.

## Presentation and motion

- The original compact summaries stay in place; hot-water max duration appears
  only when expanded.
- Expanded and collapsed contents stay mounted and crossfade. The inactive
  face is inert and hidden from accessibility navigation.
- Width uses the existing 520ms easing, so the surrounding grid and scale move
  together. Content fades out over 160ms and in over 380ms after a 140ms delay.
- A mathematically circular SVG arc and radial target marker share one mapping.
  CSS interpolates progress and marker position. Temperature digits crossfade
  actual readings without inventing intermediate values or running a
  dashboard-wide animation loop.
- Reduced motion disables these transitions. Shared home metric colors and
  adjustment chevrons are reused in both themes.
- Compact water spacing tightens below the short-tablet height breakpoint to
  prevent clipping.

## Verification — 15 September 2026

- Production build passes; the existing bundle-size advisory remains.
- 421 automated tests pass, including circle geometry, partial workflow
  reconciliation, preserved steam target, and Fahrenheit maximum rounding.
- Targeted lint passes for the integration files.
- Browser checks at the default viewport and tablet sizes 1194×834 and
  1007×602 cover expanded/collapsed cards, both themes, and Celsius/Fahrenheit.
- The local in-memory gateway at 5395 verified all six controls, steam off/on,
  matching values in Settings, and failed-save retention. Its recorded requests
  confirm each edit changes only the intended workflow fields. Fahrenheit's
  upper limit now saves exactly 170°C rather than rounding above it.
- Native Decaid verification is still outstanding: its development launcher
  could not start because Flutter is unavailable in this environment. No real
  hardware was operated. The local fixture is not a substitute for that check.

Packaged for v0.1.29-patch001; the patch notes are appended to RELEASE-v0.1.29.md.
