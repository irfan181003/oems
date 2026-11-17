// Field rules shared by Register Employee and the Employee record editor (BACKEND_PROMPT §8, DD DE-028...DE-040)
import { addYears } from '../../lib/serverDate';
import { bankAccount, contactNumber, email, employeeName, isoDate, money, notBlank, required } from '../../lib/validators';
import { DEPARTMENTS, LABELS } from '../../lib/labels';

/** DE-030 / DE-037: at least 18 on the Date of Joining; DOB not in the future. */
export function ageRule(today) {
  return (doj, all) => {
    if (!all.date_of_birth || !doj) return '';
    if (today && all.date_of_birth > today) return '';
    return doj < addYears(all.date_of_birth, 18) ? 'Employee must be at least 18 years old on the Date of Joining' : '';
  };
}

export function rules(today) {
  return {
    employee_name: employeeName,
    date_of_birth: [isoDate(LABELS.date_of_birth), (v) => (today && v > today ? 'Date of Birth must not be in the future' : '')],
    gender: required(LABELS.gender),
    contact_number: contactNumber,
    email,
    address: notBlank(LABELS.address, 200),
    department: (v) => (DEPARTMENTS.includes(v) ? '' : 'Choose an existing department'),
    designation: notBlank(LABELS.designation, 50),
    date_of_joining: [isoDate(LABELS.date_of_joining), ageRule(today)],
    basic_salary: money(LABELS.basic_salary, { positive: true }),
    bank_account: bankAccount,
    employment_status: required(LABELS.employment_status),
  };
}

export const REGISTRATION_FIELDS = [
  'employee_name',
  'date_of_birth',
  'gender',
  'contact_number',
  'email',
  'address',
  'department',
  'designation',
  'date_of_joining',
  'basic_salary',
  'bank_account',
];
export const EDITABLE_FIELDS = [...REGISTRATION_FIELDS, 'employment_status'];
