-- Office Employee Management System (Group 02) - SQLite schema
-- Table and column names exactly as Data Dictionary section 8 (T-D1-01 ... T-D7-01).
-- Type mapping: VARCHAR/CHAR -> TEXT + CHECK(length), DATE/TIME/TIMESTAMP -> TEXT (ISO),
-- DECIMAL(10,2) -> NUMERIC (money is computed in integer paise in code).
-- NOTE: SQLite CURRENT_DATE / CURRENT_TIMESTAMP are UTC. The application always supplies
-- these values explicitly from the server clock in APP_TIMEZONE; the DEFAULTs are kept
-- only because section 8 lists them.

PRAGMA foreign_keys = ON;

-- ---------------------------------------------------------------- D1
-- T-D1-01 EMPLOYEE
CREATE TABLE IF NOT EXISTS EMPLOYEE (
  employee_id         TEXT    NOT NULL PRIMARY KEY CHECK (length(employee_id) <= 8),
  employee_name       TEXT    NOT NULL CHECK (length(employee_name) <= 100),
  date_of_birth       TEXT    NOT NULL,
  gender              TEXT    NOT NULL CHECK (length(gender) = 1 AND gender IN ('M','F','O')),
  contact_number      TEXT    NOT NULL CHECK (length(contact_number) <= 10),
  email               TEXT    NOT NULL UNIQUE COLLATE NOCASE CHECK (length(email) <= 100),
  address             TEXT    NOT NULL CHECK (length(address) <= 200),
  department          TEXT    NOT NULL CHECK (length(department) <= 50),
  designation         TEXT    NOT NULL CHECK (length(designation) <= 50),
  date_of_joining     TEXT    NOT NULL,
  basic_salary        NUMERIC NOT NULL CHECK (basic_salary > 0),
  bank_account        TEXT    NOT NULL CHECK (length(bank_account) <= 18),
  employment_status   TEXT    NOT NULL DEFAULT 'Active'
                      CHECK (length(employment_status) <= 10 AND employment_status IN ('Active','Resigned','Retired')),
  record_created_date TEXT    NOT NULL DEFAULT CURRENT_DATE,
  last_updated_by     TEXT    NULL REFERENCES EMPLOYEE(employee_id) CHECK (length(last_updated_by) <= 8),
  last_updated_ts     TEXT    NULL
);

-- ---------------------------------------------------------------- D2
-- T-D2-01 ATTENDANCE
CREATE TABLE IF NOT EXISTS ATTENDANCE (
  attendance_id TEXT NOT NULL PRIMARY KEY CHECK (length(attendance_id) <= 12),
  employee_id   TEXT NOT NULL REFERENCES EMPLOYEE(employee_id) CHECK (length(employee_id) <= 8),
  att_date      TEXT NOT NULL DEFAULT CURRENT_DATE,
  checkin_time  TEXT NOT NULL,
  checkout_time TEXT NULL,
  att_status    TEXT NOT NULL DEFAULT 'Present'
                CHECK (length(att_status) <= 10 AND att_status IN ('Present','Absent','Half-day','On Leave')),
  recorded_ts   TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  -- BR-02: check-out must be later than check-in
  CHECK (checkout_time IS NULL OR checkout_time > checkin_time),
  -- ASSUMPTION A-1 / BR-01: one attendance record per employee per date
  UNIQUE (employee_id, att_date)
);

-- ---------------------------------------------------------------- D3
-- T-D3-01 LEAVE_APPLICATION
CREATE TABLE IF NOT EXISTS LEAVE_APPLICATION (
  leave_id      TEXT    NOT NULL PRIMARY KEY CHECK (length(leave_id) <= 10),
  employee_id   TEXT    NOT NULL REFERENCES EMPLOYEE(employee_id) CHECK (length(employee_id) <= 8),
  leave_type    TEXT    NOT NULL CHECK (length(leave_type) <= 15 AND leave_type IN ('Casual','Sick','Earned','Unpaid')),
  leave_start   TEXT    NOT NULL,
  leave_end     TEXT    NOT NULL,
  leave_days    INTEGER NOT NULL,
  leave_reason  TEXT    NOT NULL CHECK (length(leave_reason) <= 200),
  applied_date  TEXT    NOT NULL DEFAULT CURRENT_DATE,
  leave_status  TEXT    NOT NULL DEFAULT 'Pending'
                CHECK (length(leave_status) <= 10 AND leave_status IN ('Pending','Approved','Rejected')),
  approved_by   TEXT    NULL REFERENCES EMPLOYEE(employee_id) CHECK (length(approved_by) <= 8),
  decision_date TEXT    NULL,
  hr_remarks    TEXT    NULL CHECK (length(hr_remarks) <= 200),
  -- BR-05: end date not before start date
  CHECK (leave_end >= leave_start)
  -- ASSUMPTION A-1: no UNIQUE on employee_id (an employee applies for leave many times)
);

-- ---------------------------------------------------------------- D4
-- T-D4-01 VACANCY
CREATE TABLE IF NOT EXISTS VACANCY (
  vacancy_id     TEXT    NOT NULL PRIMARY KEY CHECK (length(vacancy_id) <= 8),
  job_title      TEXT    NOT NULL CHECK (length(job_title) <= 100),
  department     TEXT    NOT NULL CHECK (length(department) <= 50),
  positions      INTEGER NOT NULL CHECK (positions >= 1), -- BR-12
  qualifications TEXT    NOT NULL CHECK (length(qualifications) <= 300),
  vacancy_status TEXT    NOT NULL DEFAULT 'Open'
                 CHECK (length(vacancy_status) <= 10 AND vacancy_status IN ('Open','On Hold','Closed')),
  posted_date    TEXT    NOT NULL DEFAULT CURRENT_DATE
);

-- T-D4-02 CANDIDATE
CREATE TABLE IF NOT EXISTS CANDIDATE (
  candidate_id    TEXT NOT NULL PRIMARY KEY CHECK (length(candidate_id) <= 8),
  vacancy_id      TEXT NOT NULL REFERENCES VACANCY(vacancy_id) CHECK (length(vacancy_id) <= 8),
  candidate_name  TEXT NOT NULL CHECK (length(candidate_name) <= 100),
  candidate_email TEXT NOT NULL CHECK (length(candidate_email) <= 100),
  candidate_phone TEXT NULL CHECK (length(candidate_phone) <= 10)
  -- ASSUMPTION A-1: no UNIQUE on vacancy_id (a vacancy has many candidates)
);

-- T-D4-03 INTERVIEW_SCHEDULE
CREATE TABLE IF NOT EXISTS INTERVIEW_SCHEDULE (
  interview_id     TEXT NOT NULL PRIMARY KEY CHECK (length(interview_id) <= 10),
  candidate_id     TEXT NOT NULL REFERENCES CANDIDATE(candidate_id) CHECK (length(candidate_id) <= 8),
  vacancy_id       TEXT NOT NULL REFERENCES VACANCY(vacancy_id) CHECK (length(vacancy_id) <= 8),
  interview_date   TEXT NOT NULL,
  interview_time   TEXT NOT NULL,
  interview_venue  TEXT NOT NULL CHECK (length(interview_venue) <= 150),
  interviewer_name TEXT NULL CHECK (length(interviewer_name) <= 100),
  interview_status TEXT NOT NULL DEFAULT 'Scheduled'
                   CHECK (length(interview_status) <= 12 AND
                          interview_status IN ('Scheduled','Completed','Selected','Rejected','Cancelled')),
  -- ASSUMPTION A-1 / BR-13: no two interviews for the same candidate, or in the same venue, at the same date+time
  UNIQUE (candidate_id, interview_date, interview_time),
  UNIQUE (interview_venue, interview_date, interview_time)
);

-- T-D4-04 OFFER
CREATE TABLE IF NOT EXISTS OFFER (
  offer_id         TEXT    NOT NULL PRIMARY KEY CHECK (length(offer_id) <= 10),
  candidate_id     TEXT    NOT NULL REFERENCES CANDIDATE(candidate_id) CHECK (length(candidate_id) <= 8),
  vacancy_id       TEXT    NOT NULL REFERENCES VACANCY(vacancy_id) CHECK (length(vacancy_id) <= 8),
  offer_position   TEXT    NOT NULL CHECK (length(offer_position) <= 100),
  offered_salary   NUMERIC NOT NULL CHECK (offered_salary > 0),
  joining_date     TEXT    NOT NULL,
  offer_issue_date TEXT    NOT NULL DEFAULT CURRENT_DATE,
  offer_status     TEXT    NOT NULL DEFAULT 'Issued'
                   CHECK (length(offer_status) <= 10 AND offer_status IN ('Issued','Accepted','Declined')),
  -- ASSUMPTION A-1: one offer per candidate
  UNIQUE (candidate_id)
);

-- ---------------------------------------------------------------- D5
-- T-D5-01 PAYROLL
CREATE TABLE IF NOT EXISTS PAYROLL (
  payroll_id       TEXT    NOT NULL PRIMARY KEY CHECK (length(payroll_id) <= 12),
  employee_id      TEXT    NOT NULL REFERENCES EMPLOYEE(employee_id) CHECK (length(employee_id) <= 8),
  pay_period       TEXT    NOT NULL CHECK (length(pay_period) = 7),
  days_present     INTEGER NOT NULL,
  leave_days       INTEGER NOT NULL,
  basic_salary     NUMERIC NOT NULL CHECK (basic_salary > 0),
  allowances       NUMERIC NOT NULL DEFAULT 0.00 CHECK (allowances >= 0),
  gross_salary     NUMERIC NOT NULL CHECK (gross_salary >= 0),
  tax_deduction    NUMERIC NOT NULL DEFAULT 0.00 CHECK (tax_deduction >= 0),
  pf_deduction     NUMERIC NOT NULL DEFAULT 0.00 CHECK (pf_deduction >= 0),
  total_deductions NUMERIC NOT NULL CHECK (total_deductions >= 0),
  net_salary       NUMERIC NOT NULL CHECK (net_salary >= 0),
  processed_date   TEXT    NOT NULL DEFAULT CURRENT_DATE,
  payroll_status   TEXT    NOT NULL DEFAULT 'Processed'
                   CHECK (length(payroll_status) <= 10 AND payroll_status IN ('Processed','Paid','On Hold')),
  -- ASSUMPTION A-1 / BR-19: one payroll line per employee per pay period
  UNIQUE (employee_id, pay_period)
);

-- ---------------------------------------------------------------- D6
-- T-D6-01 PAYSLIP
CREATE TABLE IF NOT EXISTS PAYSLIP (
  payslip_id       TEXT    NOT NULL PRIMARY KEY CHECK (length(payslip_id) <= 12),
  payroll_id       TEXT    NOT NULL REFERENCES PAYROLL(payroll_id) CHECK (length(payroll_id) <= 12),
  employee_id      TEXT    NOT NULL REFERENCES EMPLOYEE(employee_id) CHECK (length(employee_id) <= 8),
  pay_period       TEXT    NOT NULL CHECK (length(pay_period) = 7),
  gross_salary     NUMERIC NOT NULL CHECK (gross_salary >= 0),
  total_deductions NUMERIC NOT NULL CHECK (total_deductions >= 0),
  net_salary       NUMERIC NOT NULL CHECK (net_salary >= 0),
  generated_date   TEXT    NOT NULL DEFAULT CURRENT_DATE,
  -- ASSUMPTION A-1: one payslip per payroll line
  UNIQUE (payroll_id)
);

-- ---------------------------------------------------------------- D7
-- T-D7-01 RETIREMENT_PLAN
CREATE TABLE IF NOT EXISTS RETIREMENT_PLAN (
  ret_plan_id         TEXT    NOT NULL PRIMARY KEY CHECK (length(ret_plan_id) <= 8),
  employee_id         TEXT    NOT NULL REFERENCES EMPLOYEE(employee_id) CHECK (length(employee_id) <= 8),
  retirement_date     TEXT    NOT NULL,
  plan_type           TEXT    NOT NULL
                      CHECK (length(plan_type) <= 20 AND plan_type IN ('Provident Fund','Pension','Gratuity')),
  contribution_amount NUMERIC NOT NULL CHECK (contribution_amount >= 0),
  nominee_name        TEXT    NULL CHECK (length(nominee_name) <= 100),
  plan_status         TEXT    NOT NULL DEFAULT 'Active'
                      CHECK (length(plan_status) <= 10 AND plan_status IN ('Active','Closed')),
  -- ASSUMPTION A-1: one retirement plan per employee (kept as in section 8)
  UNIQUE (employee_id)
);

-- ---------------------------------------------------------------- supporting tables
-- NOT part of D1-D7. ASSUMPTION A-2 (authentication) and A-5 (audit).

-- ASSUMPTION A-2
CREATE TABLE IF NOT EXISTS USER_ACCOUNT (
  employee_id   TEXT    NOT NULL PRIMARY KEY REFERENCES EMPLOYEE(employee_id),
  password_hash TEXT    NOT NULL,
  role          TEXT    NOT NULL
                CHECK (role IN ('Employee','HR Manager','Recruitment Officer','Payroll Officer','Finance Manager')),
  is_active     INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0,1))
);

-- ASSUMPTION A-2 (timestamps are UTC ISO-8601, used only for the idle timeout)
CREATE TABLE IF NOT EXISTS SESSION (
  token_hash       TEXT    NOT NULL PRIMARY KEY,
  employee_id      TEXT    NOT NULL REFERENCES EMPLOYEE(employee_id),
  role             TEXT    NOT NULL,
  created_ts       TEXT    NOT NULL,
  last_activity_ts TEXT    NOT NULL,
  revoked          INTEGER NOT NULL DEFAULT 0 CHECK (revoked IN (0,1))
);

-- ASSUMPTION A-5
CREATE TABLE IF NOT EXISTS AUDIT_LOG (
  audit_id    INTEGER PRIMARY KEY AUTOINCREMENT,
  ts          TEXT    NOT NULL,
  employee_id TEXT    NULL REFERENCES EMPLOYEE(employee_id),
  role        TEXT    NULL,
  action      TEXT    NOT NULL,
  entity      TEXT    NOT NULL,
  entity_id   TEXT    NULL,
  outcome     TEXT    NOT NULL CHECK (outcome IN ('Success','Denied','Failed')),
  detail      TEXT    NULL
);

-- ---------------------------------------------------------------- indexes (NFR-2, NFR-15 response time)
CREATE INDEX IF NOT EXISTS idx_attendance_emp_date ON ATTENDANCE(employee_id, att_date);
CREATE INDEX IF NOT EXISTS idx_leave_emp_status    ON LEAVE_APPLICATION(employee_id, leave_status);
CREATE INDEX IF NOT EXISTS idx_payroll_period_emp  ON PAYROLL(pay_period, employee_id);
CREATE INDEX IF NOT EXISTS idx_payslip_emp_period  ON PAYSLIP(employee_id, pay_period);
CREATE INDEX IF NOT EXISTS idx_session_employee    ON SESSION(employee_id);
