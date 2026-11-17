'use strict';
// npm run seed - idempotent demo data (BACKEND_PROMPT section 10).
// Phase 1: one user per role. Later phases add attendance, leave, recruitment, payroll data.
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

function seedAll(db, password) {
  return { users: seedUsers(db, password) };
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

module.exports = { SEED_EMPLOYEES, seedUsers, seedAll };
