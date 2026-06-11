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
16. [Critical Files Guide](#16-critical-files-guide)
17. [Architecture Decision Record (ADR)](#17-architecture-decision-record-adr)
18. [Data Lifecycle](#18-data-lifecycle)
19. [Production Incident History](#19-production-incident-history)
20. [Backup & Recovery](#20-backup--recovery)
21. [Release Checklist](#21-release-checklist)
22. [Ownership & Access Matrix](#22-ownership--access-matrix)
23. [Feature Release History](#23-feature-release-history)
24. [Recent Changes](#24-recent-changes)
25. [Remaining Open Items](#remaining-open-items)

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
- **Per-question result analytics** (your time vs. historical average, correct %, Easy/Medium/Hard difficulty) and a **peer benchmark** (average score, percentile, participants beaten, top-10% score) on the result screen — both reuse existing data, no schema changes.

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

**Result-screen analytics (added post-audit, no schema changes):**
- **Per-question analytics** — each question shows the candidate's time spent, historical average time, historical correct %, and a difficulty indicator (Easy / Medium / Hard). Source: `submissions.time_per_question` (your time) + `analytics.question_stats` (avg time, accuracy/difficulty).
- **Peer benchmark** — average score, your percentile, participants beaten, and the top-10% score. Source: `leaderboard` (per-activity scores) + `submission.final_score`.

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

### Roll back a bad deploy
1. Vercel → Deployments → locate the last known-good production build → **Promote to Production** (instant rollback; no rebuild).
2. If the bad deploy also ran a Supabase migration, roll the schema back separately (Vercel rollback does **not** revert the database).
3. Confirm env vars on the promoted build match expectations before announcing recovery.

### Emergency: locked out of admin
- If the master gate or a code bug blocks all admins, access is still possible because authorization is data-driven: confirm the account's `users.role='admin'` directly in Supabase, and if the master gate is the blocker, temporarily unset `ADMIN_MASTER_PASSWORD` in Vercel and redeploy (this disables the master gate per `verify-master` logic). Re-enable afterward.
- Never delete RLS policies or the `is_admin()` function to regain access — that exposes the whole database. Prefer the env-var route above.

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

### Security Findings Priority
Findings from the audit, ranked by severity. "Exploitability" reflects how easily a finding can be triggered today.

| Pri | Finding | Impact | Exploitability | Recommended fix | Files / policies |
|---|---|---|---|---|---|
| ~~**Critical**~~ ✅ **RESOLVED** | `users_self_update` had no `WITH CHECK` (self-promotion to `admin`) | Account takeover / privilege escalation | — (fixed) | Policy rewritten with `WITH CHECK` blocking `role` changes (role mutation only via admin/service path) | RLS `users_self_update` on `public.users` |
| ~~**High**~~ ✅ **RESOLVED** | `/api/quiz/log-event` was unauthenticated | Cheat-event inflation / false flags | — (fixed) | Added `getUser()` auth + submission-ownership check before insert | `app/api/quiz/log-event/route.ts`, `quiz_logs` |
| ~~**Medium**~~ ✅ **RESOLVED** | Master/admin gate logic bugs (unlock loop; master couldn't unlock) | Admin lockout / loops | — (fixed) | Two-file patch (see Known Issues #1–2) | `middleware.ts`, `app/admin/layout.tsx` |
| **Low** | Master cookie not cleared on sign-out; `path=/admin` | Lingering ≤8h admin access after logout | Medium — requires prior valid master unlock | Clear `admin_master_verified` on sign-out (not implemented) | `verify-master/route.ts`, sign-out handler |
| **Low** | `analytics` / `leaderboard` world-readable (`SELECT true`) | Public exposure of aggregate/ranking data (intended) | Low — by design | Re-evaluate before adding sensitive columns | RLS `analytics_public`, `leaderboard_public` |
| **Low** | `NEXT_PUBLIC_*` secrets risk | Secret inlined into browser bundle if mis-prefixed | Low — process discipline | Code-review check | Env setup, `lib/supabase/admin.ts` |

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

1. ✅ **RESOLVED — `x-pathname` request/response mismatch (admin unlock redirect loop).** `middleware.ts` now forwards the pathname as a *request* header via `NextResponse.next({ request: { headers } })`, so `app/admin/layout.tsx` reads it correctly and the `/admin/unlock` loop no longer occurs. *(Files: `middleware.ts`, `app/admin/layout.tsx`.)*

2. ✅ **RESOLVED — master password could not unlock on its own.** `app/admin/layout.tsx` now treats a verified `admin_master_verified` cookie as a valid gate (access if master-verified **OR** Supabase admin), aligning behavior with the "break-glass" intent. *(Files: `app/admin/layout.tsx`.)*

3. **Master cookie cleanup on sign-out** — Known improvement opportunity (low priority, not implemented). `admin_master_verified` (8h, `path=/admin`) is not cleared on sign-out. See [Remaining Open Items](#remaining-open-items).

Issues 1–2 were resolved by a minimal two-file patch (middleware + admin layout) without architectural changes or weakening RLS.

> **Active vs. resolved:** the three items above are *active* in the audited code. Several other defects (silent zero scores, admin unable to see answers, password-reset redirect path) have already been **resolved** and are preserved as institutional memory in [Production Incident History](#19-production-incident-history) so they are not reintroduced.

---

## 16. Critical Files Guide

The files most likely to cause outages or security incidents if edited carelessly. "When to edit" / "Common mistakes" are derived from the current code and the incident history.

### `middleware.ts`
- **Purpose:** Runs on (almost) every request; refreshes the Supabase session token and is meant to expose the request pathname to layouts.
- **Why it matters:** It is the single choke point keeping auth cookies fresh at the edge. A mistake here breaks auth for the entire site, not one page.
- **When to edit:** Only to adjust the cookie/session plumbing, the `matcher`, or to correctly forward request headers (e.g., `x-pathname`).
- **Common mistakes:** Adding logic between `createServerClient` and `getUser()` (breaks refresh); returning a *new* `NextResponse` instead of the `supabaseResponse` that holds refreshed cookies (logs users out intermittently); setting `x-pathname` on the **response** and expecting `headers()` to read it (it can't — see Incident #2).

### `app/admin/layout.tsx`
- **Purpose:** Server-side gate for the entire admin area: session → role → master-password.
- **Why it matters:** It is the authorization boundary for all admin pages. Errors either lock out real admins or expose admin UI.
- **When to edit:** To change the admin gating model (e.g., master-as-second-factor vs. break-glass) or fix the gate-ordering bug.
- **Common mistakes:** Ordering the `getUser()` redirect before the master-cookie check (makes master-only access impossible — Incident #3); reading `x-pathname` while middleware sets it wrong (causes the `/admin/unlock` loop — Incident #1); removing the role check "to make it work."

### `app/api/quiz/submit/route.ts`
- **Purpose:** Authoritative scoring endpoint; persists results and rebuilds leaderboard + analytics. Idempotent.
- **Why it matters:** It owns score correctness and the integrity of every leaderboard. Subtle bugs here corrupt results silently.
- **When to edit:** To change scoring persistence, idempotency, or the leaderboard/analytics rebuild.
- **Common mistakes:** Using `final_score != null` for the "already scored" check (it defaults to `0` → caches a permanent zero — Incident #4); reading `answers` without `parseJsonField` (TEXT/JSON — Incident #5); switching question reads from the **service-role** client to an RLS-bound client (questions vanish once an activity isn't `live` → zero scores — Incident #6); making the leaderboard/analytics rebuild block the response (they are intentionally non-critical/try-catch).

### `lib/evaluation.ts`
- **Purpose:** Pure scoring engine — normalization, exact/word/phonetic matching by strictness, MCQ handling.
- **Why it matters:** Every score in the system flows through it; it's deterministic and must stay stable so re-scores reproduce.
- **When to edit:** To tune matching strictness, add a question type, or fix a grading edge case.
- **Common mistakes:** Changing `normalize()` semantics without re-running **Recalculate** (old and new scores diverge); assuming MCQ answers are option text (they are string **indices**); breaking purity by reaching for I/O or globals (it must remain side-effect-free and unit-testable).

### `lib/supabase/admin.ts`
- **Purpose:** Constructs the **service-role** client that bypasses RLS.
- **Why it matters:** This key is god-mode over the database. Any leak is a full compromise.
- **When to edit:** Almost never; only to adjust client options (`autoRefreshToken`/`persistSession` are intentionally off).
- **Common mistakes:** Importing it into a client component or any `'use client'` path (leaks the key to the browser); prefixing the key with `NEXT_PUBLIC_`; using it where an RLS-bound client should enforce per-user access.

### `app/api/admin/*` (`verify-master`, `recalculate`, `import-scores`, `delete-submission`)
- **Purpose:** Privileged admin operations.
- **Why it matters:** They perform service-role writes; their auth check is the only thing standing between a normal user and destructive operations.
- **When to edit:** To add/modify admin operations.
- **Common mistakes:** Forgetting the `getUser()` + `role==='admin'` guard at the top (every route except `verify-master`, which is gated by the password itself, must keep it); trusting client-provided `activityId`/`id` without existence checks; doing destructive writes before the role check.

### `app/(auth)/login/page.tsx`
- **Purpose:** The three sign-in modes (OTP, admin password, master) and their redirects.
- **Why it matters:** First touchpoint for every user; the master tab feeds the admin gate.
- **When to edit:** To change login UX, redirect targets, or the master-unlock call.
- **Common mistakes:** Editing the "Bypasses Supabase auth" copy without aligning the actual gate (Incident #3); changing `redirectTo` defaults without checking the admin layout's expectations; removing the post-login `router.refresh()` (stale auth state in client components).

---

## 17. Architecture Decision Record (ADR)

Decisions below are supported by repository/database evidence. Where intent is inferred from code rather than an explicit document, it is labelled.

- **ADR-1 — Supabase as the single backend.** *Evidence:* `@supabase/ssr` + `@supabase/supabase-js`, no separate API service, Vercel↔Supabase Connected App, org-managed project. *Decision:* use Supabase for Postgres + Auth + Storage so a small team ships a full app without running servers. *Trade-off:* couples auth, data, and RLS to one vendor; RLS becomes the core security model.
- **ADR-2 — Roles live in `public.users.role`.** *Evidence:* `role` column with check constraint; `is_admin()` reads it; no JWT/`app_meta` claims set. *Decision:* keep authorization data in app-owned Postgres, queryable by RLS and joins, instead of auth custom claims. *Trade-off:* a DB read per authorization (mitigated by `is_admin()` `SECURITY DEFINER`); future scale may favor a JWT claim.
- **ADR-3 — Service-role client for scoring.** *Evidence:* in-code comments in `quiz/submit` explaining that RLS-bound nested joins returned `[]` and scored 0; questions readable publicly only while `live`. *Decision:* score with a service-role client that bypasses RLS so results are correct regardless of activity status. *Trade-off:* concentrates trust in server routes; the key must never reach the client.
- **ADR-4 — `activities` and `quizzes` are separate (1:1).** *Evidence:* distinct tables, `quizzes.activity_id` unique FK, timing/`duration` on `quizzes`, lifecycle/`status`/`visibility` on `activities`. *Decision:* separate the "event/listing" concern (status, visibility, ordering) from the "quiz mechanics" concern (timing, duration, questions). *Trade-off:* an extra join; gains flexibility to evolve quiz config or support other activity types without reworking listings.
- **ADR-5 — Master-password break-glass.** *Evidence:* `ADMIN_MASTER_PASSWORD`, `verify-master` route, `admin_master_verified` cookie, dedicated `/admin/unlock`, login "Master" tab. *Decision:* provide an env-controlled emergency/secondary admin entry independent of a specific Supabase identity. *Trade-off:* a second auth path to keep correct and audited; currently under-specified (see Incidents/Known Issues).
- **ADR-6 — TEXT columns holding JSON for `answers` / `time_per_question`.** *Evidence:* repeated `parseJsonField` helpers and comments. *Decision (likely historical/incidental):* store flexible answer maps as TEXT. *Trade-off:* requires parse-everywhere discipline and caused real bugs; `jsonb` is the recommended migration (Future Improvements).
- **ADR-7 — Rebuild-on-write leaderboard/analytics.** *Evidence:* `rebuildLeaderboard`/`updateAnalytics` invoked from submit/recalculate/delete, upsert on `(activity_id,user_id)`. *Decision:* recompute aggregates synchronously on each scoring write for simplicity and immediate consistency. *Trade-off:* fine at current scale; high concurrency would favor incremental updates or Realtime.
- **ADR-8 — `is_admin()` as `SECURITY DEFINER`.** *Evidence:* function definition. *Decision:* let the policy helper read `users` without tripping that table's own RLS (prevents recursion). *Trade-off:* definer functions must be written carefully to avoid privilege leaks.

---

## 18. Data Lifecycle

Entity-by-entity create→update→read→delete and dependencies. "Owner" = who normally performs the action.

- **User** — *Create:* upsert into `public.users` on first OTP verify (`role='student'`). *Update:* username set once then `username_locked=true`; role changed by admin/SQL. *Read:* self (RLS) + admins; Navbar/role checks. *Delete:* not done in app; deleting `auth.users` should cascade/orphan the profile — handle manually. *Depends on:* `auth.users` (1:1).
- **Activity** — *Create:* admin (`/admin/activities/new`). *Update:* admin edits `status`/`visibility`/details; `status` drives quiz availability and question RLS. *Read:* public when `visibility='public'`; admins always. *Delete:* admin delete; orphans quizzes/questions/submissions/leaderboard/analytics — clean up or cascade intentionally. *Depends on:* `users.created_by`.
- **Quiz** — *Create:* with/after its activity (1:1). *Update:* timing/duration via admin. *Read:* public read allowed; questions linked through it. *Delete:* tied to activity lifecycle. *Depends on:* `activities` (unique FK).
- **Question** — *Create:* admin editor or XLSX import. *Update:* admin edits text/answers/keywords/strictness/options. *Read:* admins always; public only while parent activity `live` (RLS); scoring reads via service role. *Delete:* admin delete from editor. *Depends on:* `quizzes.quiz_id`.
- **Submission** — *Create:* student attempt row (`submissions_insert_own`, `user_id=auth.uid()`). *Update:* during attempt and by `quiz/submit` (answers/scores/flags); admin override sets `score_overridden`. *Read:* owner or admin. *Delete:* admin via `delete-submission` (triggers leaderboard rebuild). *Depends on:* `activities`, `users`, `questions` (for scoring), `quiz_logs` (for cheat count).
- **Leaderboard** — *Create/Update:* upserted by rebuild on submit/recalculate/delete, keyed `(activity_id,user_id)`. *Read:* public. *Delete:* per-row on submission delete, then rebuilt. *Depends on:* `submissions` (derived/denormalized).
- **Analytics** — *Create/Update:* `updateAnalytics` on submit/recalculate (1:1 per activity). *Read:* public + admin question/analytics views. *Delete:* tied to activity. *Depends on:* `submissions` (aggregated).
- **Announcement** — *Create/Update/Delete:* admin CRUD. *Read:* public only when `published=true`; admins always. *Depends on:* `users.created_by`.

Cascade caution: deleting an **Activity** has the widest blast radius (quizzes → questions → submissions → leaderboard → analytics). Confirm intended cleanup before deleting activities in production.

---

## 19. Production Incident History

Verified from in-code comments, fix markers, and current logic. Preserved so resolved bugs are not reintroduced.

### Incident #1 — Admin unlock redirect loop
- **Symptoms:** `/admin/unlock` redirects to itself; admins can't reach the unlock form.
- **Root cause:** The unlock-page self-exemption depends on `x-pathname`, which was always empty (see #2), so the guard never matched.
- **Resolution:** ✅ Fixed — `x-pathname` now forwarded as a request header (see #2).
- **Files:** `middleware.ts`, `app/admin/layout.tsx`.

### Incident #2 — `x-pathname` middleware bug
- **Symptoms:** Layout logic that branches on the current path never triggers.
- **Root cause:** Middleware set `x-pathname` on the **response**; `headers()` in a Server Component reads **request** headers, so the value was never visible.
- **Resolution:** ✅ Fixed — set as a request header via `NextResponse.next({ request: { headers } })`.
- **Files:** `middleware.ts`.

### Incident #3 — Master-password flow can't unlock
- **Symptoms:** Correct master password "reloads" back to login; master-only access impossible.
- **Root cause:** `app/admin/layout.tsx` enforced `getUser()`+role before consulting `admin_master_verified`, bouncing master-only visitors to `/login`.
- **Resolution:** ✅ Fixed — master cookie now accepted as a valid gate (master-verified OR Supabase admin).
- **Files:** `app/admin/layout.tsx`, `app/(auth)/login/page.tsx`, `app/api/admin/verify-master/route.ts`.

### Incident #4 — Permanent zero score ("cached 0 forever")
- **Symptoms:** First submit returns score 0 and never re-scores.
- **Root cause:** Idempotency check used `final_score != null`, but `final_score` has a DB **default of 0**, so brand-new rows looked "already scored."
- **Resolution:** ✅ Fixed — check `is_complete && auto_score != null` (`auto_score` is null until evaluation runs).
- **Files:** `app/api/quiz/submit/route.ts`.

### Incident #5 — JSON TEXT parsing issues
- **Symptoms:** Scores of 0 and "admin can't see answers"; answers appeared empty.
- **Root cause:** `answers` / `time_per_question` are **TEXT** columns holding JSON strings; consumers used them as objects.
- **Resolution:** ✅ Fixed — `parseJsonField` helper applied in submit, recalculate, quiz results, and admin submissions views.
- **Files:** `app/api/quiz/submit/route.ts`, `app/api/admin/recalculate/route.ts`, `app/quiz/[id]/page.tsx`, `app/admin/submissions/[quizId]/page.tsx`.

### Incident #6 — Nested-join scoring returned no questions
- **Symptoms:** `evaluateSubmission` scored 0 on first submit while Recalculate worked.
- **Root cause:** A 3-level nested join (`submissions→activities→quizzes→questions`) returned `[]` whenever RLS blocked an intermediate table (questions are public only while `live`).
- **Resolution:** ✅ Fixed — fetch questions with a direct flat query via the **service-role** client.
- **Files:** `app/api/quiz/submit/route.ts`.

### Incident #7 — Password-reset redirect path
- **Symptoms:** Reset links failed / hit the wrong URL.
- **Root cause:** The callback handler lives in route group `(auth)`, which does **not** appear in the URL — the real path is `/callback`, not `/auth/callback`.
- **Resolution:** ✅ Fixed — `redirectTo = ${getURL()}callback?type=recovery`; `getURL()` centralizes origin resolution.
- **Files:** `app/(auth)/reset-password/page.tsx`, `app/(auth)/callback/route.ts`, `lib/utils.ts`.

### Incident #8 — Case-sensitive CSV score import
- **Symptoms:** Some emails didn't match during score import.
- **Root cause:** Exact email comparison missed case differences.
- **Resolution:** ✅ Fixed — normalize emails and match with `ilike`.
- **Files:** `app/api/admin/import-scores/route.ts`.

### Incident #9 — Admin sidebar mobile layout
- **Symptoms:** Sidebar always visible / content offset on mobile; hydration mismatch.
- **Root cause:** Inline `left`/`marginLeft` styles couldn't be overridden by CSS media queries.
- **Resolution:** ✅ Fixed — CSS-class-controlled positioning; identical SSR/client render.
- **Files:** `app/admin/layout.tsx`, `components/admin/AdminSidebar.tsx`, `app/globals.css`.

### Incident #10 — RLS privilege escalation (self-promotion to admin)
- **Symptoms:** A signed-in student could set their own `role='admin'` via a direct PostgREST `UPDATE`.
- **Root cause:** `users_self_update` used `USING (auth.uid()=id)` with no `WITH CHECK`, leaving `role` unprotected on the self-updatable row.
- **Resolution:** ✅ Fixed — policy rewritten with a `WITH CHECK` that blocks `role` changes (role unchanged for self-update); admin role changes go through the admin/service path.
- **Files / policies:** RLS `users_self_update` on `public.users`.

### Incident #11 — Quiz log-event spoofing
- **Symptoms:** Anyone could POST to `/api/quiz/log-event` for any `submissionId`, inflating `cheat_violations`/`cheat_flag` and falsely flagging students.
- **Root cause:** Route used the service-role client with no authentication and no ownership/existence check.
- **Resolution:** ✅ Fixed — added `getUser()` authentication and a submission-ownership check (owner-only) before inserting; unauthenticated/non-owner requests rejected.
- **Files:** `app/api/quiz/log-event/route.ts`, table `quiz_logs`.

---

## 20. Backup & Recovery

> Procedures are labelled **Verified** (from repo/DB) or **Inferred** (standard Supabase/Vercel practice — confirm before relying on them in an emergency).

### Database backups
- **Inferred:** Supabase provides automated daily backups / PITR depending on plan tier. **Confirm the plan, retention window, and PITR availability in the Supabase dashboard** — *Not verified from available sources.*
- **Verified action available:** ad-hoc logical dump via `pg_dump` against the DB host (`db.mhhscvmypriujtoorgap.supabase.co`) using the DB password. Store dumps encrypted off-platform.
- Take a manual snapshot/dump before any destructive migration or bulk score operation.

### Secret rotation process
1. Rotate in source of truth (Supabase → Settings → API for keys; choose a new `ADMIN_MASTER_PASSWORD`).
2. Update the matching Vercel env vars across Production/Preview/Development.
3. **Redeploy** so values take effect (mandatory for `NEXT_PUBLIC_*`).
4. Invalidate lingering sessions if needed (master cookie has no server revocation today).
5. Treat a leaked `SUPABASE_SERVICE_ROLE_KEY` as a full compromise → rotate immediately and audit access.

### Disaster recovery steps
1. **Assess scope:** app down, DB data loss, or secret leak?
2. **App/code:** redeploy a known-good commit, or Vercel **Promote to Production** on a healthy build.
3. **Data:** restore from the latest Supabase backup/PITR (confirm capability first); for partial corruption, restore the affected tables or rebuild derived data (leaderboard/analytics via **Recalculate**).
4. **Secrets:** rotate and redeploy if a leak is suspected.
5. **Verify:** run the [Release Checklist](#21-release-checklist).

### Environment recovery checklist
- [ ] `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` present and correct in the target environment.
- [ ] `ADMIN_MASTER_PASSWORD` set (or intentionally unset to disable the gate).
- [ ] `NEXT_PUBLIC_SITE_URL` matches the deployment origin; Supabase redirect allow-list includes `<origin>/callback`.
- [ ] Storage bucket `assets` exists and is public.
- [ ] At least one row in `public.users` with `role='admin'`.

### Minimum requirements to rebuild production from scratch
1. **Supabase project** (Postgres 17) with: all `public` tables + columns (Section 10), `is_admin()` `SECURITY DEFINER` function, every RLS policy from Section 5.3, and the public `assets` bucket. *(No migration files exist in the repo — schema must be recreated from this document or an existing dump; see Gaps.)*
2. **Auth config:** email provider enabled (OTP + password + recovery), redirect URLs allow-listed.
3. **Vercel project** linked to the repo with all env vars (Section 7).
4. **One admin user:** sign in via OTP, then `update public.users set role='admin' where email='…'`.
5. **Deploy** (`next build`) and run the Release Checklist.

---

## 21. Release Checklist

Run before promoting to production.

**Build**
- [ ] `npm run build` succeeds locally with no type errors.
- [ ] No secret accidentally prefixed `NEXT_PUBLIC_`.
- [ ] `vercel.json` `no-store` on `/api/*` still present.

**Environment variables**
- [ ] All Section 7 vars set for the target environment; `NEXT_PUBLIC_*` changes followed by a redeploy.
- [ ] `NEXT_PUBLIC_SITE_URL` correct for the environment.

**Supabase**
- [ ] RLS enabled on all `public` tables; policies match Section 5.3.
- [ ] `is_admin()` present and `SECURITY DEFINER`.
- [ ] Redirect allow-list includes `<origin>/callback`.
- [ ] (If addressed) `users_self_update` has a `WITH CHECK` blocking role escalation.

**Auth**
- [ ] OTP login: code arrives, verifies, profile upserted.
- [ ] Admin password login routes to `/admin`.
- [ ] Password reset: link → `/callback` → `/update-password`.

**Admin**
- [ ] Admin can reach `/admin` (and master gate behaves per chosen model — see Known Issues).
- [ ] Non-admin is redirected away from `/admin`.
- [ ] Admin API routes reject non-admins (401/403).

**Quiz flow**
- [ ] Start a `live` quiz, answer, submit → non-zero score persists.
- [ ] Re-submit is idempotent (no double scoring).
- [ ] Cheat events log; `cheat_flag` sets at ≥6.

**Leaderboard / analytics**
- [ ] Leaderboard updates immediately after submit.
- [ ] Recalculate rebuilds scores + ranks.
- [ ] Deleting a submission rebuilds the leaderboard.

---

## 22. Ownership & Access Matrix

Who owns/administers each asset and where access is managed. Specific account holders are **Not verified from available sources** — fill in during handover.

| Asset | What it controls | Where managed | Owner / access holders |
|---|---|---|---|
| **GitHub** | Source of truth; triggers Vercel deploys | GitHub repo settings | Not verified from available sources |
| **Vercel** | Hosting, builds, env vars, domains, rollbacks | Vercel project (linked org `vercel_icfg_aspNR4TSYLQ3h0QomW0YRd8l`) | Not verified from available sources |
| **Supabase** | Postgres, Auth, Storage, RLS, keys | Project `ThinkTanq Live` (`mhhscvmypriujtoorgap`, `ap-south-1`) | Not verified from available sources |
| **Domain** | Public URL / DNS | Current prod URL is `thinqtanklive.vercel.app`; `thinqtank.co.in` appears in `next.config.mjs` image allow-list (custom domain? **Not verified**) | Not verified from available sources |
| **Storage** | Public `assets` bucket (logos/images) | Supabase Storage | Supabase admins (above) |
| **Environment Variables** | Runtime secrets/config | Vercel project settings (per environment) | Vercel admins (above) |
| **Authentication** | User identities, OTP/password, recovery | Supabase Auth | Supabase admins (above) |
| **App Admin role** | In-app admin capabilities | `public.users.role='admin'` (currently 1 account) | The single admin account on record |

---

*End of document. Sections explicitly marked "Not verified from available sources" require confirmation in the Supabase and Vercel dashboards before being relied upon for production decisions.*

---

## 23. Feature Release History

| Date / Batch | Feature | Files | Data source | Schema change |
|---|---|---|---|---|
| Post-audit | Per-question result analytics (your time, avg time, correct %, difficulty) | `app/quiz/[id]/page.tsx` | `submissions.time_per_question`, `analytics.question_stats` | None |
| Post-audit | Peer benchmark (avg score, percentile, participants beaten, top-10% score) | `app/quiz/[id]/page.tsx` | `leaderboard`, `submission.final_score` | None |

> Not shipped (blocked by required schema changes): section-based analytics and class-wise leaderboard — no `section`/`class` columns exist; deferred.

---

## 24. Recent Changes

**Security fixes completed**
- ✅ RLS privilege escalation closed — `users_self_update` now has a `WITH CHECK` blocking self-promotion to `admin`.
- ✅ Quiz log-event spoofing closed — `/api/quiz/log-event` now requires authentication and verifies submission ownership before inserting.
- ✅ Admin unlock redirect loop / master-password gate fixed — `x-pathname` forwarded as a request header; master cookie accepted as a valid gate (two-file patch in `middleware.ts` + `app/admin/layout.tsx`).

**Analytics features added**
- ✅ Per-question analytics on the result screen.
- ✅ Peer benchmark on the result screen.

---

## Remaining Open Items

Concise list of what is still outstanding after the post-audit fixes.

- **Admin logout cookie cleanup** — *Known improvement opportunity (low priority, not implemented).* `admin_master_verified` (8h, `path=/admin`) is not cleared on sign-out, so master access can linger after logout. Fix: clear the cookie via a small server route called from the sign-out handler.
- **`analytics` / `leaderboard` world-readable** (Low, by design) — re-evaluate only if a sensitive column is added.
- **Process gaps** (unchanged) — no automated tests/linter/CI; no committed SQL migrations; no `.env.local.example`.
- **Unverified dashboard items** — Vercel project settings, Supabase Auth/backup config, and ownership/account holders remain marked "Not verified from available sources."

*Resolved items (RLS escalation, log-event spoofing, admin unlock/master gate) have been moved out of open issues into [Production Incident History](#19-production-incident-history) and [Recent Changes](#24-recent-changes).*
