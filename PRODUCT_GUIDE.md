# StudyDuel Product Guide

## Product objective

StudyDuel is a time-tracking and friendly accountability product for people who study or work toward shared goals. It should combine reliable personal time tracking and useful self-insights with opt-in comparisons against friends, similar in spirit to TimeCamp's tracking capabilities and a friendly study duel.

The most important product requirement is trustworthy time data. Every timer session and manual entry must be saved in the database and associated with its owner, project hierarchy, start and end times, and relevant dates. Dashboards, streaks, goals, and comparisons must be derived from this saved data rather than from browser-only state or hard-coded examples.

## Open-source project goals

StudyDuel is intended to be published and maintained as an open-source project. Keep setup understandable for first-time contributors and avoid dependencies on private infrastructure for local development.

- Document prerequisites, environment configuration, database setup, migrations, development commands, and known limitations in the README.
- Commit only source, migrations, and safe example configuration. Never commit credentials, OAuth client secrets, production database URLs, personal tracking data, or real user exports.
- Keep `.env.example` values visibly fake and explain how to create a local `.env`.
- Use synthetic seed data for screenshots and development demos. Do not publish actual user histories or identifying friend-comparison data.
- Explain how to report security issues privately in a `SECURITY.md` before inviting public use.
- Select and add an explicit open-source license before publishing the repository. Do not assume that a public GitHub repository automatically grants reuse rights.
- Prefer documented, replaceable services and standards. Core time tracking must remain usable without Google sign-in or any hosted analytics service.
- Keep contributor instructions and application behavior aligned with the current implementation; label planned features clearly.

## Product principles

- **Accurate first:** The server is authoritative for timer state and timestamps. The browser displays elapsed time but must not be the source of truth.
- **Private by default:** A user's personal dashboard and entries are visible only to that user. Friends see comparison data only after an explicit connection and selection in Compare.
- **Useful alone, better with friends:** Personal tracking and insights must work without adding a friend.
- **Clear, consistent metrics:** Date range, timezone, goal, and definitions should be visible wherever a metric is shown.
- **Editable history:** Users can correct their own logged sessions while preserving valid durations and dates.
- **Responsive and accessible:** The four sections, timer controls, charts, and forms must work on desktop and mobile, with keyboard navigation and clear labels.

## Main application sections

The authenticated app has four primary sections: **Timer**, **Dashboard**, **Compare**, and **Manage**. The navigation and section names should be consistent throughout the product.

## Modular architecture

Implement each primary section as an independent feature module: Timer, Dashboard, Compare, and Manage. A section should own its screen components, local presentation state, and section-specific interactions; shared services should own authentication, API access, and database operations. Sections must use shared data contracts rather than importing another section's internal UI or state.

- Keep reusable cross-section pieces (navigation, date-range controls, project/subproject pickers, dialogs, loading/error states, and visual primitives) in shared components.
- Keep domain rules and analytics calculations in reusable functions/services instead of embedding them in large page components.
- Keep backend access behind a small API/data layer so the UI can be developed with demo data and later switched to live data without rewriting each screen.
- Break complex screens into focused components for their major panels, as the guest demo does for its timer, duel, and productivity panels.
- Avoid a single dashboard component that owns every section. Each section should be independently understandable and replaceable, with integration handled by the app shell/navigation.
- Clearly label demo-only modules and data; do not let demo state become a source of truth for real timers or analytics.

### 1. Timer

The Timer section is the primary data-entry workflow.

- Require a project before starting a timer. A subproject/subject is optional and can be left unselected; support nested subprojects for users who want more detail. Entries without a selected subproject belong to the project itself.
- Let users select or clear the optional subproject without losing the required project. Changing the project/subproject while a timer runs follows the atomic timer-switch behavior below.
- Provide a prominent start/stop timer and show the selected project/category, start time, elapsed duration, and current running state.
- Persist the active timer on the server. It must continue accurately through refreshes, closing and reopening the browser, and signing in on another device. The UI may update its display every second, but elapsed time must be calculated from the stored server start time; do not rely on a browser interval to record time.
- Enforce exactly one active timer per user. The UI must not offer a way to run two timers concurrently. Starting the first timer requires a project and may include an optional subproject.
- If the user selects a different project or subproject while a timer is active, treat that as a timer switch: stop and save the current entry with its original project and subproject, then start the newly selected timer at the same server timestamp. Perform both operations in one server-side database transaction so there is no overlap, accidental gap, or lost previous selection. If the switch fails, leave the original timer active and report the error.
- On stop, save a completed time entry with start and end timestamps and a derived duration.
- Provide a time-entry list with date-range filters, including custom start/end dates. Each user should be able to edit or delete their own entry, subject to validation and clear confirmation for deletion.
- Allow manual entries for time that was not recorded with the live timer. Validate positive duration, dates, and project ownership.
- Prevent accidental overlapping entries or define a clear policy if overlaps are supported. Do not silently double-count them in reports. A switch should close the previous timer exactly where the next one starts.

### 2. Dashboard

The Dashboard is a personal view. It must show only the signed-in user's data and insights; friend data belongs in Compare.

Provide date filters such as Today, This week, This month, and custom range. Display the active range and the user's timezone. Weekly summaries should clearly define the week start day and whether the current day is complete or still in progress.

Useful personal summary cards include:

- Hours today, this week, this month, and all time
- Current streak and longest streak
- Daily average, with the averaging period and whether inactive days are excluded
- Daily goal progress, remaining time, and an edit action
- Average and longest session, most productive hour, and session counts

Useful personal analysis includes:

- Daily and weekly study-time trends, optionally with a moving average
- Session-length distribution and median active-day duration
- Short-session and 45+ minute session shares
- Weekday/weekend split and best weekday
- Days meeting a duration threshold and days reaching the daily goal
- Hours by project/category, top tasks, time-of-day heatmap, and activity calendar
- Recent activity and a full session history with date filters

All metrics must be calculated from the signed-in user's saved entries. Empty states should explain how to begin tracking rather than presenting sample values as real data.

### 3. Compare

Compare is the only section that combines data from different people. It supports friendly, opt-in accountability.

- Let users invite or add friends and accept, decline, or remove friend connections.
- Let a user choose which connected friends to include in a comparison. Show which profiles are selected and how many profiles are included.
- Support period filters such as Today, 7 days, This week, Month, Quarter, Year, All time, and Custom. Show the exact date range and timezone.
- Support comparison modes such as **Study time** and **Goal pace**.
- Show period standings, total hours, change versus the previous equivalent period, active days, sessions, average per active day, group mean/median/coverage, and a weekly trend.
- When at least two profiles are selected, show head-to-head daily results, wins/losses/ties, streaks, session totals, records, challenges, project rivalry where permitted, cumulative hours, and consistency metrics.
- When only one profile is selected, label the view clearly and explain that head-to-head results require at least two profiles. Do not imply that the values represent a group.
- Keep friend data private until the friend connection and comparison sharing are allowed. Define and communicate what is shared (for example, totals and activity patterns) and whether project names are shared; do not expose raw session notes or private details by default.
- Support challenge targets and saved challenges only after their ownership, visibility, and update rules are defined.

#### Comparison metric definitions

- **Study time:** Sum of valid session durations overlapping the selected date range.
- **Active day:** A local calendar day containing at least one valid session.
- **Change versus previous period:** Current period total minus the immediately preceding period of equal length; label absolute and percentage change and handle a zero previous value without dividing by zero.
- **Average per active day:** Period duration divided by active days, not all calendar days.
- **Daily result:** Compare each profile's total for the same local calendar day; ties are explicit.
- **Goal pace:** Tracked time divided by the goal for the selected period. Use each profile's own goal unless a challenge specifies a shared target.
- **Profile coverage:** Number of connected, selected profiles with available data in the period. Make exclusions visible.

### 4. Manage

Manage contains the user's setup and account controls.

- Create, select, rename, archive, restore, and delete projects and optional nested subprojects (subjects and sub-subjects). A project must be selected for a timer; subproject selection may be empty.
- Let users assign and change a color for each project and subproject. Persist each color with its project/subproject record and reuse it consistently in selectors, timer display, entries, dashboard charts, and comparisons where project names are shared.
- Persist project/subproject names, hierarchy, selection references, archive state, ordering, and colors in the database; do not keep management changes only in browser state.
- Make it clear what happens to existing entries when a project or subproject is renamed, archived, or deleted. Preserve historical entries and their hierarchy. Allow permanent deletion when nothing references the record; otherwise offer archive or reassignment instead of breaking history.
- Reorder projects and subprojects and provide clear, accessible controls to create, edit, archive, restore, and delete them.
- Set and edit personal daily/weekly goals and preferred timezone/week-start settings.
- Manage friend invitations and connections, comparison visibility, and account profile details.
- Provide account security controls and session sign-out. Account deletion and permanent data deletion must be explicit and confirmed.

## Accounts, authentication, and security

- Support email/password registration and login, plus Google sign-in through a standard OAuth/OpenID Connect flow.
- Never store plaintext passwords. Hash passwords server-side with a modern password-hashing algorithm such as Argon2id (preferred) or bcrypt, with maintained libraries and appropriate parameters. Password hashing is not general-purpose encryption; do not implement a custom hash.
- Keep OAuth secrets, session secrets, and database credentials on the server in environment-managed secrets. Never expose them in frontend bundles or commit them to source control.
- Use secure, HTTP-only, same-site cookies for sessions where applicable; protect state-changing requests against CSRF and validate authorization on every server request.
- Enforce ownership in database queries and API handlers. A user must never read or alter another user's sessions, projects, goals, or profile settings by guessing an ID.
- Use rate limits and safe error responses for authentication flows. Add account recovery and email verification before production launch.
- Minimize collected data. Treat session notes, profile details, and friend relationships as private. Provide a clear way to disconnect from a friend and understand its effect on shared comparisons.

## Data and backend requirements

The initial PostgreSQL schema in `database/001_initial_schema.sql` provides these core entities:

- **User:** Identity, display name, timezone, week-start preference, and account settings.
- **Credential / OAuth identity:** Password hash for password accounts; provider and provider subject ID for Google accounts. A user may link more than one sign-in method under safe verification rules.
- **Project:** Owner, name, optional user-selected color, archive state, and display order, stored in the database.
- **Subproject:** Parent project, optional parent subproject for deeper subject/task levels, name, optional user-selected color, archive state, and display order, stored in the database. The timer may have no selected subproject.
- **Time entry:** Owner, required project, optional subproject, UTC start timestamp, UTC end timestamp, duration derived from timestamps, optional note, creation/update timestamps, and source (timer or manual). The selected subproject must belong to the selected project.
- **Active timer:** One row per owner, with required project, optional subproject, server-recorded start timestamp, and state. Database constraints enforce the project/subproject relationship and one active timer per user. Timer switching closes the old entry and starts the new timer in one transaction.
- **Goal:** Owner, target duration, scope (daily/weekly), and effective dates.
- **Friend relationship/invitation:** Participants, status, invite/accept timestamps, and explicit comparison-sharing settings.
- **Challenge:** Owner or group, target, period, participants, visibility, and status.

Store timestamps in UTC and convert to each user's timezone for day/week/month boundaries and display. Save enough source information to recalculate analytics after entry edits. Prefer calculating reports from canonical entries; cached or materialized summaries must be refreshable and must not become a second source of truth.

Timer API operations should be server-authoritative and transactional. Starting a timer creates the active timer if none exists. Switching timers must atomically close the active entry and replace its project/subproject and start time. Stopping closes the active timer and creates one completed entry atomically. The server should reject invalid project/subproject ownership, impossible end times, and malformed edits. Persisted timer state—not a long-running in-memory process—keeps tracking reliable across server restarts.

## Product experience and visual direction

- Preserve StudyDuel's existing warm study-art direction, dark navy typography, coral primary action, and light/dark themes.
- Keep the timer's start/stop action unmistakable; secondary controls should not compete with it.
- Use consistent type scales, spacing, input heights, and corner radii across all four sections.
- Make charts understandable with labels, date ranges, units, and accessible alternatives to color-only meaning.
- Loading, empty, error, offline, and saved states should be visible and specific. Never show mocked or stale values as if they were live data.
- Keep the dashboard focused on the signed-in user's own progress; use Compare for friend leaderboards and head-to-head views.

## Core acceptance criteria

1. A person can create an account, securely sign in with a password, and sign in with Google.
2. A user can create a project and optional nested subprojects, start a timer with only a project or with a subproject, refresh or reopen the app, and see the same active timer with correct elapsed time.
3. A user can have only one active timer. Selecting another project/subproject switches timers atomically: the previous entry keeps its original project/subproject and ends exactly when the new entry begins.
4. Stopping or switching a timer creates exactly one persisted entry with correct timestamps and duration; retries do not create duplicates.
5. A user can filter their entries by standard and custom date ranges and edit an entry; dashboard metrics update from the edited data.
6. Dashboard data is scoped to the signed-in user and includes personal summaries, trends, goals, and session history with clear date/time definitions.
7. A user can connect with a friend and compare only profiles they selected and are allowed to see. A disconnected or unselected profile is excluded.
8. Period comparison metrics have defined date boundaries and consistent behavior for ties, missing days, zero previous periods, and incomplete current periods.
9. Users can create, select, rename, color, archive, restore, and delete projects and optional nested subprojects; every change persists after refresh and is reflected in relevant views.
10. Users can manage goals, friend connections, and account settings without corrupting historical entries.
11. Authentication and authorization are enforced on the server; direct API requests cannot access another user's data.
12. Core workflows work on mobile and desktop and are accessible by keyboard and assistive technology.

## Suggested implementation order

1. Design the data model, authentication, authorization, and database migrations.
2. Implement projects, optional nested subprojects, and reliable timer start/stop/switch persistence.
3. Implement manual entries, entry history, custom date filtering, and editing.
4. Build the personal Dashboard from real saved entries and add goals.
5. Implement invitations, friend relationships, sharing controls, and Compare metrics.
6. Add challenges, deeper analytics, export, and other refinements after the core tracking and privacy model is dependable.

## Current repository context

The current repository is a React/Vite frontend. **Try demo** opens a guest dashboard with sample data; its timer, duel, and productivity panels are separate UI components, but they do not use production services. The demo does not create or authenticate an account, and its timer is temporary browser state. Login, Google login, persistent timers, and database-backed analytics are not implemented. Treat this guide as the target product specification and do not describe those capabilities as implemented until a backend and end-to-end flows exist.
