# TripSync

A collaborative trip-planning platform with an AI-assisted daily itinerary planner.

**Current stage: full-stack workspace on Postgres.** Sign-up, sign-in, sessions and
every workspace screen are connected to the real backend: the protected layout
loads the signed-in user's rows from Postgres (Supabase) on the server, and every change
(trips, itinerary, expenses, polls, packing, notes, invitations, profile, admin,
feedback) goes through a validated server action with per-trip role checks. Data
lives in the database, so it survives refreshes, sign-out/sign-in and other
devices. The only sample content left is the curated read-only example trip, the
marketing photography, and AI suggestions until a provider key is added — and
each of those is labelled in the interface.

---

## 1. What exists today

### Working, database-backed

- Registration, sign-in, sign-out and HTTP-only sessions (Better Auth).
- A protected workspace layout: signed-out visitors are redirected, and the
  workspace is loaded server-side for the signed-in account only.
- Trip CRUD: create with inline validation (name, dates, budget, travellers),
  read, edit (owner), delete (owner, with cascade) and copy of the example trip.
- Dashboard counters (total/upcoming/ongoing/completed), next departure and
  featured trip — all calculated from the user's own rows.
- My Trips: search by name/destination, status filters with counts, sorts
  (soonest, latest, recently added, destination, name) and clear/reset.
- Day-wise itinerary: add, edit, delete and reorder activities, each saved with a
  persisted position (`sort_order`), estimated cost and a Google Maps search link;
  the order comes from the database, not from browser state.
- Trip dates cannot strand activities: shortening a trip that would leave plans
  outside its dates is refused with an explanation instead of moving or deleting them.
- Expenses: title, amount, category, payer, date, optional note and the people
  sharing it. Shares are stored in integer paise, so ₹1,000 across three people
  is recorded as 333.34 + 333.33 + 333.33 and always adds up exactly.
- Budget tracking: recorded total, remaining, percentage used, over-budget amount,
  category and daily breakdowns — all derived from saved expenses.
- Balances and suggested settlements: paid/shares/net per member, with a
  calculation-only transfer list (no payment is ever moved).
- Polls: question with optional context, two to six options and a closing date;
  one vote per member, vote changes while open, persisted results and
  open/closed/expired states. The creator or owner closes a poll with confirmation.
- Packing list: shared items with quantity, category, carrier, optional note and a
  packed tick, plus counts, percentage, and all/packed/unpacked filters.
- Trip notes: shared title and body with an optional label (Bookings, Transport,
  Food, Contacts, General, Other); edits are version-checked and deletion is
  limited to the author or the trip owner.
- All of the above is persisted with role checks, and viewers only read.
- Collaboration: `owner`, `editor` and `viewer` memberships stored in Postgres; owners
  manage members (change role, remove, withdraw a pending invitation) from the trip
  page, and viewers get a read-only itinerary.
- Invitations: send with a chosen role, accept, decline, revoke, expire; every
  invitation has a 256-bit link token and a `/invite/[token]` page that validates it
  on the server before showing anything, and only the invited email can accept.
  Membership and in-app notifications are written on the server.
- Trip status logic (upcoming/ongoing/completed) from trip dates, shared by the
  dashboard, My Trips filters and every card.
- First-run onboarding: a dismissible tour card on the dashboard covering trip
  creation, itinerary, budgets, invitations, polls and packing. Skipping or
  completing it is stored in `user.onboarding_completed_at`, so it never returns
  on later visits, and the profile page can replay it.
- In-app notifications: a bell in the top bar with an unread badge, plus a
  `/preview/notifications` history page. Rows live in the `notifications` table,
  are written only by real events (invitation sent/accepted/declined, access
  changes, poll creation, itinerary changes, over-budget spending) and are scoped to their recipient
  by `user_id` in every query and every mark-read/unread action. Retried events
  do not stack duplicate rows, and the four switches on the profile page filter
  new notifications server-side.
- Feedback: a 1–5 star rating with optional comment from the dashboard, stored in
  the `feedback` table and shown only to platform admins (1 submission per minute
  server-side so double clicks cannot duplicate rows).
- Loading, empty, validation and error states; failures surface the server's
  message and never fake a success.
- Keyboard focus styles, labelled form fields, semantic landmarks and reduced-motion support.
- No emoji characters are used in the interface; icons come from Lucide.

### Deliberately not built yet

- Live AI generation (the route, validation and approval flow exist; a provider
  key is required) and audit logging for admin role changes.
- Email delivery (needs `RESEND_API_KEY`; without it invitations fall back to
  in-app notifications and shareable links).
- File uploads, real-time updates, pagination of the workspace query and public
  production deployment.
- The public Git repository (the project folder is currently not a Git repository).

Unsupported actions say so honestly: no action pretends to have saved.

---

## 2. Stack

### Used now

| Layer | Choice | Why |
| --- | --- | --- |
| Framework | Next.js 16 App Router, React 19, TypeScript | One codebase for pages and server routes; strong typing; good beginner documentation. |
| Styling | Tailwind CSS v4 with design tokens in `src/app/globals.css` | Consistent spacing, colours and components without a separate CSS framework. |
| UI primitives | Small local components (`src/components/ui`) | Buttons, badges, fields, dialogs and menus share the same behaviour and visual language. |
| Icons | Lucide React | One consistent line-icon set; no emoji icons. |
| Fonts | Inter for the interface, Fraunces for major headings | A readable working font paired with a restrained travel-journal display face. |
| Validation | Local TypeScript validation in forms | Field-level feedback now; the same rules will be mirrored on the server with Zod. |

### Connected to the screens

| Layer | Choice | Status |
| --- | --- | --- |
| Database | Postgres (Supabase) with Drizzle ORM | Every screen reads and writes Postgres; migrations in `drizzle/` |
| Authentication | Better Auth (email + password, server sessions) | Sign-up, sign-in, sign-out and reset screens live; preview layout enforces the session |
| Validation | Zod on the server, mirroring the form rules | Applied inside every server action |
| Authorisation | Membership and role checks per trip | Enforced server-side on every read and write |
| AI provider | Any OpenAI-compatible chat-completions API | Full server route (trip, day and activity scopes) verified end-to-end against a local OpenAI-compatible mock over real HTTP; a live provider call still needs `AI_API_KEY` |
| Email | Resend HTTP API | Adapter written; no key configured, falls back to share links |
| Deployment | Render (Node web service) | The live site runs at https://tripsync-lo3f.onrender.com; `next build` and `npm start` run on plain Node |

> The database moved from Cloudflare Postgres to Supabase Postgres so the owner can
> inspect and manage rows in a dashboard, and so data survives every redeploy
> the application instead of adding a second external service.

---

## 3. Run the project

Requirements: Node.js 20 or newer (tested with Node 24.13.0) and npm.

```bash
npm install
npm run dev
```

Open <http://localhost:3000>. Sign-up, sign-in and the workspace need a migrated
local database:

```bash
# fresh setup: apply each migration file in order (the local DB already has them)
npx wrangler d1 execute freebuff-next-db-local --local --config freebuff.wrangler.jsonc --file drizzle/0000_init.sql
npx wrangler d1 execute freebuff-next-db-local --local --config freebuff.wrangler.jsonc --file drizzle/0001_flowery_polaris.sql
```

Useful checks:

```bash
npm run typecheck
npm run lint
npm run build
npm run start
```

The production build uses the standard Next.js output. Images are served
unoptimized because the Phase 1 photographs are already resized and compressed.
The root metadata is intentionally `noindex` until the project is published.

---

## 4. Routes

| Route | Screen |
| --- | --- |
| `/` | Public landing page |
| `/credits` | Photo attribution and licences |
| `/preview/dashboard` | Signed-in dashboard preview |
| `/preview/trips` | My Trips with filters and search |
| `/preview/trips/[tripId]` | Trip overview |
| `/preview/trips/[tripId]/itinerary` | Day-wise manual itinerary |
| `/preview/trips/[tripId]/ai-planner` | AI draft review example |
| `/preview/trips/[tripId]/expenses` | Expenses, budget and equal split |
| `/preview/trips/[tripId]/polls` | Open and closed polls |
| `/preview/trips/[tripId]/packing` | Shared packing checklist |
| `/preview/trips/[tripId]/notes` | Shared trip notes |
| `/preview/invitations` | Received and sent invitations |
| `/preview/notifications` | In-app notification history with read/unread controls |
| `/invite/[token]` | Public invitation link: validates the token, then offers sign-in plus accept or decline |
| `/preview/profile` | Profile details and preferences |
| `/preview/admin` | Admin area (platform admins only; others are redirected) |
| `/preview/build` | Honest build-status page |

The `/preview` prefix is the historical route group name. These screens are now
protected: `src/app/preview/layout.tsx` checks the session on the server and
redirects signed-out visitors, and `/preview/admin` additionally requires the
`admin` role.

---

## 5. Project structure

```text
src/
  app/                     Next.js routes and layouts
    page.tsx               Public landing page
    credits/               Photo credits
    preview/               Sample workspace
      dashboard/
      trips/[tripId]/       Overview and section pages
      invitations/
      profile/
      admin/
      build/
  components/
    app-shell/             Sidebar, top bar, mobile nav, create-trip dialog
    brand/                 Logo
    invitations/           Invitation cards and list
    itinerary/             Day switcher, activity metadata, add-activity dialog
    marketing/             Landing header and footer
    notes/                 Note cards
    packing/               Checklist
    polls/                 Poll cards and result bars
    preview/               Global "not connected" notice provider
    profile/               Profile form
    trips/                 Covers, cards, rows, tabs, budget bar, actions
    ui/                    Reusable buttons, fields, dialogs, badges, states
  lib/
    types.ts               Typed domain model
    sample-data.ts         Curated example-trip and marketing content
    demo-store.ts          Client workspace provider backed by server actions
    money.ts               Paise-safe split, balance and settlement arithmetic
    polls.ts               Vote totals and percentages
    format.ts              Dates, times, currency, status and labels
    cn.ts                  Class-name helper
  server/
    schema.ts              Drizzle table definitions
    data.ts                loadWorkspace(): scoped reads for one account
    actions.ts             Every mutation, validated and role-checked
    permissions.ts         Membership and role enforcement
    template.ts            Read-only example trip and its copy routine
    auth.ts                Better Auth configuration
  middleware.ts            Copies the requested path for post-sign-in redirects
public/images/             Destination photographs
screenshots/               Local review captures, not runtime assets
drizzle/                   SQL migrations (0000_init, 0001 traveller_count, 0002 sample-data fields, 0003 profile preferences)
```

The important boundary is `src/server`: the client store (`src/lib/demo-store.tsx`)
only calls server actions and adopts the workspace they return, so screens never
read or write the database directly.

---

## 6. Design system

The visual direction follows PRD section 6: an editorial travel journal crossed
with a practical planning tool.

- **Surfaces:** warm paper / ivory (`paper-50`, `paper-100`, `paper-200`).
- **Structure:** deep forest green (`forest-800`, `forest-900`) for navigation, headings and primary actions.
- **Accent:** muted terracotta (`clay-500`, `clay-600`) for selection, status and restrained highlights.
- **Support:** soft sage for positive states and calm secondary surfaces.
- **Type:** Fraunces for editorial headings, Inter for interface text, small uppercase labels for structure.
- **Shape:** modest radii, thin borders, restrained shadows. No glassmorphism, neon gradients or floating blobs.
- **Icons:** Lucide line icons only. Emoji are not used as UI elements.
- **Photography:** five destination photographs used in trip covers and the landing hero. Attribution is on `/credits`.

The trip header has two variants. The Overview uses the large photographic cover;
section pages use a compact trip bar so the working content is visible sooner.
The layout has been checked at 1440 px desktop and 390 px phone widths.

---

## 7. Sample data and arithmetic

All sample records live in `src/lib/sample-data.ts`:

- Five trips: Coorg, Jaipur, Goa, Kerala and Manali.
- Nine sample accounts: six active travellers, two invited accounts and one additional account, with owner/member/admin roles.
- Two received invitations and three sent invitations.
- Itinerary activities, expenses, polls, packing items and notes.

The workspace UI shows real data; the labels that remain describe the curated
example trip (read-only), the build-status page and photo credits on `/credits`.
The admin page states its server-side restrictions.

Expense arithmetic is real, not hardcoded:

- `splitEqually` converts the amount to paise, divides in integers and gives the
  leftover paisa to the first participants. Example: ₹1,000 across three people
  becomes ₹333.34, ₹333.33 and ₹333.33 — exactly ₹1,000.
- `summarizeExpenses` reads the stored split shares and calculates total paid, each
  member's share and net balance; `suggestSettlements` then proposes transfers.
- The landing-page example is computed from the same Goa sample trip as the
  Expenses page, so the numbers agree.
- TripSync records planning information only. It never moves money.

These functions are pure TypeScript and are the first candidates for unit tests in
Phase 4.

---

## 8. Server layer (wired to every screen)

The screens do **not** keep their own copy of the data: the protected layout loads
`loadWorkspace()` on the server and hands it to the client workspace provider, and
every mutation is a server action that returns the fresh workspace afterwards.

### What is implemented

| Area | Implementation |
| --- | --- |
| Database | Postgres (Supabase) through Drizzle ORM; one migration in `drizzle/0000_init.sql`, applied by the app-side runner on first request |
| Tables | `user`, `session`, `account`, `verification`, `trips`, `trip_members`, `trip_invitations`, `itinerary_items`, `expenses`, `expense_splits`, `polls`, `poll_options`, `poll_votes`, `packing_items`, `trip_notes`, `feedback`, `notifications` |
| Authentication | Better Auth with email and password: scrypt hashing, HTTP-only session cookies, password change and reset code paths |
| Validation | Zod schemas in `src/server/validation.ts`, applied inside every server action |
| Authorisation | `src/server/permissions.ts`: membership and role checks on every trip-scoped write |
| Mutations | Server actions in `src/server/actions.ts` covering trips, itinerary, expenses, polls, packing, notes, invitations, profile, admin, feedback, notifications and account security |
| Reads | `loadWorkspace()` in `src/server/data.ts` returns only rows the signed-in person may see |
| Example trip | Curated in code; `copyTemplateForUser()` copies it into an account as one atomic batch |
| AI generation | `POST /api/ai/itinerary`: session check, trip access check, Zod validation, provider call, response normalisation. Three operations share the route via `scope`: `trip` (draft), `day` (replace one day) and `activity` (replace one slot). Saving goes through `addDraftItemsAction` (append) or `replaceDraftDaysAction` (atomic transaction replace) |
| Email | Resend adapter used for invitations and password reset when configured; otherwise the app reports that email is unavailable |
| Money | `src/lib/money.ts` is the single source of currency maths: amounts convert to paise, splits and balances use integer minor units, and `suggestSettlements()` only computes transfers. `/expenses` never sends a total to the server. |
| Poll lifecycle | `polls.status` is `open`/`closed`; a passed `closes_at` reads as `expired`. Votes are upserted on the unique `(poll_id, user_id)` index, so a member can change a vote but never create two. |
| Note versions | `updateNoteAction` requires the `updatedAt` the form was opened with and updates with `where updated_at = ?`, so a newer save is reported as a conflict instead of being overwritten. |
| Itinerary ordering | `itinerary_items.sort_order` (existing column) stores the position inside a day; a move re-numbers that day as `0..n-1` in one transaction. New activities are appended with `max(sort_order) + 1`, and the itinerary reads `order by day_date, sort_order, start_time` |
| Invitation links | `src/server/invitations.ts` loads a public-safe preview by token; `acceptInvitationTokenAction` / `declineInvitationTokenAction` re-check status, expiry and the signed-in email, then write membership and invitation status in one batch |
| Membership management | `updateMemberRoleAction`, `removeMemberAction` and `revokeInvitationAction` are owner-only; the owner row cannot be demoted or removed, and access ends on the next request because membership is read per request |

### In beginner-friendly terms

- **Postgres** is the database. It lives next to the application on Cloudflare, so there
  is no separate database server to manage. Foreign keys, unique indexes and check
  constraints are the real safety net.
- **Better Auth** is the login desk. It hashes passwords and issues an HTTP-only
  session cookie. The app never stores or logs a password.
- **Server actions** are the only way the interface may change data. Each one begins
  by identifying the caller, validates the input, checks the caller's role for that
  exact trip, and only then writes.
- **The AI route** is a server-only translator. The provider key stays on the server,
  the answer is validated before it reaches the browser, and nothing is saved until a
  member approves specific suggestions.

### Rules already enforced on the server

1. Every action resolves the session itself; no user id is accepted from the browser.
2. Trip reads and writes go through membership checks, so guessing a trip id is not enough.
3. Roles are `owner`, `editor` and `viewer`; only an owner may delete a trip or change roles.
4. The curated example trip is read-only; copying it creates independent rows.
5. Inputs are validated with Zod, and money is stored as integer paise.
6. One vote per member per poll is enforced by a unique index.
7. Auth, AI and email secrets are read only in server code.
8. An activity's date must fall inside the trip's start and end dates, checked in
   the action as well as in the form.
9. Only the owner may change roles, remove members or revoke invitations; an
   invitation never grants access until the invited account accepts it.

### Not yet true

- No AI or email key is configured, so those integrations report "not configured"
  rather than pretending to work.
- The hosted preview environment does not have a DATABASE_URL attached yet, so the
  deployed URL still runs the previous build (see section 11).

## 9. Environment variables

Copy `.env.example` to `.dev.vars` for local work. The preview screens need none of
these, but the server routes and database access do. Never commit real values.

| Variable | Used by | Exposure |
| --- | --- | --- |
| `DATABASE_URL` | Supabase pooler connection string | Server only (never reaches the browser) |
| `BETTER_AUTH_SECRET` | Session cookie signing | **Server only** |
| `BETTER_AUTH_URL` | Exact public origin for auth redirects | Server configuration |
| `AI_API_KEY` | Provider call in `/api/ai/itinerary` | **Server only** |
| `AI_BASE_URL` | OpenAI-compatible endpoint; set it explicitly on the host | Server configuration |
| `AI_MODEL` | Model name used for drafts | Server configuration |
| `AI_PROVIDER` | Label for the chosen provider | Server configuration |
| `AI_TIMEOUT_MS` | Provider response timeout, 1s–120s; default 45s | Server configuration |
| `AI_MAX_ATTEMPTS` | Generation attempts per account per 10 minutes; default 6 | Server configuration |
| `RESEND_API_KEY` | Invitation, password-reset and confirmation email (Resend) | **Server only** |
| `BREVO_API_KEY` | Invitation, password-reset and confirmation email (Brevo) | **Server only** |
| `EMAIL_PROVIDER` | `resend` (default) or `brevo` | Server configuration |
| `EMAIL_FROM` | Verified sender address | Server configuration |
| `GOOGLE_CLIENT_ID` | Sign in with Google (OAuth client) | Server configuration |
| `GOOGLE_CLIENT_SECRET` | Sign in with Google (OAuth client) | **Server only** |

Without `AI_API_KEY` and `AI_MODEL`, `GET /api/ai/itinerary` returns
`{"configured":false}` and generation answers with a clear 503 instead of sample text.

**Recommended provider:** Google AI Studio's Gemini free tier via its
OpenAI-compatible endpoint — `AI_BASE_URL=https://generativelanguage.googleapis.com/v1beta/openai/`,
`AI_MODEL=gemini-3.8-flash`. Use a *current* model id: Gemini shuts old ones
down (`gemini-2.0-flash` on 1 June 2026), and a retired id makes every draft
fail with a 502. Groq (`https://api.groq.com/openai/v1`),
OpenRouter and OpenAI all work with the same three variables, so switching
providers never needs a code change.

**Sign in with Google.** Create an OAuth client in Google Cloud Console →
APIs & Services → Credentials → Credentials → OAuth client ID → Web
application, and add the authorised redirect URI
`<origin>/api/auth/callback/google` (for local work:
`http://localhost:3000/api/auth/callback/google`; for the deployed site:
`https://<your-render-domain>/api/auth/callback/google`). While
`GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` are unset the "Continue with
Google" button is hidden and the social endpoint is not registered. Google
accounts arrive with a pre-verified address.

**Email verification becomes mandatory automatically** once a provider is
configured (`EMAIL_PROVIDER=brevo` + `BREVO_API_KEY` + `EMAIL_FROM`, or
`RESEND_API_KEY` + `EMAIL_FROM`): password sign-ups then cannot sign
in until the confirmation link is opened (`requireEmailVerification` follows
the email configuration — no separate switch). Unset, the app says plainly
that mail is unavailable instead of pretending a message was sent.

**Which mail provider.** Resend only sends from a domain you own and verify
with DNS records, so it needs a real domain. Brevo verifies a single sender
address (it emails a 6-digit code to that inbox), so email verification and
invitations work with nothing but a Gmail address — 300 messages/day free.
Either way the sender in `EMAIL_FROM` must be verified with that provider.

## 10. Verification performed

### Current stage (full-stack workspace)

- `npm run typecheck`, `npm run lint`, `npm run build` — all pass.
- Automated browser suite (Chrome/Playwright) against the local dev server with a
  fresh account: **45/45 checks passed, zero console errors, zero page errors**:
  - Sign-up lands on the dashboard; a new account shows the empty state and 0/0/0/0
    counters.
  - Inline validation: required name, end date before start date, travellers out of range.
  - Create a trip → lands on its details page with the saved name and travellers count.
  - Three trips with upcoming/ongoing/past dates → dashboard counts 3/1/1/1 and
    features the ongoing trip; My Trips search, both status filters, three sorts,
    no-match empty state and clear-filters all behave.
  - Edit name/budget/travellers (owner) → values appear immediately and survive a
    full page reload.
  - Add an itinerary activity → appears on the trip, survives a reload, and the trip
    card shows the real activity count.
  - Sign out, sign back in → trips remain; a **second browser context** signed in as
    the same account sees the same data (cross-device).
  - A second signed-in account gets the "not in your workspace" state on the first
    account's trip URL and sees **zero** of its data; a signed-out visitor is
    redirected to sign-in.
  - Delete with confirmation → trip disappears from My Trips and the dashboard
    counts drop, with cascade removal verified at the SQL level.
- Direct Postgres inspection confirms the rows (budget in paise, `traveller_count`,
  renamed/edited values, activity rows) independently of the UI.

### Itinerary and collaboration suite (current stage)

- Automated browser suite (Chrome/Playwright) with four real accounts against the
  local dev server: **53/53 checks passed, zero console errors, zero page errors**.
  - **Itinerary:** add three activities in order; the day shows them by scheduled
    time; move one earlier and the persisted order survives a full reload; rename
    and re-cost an activity; delete with confirmation; one save never creates a
    duplicate row.
  - **Date safety:** a form left open while the trip dates move cannot submit the
    now-outside day — the server refuses with "Activities must fall between …" and
    stores nothing; shortening the trip over existing plans is refused and the
    activities remain.
  - **Invitations:** the dialog lists the chosen role, the link token is a 64-hex
    string, a duplicate pending invitation is refused, an unknown token shows the
    invalid-link state without trip data, and an expired invitation is rejected
    (expiry set through the database clock).
  - **Acceptance:** opening a link while signed out shows only the trip name, dates,
    destination, inviter and role; the wrong signed-in account cannot accept;
    the invited account accepts and lands on the trip; accepting twice is refused
    and the database shows exactly one membership row.
  - **Roles:** an editor can add an activity and its change is visible to the owner
    after refetch; the editor cannot open member management; after the owner demotes
    them to viewer, a still-open tab's write is refused by the server (`Viewers can
    read this trip but cannot change it`) and stores nothing; after a reload the
    add and reorder controls are gone.
  - **Membership changes:** role changes are verified in Postgres, removing a member
    deletes their membership and their next trip request is refused, withdrawing a
    pending invitation marks it revoked and the link grants nothing.
  - **Privacy:** a non-member sees none of the trip or itinerary at the trip URL.

### Expenses, polls, packing and notes suite (current stage)

- Expenses/budget suite (Chrome/Playwright, three real members): **26/26 checks
  passed**, no console or page errors — expense create with note, three-way
  paise split (`333.34 for 1 · 333.33 for 2`), totals/remaining/percentage from
  saved rows, stored shares summing to the amount in Postgres, an expense dated outside
  the trip refused by the server with nothing stored, edit to a two-way split,
  viewer read-only, delete confirmation and recalculation, over-budget amount and
  105% of budget, and a trip with no budget showing “Not set” with no division by
  zero.
- Polls/packing/notes suite (three members): **36/36 checks passed**, no console
  or page errors — poll context saved, first vote, changed vote keeping one row,
  second member voting 50/50, owner closing with confirmation, a stale vote
  refused by the server after closure (nothing stored), an expired poll shown as
  Expired with no voting controls, packing notes/quantity, tick progress 0→100%,
  filters, persistence across refresh, second member seeing the same progress,
  viewer-only disabling, edit/delete recalculation, note label, editor updating a
  shared note, a stale note save refused with the typed text preserved, editor
  not offered deletion of another member’s note, owner deleting it, and a
  demoted editor’s note save refused server-side.
- The earlier itinerary/collaboration suite was re-run after these changes:
  **55/55 checks passed**, confirming no regressions.

### Profile, notifications, onboarding, feedback and demo-copy suite (current stage)

- New browser suite with three real accounts (Chrome/Playwright) plus direct Postgres
  inspection: **42/42 checks passed, zero console errors, zero page errors**:
  - **Onboarding:** a fresh account sees the six-step tour, "Skip tour" removes it
    and it stays gone after a full refresh; the profile page's "Replay tour"
    brings it back; completion is stored in `user.onboarding_completed_at`.
  - **Profile and preferences:** renaming persists across refresh, and turning off
    a notification switch is saved and still off after reload (re-enabled before
    the invite test, proving the switch also gates new notifications).
  - **Feedback:** submitting with no rating shows the validation message and
    writes nothing; a 5-star rating with a comment appears in the `feedback` table
    (exactly 1 row) and only shows success after the insert; a second submission
    within a minute is refused server-side with "just saved" instead of writing a
    duplicate.
  - **Demo trip:** `/preview/trips/goa` is viewable before any trip exists, is
    labelled read-only, offers "Create my own copy", and the database shows **zero** rows for
    the demo (`trips`, `itinerary_items`, `expenses`, `polls` counts all 0) — the
    sample lives only in code. The copy creates a new trip id with an owner
    membership plus 13 itinerary items, 3 notes, 9 packing items, 2 polls / 24 poll
    options and 5 expenses with 5 split rows, all referencing the new id. Editing
    the copy's name succeeds, survives a refresh, and the original demo still
    renders with its own name.
  - **Notifications from real events:** an invitation to an existing account puts
    "… invited you to …" in the bell with `1 unread`; the invite notice states
    honestly that email delivery is not configured; "Mark all read" clears the
    badge; the history page lists the event; marking it unread and refreshing keeps
    `1 unread`; accepting the invitation lands on the trip and notifies the owner
    ("… joined …"); an unrelated third account sees an empty list and no badge;
    an activity added by one member produces an "… added an activity to …"
    notification for the other members (solo trips notify nobody).
  - **Admin access:** a normal account visiting `/preview/admin` is redirected to
    the dashboard; after promoting the test account with SQL, the admin page shows
    the Feedback tab with the rating, comment, author email and date; the role was
    reset and all test accounts deleted afterwards.
- Regressions re-run after these changes: trip lifecycle **45/45**, expenses
  **26/26**, itinerary/collaboration **55/55**, polls/packing/notes **36/36**,
  full-stack responsive/permissions **35/35** — all with zero console and page
  errors.

### Earlier phases

- Auth, AI-route and responsive checks from the earlier phases still stand; see
  the sections below.

### Phase 1 (design foundation)

- `npm run typecheck` — passes.
- `npm run lint` — passes with no warnings.
- `npm run build` — passes.
- Automated browser checks through Chrome/Playwright:
  - 19 routes at 1440 x 1000 and 390 x 844 (38 page loads).
  - Zero horizontal page overflow at 320, 360, 375, 390, 768, 1024 and 1440 px.
  - Zero page errors and zero console errors.
  - All photographs loaded.
  - Trip filters/search, itinerary day switching, activity validation, trip
    validation, date-range validation, packing ticks, poll selection and profile
    validation exercised.
  - The trip header switches between the large overview cover and the compact
    section bar during client-side navigation, with no console errors.
  - No emoji characters found in visible text.
- Manual visual review of the landing page, dashboard, trip overview, itinerary,
  expenses, polls, AI planner, admin, invitations and profile at desktop and phone
  widths. Layout fixes made from that review.

A successful build alone is not proof that a feature works. Phase 1 claims only
the interactions listed in section 1; those interactions do not persist.

### AI planner checks (current stage)

The server route was exercised end-to-end through the real HTTP pipeline against a
local OpenAI-compatible provider (a test-only mock on `127.0.0.1`), configured with
`AI_BASE_URL`, `AI_MODEL`, `AI_API_KEY`, `AI_TIMEOUT_MS=1500`, `AI_MAX_ATTEMPTS=3`
in `.dev.vars`. **42/42 browser checks passed, zero unexpected console errors**, plus:

| Check | Result |
| --- | --- |
| Generation for a real 3-day trip | 3 day sections, 9 activities, day summaries, per-day and total cost estimates, not-verified labels, map links |
| Required-field, date-order and traveller validation | Inline errors, no request sent |
| Provider returns malformed JSON | Clear "not valid JSON" error; form values and previous draft preserved |
| Provider429 | Friendly rate-limit message |
| Provider timeout (1.5s) | 504 "took too long" message; original draft unchanged |
| Edit, add, delete and reorder activities | Draft updates; reorder swaps time slots |
| Day collapse / expand | `aria-expanded` toggles |
| Regenerate one day | Preview dialog; **Keep original** leaves everything unchanged, **Use replacement** changes that day only |
| Regenerate one activity | Current vs alternative comparison; accepting changes only that item |
| Save approved (9 items) | Rows written to `itinerary_items` (costs in paise), visible on the itinerary page immediately |
| Reload after save | Items still there (server-rendered workspace) |
| Save when days already have activities | Confirmation dialog with "Add alongside" / "Replace" / "Cancel"; replace is one atomic transaction |
| Saving to another user's trip | `404` (identical message for missing and foreign trips) |
| Sign-in required | `401` without a session |
| Provider throttle (`AI_MAX_ATTEMPTS=3`) | `[200, 200, 200, 429, 429]` |
| No `AI_API_KEY`/`AI_MODEL` | `GET` says `configured:false`; the planner shows a setup notice with the button disabled; an authenticated `POST` answers `503` naming `AI_API_KEY` and `AI_MODEL`; no sample draft is substituted |
| Direct SQL inspection | 9 rows for the saved trip, paise amounts, start/end times, correct categories; replace left exactly 9 rows (no duplicates, no orphans) |

**Not tested: a live call to a commercial provider.** No real key exists in this
workspace, so the provider leg was proven against a local endpoint that speaks the
same OpenAI-compatible protocol. Add `AI_API_KEY`/`AI_MODEL` and generate once to
verify your provider; the UI will report the outcome honestly either way.

---

## 11. Known limitations and decisions to confirm

**Limitations**

- No AI provider key is configured, so the planner shows its setup notice and
  generation answers `503`. The route itself is complete and was verified against
  a local OpenAI-compatible mock (see section 10); the provider leg is untested
  against a commercial API until a key is added.
- Places verification, directions and weather are **not** integrated: map links are
  plain Google Maps searches, and addresses are typed by members. No provider place
  ID or coordinates are stored, and no coordinates or travel times are invented.
- No email key is configured; invitations are stored as pending, registered invitees
  get an in-app notification, and the owner can copy the secure link. "Invitation
  sent" is only reported when the provider accepts the message.
- **No real-time synchronisation.** Members see the shared data on load, after a
  refresh or after their own action returns the fresh workspace; there are no
  websocket subscriptions. Concurrency is last-write-wins per row, and a reorder
  re-numbers the day in one batch so order never ends up duplicated.
- The hosted preview URL runs the previous build and has **no DATABASE_URL** on its
  environment; local development is the verified path. Publishing this work needs
  the storage binding, the migrations and a redeploy (section 13).
- No Git repository initialized.
- Trips use INR only. Expense amounts are entered in whole rupees and stored as
  integer paise; an equal split can show two decimals because the remainder is
  allocated paisa by paisa. There is no multi-currency conversion.
- Votes and expense/balance figures refresh when a member loads or refetches the
  page; there are no live subscriptions (see the real-time note below).

- `loadWorkspace()` loads the whole workspace for one account in one request;
  pagination is not implemented (fine at this scale, revisit if lists grow).
- Trips are deleted permanently with cascading child records — there is no archive.

**Decisions taken**

1. **Backend/auth:** Cloudflare Postgres + Better Auth with server-side-only checks,
   matching the Workers hosting already in use.
2. **Invitations:** email address plus role, stored with a 256-bit token and a
   14-day expiry. The token is kept in the row (not hashed) because the owner must
   be able to re-copy the link from the members dialog; the page it opens is public
   but shows only name, dates, destination, inviter and role, and accepting still
   requires the invited email. Email delivery is used when a Resend key is configured.
3. **Deletion:** permanent deletion with cascading child records, confirmed in a
   dialog that states the retention policy; owners delete, members leave.
4. **Currency:** INR as the fixed MVP currency; no conversion.
5. **Admin bootstrap:** the first admin is assigned with a trusted SQL update on
   the `user` table — `update user set role='admin' where email='you@example.com';`
   run against the deployment's Postgres database; after that, admins can promote users
   from the admin page (server-enforced). `/preview/admin` is a server component
   that redirects every non-admin before any admin markup renders, and `loadWorkspace`
   only selects users, trips and feedback rows for accounts whose stored role is
   `admin`.

---

## 12. Photo credits

The destination photographs are from Wikimedia Commons and are used under
CC BY-SA 4.0. The full list, authors, sources and licence links are on
[`/credits`](http://localhost:3000/credits). The trip names and details are
fictional; the photographs are illustrative and do not depict the sample
itineraries.

---

## 13. Next step

1. **Publish the full-stack build:** attach a DATABASE_URL (`DB`) to the site's
   preview environment, apply `drizzle/0000_init.sql`, `drizzle/0001_flowery_polaris.sql`,
   `drizzle/0002_flaky_barracuda.sql` and `drizzle/0003_brief_pyro.sql`
   to that database, then deploy and publish. Until then the hosted URL keeps
   running the previous demo build.
2. Remaining follow-ups: live multi-browser real-time sync (only refetch is
   implemented), a live email send once a Resend key exists, and a Places lookup
   for verified addresses and coordinates.
3. Deeper concurrency testing (two members editing the same activity at once) and
   a phone-width pass on the members and invitation dialogs.
4. Add `AI_API_KEY` and `AI_MODEL` to `.dev.vars` (or site secrets) to turn on live
   generation, and `RESEND_API_KEY` + `EMAIL_FROM` to turn on invitation emails.
5. Git repository initialisation.

No feature above is claimed to work until those tests pass.

---

## 14. Authentication and account security

Implemented on top of Better Auth + Postgres (tables `user`, `session`, `account`,
`verification`, `two_factor`; all created by the migration runner in
`src/server/migrations.ts`, currently 5 migrations / 24 tables).

| Concern | How it works | Where |
| --- | --- | --- |
| Password hashing | scrypt via Better Auth; the app never stores or logs a password | `src/server/auth.ts` |
| Session | 30-day HTTP-only, `SameSite=Lax` cookie; the row is re-read from Postgres on every request, so deleting a session ends access immediately | `auth.ts`, `getSessionUser()` |
| Email confirmation | One-hour, single-use token. Enforced **only when a mail provider is configured** (`requireEmailVerification`); otherwise the workspace stays open and `/verify-email` says email is unavailable | `auth.ts`, `app/verify-email` |
| Password reset | Provider-backed link, one hour, single use; invalid/expired/used tokens are refused by the server and reported in the UI | `auth.ts`, `components/auth/reset-password-form.tsx` |
| Password change | Requires the current password and revokes the account's other sessions | `changePasswordAction` |
| Two-factor (TOTP) | Authenticator app enrolment with setup key + 10 single-use recovery codes, hashed at rest; `/two-factor/verify-totp` is required at sign-in; five wrong codes lock the challenge for 15 minutes; turning it off or re-issuing codes requires the password | `server/auth.ts`, `components/profile/two-factor-card.tsx` |
| Rate limits | Per-route budgets for sign-in, sign-up, resend, verify, reset, TOTP and change-password | `rateLimit.customRules` in `auth.ts` |
| Authorisation | Every trip operation re-checks the caller's stored role; non-members see "This trip isn't available" instead of data; admin pages/actions are server-guarded | `server/permissions.ts`, `server/actions.ts` |
| Admin audit | Role changes and admin self-deletion append to `admin_audit_log` | `audit()` in `server/actions.ts` |
| Response hardening | `nosniff`, `DENY` framing, `strict-origin-when-cross-origin`, `Permissions-Policy`, HSTS | `next.config.ts` |

Still unconfigured (the features stay in their honest "not available" state, they
are not mocked): `AI_API_KEY` + `AI_MODEL` for live itinerary generation, and
`RESEND_API_KEY` + `EMAIL_FROM` for confirmation/reset/invitation mail. Turning on
the mail keys also turns on email verification and blocks unconfirmed accounts.
The first platform admin is still assigned with a trusted SQL update on the
deployment's Postgres (section 11, decision 5).

---

## 15. AI itinerary planner

The planner is a protected server route plus a review screen. Nothing reaches
the database until a member approves suggestions.

**Flow** — `components/ai-planner/ai-planner.tsx` → `POST /api/ai/itinerary` →
provider (OpenAI-compatible `/chat/completions`) → zod validation and
normalisation → draft in the browser → `addDraftItemsAction` (add alongside) or
`replaceDraftDaysAction` (atomic day replacement). Both actions re-check the
trip role and the trip dates server-side.

| Scope | Use |
| --- | --- |
| `trip` | a full draft for up to 14 days |
| `day` | a replacement for one date, with the current activities for context |
| `activity` | exactly one alternative for a chosen slot |

**Configuration** (server secrets only; never in the client bundle)

| Variable | Required | Notes |
| --- | --- | --- |
| `AI_API_KEY` | yes | Sent as `Authorization: Bearer …` from the Worker only |
| `AI_MODEL` | yes | Model id the provider expects |
| `AI_BASE_URL` | no | Defaults to `https://api.openai.com/v1`. Must be `https://`; `http://` is accepted only for `localhost`/`127.0.0.1` while developing against a mock |
| `AI_TIMEOUT_MS` | no | 45 000 by default, clamped to 1 000–120 000 |
| `AI_MAX_ATTEMPTS` | no | 6 generations per account per 10 minutes by default |

Without a key the route answers `503` and the planner shows a "not configured"
notice with the Generate button disabled — no sample itinerary is ever
substituted.

**Guards**

- Session required (`401`); the trip must belong to the caller. Missing and
  not-yours both return the same `404` so the route never reveals another
  trip's existence.
- Request body capped at 16 KB; every preference field is length-capped;
  interests 1–8; travellers 1–99; budget ≤ 10 000 000; dates must fall inside
  the trip and span at most 14 days.
- Provider answer is parsed with zod: unknown categories, bad dates, negative
  costs, inverted times, missing fields, out-of-range dates and duplicate
  suggestions (same day, same start time, same title) are dropped and counted;
  per-pace caps apply. Unusable answers return `502` instead of an empty draft.
- Provider failures are mapped to readable messages: `504` timeout, `429`
  provider rate limit, `503` rejected key, `502` non-JSON or empty answer. The
  provider's status is logged; its body (which can echo the prompt) and the key
  are never logged.
- Costs are labelled as estimates on every card, and the model is instructed not
  to claim live prices, opening hours or availability.

**Known limits**

- The draft lives in the browser until saved, so a reload loses it (the page
  warns first). Generation is not persisted server-side.
- Progress is a spinner with "Generating draft…"; there is no token streaming.
- The per-account throttle is in-isolate memory, so it is a cost guard rather
  than a billing guarantee.

## 16. Deploying to Render

The database is Supabase Postgres, and the app is a plain Node server on Render
(`npm run build` → `npm start`). There is no second runtime to keep in sync:
`src/server/db.ts` opens one `pg` pool from `DATABASE_URL` and exposes it two
ways — a Drizzle instance for Better Auth, and a D1-shaped facade (`prepare` →
`bind` → `run` / `all` / `first` / `batch`) for the app's parameterised SQL.
Timestamps stay bigint epoch-milliseconds, so every statement binds and reads
plain numbers exactly as it did before the move.

### One-time: push to GitHub

Render deploys from a Git repository — this project lives at
https://github.com/khushikhuranaa/TripSync. A push to `main` triggers a
redeploy.

Keep `.dev.vars`, `.env` and `data/` out of the repo (they are already covered
by `.gitignore` — verify before pushing).

### Render service settings

| Setting | Value |
| --- | --- |
| Runtime | Web Service (Node) |
| Build command | `npm install && npm run build` |
| Start command | `npm start` |
| Node version | 20 or newer |

### Environment variables (Render → Environment)

| Name | Required | Notes |
| --- | --- | --- |
| `BETTER_AUTH_SECRET` | yes | `openssl rand -base64 32`; signs session cookies |
| `BETTER_AUTH_URL` | yes | exact public origin, e.g. `https://tripsync.onrender.com` |
| `DATABASE_URL` | **yes** | Supabase → Connect → Connection pooling (Transaction, port 6543) URI, password included |
| `AI_PROVIDER`, `AI_BASE_URL`, `AI_MODEL`, `AI_API_KEY` | for AI planner | any OpenAI-compatible endpoint; `AI_MODEL` must be a **live** model id (Gemini retires ids — `gemini-2.0-flash` died 1 June 2026 and makes every draft 404); unset = planner reports "not configured" |
| `AI_TIMEOUT_MS`, `AI_MAX_ATTEMPTS` | optional | provider timeout / per-user throttle overrides |
| `EMAIL_PROVIDER`, `RESEND_API_KEY`, `EMAIL_FROM` | recommended | Resend (default): needs a verified **domain**. Real email + **mandatory verification** for password sign-ups; unset = invitations fall back to share links |
| `EMAIL_PROVIDER=brevo`, `BREVO_API_KEY`, `EMAIL_FROM` | alternative | Brevo: needs only a verified **sender address** (no domain), 300/day free — same verification and invitation emails |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | for Google login | OAuth client with redirect URI `https://<your-domain>/api/auth/callback/google`; unset = button hidden |
| `ADMIN_EMAIL` | optional | seed admin address (see section 11) |

Supabase keeps the rows, so a redeploy never loses them. In the Supabase
dashboard: **Connect → Connection pooling → Transaction** (port 6543 — the
direct 5432 connection is IPv6-only and Render cannot reach it), replace the
password placeholder, and use that URI locally in `.dev.vars` and on Render.
The **Table Editor** and **SQL Editor** show and edit the same tables the app
writes.

Migrations run automatically: `/api/health` (the Render health-check path) and
every server page call `ensureMigrated` before querying, so a fresh database
is fully schema'd on first request.
