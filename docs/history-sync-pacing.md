# History sync pacing

PR #74 reduces bursts of background history reads without changing the saved
record limit or putting interactive shot charts behind archive maintenance.

## Refresh policy

- History remains event-driven: eligible screen entry, becoming visible, a changed
  last-shot ID (after its existing four-second settling delay), or explicit Refresh.
- Successful syncs do not schedule another sync. Genuine failures keep the existing
  5 / 15 / 30 / 60-second retry backoff; reconnect retries failed work only.
- A normal refresh reads the newest 100-record page. An incremental merge is used
  if the last full pass is less than six hours old and the page is consistent with
  the saved archive. Otherwise it reconciles up to 1,000 records.
- Six hours is an eligibility window, **not a polling timer**. An older edit outside
  the newest page can remain stale until the next eligible full pass (potentially
  longer than six hours if the app stays closed). Explicit Refresh forces a full
  pass. Deletions, gaps and large imports that invalidate the incremental merge
  still trigger a full pass immediately on the next refresh.
- A full multi-page pass rechecks the head before committing. Interrupted passes
  are discarded and restart at the head, not at an offset from an older snapshot.

## Background work and pause handling

The repository owns one serial queue for history pages and duration-detail reads,
with a minimum 750 ms gap from one operation finishing to the next starting. It
survives the hook's effect restarts while the same repository is mounted. A source
change creates an independent repository and queue.

The duration migration still handles up to five records per batch. Its runner
enforces a repository-owned cooldown of at least four seconds **after a batch
finishes**, including when `resume()` is called by online/visibility events or
the effect restarts. A failed batch retains the longer retry delay. The additional
per-read pacing deliberately makes a large first-time migration slower; it does
not withhold the already-available summary list or fetched durations.

App eligibility excludes brewing, utility operations and the sleep screen. Effect
cleanup stops the associated work, and document visibility is checked before each
background request, including after waiting in the queue. Once paused:

- An already-issued request may finish, but no subsequent background request starts.
- A partial history scan cannot replace the existing cache or advance sync dates.
- The pause itself does not change the online/offline state, show an error, or
  schedule a failure retry. Returning to an eligible view resumes through the normal
  event-driven refresh.
- Completed duration metadata is saved before leaving a batch. Unfinished records
  remain eligible and previously completed records are not downloaded again.

We do not abort a shared in-flight chart fetch. Browser cancellation also cannot
undo work Decaid has already started.

## Fast paths

- User-opened history details and the last-shot chart bypass the background queue.
- Only actual in-flight detail requests are deduplicated. A chart never has to wait
  for a queued duration read of the same shot; the later background operation checks
  the cache again before fetching.
- Durations available in cached charts and the offline stage-reason migration do
  not require paced network reads.
- No shot telemetry, brewing controls, cache schema, record cap or chart rendering
  behavior changes in this PR.

## Verification

Deterministic tests cover request spacing, failure spacing, early timer wakeups,
cooldown bypass attempts, effect restart cooldowns, pauses while queued/waiting/in
flight, cache preservation, fresh-head resumption, explicit Refresh, concurrent
chart loads, shared in-flight reads, six-hour eligibility and offline persistence.

Physical-tablet validation is still needed for the reported scale-reconnect issue.
The reported timing correlation with a history sync is not proof of a BLE cause.
Check wake/reconnect, starting a shot during sync, background/foreground transitions,
first-time duration migration and opening both cached and uncached charts.
