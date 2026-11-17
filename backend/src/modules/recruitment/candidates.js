'use strict';
// ASSUMPTION A-3: no flow creates candidates (Data Dictionary section 12 #10 recommends "Register Candidate").
// Recruitment Officer registers and lists candidates (CANDIDATE, T-D4-02). Supports UC-10 / UC-19.
const express = require('express');
const { getDb } = require('../../db');
const { nextId } = require('../../lib/ids');
const { ok } = require('../../lib/result');
const f = require('../../lib/fields');
const { validate } = require('../../middleware/validate');
const { auditFailures, auditActor } = require('../../middleware/audit');
const { conflict, notFound } = require('../../middleware/errors');

const { z } = f;
const COLUMNS = 'c.candidate_id, c.vacancy_id, c.candidate_name, c.candidate_email, c.candidate_phone';

function getById(db, candidateId) {
  return db
    .prepare(`SELECT ${COLUMNS}, v.job_title FROM CANDIDATE c JOIN VACANCY v ON v.vacancy_id = c.vacancy_id WHERE c.candidate_id = ?`)
    .get(candidateId);
}

// ASSUMPTION A-3 | UC-10 | FR-10 | Process 0.4 | NFR-9 — vacancy must exist and be Open
function create(db, actor, input) {
  return db.transaction(() => {
    const vacancy = db.prepare('SELECT vacancy_status FROM VACANCY WHERE vacancy_id = ?').get(input.vacancy_id);
    if (!vacancy) throw notFound(`Vacancy ${input.vacancy_id} not found`);
    if (vacancy.vacancy_status !== 'Open') throw conflict(`Vacancy ${input.vacancy_id} is ${vacancy.vacancy_status}; candidates can be added only to Open vacancies`);
    const candidateId = nextId(db, 'CANDIDATE');
    db.prepare(
      'INSERT INTO CANDIDATE (candidate_id, vacancy_id, candidate_name, candidate_email, candidate_phone) VALUES (?, ?, ?, ?, ?)'
    ).run(candidateId, input.vacancy_id, input.candidate_name, input.candidate_email, input.candidate_phone ?? null);
    auditActor(db, actor, { action: 'CREATE', entity: 'CANDIDATE', entity_id: candidateId, detail: { vacancy_id: input.vacancy_id } });
    return getById(db, candidateId);
  })();
}

// ASSUMPTION A-3 | UC-10 | FR-10 | NFR-9
function list(db, { vacancy_id: vacancyId }) {
  const sql = `SELECT ${COLUMNS}, v.job_title FROM CANDIDATE c JOIN VACANCY v ON v.vacancy_id = c.vacancy_id
    ${vacancyId ? 'WHERE c.vacancy_id = ?' : ''} ORDER BY c.candidate_id`;
  return vacancyId ? db.prepare(sql).all(vacancyId) : db.prepare(sql).all();
}

// DS-24 Candidate & Vacancy Details (DE-063 ... DE-065)
const createBody = z.strictObject({
  vacancy_id: f.id('VACANCY', 'Vacancy ID'),
  candidate_name: f.notBlank('Candidate name', 100),
  candidate_email: f.text('Candidate e-mail').trim().max(100, 'Candidate e-mail must be at most 100 characters').email('Candidate e-mail must be a valid e-mail address'),
  candidate_phone: f.text('Candidate phone').trim().regex(/^\d{1,10}$/, 'Candidate phone must contain digits only (at most 10)').optional().nullable(),
});
const listQuery = z.strictObject({ vacancy_id: f.id('VACANCY', 'Vacancy ID').optional() });

const router = express.Router();

// ASSUMPTION A-3 | UC-10 | FR-10 | NFR-9
router.post('/', auditFailures('CANDIDATE', 'CREATE'), validate({ body: createBody }), (req, res) => {
  const c = create(getDb(), req.user, req.body);
  return ok(res, { status: 201, reference_id: c.candidate_id, message: 'Candidate registered', data: c });
});

// ASSUMPTION A-3 | UC-10 | FR-10 | NFR-9
router.get('/', validate({ query: listQuery }), (req, res) => {
  const rows = list(getDb(), req.validQuery);
  return ok(res, { message: `${rows.length} candidate(s)`, data: rows });
});

module.exports = { router, getById };
