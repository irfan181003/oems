// Single source of the role -> menu permission matrix (BACKEND_PROMPT §4, FRONTEND_PROMPT §4).
// The UI hides what a role cannot use; the backend remains the real gate (403 is always handled).

export const ROLES = Object.freeze({
  EMPLOYEE: 'Employee',
  HR: 'HR Manager',
  RECRUITMENT: 'Recruitment Officer',
  PAYROLL: 'Payroll Officer',
  FINANCE: 'Finance Manager',
});

export const ROLE_CONFIG = Object.freeze({
  [ROLES.EMPLOYEE]: {
    color: 'var(--role-employee)',
    home: '/employee',
    items: [
      { to: '/employee', label: 'Dashboard', end: true },
      { to: '/employee/attendance', label: 'Attendance' },
      { to: '/employee/leave/new', label: 'Apply Leave' },
      { to: '/employee/leave', label: 'My Leaves', end: true },
      { to: '/employee/profile', label: 'My Profile' },
      { to: '/employee/salary', label: 'My Salary' },
    ],
  },
  [ROLES.HR]: {
    color: 'var(--role-hr)',
    home: '/hr/employees',
    items: [
      { to: '/hr/employees', label: 'Employees', end: true },
      { to: '/hr/employees/new', label: 'Register Employee' },
      { to: '/hr/attendance', label: 'Attendance' },
      { to: '/hr/leaves', label: 'Leave Review' },
      { to: '/hr/retirement', label: 'Retirement Plans' },
      { to: '/hr/salary', label: 'Salary View' },
      { to: '/hr/reports', label: 'HR Reports' },
    ],
  },
  [ROLES.RECRUITMENT]: {
    color: 'var(--role-recruitment)',
    home: '/recruitment/vacancies',
    items: [
      { to: '/recruitment/vacancies', label: 'Vacancies' },
      { to: '/recruitment/candidates', label: 'Candidates' },
      { to: '/recruitment/interviews', label: 'Interviews' },
      { to: '/recruitment/offers', label: 'Offers' },
    ],
  },
  [ROLES.PAYROLL]: {
    color: 'var(--role-payroll)',
    home: '/payroll/run',
    items: [
      { to: '/payroll/run', label: 'Run Payroll' },
      { to: '/payroll/records', label: 'Payroll Records' },
      { to: '/payroll/payslips', label: 'Payslips' },
      { to: '/payroll/salary', label: 'Salary View' },
    ],
  },
  [ROLES.FINANCE]: {
    color: 'var(--role-finance)',
    home: '/finance/salary',
    items: [
      { to: '/finance/salary', label: 'Salary View' },
      { to: '/finance/reports', label: 'Financial / Payroll Report' },
    ],
  },
});

export const homeFor = (role) => (ROLE_CONFIG[role] ? ROLE_CONFIG[role].home : '/login');
export const menuFor = (role) => (ROLE_CONFIG[role] ? ROLE_CONFIG[role].items : []);
export const colorFor = (role) => (ROLE_CONFIG[role] ? ROLE_CONFIG[role].color : 'var(--accent)');
