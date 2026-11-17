'use strict';
// Process 0.7 Generate Reports — UC-16, UC-17 (includes UC-02, UC-12, UC-15) · FR-16, FR-17 · NFR-16, NFR-17
const dates = require('../../lib/dates');
const money = require('../../lib/money');

const HR_REPORT_TYPES = Object.freeze(['Attendance', 'Leave', 'Headcount', 'Employee']);
const FINANCIAL_REPORT_TYPES = Object.freeze(['Payroll', 'Financial']);

/** DE-091 Report Title, generated from the report type and criteria. */
function reportTitle(kind, type, { from_date: from, to_date: to, department }) {
  let t = `${type} ${kind}Report`;
  if (department) t += ` - ${department}`;
  if (from && to) t += ` (${from} to ${to})`;
  return t;
}

function deptFilter(alias, department, params) {
  if (!department) return '';
  params.push(department);
  return ` AND ${alias}.department = ?`;
}

/** DE-092 Headcount: active employees in scope. */
function headcount(db, department) {
  const params = [];
  return db.prepare(`SELECT COUNT(*) AS n FROM EMPLOYEE e WHERE e.employment_status = 'Active'${deptFilter('e', department, params)}`).get(...params).n;
}

// ---------------------------------------------------------------- HR report (0.7.1) - no salary or bank data

function attendanceReport(db, { from_date: from, to_date: to, department }) {
  // DS-49 Attendance Report Data -> days present per employee
  const params = [from, to];
  const rows = db
    .prepare(
      `SELECT e.employee_id, e.employee_name, e.department, e.employment_status,
              COALESCE(SUM(CASE WHEN a.att_status = 'Present' THEN 1 ELSE 0 END), 0) AS days_present,
              COUNT(a.attendance_id) AS attendance_records
         FROM EMPLOYEE e
         LEFT JOIN ATTENDANCE a ON a.employee_id = e.employee_id AND a.att_date BETWEEN ? AND ?
        WHERE 1 = 1${deptFilter('e', department, params)}
        GROUP BY e.employee_id
       HAVING e.employment_status = 'Active' OR attendance_records > 0
        ORDER BY e.employee_id`
    )
    .all(...params);
  return {
    aggregates: {
      employees: rows.length,
      total_days_present: rows.reduce((s, r) => s + r.days_present, 0),
    },
    rows,
  };
}

function leaveReport(db, { from_date: from, to_date: to, department }) {
  // DS-48 Leave Summary Data: applications overlapping the period
  const params = [to, from];
  const rows = db
    .prepare(
      `SELECT l.leave_id, l.employee_id, e.employee_name, e.department, l.leave_type, l.leave_start, l.leave_end,
              l.leave_days, l.leave_status, l.applied_date, l.decision_date
         FROM LEAVE_APPLICATION l JOIN EMPLOYEE e ON e.employee_id = l.employee_id
        WHERE l.leave_start <= ? AND l.leave_end >= ?${deptFilter('e', department, params)}
        ORDER BY l.leave_start, l.leave_id`
    )
    .all(...params);
  const byType = {};
  const byStatus = { Pending: 0, Approved: 0, Rejected: 0 };
  for (const t of ['Casual', 'Sick', 'Earned', 'Unpaid']) byType[t] = { applications: 0, days: 0 };
  for (const r of rows) {
    byType[r.leave_type].applications += 1;
    byType[r.leave_type].days += r.leave_days;
    byStatus[r.leave_status] += 1;
  }
  return { aggregates: { applications: rows.length, by_type: byType, by_status: byStatus }, rows };
}

function headcountReport(db, { department }) {
  const params = [];
  const rows = db
    .prepare(
      `SELECT e.department, COUNT(*) AS headcount FROM EMPLOYEE e
        WHERE e.employment_status = 'Active'${deptFilter('e', department, params)}
        GROUP BY e.department ORDER BY e.department`
    )
    .all(...params);
  return { aggregates: { departments: rows.length }, rows };
}

function employeeReport(db, { department }) {
  // DS-47 Employee Summary Data — excludes salary and bank data (NFR-16, BR-22)
  const params = [];
  const rows = db
    .prepare(
      `SELECT e.employee_id, e.employee_name, e.department, e.designation, e.employment_status, e.date_of_joining
         FROM EMPLOYEE e WHERE 1 = 1${deptFilter('e', department, params)} ORDER BY e.employee_id`
    )
    .all(...params);
  const byStatus = { Active: 0, Resigned: 0, Retired: 0 };
  for (const r of rows) byStatus[r.employment_status] += 1;
  return { aggregates: { employees: rows.length, by_status: byStatus }, rows };
}

const HR_BUILDERS = { Attendance: attendanceReport, Leave: leaveReport, Headcount: headcountReport, Employee: employeeReport };

// UC-16 | FR-16 | Process 0.7.1 | BR-22 | NFR-16 — DS-50 HR Report
function hrReport(db, criteria) {
  const built = HR_BUILDERS[criteria.report_type](db, criteria);
  return {
    report_title: reportTitle('', criteria.report_type, criteria),
    report_type: criteria.report_type,
    generated_ts: dates.nowTs(), // DE-093
    from_date: criteria.from_date ?? null,
    to_date: criteria.to_date ?? null,
    department: criteria.department ?? null,
    headcount: headcount(db, criteria.department),
    ...built,
  };
}

// ---------------------------------------------------------------- Financial / payroll report (0.7.2 + 0.7.3)

// UC-17 (includes UC-02, UC-12, UC-15) | FR-17 | Process 0.7.2 | BR-23 | NFR-17 — DS-52 Compiled Payroll Report Data
function compilePayrollData(db, { from_date: from, to_date: to, department }) {
  const fromPeriod = from.slice(0, 7);
  const toPeriod = to.slice(0, 7);
  // DS-51 Payroll Summary Data: only Processed / Paid lines whose pay period falls in the range
  const pParams = [fromPeriod, toPeriod];
  const lines = db
    .prepare(
      `SELECT p.payroll_id, p.employee_id, e.employee_name, e.department, p.pay_period,
              p.gross_salary, p.total_deductions, p.net_salary, p.payroll_status
         FROM PAYROLL p JOIN EMPLOYEE e ON e.employee_id = p.employee_id
        WHERE p.payroll_status IN ('Processed', 'Paid') AND p.pay_period BETWEEN ? AND ?${deptFilter('e', department, pParams)}
        ORDER BY p.pay_period, e.department, p.employee_id`
    )
    .all(...pParams);
  // UC-02 include: attendance totals for the range (DS-33)
  const aParams = [from, to];
  const attendance = db
    .prepare(
      `SELECT e.department, COUNT(*) AS days_present FROM ATTENDANCE a JOIN EMPLOYEE e ON e.employee_id = a.employee_id
        WHERE a.att_status = 'Present' AND a.att_date BETWEEN ? AND ?${deptFilter('e', department, aParams)}
        GROUP BY e.department`
    )
    .all(...aParams);
  return { lines, attendance };
}

// UC-17 | FR-17 | Process 0.7.3 | BR-23 | NFR-17 — DS-53 Financial / Payroll Report (DE-094 ... DE-097)
function financialReport(db, criteria) {
  const { lines, attendance } = compilePayrollData(db, criteria);
  const depts = new Map();
  const dept = (name) => {
    if (!depts.has(name)) depts.set(name, { department: name, employees: new Set(), gross: 0, deductions: 0, net: 0, days_present: 0 });
    return depts.get(name);
  };
  let gross = 0;
  let deductions = 0;
  let net = 0;
  for (const l of lines) {
    const g = money.toPaise(l.gross_salary);
    const dd = money.toPaise(l.total_deductions);
    const n = money.toPaise(l.net_salary);
    gross += g;
    deductions += dd;
    net += n;
    const d = dept(l.department);
    d.employees.add(l.employee_id);
    d.gross += g;
    d.deductions += dd;
    d.net += n;
  }
  for (const a of attendance) dept(a.department).days_present = a.days_present;

  const departments = [...depts.values()]
    .sort((a, b) => a.department.localeCompare(b.department))
    .map((d) => ({
      department: d.department,
      employees_paid: d.employees.size,
      department_total_gross: money.fromPaise(d.gross), // DE-095
      department_total_deductions: money.fromPaise(d.deductions), // DE-096
      department_total_net: money.fromPaise(d.net), // DE-097
      days_present: d.days_present,
    }));

  const report = {
    report_title: reportTitle('', criteria.report_type, criteria),
    report_type: criteria.report_type,
    generated_ts: dates.nowTs(),
    from_date: criteria.from_date,
    to_date: criteria.to_date,
    department: criteria.department ?? null,
    pay_periods: [...new Set(lines.map((l) => l.pay_period))],
    payroll_lines: lines.length,
    total_payroll_cost: money.fromPaise(gross), // DE-094: sum of gross salary
    total_deductions: money.fromPaise(deductions),
    total_net: money.fromPaise(net),
    total_days_present: attendance.reduce((s, a) => s + a.days_present, 0),
    departments,
  };
  // 'Payroll' report lists each payroll line; 'Financial' report gives the totals only
  if (criteria.report_type === 'Payroll') report.rows = lines;
  return report;
}

module.exports = { HR_REPORT_TYPES, FINANCIAL_REPORT_TYPES, hrReport, compilePayrollData, financialReport };
