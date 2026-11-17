# Office Employee Management System — Frontend (Group 02)

React web client for the OEMS backend in `../backend`. It covers every use case kept in Assignment 2 for the five actors: UC-01…UC-07, UC-09…UC-17, UC-19 and UC-20.

Not built, because Assignment 2 removed them: the Director actor, UC-08 and UC-18.

The specification is `docs/FRONTEND_PROMPT.md`. Its API contract is `docs/BACKEND_PROMPT.md` §4–§8, checked against the running backend (see *API notes* below).

## Stack

- React 18, Vite 6 and React Router 6, in plain JavaScript.
- Plain CSS with design tokens (`src/styles/tokens.css`, the "Calm Ledger" look). No UI kit, no Tailwind.
- Fonts from npm (Fraunces, Inter, IBM Plex Mono), so the app works offline.
- `fetch` only, no axios. React context for the session; local state everywhere else.
- ESLint 9 (`npm run lint`).

## Install and run

The backend must be running first (see `../backend/README.md`):

```bash
cd backend && npm install && npm run seed && npm start      # API on http://localhost:4000
```

Then the frontend:

```bash
cd frontend
npm install
npm run dev          # http://localhost:5173
```

| Script | What it does |
|---|---|
| `npm run dev` | Vite dev server on **5173**; `/api` is proxied to the backend, so there are no CORS problems |
| `npm run build` | Production build into `dist/` (no warnings) |
| `npm run preview` | Serve the build on 4173 with the same `/api` proxy |
| `npm run lint` | ESLint, zero warnings allowed |

### Environment

| Variable | Where | Default | Meaning |
|---|---|---|---|
| `VITE_IDLE_MINUTES` | `frontend/.env` (see `.env.example`) | `15` | Client idle timeout. Keep it equal to the backend's `SESSION_IDLE_MINUTES`. The "Still there?" dialog appears at 2:00 left. |
| `API_TARGET` | shell, when starting Vite | `http://localhost:4000` | Backend the dev proxy forwards `/api` to, e.g. `API_TARGET=http://localhost:4001 npm run dev`. |

To see the session-expiry dialog quickly, set `VITE_IDLE_MINUTES=3` here and `SESSION_IDLE_MINUTES=3` in `backend/.env`, then restart both servers.

## Demo logins (seeded by `npm run seed` in the backend)

Password for every account: `SEED_PASSWORD` from `backend/.env` (`ChangeMe@123` in `.env.example`). Log in with the employee ID or the e-mail address.

| Role | Login | Home screen |
|---|---|---|
| Employee | `EMP00005` (sneha.das@example.com); also EMP00006 – EMP00010 | `/employee` |
| HR Manager | `EMP00001` (anita.sharma@example.com) | `/hr/employees` |
| Recruitment Officer | `EMP00002` (rahul.verma@example.com) | `/recruitment/vacancies` |
| Payroll Officer | `EMP00003` (priya.nair@example.com) | `/payroll/run` |
| Finance Manager | `EMP00004` (vikram.singh@example.com) | `/finance/salary` |

The backend allows **10 sign-ins per IP per 15 minutes**. After that, the login page says "Too many sign-in attempts"; wait, or restart the backend.

## Role → screen

The single source of this matrix is `src/layout/menu.js`. Every role's routes are wrapped in `<RequireRole>`, so opening another role's URL shows the 403 page; the backend is still the real gate. Every screen file starts with `// UC-xx | FR-xx | Role | API: …`.

| Role | Screen | Route | UC / FR | API |
|---|---|---|---|---|
| Employee | Dashboard | `/employee` | — | `GET /attendance/me`, `GET /leaves/me` |
| | Attendance | `/employee/attendance` | UC-01, UC-02 | `POST /attendance/check-in`, `POST /attendance/check-out`, `GET /attendance/me` |
| | Apply Leave | `/employee/leave/new` | UC-03 | `POST /leaves` |
| | My Leaves | `/employee/leave` | UC-03/04 | `GET /leaves/me` |
| | My Profile | `/employee/profile` | UC-05 | `GET`, `PATCH /profile/me` |
| | My Salary | `/employee/salary` | UC-11 | `GET /salary/me` |
| | Payslip | `/employee/payslips/:id` | UC-13 | `GET /payslips/:id`, `…/download` |
| HR Manager | Employees | `/hr/employees` | UC-07 | `GET /employees` |
| | Register Employee | `/hr/employees/new` | UC-06 | `POST /employees` |
| | Employee record | `/hr/employees/:id` | UC-07 | `GET`, `PATCH /employees/:id` |
| | Attendance | `/hr/attendance` | UC-02 | `GET /attendance` |
| | Leave Review | `/hr/leaves` | UC-04 | `GET /leaves`, `PATCH /leaves/:id/decision` |
| | Retirement Plans | `/hr/retirement` | UC-20 | `GET`, `POST`, `PATCH /retirement-plans` |
| | Salary View | `/hr/salary` | UC-11 | `GET /salary` |
| | HR Reports | `/hr/reports` | UC-16 | `GET /reports/hr` |
| Recruitment Officer | Vacancies | `/recruitment/vacancies` | UC-09 | `GET`, `POST`, `PATCH /vacancies`, `POST /vacancies/:id/close` |
| | Candidates | `/recruitment/candidates` | (A-3) | `GET`, `POST /candidates` |
| | Interviews | `/recruitment/interviews` | UC-10 | `GET`, `POST`, `PATCH /interviews` |
| | Offers | `/recruitment/offers` | UC-19 | `GET`, `POST /offers`, `PATCH /offers/:id/status` |
| | Offer Letter | `/recruitment/offers/:id/letter` | UC-19 | `GET /offers/:id/letter` |
| Payroll Officer | Run Payroll | `/payroll/run` | UC-12, UC-14 | `POST /payroll/run` |
| | Payroll Records | `/payroll/records` | UC-15 | `GET /payroll/records[/:id]`, `PATCH …/status` |
| | Payslips | `/payroll/payslips` (and `/:id`) | UC-13 | `POST /payslips/generate`, `GET /payslips[/:id]`, `…/download` |
| | Salary View | `/payroll/salary` | UC-11 | `GET /salary` |
| Finance Manager | Salary View | `/finance/salary` | UC-11 | `GET /salary` |
| | Financial / Payroll Report | `/finance/reports` | UC-17 | `GET /reports/financial` |

Plus `/login`, `/403`, `/404`, and `/`, which redirects to the role's home.

## Behaviour worth knowing

- **Session (NFR-22, BR-27):**
  - The token is kept in `sessionStorage`, so it disappears when the tab closes. It is never logged and never put in a URL.
  - Any 401 clears the session and shows "Your session has ended. Please sign in again." on the login page.
  - The top bar counts down "Session ends in mm:ss". "Still there?" appears at 2:00 left; *Stay signed in* calls `GET /auth/me`, and at 0:00 the app signs out.
- **Access (NFR-21, BR-26):**
  - The sidebar shows only the current role's items.
  - Another role's URL shows the 403 page, and a 403 from the API shows "Access denied", never a blank screen.
- **Forms:**
  - Labels use Data Dictionary names, with the dictionary rule as a hint under each field.
  - Client-side checks mirror BACKEND_PROMPT §8.
  - Server field errors appear beside the matching field.
  - PATCH requests send only changed, allowed fields.
- **Confirmations:** destructive or irreversible actions use a confirm dialog that names the target: approve or reject leave, close a vacancy, run payroll, mark Paid or put On Hold, and change employment status.
- **Documents:**
  - The payslip and offer letter look like printed documents, with Print, and PDF download for payslips.
  - Downloads are fetched with the Bearer token and saved through an object URL.
  - The offer-letter HTML from the backend is shown in a sandboxed iframe that cannot run scripts.
- **Formatting:** money uses `inr()` (₹ 1,23,456.00); IDs, money and times are in IBM Plex Mono with tabular figures; dates show as `17 Nov 2026`.

## API notes (where the running backend differs from FRONTEND_PROMPT §4)

All of these were checked with real calls against the running backend. None needed a backend change.

1. **No "today" keyword.** `?from=today&to=today` is not accepted: the API needs real `YYYY-MM-DD` dates. The UI takes "today" from `GET /health` → `server_time` (APP_TIMEZONE), never from the browser clock. The same date sets the minimum leave start, the latest pay period and the "not in the past" check for interviews.
2. **Date ranges are mandatory.**
   - `GET /attendance/me` and `GET /attendance` need both `from` and `to`.
   - `GET /reports/hr` needs `from_date`/`to_date` for **every** type, Headcount and Employee included (BR-22).
   - `GET /reports/financial` needs both.
3. **Profile has only seven fields.** `GET /profile/me` returns only DS-17 (ID, name, contact, e-mail, address, department, designation). The read-only part of *My Profile* is therefore ID, Name, Department and Designation; DOB, gender, salary and bank details are not available to the Employee.
4. **Candidates have no status.** "Selected" is an interview status, and BR-14 uses the candidate's latest interview. The Offers screen works out eligible candidates from `GET /interviews` (latest by date, time, ID = Selected) and `GET /offers` (no offer yet).
5. **Candidates are list + create only.** There is no `GET /candidates/:id` and no PATCH. `candidate_phone` is optional, digits only, at most 10.
6. **Vacancy status.** `PATCH /vacancies/:id` accepts only `Open` or `On Hold`; closing is `POST /vacancies/:id/close`. Closed vacancies are read-only in the UI.
7. **Non-JSON responses.** The offer letter is HTML and the payslip download is a PDF; neither uses the JSON envelope (errors still do).
8. **No employee list for the Payroll Officer.** `GET /employees` is HR-only, so the Payroll Officer's employee pickers use `GET /salary`. That has no employment status: a Resigned or Retired employee added to a run is reported under **Failed** ("not Active").
9. **Field-error names have a location prefix** (`body.email`, `query.from`, `body.lines.0.allowances`). The client strips the prefix to match form fields.
10. **A wrong password returns 401 at login.** The login form shows the generic error; only 401s from other routes end the session. Too many sign-ins return 429.
11. **The server only sees API calls.** Its idle timeout counts from the last request. To stay in step, user activity triggers a `GET /auth/me` keep-alive when the last request is older than 30 s, and the countdown runs to the earlier of the two deadlines.
12. **Attendance times are `hh:mm`.** A check-out in the same minute as the check-in is refused (409), and the UI shows the backend message.
13. **Interview clashes return 409** with "…please choose another date, time or venue", shown under the slot fields.
14. **Default periods.** Screens that need a period default to the server's current month (Employee attendance) or the previous, last complete month (HR attendance, reports, Run Payroll, Payslips), which is where the seed data is.

## Known gaps and limitations

- **React Router 6.** `npm audit` reports two moderate advisories, fixed only in React Router 7. The SSR one does not apply (no server rendering). For the open-redirect one, the only place a path we did not write reaches `navigate` is the post-login return path, which accepts plain in-app paths only (`LoginPage.jsx`).
- **No status ordering.** Interview and offer status changes have no ordering rules, because the documents say "domain validation only". See the backend README's open questions.
- **Same-tab sessions only.** Each browser tab has its own session (sessionStorage); opening a link in a new tab asks you to sign in again.

## Accessibility and responsiveness

- **Contrast:** every text/background pair in the tokens is at least 4.5:1 (WCAG AA). The success-badge tint was lightened to `#EEF8F1` to reach 4.62:1.
- **Keyboard:**
  - visible 2px focus ring, and a "Skip to content" link;
  - focus moves to the page content after navigation;
  - dialogs trap focus and close with Escape;
  - the mobile menu closes with Escape, and is hidden from keyboard focus while closed.
- **Screen readers:**
  - labels are tied to inputs, with hints and errors linked through `aria-describedby`;
  - tables have captions and header cells;
  - toasts use `aria-live="polite"`.
- **Responsive from 360px:** below 900px the sidebar becomes a slide-over, and tables scroll horizontally inside their card. Checked at 360px on every screen: no page-level horizontal scroll.

## Screenshot checklist for the submission PDF (FRONTEND_PROMPT §8)

| # | Screenshot | Route / how | Caption |
|---|---|---|---|
| 1 | Login | `/login` | NFR-22 Authentication |
| 2 | Employee dashboard | `/employee` as EMP00005 | UC-01 / UC-02 / UC-03 at a glance |
| 3 | Attendance | `/employee/attendance` | UC-01 Mark Attendance, UC-02 View Attendance |
| 4 | Apply leave | `/employee/leave/new` | UC-03 Apply Leave |
| 5 | My leaves | `/employee/leave` | UC-03 / UC-04 leave status |
| 6 | Profile | `/employee/profile` | UC-05 Manage Profile |
| 7 | My salary | `/employee/salary` | UC-11 View Salary |
| 8 | Payslip | `/employee/payslips/PS0000000005` | UC-13 Generate Payslip |
| 9 | Employee list | `/hr/employees` as EMP00001 | UC-07 Manage Records |
| 10 | Register employee | `/hr/employees/new` (after submit: one-time password panel) | UC-06 Register Employee |
| 11 | Record edit | `/hr/employees/EMP00005`, click *Edit* on a field | UC-07 Manage Records |
| 12 | Leave review | `/hr/leaves`, click *Approve* (confirm dialog) | UC-04 Manage Leave |
| 13 | Retirement plan | `/hr/retirement`, *Edit* on RP000001 | UC-20 Manage Retirement Plans |
| 14 | HR report | `/hr/reports` → *Generate report* | UC-16 Generate HR Report |
| 15 | Vacancies | `/recruitment/vacancies` as EMP00002 | UC-09 Manage Vacancies |
| 16 | Interview schedule + conflict | `/recruitment/interviews` → *Schedule interview* into an existing slot (e.g. INT0000002's date, time and venue) | UC-10 Schedule Interviews (BR-13) |
| 17 | Offer | `/recruitment/offers` → *New offer* | UC-19 Generate Offer Letter |
| 18 | Offer letter | `/recruitment/offers/OFR0000001/letter` | UC-19 (BR-29) |
| 19 | Run payroll result | `/payroll/run` as EMP00003 → *Run payroll* | UC-12 Calculate Salary, UC-14 Manage Payroll |
| 20 | Payroll records | `/payroll/records` | UC-15 View Payroll Records |
| 21 | Payslips | `/payroll/payslips` → *Generate payslips* | UC-13 Generate Payslip |
| 22 | Finance salary view | `/finance/salary` as EMP00004 | UC-11 View Salary |
| 23 | Financial report | `/finance/reports` → *Generate report* | UC-17 Generate Financial/Payroll Report |
| 24 | Access denied | as EMP00005 open `/hr/employees` | NFR-21 / BR-26 |
| 25 | Session-expiry modal | idle with `VITE_IDLE_MINUTES=3` | NFR-22 / BR-27 |
