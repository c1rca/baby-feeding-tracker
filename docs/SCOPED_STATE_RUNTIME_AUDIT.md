# Scoped State Runtime Audit

This branch stores tracker state per `(household_id, baby_id)` while preserving legacy `app_state` for rollback compatibility.

## Audited paths

| Path | Current behavior | Status |
| --- | --- | --- |
| `GET /api/state` | Reads scoped `baby_state` for authenticated household/baby, including `X-Baby-Id` override. | Scoped |
| `PUT /api/state` | Writes scoped `baby_state`; mirrors only default household/baby to legacy `app_state`. | Scoped + rollback compatible |
| `/api/state/events` | Subscribes each SSE client to authenticated household/baby and only broadcasts matching scope updates. | Scoped in this slice |
| Reminder scheduler | Still reads legacy/default `app_state`; reminders remain default-baby only until a multi-baby notification model is designed. | Explicit limitation |


## Why scheduler remains default-only for now

Reminder delivery has a single global notification state table keyed by `entry_id`/medicine IDs and global notification settings. Sending reminders for every baby needs additional product decisions:

- which babies should produce notifications
- whether reminder settings are household-wide or baby-specific
- how notification de-dupe keys should include household/baby scope
- how quick-log URLs should select the intended baby

Until that model exists, keeping reminders tied to default/legacy state is safer than silently sending duplicate or ambiguous reminders.

## Required before multi-baby reminders

- add household/baby identifiers to notification state keys or rows
- include selected baby context in quick-log URLs
- decide baby-specific vs household-wide reminder settings
- add tests for two babies due at the same time without de-dupe collisions
