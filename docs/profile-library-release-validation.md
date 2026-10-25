# Profile library integration — v0.1.29

## Scope

The approved review prototype is now implemented by the production ProfilesPanel, not a separate route or fixture UI. It uses the existing Decaid profile list, save/readback, workflow selection, favorite shared-store writes, and protected soft-delete flow. Visualizer import remains hidden.

## Verified in the browser

Tested against `test/profile-library-api-fixture.mjs`, an isolated in-memory Decaid REST contract fixture on port 5396. No real machine or user profiles were modified.

- Created a recipe, reviewed the existing no-final-yield warning, saved it, and returned to its new detail page.
- Imported `test/fixtures/profile-library-import.json` through the native file-input workflow and saved it without editing. Confirmed Imported source, category, description, and targets.
- Edited an imported recipe and verified the updated name and preserved metadata in the gateway.
- Opened a built-in recipe: no Delete action, Edit a copy created a separate saved record without changing the built-in.
- Selected the copy: verified the workflow update and corresponding home cover-flow selection.
- Reordered favorites and verified persisted slot order; filled a vacant slot; replaced a favorite using the five-slot chooser.
- Deleted a user-owned favorite: verified its soft-deleted visibility, favorite cleanup, and unchanged saved shot. A simulated failed delete kept the dialog open with a retry message and preserved the record.
- Tried deleting the currently selected recipe: confirmation explained the restriction and disabled deletion.
- Combined source, search, category, and recent sorting; closed detail and verified the filters were retained.
- Checked 1280×720 desktop, 1024×768 tablet, and 390×844 phone. No horizontal document overflow; phone detail stacks into one column, and close controls remain 44×44 circles.
- Measured exact 12px target-card overlap and 1:2 metadata-column ratio at desktop size.
- Used Settings to change to light mode, Fahrenheit, and medium line weight; confirmed 198° for 92°C and 1.75px chart strokes. Restored original dark/Celsius/thin preferences afterwards.

## Automated checks

Run `npm test`, `node node_modules/oxlint/bin/oxlint src`, and `npm run build`. Regression tests cover source metadata, legacy fallback, search/filter ordering, preserved actual chart data, import mapping, save guards, favorite behavior, and protected deletion.

## Limits

The contract fixture verifies UI wiring and request/readback behavior; it does not replace validation on a physical tablet or BLE/USB machine. Existing profile execution and Decaid transport implementations are unchanged. Source provenance is only tracked for newly saved/imported profiles; legacy source is deliberately not inferred.
