# Profile deletion and standby ordering — v0.1.28 patch

## Behavior

- A red trash action appears immediately beside Edit in the detail heading only for known `isDefault: false` records. This includes created profiles, imported profiles and user-saved copies. Missing provenance and bundled defaults are protected.
- Native modal confirmation makes the underlying interface inert and focuses Cancel. Duplicate confirmation is guarded. Cancel and Escape dismiss without deleting; in-flight requests cannot be dismissed accidentally.
- Block the currently loaded profile and active machine operations. Fresh profile/workflow reads recheck protection before `DELETE /api/v1/profiles/{id}`. No workflow or machine write is issued by deletion.
- Verify `visibility: deleted` on readback. If a response is lost, readback can confirm success; retries of an already soft-deleted record only finish cleanup. Never call the permanent purge endpoint.
- Remove the deleted library entry and favorite references, preserving other slots. Read fresh shared favorites before writing. A shortcut-cleanup failure reports partial success without pretending the profile was not deleted. Historical shot data is untouched.
- Sleep precedes Cleaning and Settings in both DOM and visual order. Its existing handler, pending guard and wake behavior are unchanged.

## Verification

- All 350 automated tests pass, including ten new deletion/order tests. Production build, TypeScript and targeted lint pass; the existing large-bundle warning remains.
- Browser checks use `test/profile-delete-api-fixture.mjs`: an isolated in-memory HTTP fixture for the Decaid profile, workflow and shared-store contracts. Its quiet WebSocket connections keep the app's connection indicator online; it does not simulate extraction telemetry or control hardware.
- Cancel produced no writes. Created and imported profile confirmations each sent exactly one DELETE, followed by favorite cleanup. Records were soft-deleted, only their favorite slots became empty, and the loaded workflow and saved shot stayed unchanged. Reload did not restore deleted entries.
- Built-in detail had no Delete action. Loaded user-profile confirmation disabled deletion with a clear instruction. A 503 failure left the record visible and displayed the server message inside the dialog; cancellation still worked.
- Clicked the first-position Sleep button and reached the sleep screen with the mock API accepting the existing sleeping command.
- Inspected the detail and confirmation at 1052×734 in light and dark modes. Evidence: `review/profile-delete-confirm-light.png`, `review/profile-delete-confirm-dark.png`, `review/sleep-leftmost-light.png`.
- No physical Decaid/iOS device was available; browser pointer checks are not physical touchscreen verification. Only synthetic test profiles were deleted.

## Action placement follow-up

- Delete now shares the existing 44px circular action layout immediately after Edit, with a red icon and border in both themes. The action row moves below the title if needed instead of squeezing the title or separating Edit and Delete.
- Browser checked at 1052×734 in both themes; opened and cancelled confirmation via real clicks. In light mode Edit and Delete have identical 44×44 bounds and vertical alignment, with a 12px gap. Screenshot: `review/profile-delete-beside-edit-light.png`.
- All 350 tests, production build and targeted lint pass. Version and published release notes are unchanged.
