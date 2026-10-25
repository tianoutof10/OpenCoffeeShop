# Home rendering optimization — Patch 004

## Scope

- Preserve state identity for unchanged visible scale, steam, tank and connection readings.
- Memoize home cards with stable event props that invoke the latest committed handler. No custom comparator ignores callbacks or data fields.
- Memoize the seven-day summary by records and local calendar day, and keep the insights hook result stable between actual changes.
- Adapt PR85's independent carousel frame coalescing and transform-based positioning, including cancellation and ResizeObserver sizing. Credit: Tobias Gregorius, PR85 / commit 5cbefa6.
- No change to raw sample capture, stage transitions, readiness tracking, stop decisions, workflow writes, polling intervals or history-sync policy. This does not merge PR84 or all of PR85; library/date-formatting work remains there.

## Verification

- 527 unit/regression tests pass. Added identity/change-boundary tests for readings and connection state, summary eligibility/date rollover tests, and PR85's frame-publisher cancellation tests.
- Production build passes with the existing bundle-size advisory; lint has only five existing review-fixture Fast Refresh warnings.
- Mocked browser comparison against Patch 003, at 1024×768: 40 pairs of machine and scale readings that do not change visible values. Component invocations in React development StrictMode:

| Component | Before | After |
| --- | ---: | ---: |
| Status pill | 160 | 0 |
| Utility cards, total | 640 | 0 |
| Profile panel | 160 | 0 |
| Insight entry | 160 | 0 |

A subsequent visible steam-temperature change invokes only the steam utility component twice (StrictMode's double invocation); profile and insight entry remain unchanged. These are controlled render counts, not device CPU or frame-rate claims.

- Keyboard selection and multi-event dragging still update the selected workflow. Pointer release clears dragging. The active card remains centered after utility collapse, expansion and viewport resizing to 1280×800.
- Animation setting: save/reload, dark/light, static gauge updates, re-enable and OS reduced motion all pass.
- Stop/auto-tare regressions: confirmed stop, unconfirmed stop/retry, disconnect, new-shot protection and preparation-only auto-tare all pass against mocked REST/WebSocket endpoints.
- No physical machine, tablet WebView or running Decaid instance was used. All browser API calls were intercepted. Test instrumentation was confined to the test browser and is not shipped.
