'use strict';
// Process 0.4.1 Manage Vacancies — UC-09 · FR-9 · NFR-9 (Recruitment Officer)
const express = require('express');
const { getDb } = require('../../db');
const dates = require('../../lib/dates');
const { nextId } = require('../../lib/ids');
const { ok } = require('../../lib/result');
const f = require('../../lib/fields');
const { validate } = require('../../middleware/validate');
const { auditFailures, auditActor } = require('../../middleware/audit');
const { conflict, notFound } = require('../../middleware/errors');

const { z } = f;
const COLUMNS = 'vacancy_id, job_title, department, positions, qualifications, vacancy_status, posted_date';

// ---------------------------------------------------------------- service

function getById(db, vacancyId) {
  return db.prepare(`SELECT ${COLUMNS} FROM VACANCY WHERE vacancy_id = ?`).get(vacancyId);
}

// UC-09 | FR-9 | Process 0.4.1 | BR-12 | NFR-9
function create(db, actor, input) {
  return db.transaction(() => {
    const vacancyId = nextId(db, 'VACANCY');
    db.prepare(
      `INSERT INTO VACANCY (vacancy_id, job_title, department, positions, qualifications, vacancy_status, posted_date)
       VALUES (?, ?, ?, ?, ?, 'Open', ?)`
    ).run(vacancyId, input.job_title, input.department, input.positions, input.qualifications, dates.today());
    auditActor(db, actor, { action: 'CREATE', entity: 'VACANCY', entity_id: vacancyId });
    return getById(db, vacancyId);
  })();
}

// UC-09 | FR-9 | Process 0.4.1 | NFR-9 — Vacancy List (DS-21)
function list(db, { status }) {
  return status
    ? db.prepare(`SELECT ${COLUMNS} FROM VACANCY WHERE vacancy_status = ? ORDER BY vacancy_id`).all(status)
    : db.prepare(`SELECT ${COLUMNS} FROM VACANCY ORDER BY vacancy_id`).all();
}

// UC-09 | FR-9 | Process 0.4.1 | NFR-9
function get(db, vacancyId) {
  const v = getById(db, vacancyId);
  if (!v) throw notFound(`Vacancy ${vacancyId} not found`);
  return v;
}

// UC-09 | FR-9 | Process 0.4.1 | BR-12 | NFR-9
function update(db, actor, vacancyId, changes) {
  return db.transaction(() => {
    get(db, vacancyId);
    const fields = Object.keys(changes);
    db.prepare(`UPDATE VACANCY SET ${fields.map((k) => `${k} = @${k}`).join(', ')} WHERE vacancy_id = @__id`).run({
      ...changes,
      __id: vacancyId,
    });
    auditActor(db, actor, { action: 'UPDATE', entity: 'VACANCY', entity_id: vacancyId, detail: { fields } });
    return getById(db, vacancyId);
  })();
}

// UC-09 | FR-9 | Process 0.4.1 | NFR-9 — close a vacancy
function close(db, actor, vacancyId) {
  return db.transaction(() => {
    const v = get(db, vacancyId);
    if (v.vacancy_status === 'Closed') throw conflict(`Vacancy ${vacancyId} is already Closed`);
    db.prepare("UPDATE VACANCY SET vacancy_status = 'Closed' WHERE vacancy_id = ?").run(vacancyId);
    auditActor(db, actor, { action: 'CLOSE', entity: 'VACANCY', entity_id: vacancyId, detail: { from: v.vacancy_status, to: 'Closed' } });
    return getById(db, vacancyId);
  })();
}

// ---------------------------------------------------------------- routes

// DS-20 Vacancy Details — BR-12: title, department, positions >= 1, qualifications required
const vacancyFields = {
  job_title: f.notBlank('Job title', 100),
  department: f.department,
  positions: z.number({ error: () => 'Number of positions must be a whole number' }).int('Number of positions must be a whole number').min(1, 'Number of positions must be at least 1'),
  qualifications: f.notBlank('Qualifications', 300),
};
const createBody = z.strictObject(vacancyFields);
const updateBody = z
  .strictObject({ ...vacancyFields, vacancy_status: f.enumOf('Vacancy status', ['Open', 'On Hold']) })
  .partial()
  .refine((o) => Object.keys(o).length > 0, { message: 'At least one field to change is required' });
const listQuery = z.strictObject({ status: f.enumOf('Status', ['Open', 'On Hold', 'Closed']).optional() });
const idParams = z.strictObject({ id: f.id('VACANCY', 'Vacancy ID') });

const router = express.Router();

// UC-09 | FR-9 | Process 0.4.1 | BR-12 | NFR-9
router.post('/', auditFailures('VACANCY', 'CREATE'), validate({ body: createBody }), (req, res) => {
  const v = create(getDb(), req.user, req.body);
  return ok(res, { status: 201, reference_id: v.vacancy_id, message: 'Vacancy created', data: v });
});

// UC-09 | FR-9 | Process 0.4.1 | NFR-9
router.get('/', validate({ query: listQuery }), (req, res) => {
  const rows = list(getDb(), req.validQuery);
  return ok(res, { message: `${rows.length} vacancy(ies)`, data: rows });
});

// UC-09 | FR-9 | Process 0.4.1 | NFR-9
router.get('/:id', validate({ params: idParams }), (req, res) => {
  const v = get(getDb(), req.params.id);
  return ok(res, { reference_id: v.vacancy_id, message: 'Vacancy', data: v });
});

// UC-09 | FR-9 | Process 0.4.1 | BR-12 | NFR-9
router.patch('/:id', auditFailures('VACANCY', 'UPDATE'), validate({ params: idParams, body: updateBody }), (req, res) => {
  const v = update(getDb(), req.user, req.params.id, req.body);
  return ok(res, { reference_id: v.vacancy_id, message: 'Vacancy updated', data: v });
});

// UC-09 | FR-9 | Process 0.4.1 | NFR-9
router.post('/:id/close', auditFailures('VACANCY', 'CLOSE'), validate({ params: idParams }), (req, res) => {
  const v = close(getDb(), req.user, req.params.id);
  return ok(res, { reference_id: v.vacancy_id, message: 'Vacancy closed', data: v });
});

module.exports = { router, getById };
