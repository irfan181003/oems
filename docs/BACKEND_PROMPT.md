# BACKEND BUILD PROMPT — Office Employee Management System (Group 2)

You are building the **backend** for the *Office Employee Management System* (Group 2, Software Engineering project). This is the implementation phase (Gr_02_Imp1). The design is already fixed by two documents in `docs/`:

- `docs/Group02_Assign2_Revised_v3.pdf` — requirements: 18 use cases, FR-1…FR-20, NFR-1…NFR-22, 5 actors.
- `docs/Group02_Assign3.2_updated.pdf` — DFD (Level 0/1/2) + Data Dictionary (data stores D1–D7, 10 proposed tables, business rules BR-01…BR-30, security metadata, traceability, inconsistencies).
  A text copy is in `docs/dd.txt` (use `grep -n` to find sections; do NOT read it end to end).

## 0. GROUND RULES (strict)

1. **Stick to the documents.** Every table, column, ID format, status value, validation, role permission and business rule below comes from them. Do not invent features. Do **not** build: the Director actor, UC-08 View Organizational Records, UC-18 Organization Summary Report (all removed in Assignment 2). FR-8 and FR-18 do not exist.
2. Where the documents are silent or contradictory, use the decision recorded in **Section 12 (Deviations)** of this prompt, mark it in code with `// ASSUMPTION A-n`, and list it in `README.md`. Never silently "fix" the documents.
3. Tag every route handler and service function with a comment: `// UC-xx | FR-xx | Process 0.x.y | BR-xx | NFR-xx`.
4. Work **phase by phase** (Section 11). After each phase: run the tests, `git commit`, print a short report (what was built, which BRs are covered, what is left), then **stop and wait for me to say "continue"**.
5. Before writing code, produce a short plan (folder layout, dependency list, phase list) and wait for my OK.

## 1. STACK (our choice — the documents do not prescribe one)

- Node.js ≥ 20, Express 4, **SQLite** via `better-sqlite3` (zero-install DB, easy to zip), `PRAGMA foreign_keys = ON`.
- `zod` (validation), `bcryptjs` (password hashing), `helmet`, `cors`, `express-rate-limit`, `dotenv`, `pdfkit` (payslip / offer-letter PDF), `morgan`.
- Tests: Node built-in test runner (`node --test`) + `supertest`.
- Plain JavaScript (CommonJS or ESM — pick one and be consistent). No ORM; parameterised SQL only.
- Config via `.env` (see `.env.example`): `PORT=4000`, `DB_FILE=./data/oems.db`, `SESSION_IDLE_MINUTES=15`, `APP_TIMEZONE=Asia/Kolkata`, `CORS_ORIGIN=http://localhost:5173`, `SELF_SERVICE_ROLES=Employee`.
- All "today / now" values come from the **server clock in `APP_TIMEZONE`** and are never accepted from the client (DE-003). Dates are ISO `YYYY-MM-DD`; currency is INR (A5 in the Data Dictionary).

## 2. FOLDER LAYOUT

```
backend/
  package.json  .env.example  README.md  TRACEABILITY.md  api.http
  db/schema.sql  db/seed.js
  src/server.js  src/app.js  src/config.js  src/db.js
  src/middleware/  auth.js  rbac.js  validate.js  audit.js  errors.js
  src/lib/         ids.js  dates.js  money.js  result.js  departments.js
  src/modules/
    auth/  attendance/  leave/  profile/  employees/  retirement/
    recruitment/ (vacancies, candidates, interviews, offers)
    payroll/ (collect.js, calculator.js [pure], store.js, routes.js)
    payslips/  salary/  reports/
  tests/  (one file per module + tests/businessRules.test.js)
```

## 3. DATABASE (`db/schema.sql`) — names exactly as in Data Dictionary §8

Use the **exact table and column names**. Map: VARCHAR/CHAR→TEXT with `CHECK(length(col) <= n)`, DATE/TIME/TIMESTAMP→TEXT (ISO), INTEGER→INTEGER, DECIMAL(10,2)→`NUMERIC` (but compute money in integer paise, see §7). Keep every NOT NULL, DEFAULT and CHECK listed.

**D1 EMPLOYEE** (T-D1-01): `employee_id` PK VARCHAR(8) `EMP`+5 digits · `employee_name`(100) · `date_of_birth` · `gender` CHAR(1) IN('M','F','O') · `contact_number`(10) · `email`(100) UNIQUE · `address`(200) · `department`(50) · `designation`(50) · `date_of_joining` · `basic_salary` DECIMAL(10,2) CHECK>0 · `bank_account`(18) · `employment_status`(10) DEFAULT 'Active' IN('Active','Resigned','Retired') · `record_created_date` DEFAULT CURRENT_DATE · `last_updated_by` FK→EMPLOYEE.employee_id NULL · `last_updated_ts` NULL. All others NOT NULL.

**D2 ATTENDANCE** (T-D2-01): `attendance_id` PK(12) `ATT`+9 digits · `employee_id` FK · `att_date` DEFAULT CURRENT_DATE · `checkin_time` TIME NOT NULL · `checkout_time` TIME NULL · `att_status`(10) DEFAULT 'Present' IN('Present','Absent','Half-day','On Leave') · `recorded_ts` DEFAULT CURRENT_TIMESTAMP.

**D3 LEAVE_APPLICATION** (T-D3-01): `leave_id` PK(10) `LV`+8 digits · `employee_id` FK · `leave_type`(15) IN('Casual','Sick','Earned','Unpaid') · `leave_start` · `leave_end` · `leave_days` INTEGER · `leave_reason`(200) · `applied_date` DEFAULT CURRENT_DATE · `leave_status`(10) DEFAULT 'Pending' IN('Pending','Approved','Rejected') · `approved_by` FK→EMPLOYEE NULL · `decision_date` NULL · `hr_remarks`(200) NULL.

**D4 recruitment — four tables:**
- `VACANCY`: `vacancy_id` PK(8) `VAC`+5 · `job_title`(100) · `department`(50) · `positions` INTEGER · `qualifications`(300) · `vacancy_status`(10) DEFAULT 'Open' IN('Open','On Hold','Closed') · `posted_date` DEFAULT CURRENT_DATE.
- `CANDIDATE`: `candidate_id` PK(8) `CAN`+5 · `vacancy_id` FK · `candidate_name`(100) · `candidate_email`(100) · `candidate_phone`(10) NULL.
- `INTERVIEW_SCHEDULE`: `interview_id` PK(10) `INT`+7 · `candidate_id` FK · `vacancy_id` FK · `interview_date` · `interview_time` · `interview_venue`(150) · `interviewer_name`(100) NULL · `interview_status`(12) DEFAULT 'Scheduled' IN('Scheduled','Completed','Selected','Rejected','Cancelled').
- `OFFER`: `offer_id` PK(10) `OFR`+7 · `candidate_id` FK · `vacancy_id` FK · `offer_position`(100) · `offered_salary` DECIMAL(10,2) CHECK>0 · `joining_date` · `offer_issue_date` DEFAULT CURRENT_DATE · `offer_status`(10) DEFAULT 'Issued' IN('Issued','Accepted','Declined').

**D5 PAYROLL** (T-D5-01): `payroll_id` PK(12) `PAY`+9 · `employee_id` FK · `pay_period` CHAR(7) `YYYY-MM` · `days_present` · `leave_days` · `basic_salary` CHECK>0 · `allowances` DEFAULT 0 CHECK>=0 · `gross_salary` ≥0 · `tax_deduction` DEFAULT 0 ≥0 · `pf_deduction` DEFAULT 0 ≥0 · `total_deductions` ≥0 · `net_salary` ≥0 · `processed_date` DEFAULT CURRENT_DATE · `payroll_status`(10) DEFAULT 'Processed' IN('Processed','Paid','On Hold').

**D6 PAYSLIP** (T-D6-01): `payslip_id` PK(12) `PS`+10 · `payroll_id` FK · `employee_id` FK · `pay_period` · `gross_salary` · `total_deductions` · `net_salary` · `generated_date` DEFAULT CURRENT_DATE.

**D7 RETIREMENT_PLAN** (T-D7-01): `ret_plan_id` PK(8) `RP`+6 · `employee_id` FK · `retirement_date` · `plan_type`(20) IN('Provident Fund','Pension','Gratuity') · `contribution_amount` ≥0 · `nominee_name`(100) NULL · `plan_status`(10) DEFAULT 'Active' IN('Active','Closed').

**Supporting tables (added — see A-2, A-5; they are NOT part of D1–D7):**
- `USER_ACCOUNT`(`employee_id` PK/FK, `password_hash`, `role` IN('Employee','HR Manager','Recruitment Officer','Payroll Officer','Finance Manager'), `is_active` DEFAULT 1).
- `SESSION`(`token_hash` PK, `employee_id` FK, `role`, `created_ts`, `last_activity_ts`, `revoked` DEFAULT 0).
- `AUDIT_LOG`(`audit_id` PK, `ts`, `employee_id` NULL, `role` NULL, `action`, `entity`, `entity_id` NULL, `outcome` IN('Success','Denied','Failed'), `detail` NULL).

**Uniqueness (A-1).** The dictionary marks several FK columns "UNIQUE: Yes". Read literally that would allow one attendance row / leave / candidate per employee ever, which contradicts the business rules. Implement the *intended* uniqueness instead:
`ATTENDANCE UNIQUE(employee_id, att_date)` (BR-01) · `PAYROLL UNIQUE(employee_id, pay_period)` (BR-19) · `PAYSLIP UNIQUE(payroll_id)` · `RETIREMENT_PLAN UNIQUE(employee_id)` · `OFFER UNIQUE(candidate_id)` · `INTERVIEW_SCHEDULE UNIQUE(candidate_id, interview_date, interview_time)` and `UNIQUE(interview_venue, interview_date, interview_time)` (BR-13). `LEAVE_APPLICATION`, `CANDIDATE` get no extra UNIQUE on `employee_id` / `vacancy_id`.

IDs are generated by the server as prefix + zero-padded sequence (e.g. `EMP00007`, `ATT000000123`, `PS0000000042`), via a counter derived inside the same transaction as the insert. Never accept IDs from the client.

## 4. ROLES, AUTHENTICATION, SESSION (NFR-21, NFR-22, BR-26, BR-27)

Five roles exactly: `Employee`, `HR Manager`, `Recruitment Officer`, `Payroll Officer`, `Finance Manager`.

- `POST /api/auth/login {login, password}` (`login` = employee_id or email) → opaque random 32-byte token, only its SHA-256 stored. Client sends `Authorization: Bearer <token>`. Passwords bcrypt-hashed (cost ≥ 10). Rate-limit login (e.g. 10/15 min/IP). Generic error text for bad credentials.
- **Idle timeout:** every authenticated request updates `last_activity_ts`; if `now − last_activity > SESSION_IDLE_MINUTES` the session is revoked and the request gets 401 (BR-27).
- `POST /api/auth/logout` revokes the session. `GET /api/auth/me` returns `{employee_id, name, role}`.
- Middleware `authenticate` (401 if missing/expired) then `requireRole(...roles)` (403 + `AUDIT_LOG` row outcome `Denied` — BR-26 "Denied and logged").
- **Self-service gate (A-7):** UC-01, UC-02 (own), UC-03, UC-05, UC-11 (own) are the *Employee* actor's use cases. They require a role in `SELF_SERVICE_ROLES` (default `Employee` only) and always act on `req.user.employee_id`; the client can never name another employee on those routes (BR-03, NFR-2, NFR-11).

**Permission matrix (from Assignment 2 §3 + DFD entities):**

| Role | May do |
|---|---|
| Employee | check-in/out, view own attendance, apply leave, view own leave status, view/update own profile (3 fields), view own salary + own payslips |
| HR Manager | view all attendance, manage leave (review/approve/reject), register employee, manage employee records, manage retirement plans, view salary of employees, HR reports |
| Recruitment Officer | vacancies, candidates (A-3), interview schedules, offer letters |
| Payroll Officer | run payroll (UC-12/UC-14 via 0.5), view payroll records (UC-15), update payroll status, generate/view payslips (UC-13), view salary (UC-11) |
| Finance Manager | view salary (UC-11), financial/payroll reports (UC-17) |

## 5. RESPONSE ENVELOPE (DS-04 Operation Result)

Every response: `{ "result_status": "Success"|"Failed", "reference_id": "<id|null>", "response_message": "...", "error_message": null|"...", "data": ... }`. Validation errors → 400/422 with `error_message` and a `details` array of field errors. Use 401 (not logged in), 403 (role), 404, 409 (duplicate / conflict). Never leak stack traces. Mutations write `AUDIT_LOG`.

## 6. ENDPOINTS (one block per DFD Level-1 process)

All paths prefixed `/api`. Role in **bold**.

**Process 0.1 Manage Attendance — UC-01, UC-02 · FR-1, FR-2 · NFR-1, NFR-2**
- `POST /attendance/check-in` — **Employee**. Server sets `att_date`, `checkin_time`, `att_status='Present'`. BR-01: second check-in same date → 409.
- `POST /attendance/check-out` — **Employee**. BR-02: needs today's check-in, check-out time > check-in time, only once.
- `GET /attendance/me?from&to` — **Employee**, own only. `from ≤ to` (DE-014/015). Returns rows + summary (days present).
- `GET /attendance?employee_id&from&to` — **HR Manager**, all employees (BR-03).

**Process 0.2 Manage Leave — UC-03, UC-04 · FR-3, FR-4 · NFR-3, NFR-4**
- `POST /leaves` — **Employee**. Body `{leave_type, leave_start, leave_end, leave_reason}`. BR-04 all mandatory; BR-05 `leave_end ≥ leave_start ≥ today`; `leave_days = end − start + 1`; status `Pending`.
- `GET /leaves/me` — **Employee**: own applications + status (DS-11 Leave Status Notice: leave_id, leave_status, decision_date, hr_remarks).
- `GET /leaves?status&employee_id` — **HR Manager**: review list including `employee_name` (DS-09).
- `GET /leaves/:leave_id` — **HR Manager** or the owning Employee.
- `PATCH /leaves/:leave_id/decision` — **HR Manager** `{decision:'Approved'|'Rejected', hr_remarks?}`. BR-06 sets `approved_by`, `decision_date`; BR-07 only `Pending → Approved|Rejected` (else 409). Every decision writes `AUDIT_LOG` (NFR-4). The response is the Leave Status Notice (this is the "notify" step of 0.2.4; no e-mail needed).

**Process 0.3 Manage Employee Records — UC-05, UC-06, UC-07, UC-20 · FR-5, FR-6, FR-7, FR-20 · NFR-5, NFR-6, NFR-7, NFR-20**
- `GET /profile/me` — **Employee** (DS-17). `PATCH /profile/me` — **Employee**: only `contact_number`, `email`, `address` (BR-08); any other key → 400 listing the rejected keys. Validate each; set `last_updated_by`/`last_updated_ts`.
- `POST /employees` — **HR Manager** (BR-09, BR-10). Required: name, DOB, gender, contact, email, address, department, designation, date_of_joining, basic_salary, bank_account. Generates `employee_id`, status `Active`, creates `USER_ACCOUNT` with role `Employee` and a one-time temporary password returned **once** in `data.temporary_password` (A-2). Duplicate email → 409.
- `GET /employees?department&status&q`, `GET /employees/:id` — **HR Manager**. Mask `bank_account` in list view (last 4 digits).
- `PATCH /employees/:id` — **HR Manager**, body = `{field: newValue, ...}` for editable fields (every field except `employee_id`, `record_created_date`, `last_updated_*`); each validated by its own rule (DE-044/045); sets `last_updated_by` + `last_updated_ts` (BR-11, NFR-7) and writes `AUDIT_LOG`. Changing `employment_status` is how an employee is retired/resigned. **No DELETE** — delete is "Not Explicitly Specified" in the dictionary.
- Retirement (UC-20, **HR Manager** only, BR-24): `POST /retirement-plans`, `GET /retirement-plans?employee_id`, `GET /retirement-plans/:id`, `PATCH /retirement-plans/:id`. BR-25 `retirement_date > date_of_joining`; employee must exist; `plan_type` enum; `contribution_amount ≥ 0`; changes audited (NFR-20).

**Process 0.4 Manage Recruitment — UC-09, UC-10, UC-19 · FR-9, FR-10, FR-19 · NFR-9, NFR-10, NFR-19** (all **Recruitment Officer**)
- Vacancies: `POST /vacancies`, `GET /vacancies?status`, `GET /vacancies/:id`, `PATCH /vacancies/:id`, `POST /vacancies/:id/close`. BR-12: title, department, positions ≥ 1, qualifications required; `department` must be in the department list (§8).
- Candidates (A-3): `POST /candidates`, `GET /candidates?vacancy_id`. Vacancy must exist and be `Open`.
- Interviews: `POST /interviews`, `GET /interviews?vacancy_id&candidate_id&date`, `GET /interviews/:id`, `PATCH /interviews/:id` (reschedule or change `interview_status`). DE-058 candidate must exist; DE-059 date not in the past; BR-13 no clash on same date+time for the same candidate **or** the same venue → 409 with a message asking for another slot.
- Offers: `POST /offers {candidate_id, offered_salary, joining_date, offer_position?}`, `GET /offers`, `GET /offers/:id`, `GET /offers/:id/letter` (printable HTML, consistent template — NFR-19), `PATCH /offers/:id/status` (Issued/Accepted/Declined). BR-14: the candidate's latest interview must be `Selected`; salary > 0; `offer_position` is taken from the vacancy's `job_title` (if supplied and different → 400, DE-068); `joining_date > offer_issue_date` (DE-070). BR-29: the letter is rendered only from the stored OFFER row.

**Process 0.5 Manage Payroll — UC-11, UC-12, UC-14, UC-15 · FR-11, FR-12, FR-14, FR-15 · NFR-11, NFR-12, NFR-14, NFR-15** (see §7 for the calculation)
- `POST /payroll/run` — **Payroll Officer**. Body `{pay_period:'YYYY-MM', working_days, lines?:[{employee_id, allowances, other_deductions}]}`. If `lines` is omitted, every `Active` employee is processed with 0 allowances/0 other deductions. DE-074 period valid and not in the future; DE-075 `1 ≤ working_days ≤ days in month`; allowances/other deductions ≥ 0 (BR-28). Pipeline = 0.5.1 collect → 0.5.2 calculate → 0.5.3 store. Runs in **one transaction per employee**. Response (DS-38): `{employees_processed, skipped:[{employee_id, reason}], failed:[{employee_id, reason}], status}`. BR-19: an existing line for that employee+period is kept and reported as skipped.
- `GET /payroll/records?pay_period&employee_id`, `GET /payroll/records/:payroll_id` — **Payroll Officer only** (BR-30; Finance sees payroll only through reports).
- `PATCH /payroll/records/:payroll_id/status` — **Payroll Officer**: `Processed → Paid`, `Processed ↔ On Hold`. Amounts are never editable after processing (NFR-14).
- Salary view (UC-11, BR-15): `GET /salary/me` — **Employee**: own `basic_salary`, own payroll lines (gross/deductions/net) and own payslip list (A-4). `GET /salary?employee_id&pay_period` — **HR Manager, Payroll Officer, Finance Manager**: `employee_id, name, department, basic_salary`, plus gross/deductions/net per period. No role other than these may read another employee's salary.

**Process 0.6 Generate Payslips — UC-13 · FR-13 · NFR-13** (**Payroll Officer**; owning Employee may read own)
- `POST /payslips/generate {pay_period, employee_ids?}` — BR-21 only for payroll lines with status `Processed` or `Paid`; BR-20 amounts copied unchanged from the PAYROLL row; one payslip per payroll row (re-request returns the existing one). Response includes `payslip_count` (DE-089).
- `GET /payslips?pay_period&employee_id` (Payroll Officer), `GET /payslips/:payslip_id` and `GET /payslips/:payslip_id/download` (PDF, fixed readable layout) — Payroll Officer or the owner only.

**Process 0.7 Generate Reports — UC-16, UC-17 (includes UC-02, UC-12, UC-15) · FR-16, FR-17 · NFR-16, NFR-17**
- `GET /reports/hr?report_type&from_date&to_date&department` — **HR Manager only** (BR-22). `report_type ∈ Attendance | Leave | Headcount | Employee`. `from_date ≤ to_date`. Output: `report_title` (generated from type), `generated_ts`, `headcount` (active employees), and aggregates + rows. The Employee report excludes salary and bank data. Attendance report = days present per employee; Leave report = counts by type/status + rows; Headcount = active employees by department.
- `GET /reports/financial?report_type&from_date&to_date&department` — **Finance Manager only** (BR-23). `report_type ∈ Payroll | Financial`. Compile (0.7.2): only payroll lines with status `Processed`/`Paid` whose `pay_period` falls in the range, plus attendance totals for the range (this is the UC-02 include), then compute `total_payroll_cost` (Σ gross), and per department `department_total_gross`, `department_total_deductions`, `department_total_net` (DE-094…097).
- `GET /health` — public.

## 7. SALARY CALCULATION (UC-12 — BR-16, BR-17, BR-18, BR-28, NFR-12)

`payroll/calculator.js` must be a **pure, deterministic function** (no DB, no clock, no randomness). All money in **integer paise** internally; convert to 2-decimals only when storing (reproducibility, BR-16).

Inputs (DS-35 Consolidated Payroll Inputs): `basic_salary, working_days, days_present, paid_leave_days, allowances, other_deductions`.

Collect (0.5.1):
- `basic_salary` from EMPLOYEE (D1); `days_present` = count of ATTENDANCE rows with `att_status='Present'` in the month (D2).
- `leave_days` = days of **Approved** leave overlapping the month (clip to month boundaries) (D3; BR-18 — Pending/Rejected ignored). Only types `Casual`, `Sick`, `Earned` count as *paid* leave days; `Unpaid` counts as unpaid absence (A-6).
- `unpaid_absence = max(0, working_days − days_present − paid_leave_days)`.

Calculate (0.5.2) — **BR-17 (Proposed formula)**:
```
gross  = basic * (working_days − unpaid_absence) / working_days + allowances
pf     = 12% of the earned basic (basic * (working_days − unpaid_absence)/working_days)     // A-6
tax    = 0 if gross ≤ 25,000 ; 5% of gross if 25,000 < gross ≤ 50,000 ; 10% of gross if > 50,000   // A-6
total_deductions = tax + pf + other_deductions
net    = gross − total_deductions
```
Round half-up to paise at the end of each line. If `net < 0` or any input is invalid → that employee **fails** (BR-17 "Run stopped for that employee"), is listed in `failed`, other employees continue. Put the PF %, tax slabs and paid-leave types in one `payroll/rules.js` constants file with a comment "Proposed — not specified in sources".

Store (0.5.3): one `PAYROLL` row per employee+period storing `days_present`, `leave_days` (= paid leave days used), `basic_salary` (snapshot), `allowances`, `gross_salary`, `tax_deduction`, `pf_deduction`, `total_deductions`, `net_salary`, status `Processed`.

## 8. VALIDATION CATALOGUE (Data Dictionary §7 / §9) — implement in zod schemas + service checks

- `employee_id` `^EMP\d{5}$` · `contact_number` `^[6-9]\d{9}$` · `email` valid + unique · `bank_account` `^\d{9,18}$` · `gender` M/F/O · `date_of_birth`: employee ≥ 18 years at `date_of_joining`; `date_of_joining` ≥ DOB + 18 y · `basic_salary > 0` · `department` ∈ configured list in `lib/departments.js` (HR, Finance, Engineering, Sales, Operations, Recruitment, Payroll — A-8) · `employee_name` letters and spaces, not blank.
- `attendance date` not in the future · `leave_reason` not blank · `candidate_phone` digits only · `candidate_email` valid · `positions ≥ 1` · `pay_period` `^\d{4}-(0[1-9]|1[0-2])$` · `report_type` per §6.
- A "Not blank" rule means after trimming.

## 9. SECURITY & NON-FUNCTIONAL (NFR-21/22 and Section 10 of the Data Dictionary)

- Parameterised queries only; `helmet`; CORS limited to `CORS_ORIGIN`; JSON body limit 100 kb.
- Restricted data (salary, bank account, retirement/nominee, offered salary) is never logged and never returned to roles that are not permitted (§4).
- Every denied request is logged (BR-26); every create/update/decision on employee, leave, retirement, payroll, payslip, offer is logged with actor, entity, outcome.
- Reasonable response time: add indexes on `ATTENDANCE(employee_id, att_date)`, `LEAVE_APPLICATION(employee_id, leave_status)`, `PAYROLL(pay_period, employee_id)`, `PAYSLIP(employee_id, pay_period)`.

## 10. SEED DATA & TESTS

`npm run seed` creates (idempotent): one user per role — `EMP00001` HR Manager, `EMP00002` Recruitment Officer, `EMP00003` Payroll Officer, `EMP00004` Finance Manager, `EMP00005`–`EMP00010` Employees — with a demo password from `.env` (`SEED_PASSWORD`), 2 months of attendance, a few leaves in each status, 2 vacancies, 3 candidates, interviews, one retirement plan, and one processed payroll month with payslips. Seeded roles other than `Employee` exist only through the seed (A-2: the documents do not define role assignment).

Tests (`npm test`) must cover **every BR-01…BR-30**, at least: duplicate check-in (BR-01); check-out before check-in (BR-02); employee reading another's attendance/salary → 403 (BR-03, BR-15); leave date rules, status life-cycle, decision authority (BR-04–07); profile field whitelist (BR-08); duplicate email (BR-09); record-change traceability (BR-11); interview clash (BR-13); offer eligibility (BR-14); calculator determinism — same inputs 1000× same output (BR-16); formula worked examples (BR-17); only approved leave affects pay (BR-18); payroll re-run does not duplicate (BR-19); payslip equals payroll (BR-20); payslip refused for unprocessed/on-hold (BR-21); report role gates (BR-22, BR-23); retirement date (BR-25); 401 without token and after idle timeout (BR-27); non-negative amounts (BR-28); payroll record role gate (BR-30).

## 11. PHASES (stop after each one)

1. **Foundation** — project scaffold, config, `schema.sql`, ID generator, result envelope, error handler, auth (login/logout/me/idle timeout), RBAC, audit log, health, seed users. Tests: auth + RBAC + idle timeout.
2. **Employee-facing core** — attendance (0.1), leave (0.2), profile + employee records + retirement plans (0.3). Tests for BR-01…11, 24, 25.
3. **Recruitment** (0.4) — vacancies, candidates, interviews, offers + HTML letter. Tests BR-12…14, 29.
4. **Payroll** (0.5) — collector, pure calculator, run, records, status, salary views. Tests BR-15…19, 28, 30.
5. **Payslips + Reports** (0.6, 0.7) — payslip generate/read/PDF, HR and financial reports. Tests BR-20…23.
6. **Hardening & docs** — full seed, `api.http` (one request per endpoint), `README.md` (setup, run, test, env, demo logins, assumptions A-1…A-8), `TRACEABILITY.md` (table: endpoint → UC → FR → process → BR → NFR → tables), run the whole suite, fix gaps.

## 12. DEVIATIONS / ASSUMPTIONS (documented, do not silently change)

| # | Where the documents are silent or conflict | Decision |
|---|---|---|
| A-1 | Several FK columns are marked "UNIQUE: Yes" in §8 (would limit one attendance/leave/candidate per employee) | Use the composite uniqueness listed in §3 |
| A-2 | Authentication has no process or store (Dictionary §12 #3 recommends a "Manage User Access" process) | Add `USER_ACCOUNT`, `SESSION`; roles seeded; new employees get role `Employee` |
| A-3 | No flow creates candidates (§12 #10 recommends "Register Candidate") | Add `POST/GET /candidates` for the Recruitment Officer |
| A-4 | Level 0 shows Payslip/Salary to Employee but no Level 1/2 flow (§12 #9 recommends Employee salary & payslip views) | Add `/salary/me` and own-payslip read access |
| A-5 | BR-26 "Denied and logged", NFR-4/7/20 traceability, but no audit store | Add `AUDIT_LOG` |
| A-6 | Salary formula is Proposed (BR-17); tax/PF not specified. DE-081 lists "loss of pay" inside Total Deductions **and** BR-17 already reduces Gross for unpaid absence (double count) | Follow BR-17: loss of pay is reflected in Gross only; `total_deductions = tax + pf + other_deductions`. PF 12 %, tax slabs and paid-leave types are constants in `rules.js` |
| A-7 | Assignment 2 gives self-service use cases to *Employee* only | `SELF_SERVICE_ROLES=Employee` env switch (add other roles to the list to let staff in other roles use self-service on their own record) |
| A-8 | "Existing department" list is not given | Fixed list in `lib/departments.js` |

## 13. DEFINITION OF DONE

`npm install && npm run seed && npm start` brings up the API on :4000; `npm test` is green; every endpoint in §6 exists with its role gate; every BR-01…BR-30 has a passing test; `TRACEABILITY.md` and `README.md` are complete; no feature outside the documents was added except A-1…A-8.

**Now: print your plan (folder layout, dependencies, how you will handle each of A-1…A-8) and wait for my OK before starting Phase 1.**
