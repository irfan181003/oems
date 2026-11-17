'use strict';
// Process 0.4.2 Schedule Interviews — UC-10 · FR-10 · NFR-10 (Recruitment Officer)
const express = require('express');
const { getDb } = require('../../db');
const dates = require('../../lib/dates');
const { nextId } = require('../../lib/ids');
const { ok } = require('../../lib/result');
const f = require('../../lib/fields');
const { validate } = require('../../middleware/validate');
const { auditFailures, auditActor } = require('../../middleware/audit');
const { conflict, notFound, unprocessable } = require('../../middleware/errors');

const { z } = f;
const STATUSES = ['Scheduled', 'Completed', 'Selected', 'Rejected', 'Cancelled'];
const COLUMNS = `i.interview_id, i.candidate_id, i.vacancy_id, i.interview_date, i.interview_time, i.interview_venue,
  i.interviewer_name, i.interview_status`;

/** DS-25 / DS-26 Interview Schedule Record + Interview Confirmation (with candidate name and job title). */
function getById(db, interviewId) {
  return db
    .prepare(
      `SELECT ${COLUMNS}, c.candidate_name, v.job_title FROM INTERVIEW_SCHEDULE i
         JOIN CANDIDATE c ON c.candidate_id = i.candidate_id
         JOIN VACANCY v   ON v.vacancy_id = i.vacancy_id
        WHERE i.interview_id = ?`
    )
    .get(interviewId);
}

/** DE-059 / DE-060: interview date and time not in the past (server clock). */
function assertNotPast(date, time) {
  const now = `${dates.today()} ${dates.nowTime().slice(0, 5)}`;
  if (`${date} ${time}` <= now) {
    throw unprocessable('Interview slot is in the past', [
      { field: 'body.interview_date', message: 'Interview date and time must be later than now' },
    ]);
  }
}

/** BR-13: no other (non-cancelled) interview for the same candidate or the same venue at the same date+time. */
function assertNoClash(db, { candidate_id: candidateId, interview_date: date, interview_time: time, interview_venue: venue }, exceptId = null) {
  const clash = db
    .prepare(
      `SELECT interview_id, candidate_id FROM INTERVIEW_SCHEDULE
        WHERE interview_date = ? AND interview_time = ? AND interview_status <> 'Cancelled'
          AND (candidate_id = ? OR interview_venue = ? COLLATE NOCASE)
          AND interview_id IS NOT ?
        LIMIT 1`
    )
    .get(date, time, candidateId, venue, exceptId);
  if (clash) {
    const who = clash.candidate_id === candidateId ? 'this candidate' : 'this venue';
    throw conflict(`The slot ${date} ${time} is already booked for ${who} (${clash.interview_id}); please choose another date, time or venue`);
  }
}

// UC-10 | FR-10 | Process 0.4.2 | BR-13 | NFR-10
function create(db, actor, input) {
  return db.transaction(() => {
    // DE-058: candidate must exist in CANDIDATE
    const candidate = db.prepare('SELECT candidate_id, vacancy_id FROM CANDIDATE WHERE candidate_id = ?').get(input.candidate_id);
    if (!candidate) throw notFound(`Candidate ${input.candidate_id} not found`);
    if (input.vacancy_id && input.vacancy_id !== candidate.vacancy_id) {
      throw unprocessable('Vacancy does not match the candidate', [
        { field: 'body.vacancy_id', message: `Candidate ${candidate.candidate_id} applied for vacancy ${candidate.vacancy_id}` },
      ]);
    }
    assertNotPast(input.interview_date, input.interview_time);
    assertNoClash(db, input);

    const interviewId = nextId(db, 'INTERVIEW_SCHEDULE');
    db.prepare(
      `INSERT INTO INTERVIEW_SCHEDULE
         (interview_id, candidate_id, vacancy_id, interview_date, interview_time, interview_venue, interviewer_name, interview_status)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'Scheduled')`
    ).run(
      interviewId,
      candidate.candidate_id,
      candidate.vacancy_id,
      input.interview_date,
      input.interview_time,
      input.interview_venue,
      input.interviewer_name ?? null
    );
    auditActor(db, actor, { action: 'SCHEDULE', entity: 'INTERVIEW_SCHEDULE', entity_id: interviewId, detail: { candidate_id: candidate.candidate_id } });
    return getById(db, interviewId);
  })();
}

// UC-10 | FR-10 | Process 0.4.2 | NFR-10
function list(db, { vacancy_id: vacancyId, candidate_id: candidateId, date }) {
  const where = [];
  const params = [];
  if (vacancyId) {
    where.push('i.vacancy_id = ?');
    params.push(vacancyId);
  }
  if (candidateId) {
    where.push('i.candidate_id = ?');
    params.push(candidateId);
  }
  if (date) {
    where.push('i.interview_date = ?');
    params.push(date);
  }
  return db
    .prepare(
      `SELECT ${COLUMNS}, c.candidate_name, v.job_title FROM INTERVIEW_SCHEDULE i
         JOIN CANDIDATE c ON c.candidate_id = i.candidate_id
         JOIN VACANCY v   ON v.vacancy_id = i.vacancy_id
        ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
        ORDER BY i.interview_date, i.interview_time, i.interview_id`
    )
    .all(...params);
}

// UC-10 | FR-10 | Process 0.4.2 | NFR-10
function get(db, interviewId) {
  const i = getById(db, interviewId);
  if (!i) throw notFound(`Interview ${interviewId} not found`);
  return i;
}

// UC-10 | FR-10 | Process 0.4.2 | BR-13 | NFR-10 — reschedule and/or change status
function update(db, actor, interviewId, changes) {
  return db.transaction(() => {
    const current = get(db, interviewId);
    const merged = { ...current, ...changes };
    const slotChanged = ['interview_date', 'interview_time', 'interview_venue'].some((k) => k in changes);
    const reactivated = current.interview_status === 'Cancelled' && merged.interview_status !== 'Cancelled';
    if ('interview_date' in changes || 'interview_time' in changes) assertNotPast(merged.interview_date, merged.interview_time);
    if ((slotChanged || reactivated) && merged.interview_status !== 'Cancelled') assertNoClash(db, merged, interviewId);

    const fields = Object.keys(changes);
    db.prepare(`UPDATE INTERVIEW_SCHEDULE SET ${fields.map((k) => `${k} = @${k}`).join(', ')} WHERE interview_id = @__id`).run({
      ...changes,
      __id: interviewId,
    });
    auditActor(db, actor, {
      action: slotChanged ? 'RESCHEDULE' : 'UPDATE',
      entity: 'INTERVIEW_SCHEDULE',
      entity_id: interviewId,
      detail: { fields, ...(changes.interview_status ? { status: changes.interview_status } : {}) },
    });
    return getById(db, interviewId);
  })();
}

// ---------------------------------------------------------------- routes

// DS-23 Interview Schedule Details (DE-058 ... DE-062)
const slotFields = {
  interview_date: f.isoDate('Interview date'),
  interview_time: f.timeOfDay('Interview time'),
  interview_venue: f.notBlank('Interview venue', 150),
  interviewer_name: f.text('Interviewer name').trim().max(100, 'Interviewer name must be at most 100 characters').nullable(),
};
const createBody = z.strictObject({
  candidate_id: f.id('CANDIDATE', 'Candidate ID'),
  vacancy_id: f.id('VACANCY', 'Vacancy ID').optional(),
  ...slotFields,
  interviewer_name: slotFields.interviewer_name.optional(),
});
const updateBody = z
  .strictObject({ ...slotFields, interview_status: f.enumOf('Interview status', STATUSES) })
  .partial()
  .refine((o) => Object.keys(o).length > 0, { message: 'At least one field to change is required' });
const listQuery = z.strictObject({
  vacancy_id: f.id('VACANCY', 'Vacancy ID').optional(),
  candidate_id: f.id('CANDIDATE', 'Candidate ID').optional(),
  date: f.isoDate('Date').optional(),
});
const idParams = z.strictObject({ id: f.id('INTERVIEW_SCHEDULE', 'Interview ID') });

const router = express.Router();

// UC-10 | FR-10 | Process 0.4.2 | BR-13 | NFR-10 — response is the Interview Confirmation (DS-26)
router.post('/', auditFailures('INTERVIEW_SCHEDULE', 'SCHEDULE'), validate({ body: createBody }), (req, res) => {
  const i = create(getDb(), req.user, req.body);
  return ok(res, { status: 201, reference_id: i.interview_id, message: 'Interview scheduled', data: i });
});

// UC-10 | FR-10 | Process 0.4.2 | NFR-10
router.get('/', validate({ query: listQuery }), (req, res) => {
  const rows = list(getDb(), req.validQuery);
  return ok(res, { message: `${rows.length} interview(s)`, data: rows });
});

// UC-10 | FR-10 | Process 0.4.2 | NFR-10
router.get('/:id', validate({ params: idParams }), (req, res) => {
  const i = get(getDb(), req.params.id);
  return ok(res, { reference_id: i.interview_id, message: 'Interview', data: i });
});

// UC-10 | FR-10 | Process 0.4.2 | BR-13 | NFR-10
router.patch('/:id', auditFailures('INTERVIEW_SCHEDULE', 'UPDATE'), validate({ params: idParams, body: updateBody }), (req, res) => {
  const i = update(getDb(), req.user, req.params.id, req.body);
  return ok(res, { reference_id: i.interview_id, message: 'Interview updated', data: i });
});

module.exports = { router };
