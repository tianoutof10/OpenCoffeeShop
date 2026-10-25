# Profile library — design exploration

Branch: `design/profile-library-experience`

Preview: `/review/profile-library/index.html` on the existing Vite server. Add `?theme=light` to start in light mode. The production Profiles page and home cover flow are unchanged.

## Current revision — compact favorites and graph-led detail

- Favorites are approximately 236×176 at the desktop review size, down from approximately 317×255. No card numbering or home-selection badges remain.
- The sidebar and list also omit the currently chosen home recipe. Use profile remains an explicit action without persistent chosen-state feedback.
- Stars replace hearts throughout. Unfavorite uses the existing crossed-out star asset and explicit text.
- Reorder controls are fixed 32×32 circles; detail close is a fixed 44×44 circle. Padding, flex sizing and aspect ratio are explicitly constrained.
- Detail starts with a full-bleed illustrative graph behind the title/actions. Axes, grid lines, legend and stage cards are removed.
- Overall targets precede two metadata cards: classification/source and recipe description. Metadata stacks only on phones.
- Browser verified: favorite reorder, unfavorite, detail open/close, zero stage cards/grid lines/legend/selection badges, circular geometry, dark/light detail and phone layout.
- All interactions remain sample-data-only. Production profile management and home cover flow are unchanged.

## Initial direction (superseded where noted above)

Separate three jobs rather than compressing them into simultaneous columns:

1. **Browse the library.** Reuse the actual Settings/Insights sidebar components. All profiles and Favorites are the main destinations; Created, Imported and Built-in narrow the source. Search remains visible, with category and sort controls alongside it. Rows pair a compact recipe silhouette with the name, category, dose → yield, temperature, source and favorite control. A loaded badge is distinct from the favorite heart. Clicking a row inspects the recipe; it does not load it.
2. **Inspect a profile.** Open a full-width detail surface without a sidebar, as in History. Keep recipe values, targets and stages visible together. Close returns to the same search and category. Use profile is explicit; favorite and edit are secondary; Delete is the rightmost red action for editable profiles. Built-in profiles offer Edit a copy and no delete action. A loaded profile must be replaced before it can be deleted.
3. **Manage the home lineup.** A dedicated Favorites view retains the recognizable chart-card identity. Numbered slots make cover-flow order explicit. Move earlier/later is a touch-friendly alternative to drag-only reordering. Removing a favorite does not delete its recipe. Adding a sixth favorite opens a focused replacement chooser that explains the old recipe remains in the library.

## Visual rules

- Reuse the actual `SidebarBrand` and `SidebarNavItem`, the Insights theme palette and the existing application font.
- Warm charcoal / pale neutral surfaces, quiet outlines, green selections and neutral metric text.
- Thin preview curves; no vertical grid lines. No blur, additional orbit animation or inactive-card shine introduced.
- Dividers separate rows, never trail the final row.
- Desktop/tablet: sidebar and dense list. Source is redundant with source navigation and can disappear before recipe values collide.
- Phone: navigation becomes compact horizontal groups, the library prioritizes name and recipe, detail actions and metrics become 2×2 grids, and stages stack.

## Interactive scope

This is a review-only React prototype using nine sample profiles and illustrative chart/stage data. It makes **no machine/API requests**, writes no preferences or profiles, and resets on reload.

Working preview interactions: source navigation, category filtering, search, sorting, full-width detail, simulated loading, favorites toggling, explicit slot replacement, reorder buttons, remove favorite, deletion confirmation and loaded-profile protection, dark/light preview.

Create, Import and Edit intentionally show explanatory handoff dialogs; they are not connected to the real editor or file importer. Screenshots demonstrate the proposed experience, not genuine machine recipes. In particular, stage timelines and graph shapes are illustrative and are not a proposed change to profile execution.

## Integration after design approval

- Replace sample records with the existing profile repository and actual `ProfileTargetChart` data. Preserve stable profile IDs and do not infer identity from names.
- Establish reliable source/provenance metadata before exposing Created / Imported / Built-in filters; retain safe handling for legacy records with unknown provenance.
- Connect load/favorite/reorder/delete callbacks to existing implementations, with pending/error states and confirmed persistence.
- Reuse the existing JSON import and profile-editor flow. Keep Visualizer import hidden.
- Preserve library scroll position as well as filters when returning from detail; add URL/back-navigation state.
- Render exact targets, units and recipe fields for each drink type, including unknown/absent values and maintenance profiles.
- Keep the production cover flow unchanged; only feed its existing favorite slot order.
- Before shipping: test long names, large real libraries, missing values, device failures, keyboard focus restoration, touch targets, and Decaid integration. This exploration is not release-ready integration.

## Verification

- Production build passed; isolated prototype TypeScript check passed.
- Browser clicks: library → detail → close; search preserved; favorites reordered; sixth favorite prompts for a replacement and changes only the chosen slot; delete cancel; loaded profile deletion blocked; empty search and Clear filters.
- Reviewed desktop 1280×720, tablet 1024×768 and phone 390×844, with dark and light appearances sampled.
- Browser review caught and corrected stretched branding, short-screen overflow, phone navigation scrollbar and wrapped phone detail actions.
- No real device or production-data mutations were tested or made.
