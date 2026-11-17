'use strict';
// ASSUMPTION A-8: the documents require an "existing department" but give no list.
// This fixed list is used for EMPLOYEE.department and VACANCY.department.
const DEPARTMENTS = Object.freeze([
  'HR',
  'Finance',
  'Engineering',
  'Sales',
  'Operations',
  'Recruitment',
  'Payroll',
]);

function isDepartment(value) {
  return DEPARTMENTS.includes(value);
}

module.exports = { DEPARTMENTS, isDepartment };
