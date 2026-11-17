# FRONTEND BUILD PROMPT — Office Employee Management System (Group 2)

You are building the **frontend** for the Office Employee Management System. The backend already exists in `backend/` (all phases done, API on `http://localhost:4000/api`). The design is fixed by:
- `docs/BACKEND_PROMPT.md` — §4 roles, §5 response envelope, §6 every endpoint, §8 validation rules. **Read §4–§8 first; they are your API contract.**
- `docs/requirements.txt` (Assignment 2) — use cases, actors, FR/NFR.
- `docs/dd.txt` (Assignment 3.2 Data Dictionary) — field names, allowed values, validation text (use `grep -n`; do not read it end to end).
- `backend/TRACEABILITY.md` and `backend/api.http` — real routes and sample bodies. If they disagree with the prompt, **the running backend wins**; verify with a real call, and note it in `frontend/README.md`.

## 0. GROUND RULES (strict)
1. **No invented features.** Build only screens for use cases UC-01…UC-07, UC-09…UC-17, UC-19, UC-20 (UC-08 and UC-18 and the Director actor were removed). No chat, notifications centre, dark-mode toggle, charts library or settings pages.
2. Every screen is tagged in a header comment: `// UC-xx | FR-xx | Role | API: METHOD /path`.
3. Field labels use the Data Dictionary names (e.g. "Residential Address", "Number of Positions", "Check-in Time").
4. Work **phase by phase** (§9). After each phase: build must pass, `git commit`, short report, then **STOP and wait for "continue"**.
5. First print a plan (file tree, dependencies, routes) and wait for my OK.

## 1. STACK
- React 18 + Vite + React Router 6, plain JavaScript. **Plain CSS with CSS variables** (no Tailwind, no UI kit).
- Fonts via npm (`@fontsource/fraunces`, `@fontsource/inter`, `@fontsource/ibm-plex-mono`) so it works offline.
- `fetch` wrapper only (no axios). No state library: React context for auth, local state elsewhere.
- Vite dev server on **5173** with a proxy `/api → http://localhost:4000` (so no CORS problems). `.env.example`: `VITE_IDLE_MINUTES=15`.
- Folder: `frontend/src/{api, auth, components, layout, pages/<role>, styles, lib}`.

## 2. VISUAL DIRECTION — "Calm Ledger"
Precise, quiet, trustworthy; a well-kept ledger / modern banking dashboard.
- **Tokens** in `styles/tokens.css`:
  `--bg:#FAF9F6; --surface:#FFFFFF; --ink:#1B1F24; --muted:#5B6470; --line:#E6E3DC; --accent:#0F766E; --accent-ink:#FFFFFF;`
  status: `--ok:#15803D; --warn:#B45309; --bad:#B91C1C; --neutral:#475569` each with a light tint background.
  Role strip colours (3px bar at top of the app bar): Employee `#0F766E`, HR Manager `#7C3AED`, Recruitment Officer `#0369A1`, Payroll Officer `#B45309`, Finance Manager `#BE123C`.
- **Type:** headings Fraunces (600), body/forms/tables Inter, **all money, IDs and times in IBM Plex Mono with `font-variant-numeric: tabular-nums`**. Scale 13/14/16/20/28.
- **Shape:** 8px radius, 1px `--line` borders, shadow only on hover. Spacing multiples of 4/8.
- **Layout:** left sidebar (240px, collapses < 900px) showing **only** the menu items allowed for the logged-in role; top bar with user name, role badge, a "Session ends in mm:ss" hint, and Logout. Content max-width 1200px. Pages start with a title, then a row of 3–4 stat cards when meaningful, then the table/form.
- **Tables:** 44px rows, light zebra, sticky header, right-aligned numbers, empty state text ("No leave applications yet"), loading skeleton rows (no spinners).
- **Forms:** one column, label above field, helper hint under the field showing the dictionary rule ("10 digits, starts with 6–9"), inline error under the field, submit button disabled while sending.
- **Status badges** (component `<StatusBadge value>`): Approved/Paid/Active/Open/Selected/Accepted/Issued = green · Pending/On Hold/Scheduled/Processed = amber · Rejected/Declined/Absent = red · Closed/Resigned/Retired/Cancelled/Completed = slate.
- **Accessibility:** contrast ≥ 4.5:1, visible focus ring (2px accent), labels tied to inputs, buttons reachable by keyboard, `aria-live="polite"` for toasts.
- Special documents: **Payslip** and **Offer Letter** pages look like printed documents (letterhead, serif title, two-column earnings/deductions, bold Net Salary row) and have a Print/Download button.

## 3. API CLIENT & AUTH (NFR-21, NFR-22, BR-26, BR-27)
- `api/client.js`: `request(method, path, body?)` adds `Authorization: Bearer <token>`, parses the **envelope** `{result_status, reference_id, response_message, error_message, data, details?}`. On `result_status:'Failed'` throw an `ApiError` carrying `error_message` and `details` (array of field errors → show beside the matching fields).
- **401** → clear session, redirect to `/login` with the message "Your session has ended. Please sign in again." **403** → render a friendly "Access denied" page (never a blank screen).
- Token in `sessionStorage` (cleared when the tab closes). Never log tokens, never put them in URLs.
- **Idle timeout:** track last user activity (click/key/scroll, throttled); show the countdown in the top bar; at 2 minutes left show a modal "Still there?" with *Stay signed in* (does a `GET /auth/me`) and *Sign out*; at 0 call `POST /auth/logout` and redirect to `/login`.
- `auth/AuthContext`: `login(login, password)` → `POST /auth/login`, then `GET /auth/me` → `{employee_id, name, role}`. `logout()` → `POST /auth/logout`.
- `<RequireRole roles={[...]}>` route guard; menu config in one file `layout/menu.js` mapping role → items (this is the single source of the permission matrix in `docs/BACKEND_PROMPT.md` §4). The UI hides what a role cannot use, but **the backend remains the real gate**; always handle 403.
- Downloads that need auth (payslip PDF, offer-letter HTML): fetch with the Bearer header → `blob` → `URL.createObjectURL` → open/download. Do not link directly to the API URL.
- Shared helpers: `lib/format.js` (`inr(n)` → `₹ 1,23,456.00` using `en-IN`, `date(iso)` → `17 Nov 2026`), `lib/validators.js` mirroring §8 rules (client-side hints only).

## 4. ROUTES AND SCREENS BY ROLE

Public: `/login` — centred card, employee ID or e-mail + password, generic error message. Shows nothing about roles.

### Employee (role strip teal)
| Menu | Route | UC / FR | API |
|---|---|---|---|
| Dashboard | `/employee` | — | today's attendance (`GET /attendance/me?from=today&to=today`), pending leaves count (`GET /leaves/me`) |
| Attendance | `/employee/attendance` | UC-01, UC-02 · FR-1, FR-2 | `POST /attendance/check-in`, `POST /attendance/check-out`, `GET /attendance/me?from&to` — big **Check in / Check out** button showing server time returned; month table with date, check-in, check-out, status; "Days present" summary; From ≤ To validation |
| Apply Leave | `/employee/leave/new` | UC-03 · FR-3 | `POST /leaves` — Leave Type (Casual/Sick/Earned/Unpaid), Leave Start Date, Leave End Date, Leave Reason; show computed "Number of Leave Days"; BR-05 date hints |
| My Leaves | `/employee/leave` | UC-03/04 status | `GET /leaves/me` — status badge, Decision Date, HR Remarks |
| My Profile | `/employee/profile` | UC-05 · FR-5 | `GET /profile/me`, `PATCH /profile/me` — only Contact Number, Email Address, Residential Address are editable; all other fields shown read-only with a lock icon |
| My Salary | `/employee/salary` | UC-11 · FR-11 | `GET /salary/me` — basic salary, pay-period table (gross, deductions, net), links to payslips |
| Payslip | `/employee/payslips/:payslip_id` | UC-13 | `GET /payslips/:id` + PDF download via `/payslips/:id/download` |

### HR Manager (violet)
| Menu | Route | UC / FR | API |
|---|---|---|---|
| Employees | `/hr/employees` | UC-07 · FR-7 | `GET /employees?department&status&q` — search + filters, masked bank account |
| Register Employee | `/hr/employees/new` | UC-06 · FR-6 | `POST /employees` — all mandatory fields with §8 rules; on success show the **one-time temporary password** in a copy-once panel with warning "shown only once" |
| Employee record | `/hr/employees/:id` | UC-07 | `GET /employees/:id`, `PATCH /employees/:id` — edit mode per field; show Last Updated By / Timestamp (NFR-7) |
| Attendance | `/hr/attendance` | UC-02 · FR-2 | `GET /attendance?employee_id&from&to` |
| Leave Review | `/hr/leaves` | UC-04 · FR-4 | `GET /leaves?status&employee_id` (default Pending); card per request with employee name, type, dates, days, reason; **Approve / Reject** with HR Remarks via `PATCH /leaves/:id/decision`; confirm dialog; already-decided cards read-only |
| Retirement Plans | `/hr/retirement` | UC-20 · FR-20 | `POST/GET/PATCH /retirement-plans` — Retirement Date, Plan Type (Provident Fund/Pension/Gratuity), Contribution Amount, Nominee Name, Plan Status |
| Salary View | `/hr/salary` | UC-11 | `GET /salary?employee_id&pay_period` |
| HR Reports | `/hr/reports` | UC-16 · FR-16 | `GET /reports/hr?report_type&from_date&to_date&department` — type: Attendance / Leave / Headcount / Employee; show report title, generated time, headcount, table; Print button |

### Recruitment Officer (blue)
| Menu | Route | UC / FR | API |
|---|---|---|---|
| Vacancies | `/recruitment/vacancies` | UC-09 · FR-9 | `GET/POST/PATCH /vacancies`, `POST /vacancies/:id/close` — Job Title, Department, Number of Positions, Required Qualifications, Vacancy Status |
| Candidates | `/recruitment/candidates` | gap A-3 | `GET/POST /candidates` — Candidate Name, Email, Contact Number, Vacancy |
| Interviews | `/recruitment/interviews` | UC-10 · FR-10 | `GET/POST/PATCH /interviews` — Interview Date (not past), Time, Venue, Interviewer; on 409 show the backend message "choose another slot"; status change (Scheduled/Completed/Selected/Rejected/Cancelled) |
| Offers | `/recruitment/offers` | UC-19 · FR-19 | `GET/POST /offers`, `PATCH /offers/:id/status` — only candidates with status Selected selectable; Offered Salary, Joining Date; position shown read-only from the vacancy |
| Offer Letter | `/recruitment/offers/:offer_id/letter` | UC-19 | render `GET /offers/:id/letter` (HTML, fetched with auth) in a styled frame + Print |

### Payroll Officer (amber)
| Menu | Route | UC / FR | API |
|---|---|---|---|
| Run Payroll | `/payroll/run` | UC-12, UC-14 · FR-12, FR-14 | `POST /payroll/run` — Pay Period (month picker, not future), Working Days, optional per-employee Allowances / Other Deductions; result panel shows Employees Processed, Skipped (with reason), Failed (with reason) |
| Payroll Records | `/payroll/records` | UC-15 · FR-15 | `GET /payroll/records?pay_period&employee_id`, detail `GET /payroll/records/:id`, status `PATCH …/status` (Processed→Paid, Processed↔On Hold); amounts displayed read-only |
| Payslips | `/payroll/payslips` | UC-13 · FR-13 | `POST /payslips/generate {pay_period, employee_ids?}` (show Payslip Count), `GET /payslips?pay_period&employee_id`, open/download PDF |
| Salary View | `/payroll/salary` | UC-11 | `GET /salary?…` |

### Finance Manager (rose)
| Menu | Route | UC / FR | API |
|---|---|---|---|
| Salary View | `/finance/salary` | UC-11 | `GET /salary?…` |
| Financial / Payroll Report | `/finance/reports` | UC-17 · FR-17 | `GET /reports/financial?report_type&from_date&to_date&department` — type: Payroll / Financial; stat cards for Total Payroll Cost; department table (Total Gross, Total Deductions, Total Net); attendance totals; Print button |

Plus: `/403` access-denied page, `/404` not-found page, and `/` redirects to the role's home.

## 5. QUALITY BARS
- Every list screen: loading skeleton, empty state, error state with retry.
- Every form: client-side hint validation (mirrors §8) **and** display of server `details` per field.
- Destructive or irreversible actions (Approve/Reject leave, Close vacancy, Run payroll, Mark Paid) use a confirm dialog that names the target.
- Money always via `inr()`; IDs and times always monospace; dates always `date()`.
- Responsive from 360px: sidebar becomes a slide-over, tables scroll horizontally inside their card.
- No secrets in code; no console logging of responses containing salary or bank data.
- `npm run build` has no warnings; `npm run lint` clean if ESLint is added.

## 6. DEMO / SCREENSHOT MODE
Not a feature of the app. Keep seed logins (from `backend/README.md`) documented in `frontend/README.md` so every role can be opened in under a minute for screenshots.

## 7. README
`frontend/README.md`: install, run (`npm install && npm run dev`), env, proxy, the role → screen table, known gaps, and the list of screenshots for the submission PDF (§8).

## 8. SCREENSHOT CHECKLIST (for the submission PDF — each with a use-case caption)
Login · Employee: dashboard, attendance, apply leave, my leaves, profile, my salary, payslip · HR: employee list, register, record edit, leave review, retirement plan, HR report · Recruitment: vacancies, interview schedule (incl. the conflict message), offer, offer letter · Payroll: run payroll result, payroll records, payslips · Finance: salary view, financial report · Access-denied page · Session-expiry modal.

## 9. PHASES (stop after each)
1. **Shell:** Vite app, tokens/fonts/global CSS, `api/client`, AuthContext, login page, layout (sidebar/top bar/role strip/idle timer), `menu.js`, route guards, 403/404, shared components (`DataTable`, `FormField`, `StatusBadge`, `Modal`/confirm, `Toast`, `Skeleton`, `StatCard`).
2. **Employee screens** (all of §4 Employee).
3. **HR Manager screens.**
4. **Recruitment Officer screens** (incl. offer letter view).
5. **Payroll Officer + Finance Manager screens** (incl. payslip document view, reports).
6. **Polish:** responsive pass, accessibility pass, empty/error states, README, final build; then walk through every role with the seeded logins and fix visual or functional gaps.

## 10. DEFINITION OF DONE
`cd frontend && npm install && npm run dev` runs next to the backend; each of the 5 roles can log in and complete every use case in its table above; a role never sees menu items it cannot use, and direct URL access to another role's page shows the 403 page; session idle timeout works; build is clean; README and screenshot list are complete.

**Now: print your plan (file tree, dependencies, route list per role, and anything in the backend API that does not match §4) and wait for my OK before starting Phase 1.**
