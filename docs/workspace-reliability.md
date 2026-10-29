# Workspace reliability and browser extension update

These changes are implemented locally. The deployed website requires a separate deployment to receive the new web UI, timer transactions, sharing controls, and backup endpoints. The extension's Google/browser-session connection can use the existing deployed sign-in endpoints without copying credentials.

## Included

- Extension 1.1.2: Google sign-in through the main app, email/password sign-in, authenticated browser-tab connection, project and optional subproject selection, confirmed Start/Stop, useful empty/error states, and connection settings behind an advanced disclosure.
- Login waits for session verification before showing the sign-in form; the artificial 700 ms successful-login delay is removed. Auth/service failures show a retry state rather than silently opening a demo workspace.
- One server-authoritative timer service for signed-in web and extension usage. Per-account database locking and idempotent command IDs protect changes and retries. Pause/resume, discard, linked tasks, and existing history are preserved.
- Workspace saves and relational projections commit together. A durable per-account outbox retries failures. Conflicting versions require an explicit choice, preserve both copies locally, and can be exported in a full backup.
- Shared core totals, averages, active days, streaks, profile summaries, goal derivation and daily target helpers. The dashboard's former 60-day cap for longer selected periods is removed; no arbitrary daily goal is assumed when none is configured.
- Workspace navigation label, email previews in Admin, constructive pace feedback, honest demo report states, and a two-step onboarding flow for accounts with no projects.
- Task-linked timers and per-task accumulated tracked time in the workspace task list.
- Per-connection project sharing, private by default; project/subproject names require an additional opt-in. Disconnecting removes sharing grants. Comparison emails respect project selection. Shared totals and patterns are derived only from the selected projects; notes and task details are not shared.
- Application-level backup/export and same-account merge recovery. Projects, subprojects, goals, sessions, preferences and missing tasks can be recovered without replacing current edits. Email preferences are exported and restored disabled only when absent. Accepted recipients and comparison grants are included for reference and are not silently reactivated.
- Recent email-attempt history and bounded scheduled retries. Provider acceptance is labeled honestly; it does not guarantee inbox delivery.
- Trusted-origin checks, login throttling, production secret validation, and server enforcement of ended sessions. Extension credentials and browser cookies are separate login paths.

## Verification

- `npm test`: email rendering, shared metrics, 90-day activity, unset goals, time zones, durable retries and conflict handling.
- `npm run test:runtime`: transactional timer and retry behavior, failed-switch rollback, pause/resume, owner isolation, stale-write rejection, project sharing and revocation, backup merging, linked tasks, all report renderers, actual extension worker code, authenticated content-script bridge, legacy history, and session revocation.
- `npm run build` and lint. Existing repository lint warnings remain.
- Actual Chrome extension was reloaded from the user's installed unpacked directory. Google/browser-session connection was observed on the deployed account. The initial account had no active projects. The user then added a test project. Installed extension synchronization checks use that explicit test project; existing personal projects and history are preserved. Start/Stop was verified with disposable local test accounts.

## Operational limits

- Google/browser-session mode requires keeping its signed-in app tab open. The extension does not store a Google credential or copy that tab's session cookie.
- Local and deployed accounts/data are separate. Connection settings can select a local development origin for testing. Reload existing app tabs after extension updates so the current content script is installed.
- Application backups do not replace PostgreSQL disaster-recovery backups or a tested infrastructure restore procedure.
- Actual email delivery, inbox rendering, and SMTP/Resend failure handling need provider-level testing before a production rollout.
- The unit-check GitHub workflow is added; authenticated browser automation and multi-browser coverage are not claimed.
