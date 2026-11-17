'use strict';
// Process 0.4.3 Generate Offer Letter — UC-19 · FR-19 · NFR-19 (Recruitment Officer)
const express = require('express');
const { getDb } = require('../../db');
const dates = require('../../lib/dates');
const { nextId } = require('../../lib/ids');
const { ok } = require('../../lib/result');
const f = require('../../lib/fields');
const { validate } = require('../../middleware/validate');
const { auditFailures, auditActor } = require('../../middleware/audit');
const { badRequest, conflict, notFound, unprocessable } = require('../../middleware/errors');
const { renderOfferLetter } = require('./letter');

const { z } = f;
const COLUMNS = `o.offer_id, o.candidate_id, o.vacancy_id, o.offer_position, o.offered_salary, o.joining_date,
  o.offer_issue_date, o.offer_status`;

/** Offer row + candidate name + vacancy department (DS-29 Offer Record, DS-30 Offer Letter). */
function getById(db, offerId) {
  return db
    .prepare(
      `SELECT ${COLUMNS}, c.candidate_name, c.candidate_email, v.department FROM OFFER o
         JOIN CANDIDATE c ON c.candidate_id = o.candidate_id
         JOIN VACANCY v   ON v.vacancy_id = o.vacancy_id
        WHERE o.offer_id = ?`
    )
    .get(offerId);
}

// UC-19 | FR-19 | Process 0.4.3 | BR-14, BR-28 | NFR-19
function create(db, actor, input) {
  return db.transaction(() => {
    // DS-28 Selected Candidate Details
    const candidate = db
      .prepare(
        `SELECT c.candidate_id, c.vacancy_id, v.job_title FROM CANDIDATE c
           JOIN VACANCY v ON v.vacancy_id = c.vacancy_id WHERE c.candidate_id = ?`
      )
      .get(input.candidate_id);
    if (!candidate) throw notFound(`Candidate ${input.candidate_id} not found`);

    // BR-14: the candidate's latest interview must be Selected
    const latest = db
      .prepare(
        `SELECT interview_id, interview_status FROM INTERVIEW_SCHEDULE WHERE candidate_id = ?
          ORDER BY interview_date DESC, interview_time DESC, interview_id DESC LIMIT 1`
      )
      .get(candidate.candidate_id);
    if (!latest || latest.interview_status !== 'Selected') {
      throw conflict(
        `An offer can be generated only for a Selected candidate; candidate ${candidate.candidate_id}'s latest interview is ` +
          (latest ? `${latest.interview_status} (${latest.interview_id})` : 'missing')
      );
    }

    // DE-068: offered position must match the vacancy's job title
    if (input.offer_position !== undefined && input.offer_position !== candidate.job_title) {
      throw badRequest(`Offered position must match the vacancy's job title "${candidate.job_title}"`, [
        { field: 'body.offer_position', message: `Must be "${candidate.job_title}"` },
      ]);
    }

    // DE-070: joining date after the offer issue date (system date, DE-072)
    const issueDate = dates.today();
    if (!(input.joining_date > issueDate)) {
      throw unprocessable('Joining date is invalid', [
        { field: 'body.joining_date', message: `Joining date must be after the offer issue date ${issueDate}` },
      ]);
    }

    // ASSUMPTION A-1: one offer per candidate
    const existing = db.prepare('SELECT offer_id FROM OFFER WHERE candidate_id = ?').get(candidate.candidate_id);
    if (existing) throw conflict(`Candidate ${candidate.candidate_id} already has offer ${existing.offer_id}`);

    const offerId = nextId(db, 'OFFER');
    db.prepare(
      `INSERT INTO OFFER (offer_id, candidate_id, vacancy_id, offer_position, offered_salary, joining_date, offer_issue_date, offer_status)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'Issued')`
    ).run(offerId, candidate.candidate_id, candidate.vacancy_id, candidate.job_title, input.offered_salary, input.joining_date, issueDate);
    // offered salary is restricted - not logged
    auditActor(db, actor, { action: 'CREATE', entity: 'OFFER', entity_id: offerId, detail: { candidate_id: candidate.candidate_id } });
    return getById(db, offerId);
  })();
}

// UC-19 | FR-19 | Process 0.4.3 | NFR-19
function list(db, { status, vacancy_id: vacancyId }) {
  const where = [];
  const params = [];
  if (status) {
    where.push('o.offer_status = ?');
    params.push(status);
  }
  if (vacancyId) {
    where.push('o.vacancy_id = ?');
    params.push(vacancyId);
  }
  return db
    .prepare(
      `SELECT ${COLUMNS}, c.candidate_name, c.candidate_email, v.department FROM OFFER o
         JOIN CANDIDATE c ON c.candidate_id = o.candidate_id
         JOIN VACANCY v   ON v.vacancy_id = o.vacancy_id
        ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY o.offer_id`
    )
    .all(...params);
}

// UC-19 | FR-19 | Process 0.4.3 | NFR-19
function get(db, offerId) {
  const o = getById(db, offerId);
  if (!o) throw notFound(`Offer ${offerId} not found`);
  return o;
}

// UC-19 | FR-19 | Process 0.4.3 | NFR-19 — DE-073 domain validation only
function setStatus(db, actor, offerId, status) {
  return db.transaction(() => {
    const o = get(db, offerId);
    db.prepare('UPDATE OFFER SET offer_status = ? WHERE offer_id = ?').run(status, offerId);
    auditActor(db, actor, { action: 'STATUS', entity: 'OFFER', entity_id: offerId, detail: { from: o.offer_status, to: status } });
    return getById(db, offerId);
  })();
}

// ---------------------------------------------------------------- routes

// DS-27 Offer Letter Information (DE-068 ... DE-070)
const createBody = z.strictObject({
  candidate_id: f.id('CANDIDATE', 'Candidate ID'),
  offered_salary: f.amount('Offered salary', { positive: true }),
  joining_date: f.isoDate('Joining date'),
  offer_position: f.notBlank('Offered position', 100).optional(),
});
const statusBody = z.strictObject({ offer_status: f.enumOf('Offer status', ['Issued', 'Accepted', 'Declined']) });
const listQuery = z.strictObject({
  status: f.enumOf('Status', ['Issued', 'Accepted', 'Declined']).optional(),
  vacancy_id: f.id('VACANCY', 'Vacancy ID').optional(),
});
const idParams = z.strictObject({ id: f.id('OFFER', 'Offer ID') });

const router = express.Router();

// UC-19 | FR-19 | Process 0.4.3 | BR-14, BR-28 | NFR-19
router.post('/', auditFailures('OFFER', 'CREATE'), validate({ body: createBody }), (req, res) => {
  const o = create(getDb(), req.user, req.body);
  return ok(res, { status: 201, reference_id: o.offer_id, message: 'Offer generated', data: o });
});

// UC-19 | FR-19 | Process 0.4.3 | NFR-19
router.get('/', validate({ query: listQuery }), (req, res) => {
  const rows = list(getDb(), req.validQuery);
  return ok(res, { message: `${rows.length} offer(s)`, data: rows });
});

// UC-19 | FR-19 | Process 0.4.3 | NFR-19
router.get('/:id', validate({ params: idParams }), (req, res) => {
  const o = get(getDb(), req.params.id);
  return ok(res, { reference_id: o.offer_id, message: 'Offer', data: o });
});

// UC-19 | FR-19 | Process 0.4.3 | BR-29 | NFR-19 — printable letter rendered only from the stored OFFER row
router.get('/:id/letter', validate({ params: idParams }), (req, res) => {
  const o = get(getDb(), req.params.id);
  res.set('Cache-Control', 'no-store');
  return res.status(200).type('html').send(renderOfferLetter(o));
});

// UC-19 | FR-19 | Process 0.4.3 | NFR-19
router.patch('/:id/status', auditFailures('OFFER', 'STATUS'), validate({ params: idParams, body: statusBody }), (req, res) => {
  const o = setStatus(getDb(), req.user, req.params.id, req.body.offer_status);
  return ok(res, { reference_id: o.offer_id, message: `Offer ${o.offer_status}`, data: o });
});

module.exports = { router };
