'use strict';
// Process 0.4 — UC-09, UC-10, UC-19 · BR-12, BR-13, BR-14, BR-29 (+ BR-28 offered salary) · A-3
const { test, describe, before } = require('node:test');
const assert = require('node:assert/strict');
const { setup, login, bearer, request, USERS } = require('./helpers');
const dates = require('../src/lib/dates');

const { db, app } = setup();
const today = dates.today();
const day = (n) => dates.addDays(today, n);
const tokens = {};
let RO; // Recruitment Officer token

before(async () => {
  for (const [k, id] of Object.entries(USERS)) tokens[k] = await login(app, id);
  RO = tokens.RECRUITMENT;
});

const post = (path, body, token = RO) => request(app).post(`/api${path}`).set(bearer(token)).send(body);
const patch = (path, body, token = RO) => request(app).patch(`/api${path}`).set(bearer(token)).send(body);
const get = (path, token = RO) => request(app).get(`/api${path}`).set(bearer(token));

const vacancy = (over = {}) => ({
  job_title: 'Software Engineer',
  department: 'Engineering',
  positions: 2,
  qualifications: 'B.Tech in CS or equivalent',
  ...over,
});

async function newCandidate(vacancyId, name = 'Meera Pal') {
  const r = await post('/candidates', { vacancy_id: vacancyId, candidate_name: name, candidate_email: 'meera@example.com', candidate_phone: '9812345678' });
  assert.equal(r.status, 201, JSON.stringify(r.body));
  return r.body.data;
}

describe('BR-12 vacancy data control (UC-09)', () => {
  test('title, department, positions >= 1 and qualifications are required', async () => {
    const r = await post('/vacancies', {});
    assert.equal(r.status, 422);
    assert.deepEqual(r.body.details.map((d) => d.field).sort(), ['body.department', 'body.job_title', 'body.positions', 'body.qualifications']);
    assert.equal((await post('/vacancies', vacancy({ positions: 0 }))).status, 422);
    assert.equal((await post('/vacancies', vacancy({ positions: 1.5 }))).status, 422);
    assert.equal((await post('/vacancies', vacancy({ job_title: '  ' }))).status, 422);
    assert.equal((await post('/vacancies', vacancy({ department: 'Marketing' }))).status, 422); // A-8
  });

  test('recruitment role only (403 + Denied for every other role)', async () => {
    for (const k of ['HR', 'EMP', 'PAYROLL', 'FINANCE']) {
      assert.equal((await post('/vacancies', vacancy(), tokens[k])).status, 403, k);
      assert.equal((await get('/vacancies', tokens[k])).status, 403, k);
      assert.equal((await get('/offers', tokens[k])).status, 403, k);
    }
    assert.ok(db.prepare("SELECT COUNT(*) AS n FROM AUDIT_LOG WHERE outcome='Denied' AND entity='vacancies'").get().n >= 8);
  });

  test('create, list, read, update, close', async () => {
    const c = await post('/vacancies', vacancy());
    assert.equal(c.status, 201);
    assert.match(c.body.reference_id, /^VAC\d{5}$/);
    assert.equal(c.body.data.vacancy_status, 'Open');
    assert.equal(c.body.data.posted_date, today);
    const id = c.body.data.vacancy_id;

    assert.equal((await get(`/vacancies/${id}`)).body.data.job_title, 'Software Engineer');
    const u = await patch(`/vacancies/${id}`, { positions: 3, vacancy_status: 'On Hold' });
    assert.equal(u.status, 200);
    assert.equal(u.body.data.positions, 3);
    assert.equal(u.body.data.vacancy_status, 'On Hold');
    assert.equal((await get('/vacancies?status=On%20Hold')).body.data.length, 1);
    assert.equal((await patch(`/vacancies/${id}`, { vacancy_status: 'Closed' })).status, 422, 'closing uses /close');
    assert.equal((await patch(`/vacancies/${id}`, { vacancy_id: 'VAC99999' })).status, 400);

    const cl = await post(`/vacancies/${id}/close`, {});
    assert.equal(cl.status, 200);
    assert.equal(cl.body.data.vacancy_status, 'Closed');
    assert.equal((await post(`/vacancies/${id}/close`, {})).status, 409);
    assert.equal((await get('/vacancies/VAC99999')).status, 404);
  });
});

describe('ASSUMPTION A-3 candidates', () => {
  test('register for an Open vacancy; refused for a Closed or unknown vacancy; phone digits only', async () => {
    const v = (await post('/vacancies', vacancy())).body.data;
    const c = await newCandidate(v.vacancy_id);
    assert.match(c.candidate_id, /^CAN\d{5}$/);
    assert.equal(c.job_title, 'Software Engineer');

    assert.equal((await post('/candidates', { vacancy_id: v.vacancy_id, candidate_name: 'X', candidate_email: 'bad' })).status, 422);
    assert.equal((await post('/candidates', { vacancy_id: v.vacancy_id, candidate_name: 'X', candidate_email: 'x@example.com', candidate_phone: '98-123' })).status, 422);
    assert.equal((await post('/candidates', { vacancy_id: 'VAC99999', candidate_name: 'X', candidate_email: 'x@example.com' })).status, 404);

    const closed = (await post('/vacancies', vacancy())).body.data;
    await post(`/vacancies/${closed.vacancy_id}/close`, {});
    assert.equal((await post('/candidates', { vacancy_id: closed.vacancy_id, candidate_name: 'X', candidate_email: 'x@example.com' })).status, 409);

    const list = await get(`/candidates?vacancy_id=${v.vacancy_id}`);
    assert.deepEqual(list.body.data.map((x) => x.candidate_id), [c.candidate_id]);
  });
});

describe('BR-13 interview slot conflict prevention (UC-10)', () => {
  let v, c1, c2, first;
  before(async () => {
    v = (await post('/vacancies', vacancy({ job_title: 'Data Analyst' }))).body.data;
    c1 = await newCandidate(v.vacancy_id, 'Candidate One');
    c2 = await newCandidate(v.vacancy_id, 'Candidate Two');
  });

  test('schedule: Interview Confirmation returned (INT + 7 digits, Scheduled)', async () => {
    const r = await post('/interviews', {
      candidate_id: c1.candidate_id, interview_date: day(5), interview_time: '10:00', interview_venue: 'Room A', interviewer_name: 'Anita Sharma',
    });
    assert.equal(r.status, 201);
    first = r.body.data;
    assert.match(first.interview_id, /^INT\d{7}$/);
    assert.equal(first.interview_status, 'Scheduled');
    assert.equal(first.vacancy_id, v.vacancy_id);
    assert.equal(first.candidate_name, 'Candidate One');
  });

  test('same candidate at the same date+time (other venue) -> 409', async () => {
    const r = await post('/interviews', { candidate_id: c1.candidate_id, interview_date: day(5), interview_time: '10:00:00', interview_venue: 'Room B' });
    assert.equal(r.status, 409);
    assert.match(r.body.error_message, /another date, time or venue/);
  });

  test('same venue (any case) at the same date+time for another candidate -> 409', async () => {
    const r = await post('/interviews', { candidate_id: c2.candidate_id, interview_date: day(5), interview_time: '10:00', interview_venue: 'room a' });
    assert.equal(r.status, 409);
  });

  test('different slot is accepted', async () => {
    const r = await post('/interviews', { candidate_id: c2.candidate_id, interview_date: day(5), interview_time: '11:00', interview_venue: 'Room A' });
    assert.equal(r.status, 201);
  });

  test('rescheduling into a booked slot -> 409; cancelled interviews free their slot', async () => {
    const other = (await get(`/interviews?candidate_id=${c2.candidate_id}`)).body.data[0];
    assert.equal((await patch(`/interviews/${other.interview_id}`, { interview_time: '10:00' })).status, 409);
    assert.equal((await patch(`/interviews/${first.interview_id}`, { interview_status: 'Cancelled' })).status, 200);
    const moved = await patch(`/interviews/${other.interview_id}`, { interview_time: '10:00' });
    assert.equal(moved.status, 200);
    assert.equal(moved.body.data.interview_time, '10:00');
    // reactivating the cancelled one now clashes
    assert.equal((await patch(`/interviews/${first.interview_id}`, { interview_status: 'Scheduled' })).status, 409);
  });

  test('DE-058/059: candidate must exist; date/time not in the past; vacancy must match', async () => {
    assert.equal((await post('/interviews', { candidate_id: 'CAN99999', interview_date: day(5), interview_time: '12:00', interview_venue: 'Room C' })).status, 404);
    assert.equal((await post('/interviews', { candidate_id: c1.candidate_id, interview_date: day(-1), interview_time: '12:00', interview_venue: 'Room C' })).status, 422);
    assert.equal((await post('/interviews', { candidate_id: c1.candidate_id, interview_date: day(5), interview_time: '25:00', interview_venue: 'Room C' })).status, 422);
    const otherVac = (await post('/vacancies', vacancy())).body.data;
    const r = await post('/interviews', { candidate_id: c1.candidate_id, vacancy_id: otherVac.vacancy_id, interview_date: day(6), interview_time: '12:00', interview_venue: 'Room C' });
    assert.equal(r.status, 422);
  });

  test('list filters by date', async () => {
    const r = await get(`/interviews?date=${day(5)}&vacancy_id=${v.vacancy_id}`);
    assert.equal(r.status, 200);
    assert.ok(r.body.data.length >= 2 && r.body.data.every((i) => i.interview_date === day(5)));
  });
});

describe('BR-14 offer eligibility and BR-29 offer letter accuracy (UC-19)', () => {
  let v, cand, interview;
  before(async () => {
    v = (await post('/vacancies', vacancy({ job_title: 'QA Lead', department: 'Engineering' }))).body.data;
    cand = await newCandidate(v.vacancy_id, 'Nisha <b>Roy</b>');
  });

  const offer = (over = {}) => ({ candidate_id: cand.candidate_id, offered_salary: 55000, joining_date: day(30), ...over });

  test('no interview / interview not Selected -> 409', async () => {
    assert.equal((await post('/offers', offer())).status, 409);
    interview = (await post('/interviews', { candidate_id: cand.candidate_id, interview_date: day(3), interview_time: '09:30', interview_venue: 'Room Q' })).body.data;
    const r = await post('/offers', offer());
    assert.equal(r.status, 409);
    assert.match(r.body.error_message, /Selected/);
  });

  test('field rules: salary > 0 (BR-28), joining date after issue date, position must equal the job title', async () => {
    await patch(`/interviews/${interview.interview_id}`, { interview_status: 'Selected' });
    assert.equal((await post('/offers', offer({ offered_salary: 0 }))).status, 422);
    assert.equal((await post('/offers', offer({ offered_salary: -100 }))).status, 422);
    assert.equal((await post('/offers', offer({ joining_date: today }))).status, 422);
    const pos = await post('/offers', offer({ offer_position: 'Manager' }));
    assert.equal(pos.status, 400);
    assert.match(pos.body.error_message, /QA Lead/);
  });

  test('Selected candidate gets an offer; position comes from the vacancy; one offer per candidate', async () => {
    const r = await post('/offers', offer({ offer_position: 'QA Lead' }));
    assert.equal(r.status, 201, JSON.stringify(r.body));
    assert.match(r.body.reference_id, /^OFR\d{7}$/);
    const o = r.body.data;
    assert.equal(o.offer_position, 'QA Lead');
    assert.equal(o.offered_salary, 55000);
    assert.equal(o.offer_issue_date, today);
    assert.equal(o.offer_status, 'Issued');
    assert.equal(o.vacancy_id, v.vacancy_id);
    assert.equal((await post('/offers', offer())).status, 409);
    const audit = db.prepare("SELECT detail FROM AUDIT_LOG WHERE entity='OFFER' AND action='CREATE' AND entity_id = ?").get(o.offer_id);
    assert.ok(!audit.detail.includes('55000'), 'offered salary not logged');
  });

  test('latest interview decides: a later Rejected interview blocks a new offer', async () => {
    const c = await newCandidate(v.vacancy_id, 'Second Person');
    const i1 = (await post('/interviews', { candidate_id: c.candidate_id, interview_date: day(3), interview_time: '14:00', interview_venue: 'Room Z' })).body.data;
    await patch(`/interviews/${i1.interview_id}`, { interview_status: 'Selected' });
    const i2 = (await post('/interviews', { candidate_id: c.candidate_id, interview_date: day(4), interview_time: '14:00', interview_venue: 'Room Z' })).body.data;
    await patch(`/interviews/${i2.interview_id}`, { interview_status: 'Rejected' });
    assert.equal((await post('/offers', { candidate_id: c.candidate_id, offered_salary: 50000, joining_date: day(30) })).status, 409);
  });

  test('BR-29: the letter is rendered from the stored OFFER row (later vacancy edits do not change it) and is HTML-escaped', async () => {
    const o = (await get(`/offers?vacancy_id=${v.vacancy_id}`)).body.data[0];
    await patch(`/vacancies/${v.vacancy_id}`, { job_title: 'Renamed Title' });
    const r = await get(`/offers/${o.offer_id}/letter`);
    assert.equal(r.status, 200);
    assert.match(r.headers['content-type'], /text\/html/);
    const html = r.text;
    assert.ok(html.includes(o.offer_id));
    assert.ok(html.includes('QA Lead'), 'stored position');
    assert.ok(!html.includes('Renamed Title'));
    assert.ok(html.includes('Engineering'));
    assert.ok(html.includes('55,000.00'));
    assert.ok(html.includes('Nisha &lt;b&gt;Roy&lt;/b&gt;'));
    assert.ok(!html.includes('<b>Roy</b>'));
    // identical on regeneration
    assert.equal((await get(`/offers/${o.offer_id}/letter`)).text, html);
    assert.equal((await get(`/offers/${o.offer_id}/letter`, tokens.HR)).status, 403);
    assert.equal((await get('/offers/OFR9999999/letter')).status, 404);
  });

  test('offer status update (domain values only)', async () => {
    const o = (await get(`/offers?vacancy_id=${v.vacancy_id}`)).body.data[0];
    const r = await patch(`/offers/${o.offer_id}/status`, { offer_status: 'Accepted' });
    assert.equal(r.status, 200);
    assert.equal(r.body.data.offer_status, 'Accepted');
    assert.equal((await patch(`/offers/${o.offer_id}/status`, { offer_status: 'Withdrawn' })).status, 422);
    assert.equal((await get('/offers?status=Accepted')).body.data.length, 1);
  });
});
