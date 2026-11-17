# Traceability — Office Employee Management System backend (Group 02)

Sources: Assignment 2 (`docs/requirements.txt`) and the Assignment 3.2 Data Dictionary (`docs/dd.txt`).
Every route handler and service function in `src/modules` carries the same tag as a comment
(`// UC-xx | FR-xx | Process 0.x.y | BR-xx | NFR-xx`); `tests/endpoints.test.js` checks that each route has one.
NFR-21 (RBAC) and NFR-22 (authentication and session) apply to every row below. The supporting tables `SESSION` and `AUDIT_LOG` (A-2, A-5) are used by every authenticated or mutating request and are listed only where they are the main store.

## 1. Endpoint → requirement → store

| Endpoint | Role | UC | FR | Process | BR | NFR | Tables |
|---|---|---|---|---|---|---|---|
| `GET /api/health` | public | — | — | — | — | — | — |
| `POST /api/auth/login` | any | (all) | (all) | (A-2) | BR-27 | NFR-22 | USER_ACCOUNT, SESSION, EMPLOYEE |
| `POST /api/auth/logout` | any | (all) | (all) | (A-2) | BR-27 | NFR-22 | SESSION |
| `GET /api/auth/me` | any | (all) | (all) | (A-2) | BR-27 | NFR-22 | SESSION, EMPLOYEE |
| `POST /api/attendance/check-in` | Employee | UC-01 | FR-1 | 0.1.1, 0.1.2 | BR-01 | NFR-1 | ATTENDANCE |
| `POST /api/attendance/check-out` | Employee | UC-01 | FR-1 | 0.1.2 | BR-02 | NFR-1 | ATTENDANCE |
| `GET /api/attendance/me` | Employee | UC-02 | FR-2 | 0.1.3 | BR-03 | NFR-2 | ATTENDANCE |
| `GET /api/attendance` | HR Manager | UC-02 | FR-2 | 0.1.3 | BR-03 | NFR-2 | ATTENDANCE, EMPLOYEE |
| `POST /api/leaves` | Employee | UC-03 | FR-3 | 0.2.1, 0.2.2 | BR-04, BR-05 | NFR-3 | LEAVE_APPLICATION |
| `GET /api/leaves/me` | Employee | UC-03 | FR-3 | 0.2.4 | — | NFR-3 | LEAVE_APPLICATION |
| `GET /api/leaves` | HR Manager | UC-04 | FR-4 | 0.2.3 | — | NFR-4 | LEAVE_APPLICATION, EMPLOYEE |
| `GET /api/leaves/:leave_id` | HR Manager / owner | UC-03, UC-04 | FR-3, FR-4 | 0.2.3 | BR-26 | NFR-4 | LEAVE_APPLICATION, EMPLOYEE |
| `PATCH /api/leaves/:leave_id/decision` | HR Manager | UC-04 | FR-4 | 0.2.3, 0.2.4 | BR-06, BR-07 | NFR-4 | LEAVE_APPLICATION, AUDIT_LOG |
| `GET /api/profile/me` | Employee | UC-05 | FR-5 | 0.3.3 | — | NFR-5 | EMPLOYEE |
| `PATCH /api/profile/me` | Employee | UC-05 | FR-5 | 0.3.3 | BR-08, BR-09, BR-11 | NFR-5 | EMPLOYEE, AUDIT_LOG |
| `POST /api/employees` | HR Manager | UC-06 | FR-6 | 0.3.1 | BR-09, BR-10 | NFR-6 | EMPLOYEE, USER_ACCOUNT |
| `GET /api/employees` | HR Manager | UC-07 | FR-7 | 0.3.2 | — | NFR-7 | EMPLOYEE |
| `GET /api/employees/:id` | HR Manager | UC-07 | FR-7 | 0.3.2 | — | NFR-7 | EMPLOYEE |
| `PATCH /api/employees/:id` | HR Manager | UC-07 | FR-7 | 0.3.2 | BR-09, BR-11 | NFR-7 | EMPLOYEE, AUDIT_LOG |
| `POST /api/retirement-plans` | HR Manager | UC-20 | FR-20 | 0.3.4 | BR-24, BR-25 | NFR-20 | RETIREMENT_PLAN, EMPLOYEE |
| `GET /api/retirement-plans` | HR Manager | UC-20 | FR-20 | 0.3.4 | BR-24 | NFR-20 | RETIREMENT_PLAN, EMPLOYEE |
| `GET /api/retirement-plans/:id` | HR Manager | UC-20 | FR-20 | 0.3.4 | BR-24 | NFR-20 | RETIREMENT_PLAN, EMPLOYEE |
| `PATCH /api/retirement-plans/:id` | HR Manager | UC-20 | FR-20 | 0.3.4 | BR-24, BR-25 | NFR-20 | RETIREMENT_PLAN, AUDIT_LOG |
| `POST /api/vacancies` | Recruitment Officer | UC-09 | FR-9 | 0.4.1 | BR-12 | NFR-9 | VACANCY |
| `GET /api/vacancies` | Recruitment Officer | UC-09 | FR-9 | 0.4.1 | — | NFR-9 | VACANCY |
| `GET /api/vacancies/:id` | Recruitment Officer | UC-09 | FR-9 | 0.4.1 | — | NFR-9 | VACANCY |
| `PATCH /api/vacancies/:id` | Recruitment Officer | UC-09 | FR-9 | 0.4.1 | BR-12 | NFR-9 | VACANCY |
| `POST /api/vacancies/:id/close` | Recruitment Officer | UC-09 | FR-9 | 0.4.1 | — | NFR-9 | VACANCY |
| `POST /api/candidates` | Recruitment Officer | UC-10 (A-3) | FR-10 | 0.4 (A-3) | — | NFR-9 | CANDIDATE, VACANCY |
| `GET /api/candidates` | Recruitment Officer | UC-10 (A-3) | FR-10 | 0.4 (A-3) | — | NFR-9 | CANDIDATE, VACANCY |
| `POST /api/interviews` | Recruitment Officer | UC-10 | FR-10 | 0.4.2 | BR-13 | NFR-10 | INTERVIEW_SCHEDULE, CANDIDATE |
| `GET /api/interviews` | Recruitment Officer | UC-10 | FR-10 | 0.4.2 | — | NFR-10 | INTERVIEW_SCHEDULE, CANDIDATE, VACANCY |
| `GET /api/interviews/:id` | Recruitment Officer | UC-10 | FR-10 | 0.4.2 | — | NFR-10 | INTERVIEW_SCHEDULE, CANDIDATE, VACANCY |
| `PATCH /api/interviews/:id` | Recruitment Officer | UC-10 | FR-10 | 0.4.2 | BR-13 | NFR-10 | INTERVIEW_SCHEDULE |
| `POST /api/offers` | Recruitment Officer | UC-19 | FR-19 | 0.4.3 | BR-14, BR-28 | NFR-19 | OFFER, CANDIDATE, VACANCY, INTERVIEW_SCHEDULE |
| `GET /api/offers` | Recruitment Officer | UC-19 | FR-19 | 0.4.3 | — | NFR-19 | OFFER, CANDIDATE, VACANCY |
| `GET /api/offers/:id` | Recruitment Officer | UC-19 | FR-19 | 0.4.3 | — | NFR-19 | OFFER, CANDIDATE, VACANCY |
| `GET /api/offers/:id/letter` | Recruitment Officer | UC-19 | FR-19 | 0.4.3 | BR-29 | NFR-19 | OFFER, CANDIDATE, VACANCY |
| `PATCH /api/offers/:id/status` | Recruitment Officer | UC-19 | FR-19 | 0.4.3 | — | NFR-19 | OFFER |
| `POST /api/payroll/run` | Payroll Officer (A-9) | UC-14, UC-12 | FR-14, FR-12 | 0.5.1, 0.5.2, 0.5.3 | BR-16, BR-17, BR-18, BR-19, BR-28 | NFR-12, NFR-14 | PAYROLL, EMPLOYEE, ATTENDANCE, LEAVE_APPLICATION |
| `GET /api/payroll/records` | Payroll Officer | UC-15 | FR-15 | 0.5.4 | BR-30 | NFR-15 | PAYROLL, EMPLOYEE |
| `GET /api/payroll/records/:payroll_id` | Payroll Officer | UC-15 | FR-15 | 0.5.4 | BR-30 | NFR-15 | PAYROLL, EMPLOYEE |
| `PATCH /api/payroll/records/:payroll_id/status` | Payroll Officer (A-9) | UC-14 | FR-14 | 0.5.3 | — | NFR-14 | PAYROLL |
| `GET /api/salary/me` | Employee | UC-11 (A-4) | FR-11 | 0.5.4, 0.6.4 | BR-15 | NFR-11 | EMPLOYEE, PAYROLL, PAYSLIP |
| `GET /api/salary` | HR Manager, Payroll Officer, Finance Manager | UC-11 | FR-11 | 0.5.4 | BR-15 | NFR-11 | EMPLOYEE, PAYROLL |
| `POST /api/payslips/generate` | Payroll Officer (A-9) | UC-13 (incl. UC-12) | FR-13 | 0.6.1, 0.6.2, 0.6.3 | BR-20, BR-21 | NFR-13 | PAYSLIP, PAYROLL |
| `GET /api/payslips` | Payroll Officer | UC-13 | FR-13 | 0.6.4 | — | NFR-13 | PAYSLIP, EMPLOYEE |
| `GET /api/payslips/:payslip_id` | Payroll Officer / owner (A-4) | UC-13, UC-11 | FR-13, FR-11 | 0.6.4 | BR-15, BR-20 | NFR-13 | PAYSLIP, PAYROLL, EMPLOYEE |
| `GET /api/payslips/:payslip_id/download` | Payroll Officer / owner (A-4) | UC-13, UC-11 | FR-13, FR-11 | 0.6.4 | BR-15, BR-20 | NFR-13 | PAYSLIP, PAYROLL, EMPLOYEE |
| `GET /api/reports/hr` | HR Manager | UC-16 | FR-16 | 0.7.1 | BR-22 | NFR-16 | EMPLOYEE, ATTENDANCE, LEAVE_APPLICATION |
| `GET /api/reports/financial` | Finance Manager | UC-17 (incl. UC-02, UC-12, UC-15) | FR-17 | 0.7.2, 0.7.3 | BR-23 | NFR-17 | PAYROLL, EMPLOYEE, ATTENDANCE |

## 2. Use case coverage

| UC | Name | Actor(s) | Endpoints |
|---|---|---|---|
| UC-01 | Mark Attendance | Employee | check-in, check-out |
| UC-02 | View Attendance | Employee (own), HR Manager (all) | `/attendance/me`, `/attendance`; included in UC-17 through the financial report's attendance totals |
| UC-03 | Apply Leave | Employee | `POST /leaves`, `/leaves/me`, `/leaves/:id` |
| UC-04 | Manage Leave | HR Manager | `/leaves`, `/leaves/:id`, `/leaves/:id/decision` |
| UC-05 | Manage Profile | Employee | `/profile/me` |
| UC-06 | Register Employee | HR Manager | `POST /employees` |
| UC-07 | Manage Records | HR Manager | `GET/PATCH /employees[/:id]` |
| UC-09 | Manage Vacancies | Recruitment Officer | `/vacancies…` |
| UC-10 | Schedule Interviews | Recruitment Officer | `/interviews…`, `/candidates` (A-3) |
| UC-11 | View Salary | Employee (own), HR Manager, Payroll Officer, Finance Manager | `/salary/me`, `/salary`, own `/payslips/:id` |
| UC-12 | Calculate Salary | (none — included) | `payroll/calculator.js`, used by `/payroll/run` and so by UC-13, UC-14, UC-17 |
| UC-13 | Generate Payslip | (none — Payroll Officer, A-9) | `/payslips…` |
| UC-14 | Manage Payroll | (none — Payroll Officer, A-9) | `/payroll/run`, `/payroll/records/:id/status` |
| UC-15 | View Payroll Records | Payroll Officer | `/payroll/records…`; included in UC-17 |
| UC-16 | Generate HR Report | HR Manager | `/reports/hr` |
| UC-17 | Generate Financial/Payroll Report | Finance Manager | `/reports/financial` |
| UC-19 | Generate Offer Letter | Recruitment Officer | `/offers…`, `/offers/:id/letter` |
| UC-20 | Manage Retirement Plans | HR Manager | `/retirement-plans…` |

Removed in Assignment 2 and **not implemented**: Director, UC-08, UC-18.

## 3. Business rule → enforcement → test

| BR | Rule | Enforced in | Test (file › describe) |
|---|---|---|---|
| BR-01 | Duplicate attendance prevention | `attendance/service.checkIn`; UNIQUE(employee_id, att_date) | attendance › BR-01 |
| BR-02 | Check-out after check-in | `attendance/service.checkOut`; CHECK | attendance › BR-02 |
| BR-03 | Own attendance only | `requireSelfService` + `/me`; `requireRole('HR Manager')` | attendance › BR-03 |
| BR-04 | Leave mandatory fields | `leave/routes` applyBody | leave › BR-04 |
| BR-05 | Leave date range | `leave/service.apply`; CHECK | leave › BR-05 |
| BR-06 | Leave decision authority | `requireRole('HR Manager')`; approved_by, decision_date | leave › BR-06 |
| BR-07 | Leave status life cycle | `leave/service.decide` (Pending only) | leave › BR-07 |
| BR-08 | Self-service profile fields | `profile/routes` strict schema | employees › BR-08 |
| BR-09 | Unique employee identifier | `ids.nextId`; `assertEmailFree`; UNIQUE email | employees › BR-09 |
| BR-10 | Registration mandatory data | `employees/routes` registerBody; `checkAgeAtJoining` | employees › BR-10 |
| BR-11 | Record change traceability | `employees/service.applyChanges` (last_updated_by/ts) + AUDIT_LOG | employees › BR-11 |
| BR-12 | Vacancy data control | `recruitment/vacancies` schema; Recruitment Officer gate | recruitment › BR-12 |
| BR-13 | Interview slot conflict prevention | `interviews.assertNoClash`; partial unique indexes | recruitment › BR-13 |
| BR-14 | Offer eligibility | `offers.create` (latest interview Selected, salary > 0) | recruitment › BR-14 |
| BR-15 | Salary confidentiality | `salary/routes`; payslip owner check | payroll › BR-15; payslips › access |
| BR-16 | Reproducible salary calculation | pure `payroll/calculator.js`, integer paise | calculator › BR-16 |
| BR-17 | Salary formula (Proposed) | `calculator.calculateSalary`; per-employee failure in `service.runPayroll` | calculator › BR-17; payroll › run |
| BR-18 | Approved leave only | `payroll/collect.collectInputs` | payroll › BR-17 + BR-18 |
| BR-19 | One payroll line per period | `store.findLine`; UNIQUE(employee_id, pay_period) | payroll › BR-19 |
| BR-20 | Payslip matches payroll | `payslips/service.generate` copies amounts | payslips › BR-20; seed |
| BR-21 | Payslip after processing | `PAYSLIP_STATUSES` (Processed, Paid) | payslips › BR-21 |
| BR-22 | HR report scope | `requireRole('HR Manager')`; reports exclude salary/bank data | reports › BR-22 |
| BR-23 | Financial report access | `requireRole('Finance Manager')` | reports › BR-23 |
| BR-24 | Retirement plan control | `requireRole('HR Manager')`; AUDIT_LOG | retirement › BR-24 |
| BR-25 | Retirement date validity | `retirement/service.checkRetirementDate` | retirement › BR-25 |
| BR-26 | Role-based access control | `requireRole`, `requireSelfService`, `deniedError` → AUDIT_LOG `Denied` | rbac › BR-26; endpoints |
| BR-27 | Authentication and session timeout | `middleware/auth.authenticate` | auth › BR-27; endpoints |
| BR-28 | Non-negative amounts | `fields.amount`; calculator; DB CHECKs | calculator › BR-28; payroll; recruitment |
| BR-29 | Offer letter accuracy | `recruitment/letter.renderOfferLetter` from the stored OFFER row | recruitment › BR-29 |
| BR-30 | Payroll records access | `requireRole('Payroll Officer')` on `/payroll` | payroll › BR-30 |

`tests/businessRules.test.js` fails if any BR-01…BR-30 is not named by a test.

## 4. Data stores → tables

| Store | Table(s) (Data Dictionary §8) | Module(s) |
|---|---|---|
| D1 Employee | EMPLOYEE (T-D1-01) | employees, profile, salary, reports |
| D2 Attendance | ATTENDANCE (T-D2-01) | attendance, payroll/collect, reports |
| D3 Leave | LEAVE_APPLICATION (T-D3-01) | leave, payroll/collect, reports |
| D4 Recruitment | VACANCY, CANDIDATE, INTERVIEW_SCHEDULE, OFFER (T-D4-01…04) | recruitment |
| D5 Payroll | PAYROLL (T-D5-01) | payroll, salary, payslips, reports |
| D6 Payslip | PAYSLIP (T-D6-01) | payslips, salary |
| D7 Retirement | RETIREMENT_PLAN (T-D7-01) | retirement |
| supporting (A-2, A-5) | USER_ACCOUNT, SESSION, AUDIT_LOG | auth, middleware |

## 5. Assumptions → code

| # | Where |
|---|---|
| A-1 | `db/schema.sql` (UNIQUE constraints and partial unique indexes marked `ASSUMPTION A-1`); `retirement/service.create`; `offers.create` |
| A-2 | `db/schema.sql` USER_ACCOUNT, SESSION; `middleware/auth.js`; `modules/auth`; `employees/service.register`; `db/seed.js` |
| A-3 | `recruitment/candidates.js` |
| A-4 | `salary/routes.js` `/me`; `payslips/routes.js` `loadForReader` |
| A-5 | `db/schema.sql` AUDIT_LOG; `middleware/audit.js`; `middleware/rbac.js` |
| A-6 | `payroll/rules.js`; `payroll/calculator.js`; `payroll/collect.js`; `payslips/service.getDetail` |
| A-7 | `config.selfServiceRoles`; `middleware/rbac.requireSelfService` |
| A-8 | `lib/departments.js` |
| A-9 | `payroll/routes.js`, `payslips/routes.js` (Payroll Officer gates) |
