'use strict';
// ASSUMPTION A-6 — Proposed — not specified in sources.
// BR-17 gives the salary formula as "Proposed"; the PF rate, tax slabs and which leave types are
// paid are not stated anywhere in the documents. They are kept here, in one place, so they can be
// changed without touching the calculator. Rates are in basis points (1 % = 100 bp); money in paise.

const RULES = Object.freeze({
  /** Provident Fund: 12 % of the earned basic. */
  PF_RATE_BP: 1200,

  /**
   * Income tax on gross salary (flat rate of the slab the gross falls in):
   *   gross <= 25,000 -> 0 % ; 25,000 < gross <= 50,000 -> 5 % ; gross > 50,000 -> 10 %
   */
  TAX_SLABS: Object.freeze([
    Object.freeze({ upToPaise: 25_000_00, rateBp: 0 }),
    Object.freeze({ upToPaise: 50_000_00, rateBp: 500 }),
    Object.freeze({ upToPaise: Number.POSITIVE_INFINITY, rateBp: 1000 }),
  ]),

  /** Approved leave of these types counts as paid; 'Unpaid' counts as unpaid absence. */
  PAID_LEAVE_TYPES: Object.freeze(['Casual', 'Sick', 'Earned']),
});

module.exports = RULES;
