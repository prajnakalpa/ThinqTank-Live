# ThinqTank-Live
# ThinqTank Live

A competitive, timed quiz platform. Students sign in with a one-time email code, take weekly quizzes, and are ranked on real-time leaderboards. Admins manage activities, questions, scoring, announcements, and site content from a protected dashboard.

- **Live site:** https://thinqtanklive.vercel.app
- **Stack:** Next.js 14 (App Router) · Supabase (Postgres + Auth + Storage) · Vercel
- **Status of this document:** Written from a direct audit of the repository, the live Supabase database (`ThinkTanq Live`, ref `mhhscvmypriujtoorgap`), and the Vercel-linked project. Anything that could not be confirmed from those sources is explicitly marked **"Not verified from available sources."**

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Tech Stack](#2-tech-stack)
3. [Repository Structure](#3-repository-structure)
4. [System Architecture](#4-system-architecture)
5. [Supabase Documentation](#5-supabase-documentation)
6. [Vercel Documentation](#6-vercel-documentation)
7. [Environment Variables](#7-environment-variables)
8. [Authentication & Authorization](#8-authentication--authorization)
9. [API Documentation](#9-api-documentation)
10. [Database Documentation](#10-database-documentation)
11. [Operational Runbook](#11-operational-runbook)
12. [Security Notes](#12-security-notes)
13. [Development Workflow](#13-development-workflow)
14. [Future Improvements](#14-future-improvements)
15. [Known Issues](#15-known-issues)

---

## 1. Project Overview

### What it does
ThinqTank Live runs timed, competitive quizzes. A quiz is modelled as an **activity** that has one **quiz** configuration (start time, duration) and a set of **questions**. Questions can be free-text (graded with keyword + fuzzy/phonetic matching) or multiple-choice. When a student submits, the server scores the attempt, records a **submission**, and rebuilds the **leaderboard** and **analytics** for that activity.

### Target users
- **Students / participants** — browse live quizzes, take them, see rankings. Authenticate via email OTP.
- **Admins** — create and manage activities/questions, view submissions, override/recalculate scores, import scores from CSV, post announcements, and edit homepage CMS content. Currently there is **one** admin account in the database.

### High-level architecture
A single Next.js 14 App-Router application deployed on Vercel. The browser and server both talk to Supabase. Three Supabase access levels are used deliberately:

- **Browser (anon key)** — public reads and a few user-scoped writes, all constrained by Row-Level Security (RLS).
- **Server (anon key + user cookies)** — SSR pages and the role check in API routes; runs as the logged-in user under RLS.
- **Server (service-role key)** — privileged operations in API routes (scoring, leaderboard/analytics rebuilds, CSV imports). **Bypasses RLS** and must never reach the browser.

### Major features
- Email OTP login; admin email/password login; admin "master password" break-glass unlock.
- Timed quiz taking with resume-before-deadline, tab/visibility cheat logging, and per-question timing.
- Automatic scoring engine with `strict` / `medium` / `loose` matching for free-text answers, plus MCQ.
- Real-time leaderboards (per-quiz and overall) and per-activity / per-question analytics.
- Admin CMS for homepage content and logo, announcements, and CSV score import / score recalculation.

---

## 2. Tech Stack

| Layer | Technology | Notes (verified from `package.json`) |
|---|---|---|
| Framework | **Next.js 14.2.5** (App Router) | React 18.3.1, React-DOM 18.3.1 |
| Language | **TypeScript 5.5.3** | `strict: true`, path alias `@/* → ./*` |
| Styling | **Tailwind CSS 3.4.6** + heavy inline styles + `app/globals.css` | PostCSS + Autoprefixer |
| Backend / runtime | Next.js **Route Handlers** (`app/api/**`) + Server Components | No separate backend service |
| Database | **Supabase Postgres 17** | Project `mhhscvmypriujtoorgap`, region `ap-south-1` |
| Auth | **Supabase Auth** via `@supabase/ssr` 0.5.0 + `@supabase/supabase-js` 2.44.4 | Email OTP, password, recovery |
| Storage | **Supabase Storage** | One public bucket: `assets` |
| Hosting | **Vercel** | Linked to this repo + Supabase via Connected Apps |
| Scoring libs | `fast-levenshtein` 3.0.0 | Edit-distance for fuzzy matching |
| Data utils | `papaparse` 5.4.1, `xlsx` 0.18.5, `date-fns` 3.6.0 | CSV import, Excel question import, date formatting |

There is **no test framework, linter config, or CI pipeline** present in the repository (see [Documentation Gaps](#missing-documentation-gaps)).

---

## 3. Repository Structure

> Folders/files below were observed directly. Where a directory almost certainly contains more files than were inspected, it is noted.

```
.
├── middleware.ts                 # Supabase session refresh on every request; injects x-pathname
├── next.config.mjs               # Image remote patterns (*.supabase.co, thinqtank.co.in)
├── vercel.json                   # Rewrites + no-store cache headers on /api/*
├── tsconfig.json                 # strict TS, @/* path alias
├── postcss.config.js             # tailwind + autoprefixer
├── package.json
├── global.d.ts / types/fast-levenshtein.d.ts   # ambient module decl for fast-levenshtein
│
├── app/
│   ├── layout.tsx                # Root HTML shell only (no nav)
│   ├── globals.css               # Global + admin shell + mobile CSS
│   │
│   ├── (main)/                   # Public marketing/app pages (Navbar + Footer)
│   │   ├── layout.tsx            # (Not inspected) wraps public pages with Navbar/Footer
│   │   ├── page.tsx              # Home / hero / features
│   │   ├── live/page.tsx         # List of activities (live/upcoming/closed)
│   │   ├── leaderboard/page.tsx  # Overall + per-quiz leaderboards
│   │   ├── announcements/page.tsx# Published announcements
│   │   └── contact/page.tsx      # Referenced in nav; NOT inspected
│   │
│   ├── (auth)/                   # Full-screen standalone auth pages (no nav)
│   │   ├── layout.tsx
│   │   ├── login/page.tsx        # 3 modes: OTP / admin password / master password
│   │   ├── reset-password/page.tsx
│   │   ├── update-password/page.tsx
│   │   └── callback/route.ts     # PKCE + token-hash exchange → /callback URL
│   │
│   ├── quiz/
│   │   └── [id]/page.tsx         # Quiz-taking UI (force-dynamic). Username gate, timer, submit, results breakdown
│   │   └── layout.tsx            # (Referenced) standalone full-screen quiz layout
│   │
│   ├── admin/                    # Protected admin area (see app/admin/layout.tsx gate)
│   │   ├── layout.tsx            # Auth + role + master-password gate; renders AdminSidebar
│   │   ├── page.tsx              # Dashboard stats (activities/live/submissions/users)
│   │   ├── unlock/page.tsx       # Master-password entry screen
│   │   ├── activities/page.tsx   # Activity list
│   │   ├── activities/[id]/page.tsx       # Create/edit activity (and delete)
│   │   ├── activities/new        # New activity (route referenced from list)
│   │   ├── questions/[quizId]/page.tsx    # Question editor + XLSX import + per-question analytics
│   │   ├── submissions/[quizId]/page.tsx  # Per-submission answer review & scoring
│   │   ├── announcements/page.tsx# Announcement CRUD
│   │   └── settings/page.tsx     # CMS keys + logo upload to Storage
│   │
│   └── api/
│       ├── admin/verify-master/route.ts     # POST — verify master password, set cookie
│       ├── admin/import-scores/route.ts     # POST — CSV score import (admin)
│       ├── admin/delete-submission/route.ts # POST — delete submission + rebuild leaderboard (admin)
│       ├── admin/recalculate/route.ts       # POST — recompute scores + rebuild leaderboard (admin)
│       ├── quiz/submit/route.ts             # POST — score a submission, rebuild leaderboard/analytics
│       └── quiz/log-event/route.ts          # POST — record a cheat/visibility event
│
├── components/
│   ├── layout/Navbar.tsx         # Public nav; shows Admin link if role==='admin'
│   ├── layout/Footer.tsx
│   └── admin/AdminSidebar.tsx    # Client sidebar (nav items NOT inspected in full)
│
└── lib/
    ├── supabase/client.ts        # createBrowserClient (anon)
    ├── supabase/server.ts        # createServerClient (anon + cookies) for SSR/route handlers
    ├── supabase/admin.ts         # createAdminClient (service role) — server only
    ├── evaluation.ts             # Scoring engine (normalize, wordMatch, phoneticMatch, evaluateSubmission)
    ├── quiz-state.ts             # getSecondsRemaining, formatTime, formatDuration
    └── utils.ts                  # cn, formatDate, timeAgo, statusColor, rankEmoji, truncate, getURL
```

---

## 4. System Architecture

### 4.1 Request flow (every request)
1. Request hits **`middleware.ts`** (matcher excludes `_next/static`, `_next/image`, `favicon.ico`, and common image extensions).
2. Middleware builds a Supabase server client bound to request cookies and calls `supabase.auth.getUser()` — this **refreshes the session token** if expired and writes refreshed cookies onto the response.
3. Middleware sets an `x-pathname` header and returns the response.
4. The matched Server Component / Route Handler runs. SSR pages and API routes create their own Supabase clients via `lib/supabase/*`.

### 4.2 Authentication flow (student OTP)
```
/login (OTP tab)
  └─ signInWithOtp({ email, shouldCreateUser: true })   → email code sent
  └─ user enters code → verifyOtp({ email, token, type:'email' })
        └─ on success: supabase.auth.getUser()
              └─ upsert into public.users { id, email }  (ignoreDuplicates)
              └─ router.push(redirectTo) ; router.refresh()
```
Password recovery uses `resetPasswordForEmail` with `redirectTo = ${getURL()}callback?type=recovery` → `app/(auth)/callback/route.ts` exchanges the code/token and redirects to `/update-password`.

### 4.3 Admin flow (role-based)
```
Navigate to /admin/*
  → app/admin/layout.tsx (Server Component)
       1. getUser()                       → if none: redirect /login?redirect=/admin
       2. select role from users (self)   → if role !== 'admin': redirect /
       3. if ADMIN_MASTER_PASSWORD set:    → require admin_master_verified cookie, else redirect /admin/unlock
  → AdminSidebar + page render
```
Admin **API routes** independently re-check identity server-side: `getUser()` → `users.role === 'admin'` → otherwise `401/403`. They then use the **service-role** client for privileged writes.

### 4.4 Master-password flow (break-glass)
```
/login (Master tab)  OR  /admin/unlock
  └─ POST /api/admin/verify-master { password }
        ├─ password !== ADMIN_MASTER_PASSWORD → 401 { ok:false }
        └─ match → Set-Cookie admin_master_verified=1
                   (httpOnly, sameSite=lax, secure in prod, maxAge 8h, path=/admin)
                   → { ok:true }
  └─ client: router.push('/admin') ; router.refresh()
```
> ⚠️ This flow has known defects in the current code — see [Known Issues](#15-known-issues). Document and test against that section before relying on it.

### 4.5 Middleware flow detail
The middleware exists primarily to keep Supabase auth cookies fresh on the edge so Server Components see a valid session. It must (a) read all request cookies, (b) call `getUser()` with no logic in between, and (c) return the same response object it wrote refreshed cookies onto. It also attempts to expose the current pathname to layouts (see Known Issues for the correct way to forward it).

### 4.6 Data flow (quiz attempt, end to end)
```
Student opens /quiz/[id]
  → client loads activity + quiz + questions (anon, RLS: questions readable only while activity status='live')
  → username gate: if users.username null, set username + username_locked=true
  → a submission row is created for the user (RLS: submissions_insert_own → user_id = auth.uid())
  → student answers; visibility/tab events POST to /api/quiz/log-event (service role inserts quiz_logs)
  → on submit: POST /api/quiz/submit { submissionId, answers, time_taken_seconds, ... }
        ├─ service-role fetch of submission + questions (bypasses RLS — the reliable scoring path)
        ├─ evaluateSubmission() computes total
        ├─ update submissions { answers, auto_score, final_score, is_complete, cheat_*, ... }
        ├─ rebuildLeaderboard(activity_id)
        └─ updateAnalytics(activity_id)
  → results breakdown rendered client-side
```

**Scoring engine (`lib/evaluation.ts`):**
- `normalize()` lowercases, strips non-alphanumerics, collapses whitespace.
- Free-text matching by strictness: `strict` = exact normalized equality; `medium` = exact OR word-match (Levenshtein tolerance 1) OR phonetic match (tolerance 1); `loose` = same with tolerance 2.
- A question's accepted terms = `correct_answer` + `accepted_keywords` + `synonyms`; any match awards `weightage` points.
- MCQ: the stored answer is the option **index** as a string; correct if it equals `String(correct_option)`.
- `cheat_flag` is set when `quiz_logs` count for the submission `>= 6`.

> **Important data-shape gotcha:** `submissions.answers` and `submissions.time_per_question` are **TEXT** columns holding JSON strings. Always parse with the `parseJsonField` helper before use — this is the documented root cause of past "admin can't see answers" and "score is always 0" bugs.

---

## 5. Supabase Documentation

**Project:** `ThinkTanq Live` · ref `mhhscvmypriujtoorgap` · Postgres 17 · region `ap-south-1` · status ACTIVE_HEALTHY.
(There is a second, **INACTIVE** project `supabase-emerald-tree` / `thqpmmlnjemjljndlbdp` in the same org — not used by production. Confirm before touching it.)

### 5.1 Schema (public) — verified
Tables: `users`, `activities`, `quizzes`, `questions`, `submissions`, `leaderboard`, `announcements`, `site_content`, `analytics`, `quiz_logs`. Full column detail in [Section 10](#10-database-documentation).

### 5.2 Relationships
```
auth.users 1───1 public.users            (users.id → auth.users.id)
public.users 1───* activities             (activities.created_by → users.id)
public.users 1───* announcements          (announcements.created_by → users.id)
public.users 1───* submissions            (submissions.user_id → users.id)
public.users 1───* leaderboard            (leaderboard.user_id → users.id)
activities  1───1 quizzes                 (quizzes.activity_id → activities.id, unique)
activities  1───1 analytics               (analytics.activity_id → activities.id, unique)
activities  1───* submissions / leaderboard
quizzes     1───* questions               (questions.quiz_id → quizzes.id)
submissions 1───* quiz_logs               (quiz_logs.submission_id; FK not enforced in schema)
```

### 5.3 RLS policies — verified (RLS enabled on all public tables)
The authorization backbone is a **`SECURITY DEFINER`** SQL function:
```sql
public.is_admin() RETURNS boolean
  → SELECT EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
```
Because it is `SECURITY DEFINER`, it reads `users` without tripping that table's own RLS (avoids recursion).

| Table | Policy | Command | Rule |
|---|---|---|---|
| users | `users_admin_all` | ALL | `is_admin()` |
| users | `users_self_read` | SELECT | `auth.uid() = id` |
| users | `users_self_update` | UPDATE | `auth.uid() = id` · **no WITH CHECK** ⚠️ |
| users | `users_insert_own` | INSERT | check `auth.uid() = id` |
| activities | `activities_admin_all` / `activities_public_read` | ALL / SELECT | `is_admin()` / `visibility='public' OR is_admin()` |
| quizzes | `quizzes_admin_all` / `quizzes_public_read` | ALL / SELECT | `is_admin()` / `true` |
| questions | `questions_admin_all` / `questions_read_live` | ALL / SELECT | `is_admin()` / `is_admin() OR (quiz's activity.status='live')` |
| submissions | `submissions_admin_all` | ALL | `is_admin()` |
| submissions | `submissions_insert_own` | INSERT | check `user_id = auth.uid()` |
| submissions | `submissions_own` / `submissions_own_read` | SELECT | `user_id = auth.uid() OR is_admin()` |
| submissions | `submissions_update_own` | UPDATE | `user_id = auth.uid() OR is_admin()` |
| leaderboard | `leaderboard_admin_all` / `leaderboard_public` | ALL / SELECT | `is_admin()` / `true` |
| analytics | `analytics_admin_all` / `analytics_public` | ALL / SELECT | `is_admin()` / `true` |
| announcements | `announcements_admin_all` / `announcements_public` | ALL / SELECT | `is_admin()` / `published=true OR is_admin()` |
| site_content | `site_content_admin_all` / `site_content_public` | ALL / SELECT | `is_admin()` / `true` |

Note: `questions_read_live` only exposes questions while the parent activity is `live`. The scoring API deliberately uses the **service-role** client so it can read questions regardless of status — this is why direct (RLS-bound) nested joins previously returned `[]` and scored 0.

### 5.4 Auth setup
- Providers used by code: **Email OTP** (`signInWithOtp`/`verifyOtp` type `email`), **email+password** (`signInWithPassword`), and **password recovery** (`resetPasswordForEmail`). The exact enabled-provider configuration in the Supabase Auth dashboard is **Not verified from available sources** — confirm Email auth + "Enable email OTP" are on.
- Redirect URLs must include the deployment origin + `/callback` (and localhost for dev). Verify the Supabase **Auth → URL Configuration** allow-list includes the production and preview URLs. **Not verified from available sources.**

### 5.5 Role & admin management
- Admin status is a single column: **`public.users.role`** ∈ {`student`, `admin`} (default `student`). There is **no roles table and no JWT/custom claim** in use; `raw_app_meta_data.role`, `raw_user_meta_data.role`, and `is_super_admin` are all null for every user.
- The app authorizes by reading `users.role` (SSR/layout, API routes, Navbar) or via `is_admin()` inside RLS.

### 5.6 How to add a new admin
1. Have the person sign in once via OTP so their row exists in `public.users` (created as `student`).
2. Promote:
   ```sql
   update public.users set role = 'admin' where email = 'newadmin@example.com';
   ```
3. They refresh / re-login; subsequent role reads return `admin`.

### 5.7 Common Supabase maintenance tasks
- **List admins:** `select email, username from public.users where role='admin';`
- **Demote:** `update public.users set role='student' where email='…';`
- **Inspect a user's submissions:** `select * from submissions where user_id = (select id from users where email='…');`
- **Rebuild a leaderboard** without code: call the admin **Recalculate** action (API route) for the activity.
- **Logs:** Supabase dashboard → Logs (auth/api/postgres) for debugging.

---

## 6. Vercel Documentation

> Vercel project-settings introspection (framework preset, region, build command, per-variable environment scoping) is **Not verified from available sources** in this audit. The items below are confirmed from repo config or stated by the project owner; verify the rest in the Vercel dashboard.

### 6.1 Deployment workflow
- The project is linked to this Git repository through Vercel. **Confirmed behavior:** standard Vercel Git integration — push to the production branch → production deploy; pull requests / non-production branches → Preview deploys. (Exact production branch name **Not verified**.)
- Build: `next build` (from `package.json`). Framework preset is auto-detected as Next.js. `vercel.json` adds:
  - a pass-through rewrite `"/(.*)" → "/$1"`, and
  - `Cache-Control: no-store` on all `/api/*` responses (prevents cached API responses).

### 6.2 Environment variables (Vercel)
Set the variables in [Section 7](#7-environment-variables) for **Production, Preview, and Development**. The owner confirms `ADMIN_MASTER_PASSWORD` is set for all environments. `NEXT_PUBLIC_*` values are inlined at build time, so **changing them requires a redeploy**, not just a restart.

### 6.3 Production vs Preview
- Preview deployments get a unique `*.vercel.app` URL. For Supabase auth redirects to work on previews, either set `NEXT_PUBLIC_SITE_URL` appropriately or rely on `NEXT_PUBLIC_VERCEL_URL` (see `getURL()`), **and** ensure the preview URL pattern is in Supabase's redirect allow-list. Preview auth working end-to-end is **Not verified**.

### 6.4 Redeploy process
- Dashboard → Deployments → pick a build → **Redeploy**, or push a new commit. After changing any env var, trigger a redeploy so new values take effect (especially `NEXT_PUBLIC_*`).

### 6.5 Common deployment issues
- **Scoring returns 503 "scoring unavailable":** `SUPABASE_SERVICE_ROLE_KEY` missing/incorrect in the deployed environment.
- **Auth redirect lands on `?error=auth_callback_failed`:** callback URL mismatch — fix `getURL()` inputs and Supabase redirect allow-list.
- **Master unlock loops / bounces:** see [Known Issues](#15-known-issues).
- **Stale `NEXT_PUBLIC_*` value:** you changed it but didn't redeploy.

---

## 7. Environment Variables

All are read in code; presence of the first three is required for the app to function. "Public" (`NEXT_PUBLIC_*`) values are exposed to the browser and inlined at build time.

| Variable | Purpose | Required | Example | Impact if missing |
|---|---|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL for all clients (browser/server/admin/middleware) | **Yes** | `https://mhhscvmypriujtoorgap.supabase.co` | App cannot reach Supabase; auth + all data fail |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Public anon key for browser/SSR clients (RLS-bound) | **Yes** | `eyJhbGciOi...` (anon JWT) | Public reads, login, and SSR data all fail |
| `SUPABASE_SERVICE_ROLE_KEY` | Service-role key for privileged server operations (scoring, leaderboard/analytics, CSV import, log insert). **Server-only secret.** | **Yes** (for scoring/admin writes) | `eyJhbGciOi...` (service_role JWT) | `/api/quiz/submit` returns 503; admin score/import/recalc/delete fail |
| `ADMIN_MASTER_PASSWORD` | Enables the master-password admin gate. If unset, the master feature is treated as disabled. **Server-only secret.** | Optional | `a-long-random-string` | Master unlock disabled; `verify-master` returns `{ok:true, disabled:true}`; admin layout skips the master gate |
| `NEXT_PUBLIC_SITE_URL` | Canonical base URL used by `getURL()` for Supabase `redirectTo` links | Optional (recommended in prod) | `https://thinqtanklive.vercel.app` | Falls back to `NEXT_PUBLIC_VERCEL_URL`, then `http://localhost:3000`; recovery/redirect links may point to the wrong origin |
| `NEXT_PUBLIC_VERCEL_URL` | Fallback origin for `getURL()` on Vercel | Optional | `thinqtanklive.vercel.app` | Without `NEXT_PUBLIC_SITE_URL`, redirects may fall back to localhost. Note: Vercel auto-provides `VERCEL_URL`; the **`NEXT_PUBLIC_`** variant must be explicitly exposed to be readable in the browser bundle |

> ⚠️ `ADMIN_MASTER_PASSWORD` and `SUPABASE_SERVICE_ROLE_KEY` must **never** be prefixed with `NEXT_PUBLIC_` and must never appear in client code.

---

## 8. Authentication & Authorization

### 8.1 OTP login (students)
Email-code login via Supabase. On success the app upserts a `public.users` row keyed by the auth user id, defaulting `role='student'`.

### 8.2 Admin login
Email + password via `signInWithPassword`. After login the user is routed to `/admin` (if they came from `/live`) or their requested redirect. Authorization is still enforced by the admin layout's `role==='admin'` check — a successful password login as a non-admin will be redirected to `/`.

### 8.3 Master-password flow
A server-only secret (`ADMIN_MASTER_PASSWORD`) verified by `POST /api/admin/verify-master`, which sets an httpOnly `admin_master_verified` cookie (8h). Intended as a break-glass / second-factor gate for the admin area. **See [Known Issues](#15-known-issues) for current defects in this flow.**

### 8.4 Role checks (defense in depth)
- **UI:** `Navbar` shows the Admin link only when `users.role==='admin'`.
- **SSR gate:** `app/admin/layout.tsx` enforces session + role (+ master gate) before rendering any admin page.
- **API:** every admin route re-checks `getUser()` + `role==='admin'` server-side before doing privileged work.
- **Database:** RLS + `is_admin()` enforce access even if a client calls Supabase directly.

### 8.5 Security assumptions
- The service-role key is confined to server route handlers and never shipped to the browser.
- RLS is the last line of defense; the app assumes every public table has RLS enabled (it does).
- The master cookie is httpOnly and path-scoped; knowledge of the master password is treated as admin-equivalent authorization.

---

## 9. API Documentation

All routes are `POST` JSON unless noted. `/api/*` responses are sent with `Cache-Control: no-store` (via `vercel.json`).

### `POST /api/admin/verify-master`
- **Purpose:** Verify the master password and set the `admin_master_verified` cookie.
- **Input:** `{ password: string }`
- **Output:** `{ ok: true }` · `{ ok: true, disabled: true }` (env unset) · `401 { ok: false, error }`
- **Permissions:** Public endpoint; authorization *is* the password.
- **Dependencies:** `process.env.ADMIN_MASTER_PASSWORD`, `next/headers` cookies.

### `POST /api/quiz/submit`
- **Purpose:** Score a submission, persist results, rebuild leaderboard + analytics. Idempotent (returns cached result when `is_complete && auto_score != null`).
- **Input:** `{ submissionId, answers?, submission_time?, time_taken_seconds?, time_per_question? }`
- **Output:** `{ score, violations, cheatFlag }` (or `{…, duplicate:true}`); error JSON with `400/404/500/503`.
- **Permissions:** Requires a session cookie (server client is created); scoring uses the **service-role** client.
- **Dependencies:** `SUPABASE_SERVICE_ROLE_KEY` (returns **503** if absent), `lib/evaluation.ts`, tables `submissions`, `activities`, `quizzes`, `questions`, `quiz_logs`, `leaderboard`, `analytics`.

### `POST /api/quiz/log-event`
- **Purpose:** Record a quiz integrity event (e.g., tab switch) into `quiz_logs`.
- **Input:** `{ submissionId, type, timestamp? }`
- **Output:** `{ success: true }` · error `400/500`.
- **Permissions:** No explicit auth check; inserts via service-role client.
- **Dependencies:** `SUPABASE_SERVICE_ROLE_KEY`, table `quiz_logs`. (See Security Notes — this endpoint is unauthenticated.)

### `POST /api/admin/recalculate`
- **Purpose:** Recompute `auto_score`/`final_score` for all complete, non-overridden submissions of an activity, then rebuild its leaderboard.
- **Input:** `{ activityId, recalculateScores?: boolean }`
- **Output:** `{ ok: true, updated: number }`
- **Permissions:** **Admin** — `getUser()` + `role==='admin'` (`401/403` otherwise).
- **Dependencies:** service-role client, `lib/evaluation.ts`, `submissions`, `leaderboard`.

### `POST /api/admin/import-scores`
- **Purpose:** Bulk-set `final_score` from CSV (columns `email`, `score`), marking `score_overridden=true`. Case-insensitive email match.
- **Input:** `{ activityId, csvData }`
- **Output:** `{ updated: number, errors: string[] }`
- **Permissions:** **Admin**.
- **Dependencies:** service-role client, `submissions`.

### `POST /api/admin/delete-submission`
- **Purpose:** Delete a submission and rebuild the affected leaderboard.
- **Input:** `{ id }`
- **Output:** `{ success: true }`
- **Permissions:** **Admin**.
- **Dependencies:** service-role client, `submissions`, `leaderboard`.

### `GET /callback` (`app/(auth)/callback/route.ts`)
- **Purpose:** Complete Supabase auth flows (PKCE `code` exchange or `token_hash`+`type`); recovery → `/update-password`, else → `next`.
- **Note:** The route group `(auth)` does not appear in the URL — the path is `/callback`, not `/auth/callback`.

---

## 10. Database Documentation

All tables are in schema `public`, all have RLS enabled. Row counts are point-in-time snapshots from the audit.

### `users` — application profile (1:1 with `auth.users`)
- **Purpose:** App-level identity, display username, and **role** (the admin source of truth).
- **Key fields:** `id` (PK, FK→`auth.users.id`), `email` (unique), `username` (unique, nullable), `username_locked` (bool), `role` ∈ {`student`,`admin`} default `student`, `created_at`.
- **Used by:** auth upsert on login, role checks everywhere, leaderboard usernames, quiz username gate.

### `activities` — a quiz event
- **Purpose:** Top-level unit students browse and enter.
- **Key fields:** `id`, `title`, `description`, `type` (`quiz`), `status` ∈ {`upcoming`,`live`,`closed`,`archived`}, `visibility` ∈ {`public`,`private`}, `created_by`→`users.id`, timestamps.
- **Used by:** `/live`, leaderboard filters, admin activity management; gates question readability via RLS.

### `quizzes` — quiz config for an activity (1:1)
- **Key fields:** `id`, `activity_id` (unique FK), `start_time`, `end_time`, `duration_minutes` (default 30), `max_score`.
- **Used by:** timing (`getSecondsRemaining`), question linkage.

### `questions`
- **Key fields:** `id`, `quiz_id`→`quizzes.id`, `text`, `type` (e.g. `objective_text`, `mcq*`), `correct_answer`, `accepted_keywords[]`, `synonyms[]`, `options` (jsonb), `correct_option` (int), `weightage` (default 1), `strictness_level` ∈ {`strict`,`medium`,`loose`}, `order_index`, `image_url`.
- **Used by:** quiz UI, scoring engine, question editor + XLSX import. RLS exposes them publicly only while the parent activity is `live`.

### `submissions`
- **Purpose:** A student's attempt + scoring state. **Central scoring table.**
- **Key fields:** `id`, `activity_id`, `user_id`, `email`, `username`, `answers` (**TEXT/JSON string**), `auto_score`, `final_score` (**default 0**), `score_overridden` (bool), `start_time`, `submission_time`, `time_taken_seconds`, `time_per_question` (**TEXT/JSON string**), `is_complete` (bool), `cheat_violations` (int), `cheat_flag` (bool), `created_at`.
- **Gotchas:** `final_score` defaults to `0`, so "is it scored?" must be checked via `auto_score != null`, not `final_score`. `answers`/`time_per_question` must be `JSON.parse`d.

### `leaderboard`
- **Key fields:** `id`, `activity_id`, `user_id`, `username`, `score`, `time_taken_seconds`, `rank`, `updated_at`. Upserted on conflict `(activity_id, user_id)`.
- **Used by:** `/leaderboard` (per-quiz ranks + overall aggregation). Rebuilt by submit/recalculate/delete flows.

### `analytics` — per-activity rollup (1:1)
- **Key fields:** `id`, `activity_id` (unique), `participant_count`, `avg_score`, `completion_rate`, `avg_time_seconds`, `updated_at`. (Per-question stats are surfaced in the admin questions page via an analytics structure; the exact `question_stats` storage shape was **Not fully verified**.)

### `announcements`
- **Key fields:** `id`, `title`, `body`, `is_pinned`, `published`, `created_by`, `created_at`. Public read requires `published=true`.

### `site_content` — homepage CMS (key/value)
- **Key fields:** `key` (PK), `value`, `updated_at`. Keys used by admin settings: `hero_title`, `hero_subtitle`, `hero_cta`, `about_text`, `contact_email`, plus `logo_url`. Publicly readable.

### `quiz_logs` — integrity events
- **Key fields:** `id`, `submission_id`, `event_type`, `created_at`. Count `>= 6` sets `cheat_flag` on the submission.

### Storage
- One **public** bucket: `assets` (e.g., `assets/logo/logo.png`). Logo upload happens from admin settings.

---

## 11. Operational Runbook

### Onboard a new developer
1. Clone the repo; `npm install`.
2. Create `.env.local` with the four core vars (Section 7) using values from the Vercel/Supabase dashboards.
3. `npm run dev` → http://localhost:3000.
4. Read [Section 4](#4-system-architecture) and [Known Issues](#15-known-issues) first.

### Create a new admin
See [5.6](#56-how-to-add-a-new-admin). Person logs in once via OTP, then `update public.users set role='admin' where email='…';`.

### Reset / rotate the master password
1. In Vercel → Project → Settings → Environment Variables, set `ADMIN_MASTER_PASSWORD` to the new value for all environments.
2. **Redeploy** (env changes need a new build).
3. Existing `admin_master_verified` cookies remain valid up to 8h; to force re-entry, instruct admins to clear cookies (no server-side revocation exists today).

### Rotate secrets
- **Service role / anon keys:** rotate in Supabase → Settings → API, update the matching Vercel env vars, redeploy. Treat a leaked `SUPABASE_SERVICE_ROLE_KEY` as a full-database compromise — rotate immediately.
- **Master password:** as above.

### Troubleshoot login issues
- OTP code never arrives → check Supabase Auth email provider + rate limits; confirm Email OTP enabled.
- Recovery link errors (`auth_callback_failed`) → check `getURL()` output and Supabase redirect allow-list; remember the path is `/callback`.
- Admin can't reach `/admin` → confirm the user's `users.role='admin'`; then see Known Issues for the master gate.

### Troubleshoot deployment issues
- 503 on quiz submit → `SUPABASE_SERVICE_ROLE_KEY` missing in that environment.
- Changed a `NEXT_PUBLIC_*` value but nothing changed → redeploy.
- Inspect **Vercel runtime logs** (serverless/edge) and **Supabase logs** (auth/api/postgres) together.

### Recover from common failures
- **Wrong scores after edits:** run admin **Recalculate** for the activity (rebuilds scores + leaderboard).
- **Corrupted leaderboard:** Recalculate, or delete an offending submission (rebuilds automatically).
- **Stuck "score 0 forever":** ensure the submit path uses service-role reads (it does in current code) and that `answers` parsed correctly.

---

## 12. Security Notes

### Current model
Three-tier Supabase access (anon browser / anon server-with-cookies / service-role server) + RLS everywhere + `is_admin()` (`SECURITY DEFINER`) + an app-layer role gate and per-route admin checks. Admin = `public.users.role='admin'`.

### Known risks / observations
1. **🔴 Privilege escalation via `users_self_update`.** The UPDATE policy is `USING (auth.uid() = id)` with **no `WITH CHECK`**, and `role` lives on the same row. A signed-in student can call PostgREST directly to set their own `role='admin'`. **Recommended fix:** add a `WITH CHECK` that forbids changing `role` (or split a column-restricted policy; perform role changes only via an admin/service path).
2. **🟠 Unauthenticated `/api/quiz/log-event`.** No identity check; anyone can insert `quiz_logs` rows for any `submissionId`, potentially inflating `cheat_violations`/`cheat_flag`. Add an auth check and validate ownership of the submission.
3. **🟠 Master cookie has no revocation and `path=/admin`.** Signing out of Supabase does not clear `admin_master_verified`. Clear it in the sign-out handler if the master gate is meant to be tied to sessions.
4. **🟡 Misleading copy.** The login Master tab says "Bypasses Supabase auth," but the current admin layout requires a Supabase admin session first — the behavior and the label disagree (see Known Issues).
5. **🟡 `analytics`/`leaderboard` are world-readable** by design (`SELECT true`). Fine for public ranking, but confirm no sensitive fields are added there later.

### Admin privilege model
Single binary role, no granular permissions. Acceptable at current scale (one admin), but any move to multiple staff with different capabilities will need a real roles/permissions design.

---

## 13. Development Workflow

### Local setup
```bash
git clone <repo-url>
cd thinqtank-live
npm install
cp .env.local.example .env.local   # if present; otherwise create it (Section 7)
```

### Running locally
```bash
npm run dev      # http://localhost:3000
npm run build    # production build
npm run start    # serve the production build
```
Local auth redirects fall back to `http://localhost:3000` via `getURL()`; ensure `http://localhost:3000/callback` is allow-listed in Supabase Auth for recovery/OTP redirect flows to work locally.

### Testing
**No automated tests, linter, or CI are configured in the repository.** Validation is currently manual. (See Future Improvements.)

### Deployment workflow
Push to the production branch (or merge a PR) → Vercel builds with `next build` and deploys. Use Preview deployments for PRs. Redeploy after env changes.

---

## 14. Future Improvements

**Correctness / known bugs (do first):**
- Fix the master-password flow and `x-pathname` forwarding (see Known Issues).
- Close the `users_self_update` RLS escalation hole.
- Authenticate `/api/quiz/log-event` and validate submission ownership.

**Technical debt:**
- Heavy inline styles throughout; Tailwind is installed but underused. Consolidate a design system.
- `answers` / `time_per_question` stored as TEXT JSON strings instead of `jsonb`; migrate to `jsonb` to remove the parse-everywhere footgun.
- Pervasive `any` casts around questions/answers; introduce shared typed models.
- Duplicated leaderboard-rebuild logic across `submit`, `recalculate`, and `delete-submission`; extract a single helper.

**Architecture / scalability:**
- Consider moving the role into a JWT claim (Auth hook) so middleware/layout authorize without a per-request DB read.
- Real-time leaderboard via Supabase Realtime instead of rebuild-on-submit if concurrency grows.
- Add rate limiting on public endpoints (OTP, log-event, submit).

**Security:**
- Constant-time master-password comparison + audit logging for break-glass use.
- Add `WITH CHECK` review across all UPDATE policies.

**Process:**
- Add ESLint/Prettier, a test runner (unit tests for `lib/evaluation.ts` especially), and CI checks on PRs.
- Provide `.env.local.example` and a one-page CONTRIBUTING guide.

---

## 15. Known Issues

> These are present in the repository code as audited and directly affect the admin/master flow. They are documented here so a new owner doesn't mistake them for environment problems.

1. **`x-pathname` is set on the middleware response, but read from the request.** `middleware.ts` does `supabaseResponse.headers.set('x-pathname', …)`, while `app/admin/layout.tsx` reads `headers().get('x-pathname')` — which returns the *request* headers. The value is therefore always empty, so the unlock-page self-exemption never fires and `/admin/unlock` can redirect-loop. **Fix:** forward the pathname as a *request* header via `NextResponse.next({ request: { headers } })`.

2. **Master password cannot unlock on its own.** `app/admin/layout.tsx` runs `getUser()` + role redirect *before* checking the `admin_master_verified` cookie, so a master-only visitor is redirected to `/login` before the cookie is consulted — contradicting the "Bypasses Supabase auth" label. **Fix (design decision required):** treat the master cookie as a valid gate (access if `master_verified` **OR** Supabase admin), or formally make it a second factor and correct the UI copy.

3. **Master cookie persistence.** `admin_master_verified` (8h) is not cleared on sign-out and is path-scoped to `/admin`.

A minimal two-file patch (middleware + admin layout) resolves issues 1 and 2 without changing the architecture or weakening RLS. Coordinate the intended security model (break-glass vs. second factor) before applying.

---

*End of document. Sections explicitly marked "Not verified from available sources" require confirmation in the Supabase and Vercel dashboards before being relied upon for production decisions.*
