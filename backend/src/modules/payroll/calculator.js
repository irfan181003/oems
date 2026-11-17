'use strict';
// UC-12 | FR-12 | Process 0.5.2 Calculate Salary | BR-16, BR-17, BR-28 | NFR-12
// PURE and DETERMINISTIC: no database, no clock, no randomness, no I/O. Integer paise only.
// Same inputs always give the same output (BR-16).
//
// BR-17 (Proposed):
//   unpaid_absence   = max(0, working_days - days_present - paid_leave_days)
//   earned_basic     = basic * (working_days - unpaid_absence) / working_days
//   gross            = earned_basic + allowances
//   pf               = PF rate x earned_basic                      (ASSUMPTION A-6)
//   tax              = slab rate x gross                           (ASSUMPTION A-6)
//   total_deductions = tax + pf + other_deductions                 (ASSUMPTION A-6: loss of pay is only in gross)
//   net              = gross - total_deductions
// Each line is rounded half-up to the paisa.
const RULES = require('./rules');

class CalculationError extends Error {}

/** Round a / b half-up, for non-negative integers a and b > 0. */
function roundDiv(a, b) {
  return Math.floor((2 * a + b) / (2 * b));
}

function requireInt(name, v, min) {
  if (!Number.isSafeInteger(v) || v < min) throw new CalculationError(`${name} must be an integer >= ${min}`);
}

function taxRateBp(grossPaise) {
  for (const slab of RULES.TAX_SLABS) if (grossPaise <= slab.upToPaise) return slab.rateBp;
  throw new CalculationError('No tax slab'); // unreachable: last slab is unbounded
}

/**
 * @param {object} i DS-35 Consolidated Payroll Inputs, money in integer paise:
 *   basic_salary_paise, working_days, days_present, paid_leave_days, allowances_paise, other_deductions_paise
 * @returns {object} DS-36 Calculated Salary (paise): unpaid_absence_days, earned_basic_paise, gross_paise,
 *   tax_paise, pf_paise, other_deductions_paise, total_deductions_paise, net_paise
 * @throws {CalculationError} invalid input or negative net (BR-17 "run stopped for that employee")
 */
function calculateSalary(i) {
  if (!i || typeof i !== 'object') throw new CalculationError('Inputs are required');
  requireInt('basic_salary_paise', i.basic_salary_paise, 1); // basic > 0
  requireInt('working_days', i.working_days, 1);
  requireInt('days_present', i.days_present, 0);
  requireInt('paid_leave_days', i.paid_leave_days, 0);
  requireInt('allowances_paise', i.allowances_paise, 0); // BR-28
  requireInt('other_deductions_paise', i.other_deductions_paise, 0); // BR-28

  const unpaid = Math.max(0, i.working_days - i.days_present - i.paid_leave_days);
  const payableDays = i.working_days - unpaid;
  const earnedBasic = roundDiv(i.basic_salary_paise * payableDays, i.working_days);
  const gross = earnedBasic + i.allowances_paise;
  const pf = roundDiv(earnedBasic * RULES.PF_RATE_BP, 10000);
  const tax = roundDiv(gross * taxRateBp(gross), 10000);
  const totalDeductions = tax + pf + i.other_deductions_paise;
  const net = gross - totalDeductions;
  if (net < 0) throw new CalculationError('Net salary would be negative (deductions exceed gross)'); // BR-28

  return Object.freeze({
    unpaid_absence_days: unpaid,
    earned_basic_paise: earnedBasic,
    gross_paise: gross,
    tax_paise: tax,
    pf_paise: pf,
    other_deductions_paise: i.other_deductions_paise,
    total_deductions_paise: totalDeductions,
    net_paise: net,
  });
}

module.exports = { calculateSalary, CalculationError, roundDiv };
