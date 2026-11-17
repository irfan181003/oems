'use strict';
// npm run seed - idempotent demo data (BACKEND_PROMPT section 10): one user per role, two months of
// attendance, leave in every status, 2 vacancies, 3 candidates, interviews, an offer, a retirement plan
// and one processed payroll month with payslips.
// ASSUMPTION A-2: roles other than Employee exist only through this seed.
const bcrypt = require('bcryptjs');
const config = require('../src/config');
const dates = require('../src/lib/dates');

const SEED_EMPLOYEES = [
  { employee_id: 'EMP00001', role: 'HR Manager', employee_name: 'Anita Sharma', date_of_birth: '1985-04-12', gender: 'F',
    contact_number: '9876500001', email: 'anita.sharma@example.com', address: '12 MG Road, Kolkata',
    department: 'HR', designation: 'HR Manager', date_of_joining: '2015-06-01', basic_salary: 85000, bank_account: '100200300001' },
  { employee_id: 'EMP00002', role: 'Recruitment Officer', employee_name: 'Rahul Verma', date_of_birth: '1990-09-23', gender: 'M',
    contact_number: '9876500002', email: 'rahul.verma@example.com', address: '45 Park Street, Kolkata',
    department: 'Recruitment', designation: 'Recruitment Officer', date_of_joining: '2018-03-15', basic_salary: 55000, bank_account: '100200300002' },
  { employee_id: 'EMP00003', role: 'Payroll Officer', employee_name: 'Priya Nair', date_of_birth: '1988-01-30', gender: 'F',
    contact_number: '9876500003', email: 'priya.nair@example.com', address: '7 Salt Lake Sector V, Kolkata',
    department: 'Payroll', designation: 'Payroll Officer', date_of_joining: '2017-08-01', basic_salary: 60000, bank_account: '100200300003' },
  { employee_id: 'EMP00004', role: 'Finance Manager', employee_name: 'Vikram Singh', date_of_birth: '1982-11-05', gender: 'M',
    contact_number: '9876500004', email: 'vikram.singh@example.com', address: '3 Camac Street, Kolkata',
    department: 'Finance', designation: 'Finance Manager', date_of_joining: '2014-01-10', basic_salary: 95000, bank_account: '100200300004' },
  { employee_id: 'EMP00005', role: 'Employee', employee_name: 'Sneha Das', date_of_birth: '1996-02-14', gender: 'F',
    contact_number: '9876500005', email: 'sneha.das@example.com', address: '21 Lake Town, Kolkata',
    department: 'Engineering', designation: 'Software Engineer', date_of_joining: '2021-07-01', basic_salary: 48000, bank_account: '100200300005' },
  { employee_id: 'EMP00006', role: 'Employee', employee_name: 'Arjun Mehta', date_of_birth: '1994-06-08', gender: 'M',
    contact_number: '9876500006', email: 'arjun.mehta@example.com', address: '9 Ballygunge Place, Kolkata',
    department: 'Engineering', designation: 'Senior Engineer', date_of_joining: '2019-02-18', basic_salary: 65000, bank_account: '100200300006' },
  { employee_id: 'EMP00007', role: 'Employee', employee_name: 'Fatima Khan', date_of_birth: '1998-12-01', gender: 'F',
    contact_number: '9876500007', email: 'fatima.khan@example.com', address: '14 New Market Road, Kolkata',
    department: 'Sales', designation: 'Sales Executive', date_of_joining: '2022-04-04', basic_salary: 22000, bank_account: '100200300007' },
  { employee_id: 'EMP00008', role: 'Employee', employee_name: 'Rohan Gupta', date_of_birth: '1992-03-19', gender: 'M',
    contact_number: '9876500008', email: 'rohan.gupta@example.com', address: '30 Gariahat Road, Kolkata',
    department: 'Operations', designation: 'Operations Analyst', date_of_joining: '2020-09-14', basic_salary: 38000, bank_account: '100200300008' },
  { employee_id: 'EMP00009', role: 'Employee', employee_name: 'Kavya Iyer', date_of_birth: '1997-07-25', gender: 'F',
    contact_number: '9876500009', email: 'kavya.iyer@example.com', address: '5 Rashbehari Avenue, Kolkata',
    department: 'Finance', designation: 'Accounts Executive', date_of_joining: '2023-01-02', basic_salary: 30000, bank_account: '100200300009' },
  { employee_id: 'EMP00010', role: 'Employee', employee_name: 'Sam Roy', date_of_birth: '1995-10-10', gender: 'O',
    contact_number: '9876500010', email: 'sam.roy@example.com', address: '18 Dum Dum Road, Kolkata',
    department: 'Engineering', designation: 'QA Engineer', date_of_joining: '2021-11-22', basic_salary: 42000, bank_account: '100200300010' },
];

/** Insert the seed employees and their user accounts (skips rows that already exist). Returns rows inserted. */
function seedUsers(db, password) {
  if (!password) throw new Error('SEED_PASSWORD is not set (see .env.example)');
  const created = dates.today();
  const insertEmp = db.prepare(
    `INSERT OR IGNORE INTO EMPLOYEE
       (employee_id, employee_name, date_of_birth, gender, contact_number, email, address, department,
        designation, date_of_joining, basic_salary, bank_account, employment_status, record_created_date)
     VALUES (@employee_id, @employee_name, @date_of_birth, @gender, @contact_number, @email, @address, @department,
             @designation, @date_of_joining, @basic_salary, @bank_account, 'Active', @record_created_date)`
  );
  const hasAccount = db.prepare('SELECT 1 FROM USER_ACCOUNT WHERE employee_id = ?');
  const insertAcc = db.prepare(
    'INSERT INTO USER_ACCOUNT (employee_id, password_hash, role, is_active) VALUES (?, ?, ?, 1)'
  );
  // Hash outside the transaction (bcrypt is CPU-bound); only for accounts that are missing.
  const toCreate = SEED_EMPLOYEES.filter((e) => !hasAccount.get(e.employee_id)).map((e) => ({
    ...e,
    hash: bcrypt.hashSync(password, config.bcryptRounds),
  }));
  let employees = 0;
  db.transaction(() => {
    for (const e of SEED_EMPLOYEES) {
      const { role, ...row } = e; // eslint-disable-line no-unused-vars
      employees += insertEmp.run({ ...row, record_created_date: created }).changes;
    }
    for (const e of toCreate) insertAcc.run(e.employee_id, e.hash, e.role);
  })();
  return { employees, accounts: toCreate.length };
}

// ---------------------------------------------------------------- demo data (section 10)
// Each section runs only when its table(s) are empty, so the seed is idempotent.
// Past-dated rows are inserted directly (the API correctly refuses past dates);
// payroll and payslips go through the real services so amounts come from the real calculator.

const count = (db, table) => db.prepare(`SELECT COUNT(*) AS n FROM ${table}`).get().n;

function prevPeriod(period, n) {
  let [y, m] = period.split('-').map(Number);
  m -= n;
  while (m < 1) {
    m += 12;
    y -= 1;
  }
  return `${y}-${String(m).padStart(2, '0')}`;
}

/** Monday-Friday dates of a YYYY-MM period. */
function weekdays(period) {
  const { start, end } = dates.periodBounds(period);
  const out = [];
  for (let d = start; d <= end; d = dates.addDays(d, 1)) {
    const dow = new Date(`${d}T00:00:00Z`).getUTCDay();
    if (dow !== 0 && dow !== 6) out.push(d);
  }
  return out;
}

const actorOf = (employeeId) => {
  const e = SEED_EMPLOYEES.find((x) => x.employee_id === employeeId);
  return { employee_id: e.employee_id, role: e.role, name: e.employee_name };
};

function seedLeaves(db, P, P2) {
  if (count(db, 'LEAVE_APPLICATION') > 0) return 0;
  const { nextId } = require('../src/lib/ids');
  const today = dates.today();
  const wP = weekdays(P);
  const wP2 = weekdays(P2);
  const rows = [
    // [employee, type, start, end, status, remarks]
    ['EMP00005', 'Casual', wP[5], wP[6], 'Approved', 'Approved'],
    ['EMP00006', 'Earned', wP[10], wP[10], 'Rejected', 'Project deadline that week'],
    ['EMP00007', 'Sick', wP2[3], wP2[4], 'Approved', 'Get well soon'],
    ['EMP00008', 'Unpaid', wP[12], wP[14], 'Approved', 'Approved as unpaid leave'],
    ['EMP00009', 'Casual', dates.addDays(today, 7), dates.addDays(today, 8), 'Pending', null],
    ['EMP00010', 'Sick', dates.addDays(today, 3), dates.addDays(today, 3), 'Pending', null],
  ];
  const ins = db.prepare(
    `INSERT INTO LEAVE_APPLICATION (leave_id, employee_id, leave_type, leave_start, leave_end, leave_days, leave_reason,
       applied_date, leave_status, approved_by, decision_date, hr_remarks)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );
  db.transaction(() => {
    for (const [emp, type, start, end, status, remarks] of rows) {
      const applied = status === 'Pending' ? today : dates.addDays(start, -3);
      const decided = status === 'Pending' ? null : dates.addDays(start, -2);
      ins.run(nextId(db, 'LEAVE_APPLICATION'), emp, type, start, end, dates.daysInclusive(start, end), `${type} leave (demo)`,
        applied, status, status === 'Pending' ? null : 'EMP00001', decided, remarks);
    }
  })();
  return rows.length;
}

function seedAttendance(db, periods) {
  if (count(db, 'ATTENDANCE') > 0) return 0;
  const onLeave = db.prepare(
    "SELECT 1 FROM LEAVE_APPLICATION WHERE employee_id = ? AND leave_status = 'Approved' AND ? BETWEEN leave_start AND leave_end"
  );
  const ins = db.prepare(
    `INSERT INTO ATTENDANCE (attendance_id, employee_id, att_date, checkin_time, checkout_time, att_status, recorded_ts)
     VALUES (?, ?, ?, ?, ?, 'Present', ?)`
  );
  const { formatId, nextId } = require('../src/lib/ids');
  let seq = Number(nextId(db, 'ATTENDANCE').slice(3));
  let n = 0;
  db.transaction(() => {
    for (const period of periods) {
      weekdays(period).forEach((d, dayIdx) => {
        SEED_EMPLOYEES.forEach((e, empIdx) => {
          if (onLeave.get(e.employee_id, d)) return;
          if ((dayIdx * 7 + empIdx * 3) % 17 === 0) return; // a few absences
          const inMin = (dayIdx + empIdx) % 30;
          const outMin = (dayIdx * 3 + empIdx) % 60;
          const checkin = `09:${String(inMin).padStart(2, '0')}:00`;
          const checkout = `${17 + (outMin % 2)}:${String(outMin).padStart(2, '0')}:00`;
          ins.run(formatId('ATTENDANCE', seq), e.employee_id, d, checkin, checkout, `${d} ${checkout}`);
          seq += 1;
          n += 1;
        });
      });
    }
  })();
  return n;
}

function seedRecruitment(db) {
  if (count(db, 'VACANCY') > 0) return false;
  const today = dates.today();
  db.transaction(() => {
    const v = db.prepare(
      'INSERT INTO VACANCY (vacancy_id, job_title, department, positions, qualifications, vacancy_status, posted_date) VALUES (?, ?, ?, ?, ?, ?, ?)'
    );
    v.run('VAC00001', 'Backend Developer', 'Engineering', 2, 'B.Tech/MCA; 2+ years with Node.js and SQL', 'Open', dates.addDays(today, -20));
    v.run('VAC00002', 'Sales Executive', 'Sales', 1, 'Graduate; 1+ year field sales experience', 'Open', dates.addDays(today, -15));
    const c = db.prepare('INSERT INTO CANDIDATE (candidate_id, vacancy_id, candidate_name, candidate_email, candidate_phone) VALUES (?, ?, ?, ?, ?)');
    c.run('CAN00001', 'VAC00001', 'Priya Sen', 'priya.sen@example.com', '9830000001');
    c.run('CAN00002', 'VAC00001', 'Amit Bose', 'amit.bose@example.com', '9830000002');
    c.run('CAN00003', 'VAC00002', 'Ritu Ghosh', 'ritu.ghosh@example.com', null);
    const i = db.prepare(
      `INSERT INTO INTERVIEW_SCHEDULE (interview_id, candidate_id, vacancy_id, interview_date, interview_time, interview_venue, interviewer_name, interview_status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    );
    i.run('INT0000001', 'CAN00001', 'VAC00001', dates.addDays(today, -5), '10:00', 'Conference Room 1', 'Rahul Verma', 'Selected');
    i.run('INT0000002', 'CAN00002', 'VAC00001', dates.addDays(today, 3), '11:00', 'Conference Room 1', 'Rahul Verma', 'Scheduled');
    i.run('INT0000003', 'CAN00003', 'VAC00002', dates.addDays(today, 4), '15:00', 'Online meeting', 'Rahul Verma', 'Scheduled');
    db.prepare(
      `INSERT INTO OFFER (offer_id, candidate_id, vacancy_id, offer_position, offered_salary, joining_date, offer_issue_date, offer_status)
       VALUES ('OFR0000001', 'CAN00001', 'VAC00001', 'Backend Developer', 60000, ?, ?, 'Issued')`
    ).run(dates.addDays(today, 30), dates.addDays(today, -2));
  })();
  return true;
}

function seedRetirement(db) {
  if (count(db, 'RETIREMENT_PLAN') > 0) return false;
  db.prepare(
    `INSERT INTO RETIREMENT_PLAN (ret_plan_id, employee_id, retirement_date, plan_type, contribution_amount, nominee_name, plan_status)
     VALUES ('RP000001', 'EMP00004', '2042-11-05', 'Provident Fund', 5000, 'Meera Singh', 'Active')`
  ).run();
  return true;
}

function seedPayroll(db, P) {
  if (count(db, 'PAYROLL') > 0) return null;
  const { runPayroll } = require('../src/modules/payroll/service');
  const payslips = require('../src/modules/payslips/service');
  const lines = db
    .prepare("SELECT employee_id FROM EMPLOYEE WHERE employment_status = 'Active' ORDER BY employee_id")
    .all()
    .map((e, idx) => ({ employee_id: e.employee_id, allowances_paise: (1000 + 500 * (idx % 3)) * 100, other_deductions_paise: idx % 4 === 0 ? 20000 : 0 }));
  const run = runPayroll(db, actorOf('EMP00003'), { pay_period: P, working_days: weekdays(P).length, lines });
  const slips = payslips.generate(db, actorOf('EMP00003'), { pay_period: P });
  return { pay_period: P, processed: run.employees_processed, failed: run.failed.length, payslips: slips.payslip_count };
}

/** Demo data relative to today: the two previous months of attendance, one processed payroll month. */
function seedDemoData(db) {
  const cur = dates.currentPeriod();
  const P = prevPeriod(cur, 1);
  const P2 = prevPeriod(cur, 2);
  const leaves = seedLeaves(db, P, P2);
  const attendance = seedAttendance(db, [P2, P]);
  return {
    leaves,
    attendance,
    recruitment: seedRecruitment(db),
    retirement_plan: seedRetirement(db),
    payroll: seedPayroll(db, P),
  };
}

function seedAll(db, password) {
  return { users: seedUsers(db, password), demo: seedDemoData(db) };
}

if (require.main === module) {
  const { getDb, closeDb } = require('../src/db');
  try {
    const result = seedAll(getDb(), config.seedPassword);
    console.log(`Seed complete (${config.dbFile}):`, JSON.stringify(result));
    console.log('Demo logins (password = SEED_PASSWORD):');
    for (const e of SEED_EMPLOYEES) console.log(`  ${e.employee_id}  ${e.role.padEnd(20)} ${e.email}`);
  } catch (err) {
    console.error('Seed failed:', err.message);
    process.exitCode = 1;
  } finally {
    closeDb();
  }
}

module.exports = { SEED_EMPLOYEES, seedUsers, seedDemoData, seedAll, weekdays, prevPeriod };
