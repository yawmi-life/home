# YAWMI LifeOS V30 — Final Release and Safety Notes
**Date:** 2026-11-04  
**Repository:** https://github.com/yawmi-life/home

## Delivered
1. **Server-owned competition audit:** `public.yawmi_verified_activity` stores one bounded competitive snapshot per account/day. `public.yawmi_activity_audit` appends immutable score changes keyed by document revision. No direct authenticated writes to audit, standings or document records. All writes use the existing revision-checked `yawmi_write` RPC, now a restricted SECURITY DEFINER function.
2. **Score integrity:** Existing competitive activities were imported once without wiping anyone's historical XP. Added/edited competitive credits for past days are allowed for up to seven local Riyadh days. Older historic scores cannot be raised by editing the document; removing a completed activity can lower points. Identical repeated document writes do not duplicate scoring. Server finalizes quarters from verified snapshots rather than reinterpreting arbitrary client documents.
3. **Friend challenges:** Accepted friends can invite each other via opaque friendship tokens for activity days, tasks, habits or focus minutes over 7/14/21/28 days. The invitee accepts or declines. Verified daily snapshots determine progress; a shared, permanent badge is recorded once both people finish the goal. No additional XP is awarded, preventing double counting. Anonymous users and unrelated accounts cannot read or modify challenges.
4. **Habit analytics:** A per-habit strength index (smoothed, forgiving missed days), 7-day and 30-day adherence, current/best streak, trend comparison and a 30-day heatmap. Calculated entirely from personal account data, works offline and adds no XP.
5. **Offline & device conflicts:** Explicit field-by-field resolution (keep local vs keep cloud) for true three-way conflicts. Remote revision is checked again immediately before saving, to avoid stale overwrites. When a merge base is missing, the app refuses unsafe automatic merging and offers draft export. Backups show a data-count comparison before restore.
6. **Automated quality:** GitHub Actions workflow `.github/workflows/yawmi-quality.yml`; deterministic Node unit tests, pinned Playwright Chromium smoke tests, axe accessibility checks, Lighthouse performance/accessibility audits. Service worker caches every V30 static module; `yawmi-v30-public-shell`.
7. **Three skins:** Changes are linked into ATLAS, JOURNAL and QUEST. Ranking remains global and visible to all signed-in accounts; no personal friendship code is revealed in leaderboards.

## Test evidence
- Real Supabase transaction-and-rollback tests: accepted friend request, challenge invite/accept, private IDs, no direct database write grants; full-quarter snapshot and idempotent scoring checks.
- Real SQL score tests, rolled back: a new recent task increased points; attempts to raise scores 20 days back were rejected; saving the same document again did not create duplicate audit rows; deleting the task reduced points back to the prior balance.
- Existing 8 account documents and 280 legacy per-day snapshots preserved. No test challenges or modified account records left behind.
- GitHub Actions: unit and Playwright browser tests (6 browser checks: leaderboard privacy, habit analytics, friend invite, all skins, accessibility, PWA offline reload); Lighthouse CI. See [CI runs](https://github.com/yawmi-life/home/actions/workflows/yawmi-quality.yml).
- The test fixture uses synthetic local accounts. It does not log into a real customer account.

## How to use
- **Habits → Habit strength:** Select any active habit to see strength, 7/30-day completion and heatmap.
- **Journey → Challenges:** Add a friend by sharing your private code, wait until friendship is accepted, choose friend, goal and time period, then send an invite. Your friend accepts in their own Journey page.
- **Account → Sync conflict:** Export draft, compare each conflicting field, explicitly choose which side to keep, then merge and save. When no merge base exists, do not overwrite blindly.
- **Account → Daily backups:** Preview the counts of tasks, habits, days, books and goals in the selected backup before confirming restore.

## Honest limits / operational notes
- Users self-report their real-world task completion. A revisioned event ledger blocks several simple replay/backdating attacks but cannot physically verify their habits or eliminate all fraud.
- Legitimate offline accomplishments synced over seven days late remain in personal progress, but do not gain new historic competitive XP after the grace period.
- The global leaderboard initially renders up to 50 visible people and the account's own position.
- Notifications to devices with the browser completely closed are not part of this release (reliable push requires a separate opt-in, service-worker push and secure server credentials).
- No full end-to-end validation of **two actual personal accounts on two devices** was performed; the available tests simulate the core merge and public UI. Run such a test before a wider production rollout.
- No changes to existing account credentials or private contact information.

## Release files
- `database/yawmi_v30_trusted_event_audit_ledger.sql`
- `database/yawmi_v30_private_friend_challenges.sql`
- `yawmi-habit-insights-v30.js` / `.css`
- `yawmi-friend-challenges-v30.js` / `.css`
- `yawmi-offline-v1.js`, `cloud.js`
- `tests/core.test.cjs`, `tests/browser/features.spec.cjs`
- `playwright.config.cjs`, `.lighthouserc.json`, `package.json`, `.github/workflows/yawmi-quality.yml`
