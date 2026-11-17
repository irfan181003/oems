// One function per backend route (BACKEND_PROMPT §6, backend/TRACEABILITY.md). The single place for API paths.
import { api, qs } from './client';

const enc = encodeURIComponent;

export const health = () => api.get('/health', { auth: false });

// NFR-22 | BR-27 — authentication
export const auth = {
  login: (login, password) => api.post('/auth/login', { login, password }, { auth: false }),
  me: () => api.get('/auth/me'),
  logout: () => api.post('/auth/logout'),
};

// Process 0.1 — UC-01, UC-02
export const attendance = {
  checkIn: () => api.post('/attendance/check-in'),
  checkOut: () => api.post('/attendance/check-out'),
  mine: (from, to) => api.get(`/attendance/me${qs({ from, to })}`),
  all: ({ employee_id, from, to }) => api.get(`/attendance${qs({ employee_id, from, to })}`),
};

// Process 0.2 — UC-03, UC-04
export const leaves = {
  apply: (body) => api.post('/leaves', body),
  mine: () => api.get('/leaves/me'),
  review: ({ status, employee_id } = {}) => api.get(`/leaves${qs({ status, employee_id })}`),
  get: (id) => api.get(`/leaves/${enc(id)}`),
  decide: (id, body) => api.patch(`/leaves/${enc(id)}/decision`, body),
};

// Process 0.3.3 — UC-05
export const profile = {
  get: () => api.get('/profile/me'),
  update: (body) => api.patch('/profile/me', body),
};

// Process 0.3.1, 0.3.2 — UC-06, UC-07
export const employees = {
  register: (body) => api.post('/employees', body),
  list: ({ department, status, q } = {}) => api.get(`/employees${qs({ department, status, q })}`),
  get: (id) => api.get(`/employees/${enc(id)}`),
  update: (id, body) => api.patch(`/employees/${enc(id)}`, body),
};

// Process 0.3.4 — UC-20
export const retirementPlans = {
  create: (body) => api.post('/retirement-plans', body),
  list: ({ employee_id } = {}) => api.get(`/retirement-plans${qs({ employee_id })}`),
  get: (id) => api.get(`/retirement-plans/${enc(id)}`),
  update: (id, body) => api.patch(`/retirement-plans/${enc(id)}`, body),
};

// Process 0.4 — UC-09, UC-10, UC-19
export const vacancies = {
  create: (body) => api.post('/vacancies', body),
  list: ({ status } = {}) => api.get(`/vacancies${qs({ status })}`),
  get: (id) => api.get(`/vacancies/${enc(id)}`),
  update: (id, body) => api.patch(`/vacancies/${enc(id)}`, body),
  close: (id) => api.post(`/vacancies/${enc(id)}/close`),
};
export const candidates = {
  create: (body) => api.post('/candidates', body),
  list: ({ vacancy_id } = {}) => api.get(`/candidates${qs({ vacancy_id })}`),
};
export const interviews = {
  create: (body) => api.post('/interviews', body),
  list: ({ vacancy_id, candidate_id, date } = {}) => api.get(`/interviews${qs({ vacancy_id, candidate_id, date })}`),
  get: (id) => api.get(`/interviews/${enc(id)}`),
  update: (id, body) => api.patch(`/interviews/${enc(id)}`, body),
};
export const offers = {
  create: (body) => api.post('/offers', body),
  list: ({ status, vacancy_id } = {}) => api.get(`/offers${qs({ status, vacancy_id })}`),
  get: (id) => api.get(`/offers/${enc(id)}`),
  letterHtml: (id) => api.get(`/offers/${enc(id)}/letter`, { as: 'text' }),
  setStatus: (id, offer_status) => api.patch(`/offers/${enc(id)}/status`, { offer_status }),
};

// Process 0.5 — UC-11, UC-12, UC-14, UC-15
export const payroll = {
  run: (body) => api.post('/payroll/run', body),
  records: ({ pay_period, employee_id } = {}) => api.get(`/payroll/records${qs({ pay_period, employee_id })}`),
  record: (id) => api.get(`/payroll/records/${enc(id)}`),
  setStatus: (id, payroll_status) => api.patch(`/payroll/records/${enc(id)}/status`, { payroll_status }),
};
export const salary = {
  mine: () => api.get('/salary/me'),
  list: ({ employee_id, pay_period } = {}) => api.get(`/salary${qs({ employee_id, pay_period })}`),
};

// Process 0.6 — UC-13
export const payslips = {
  generate: (body) => api.post('/payslips/generate', body),
  list: ({ pay_period, employee_id } = {}) => api.get(`/payslips${qs({ pay_period, employee_id })}`),
  get: (id) => api.get(`/payslips/${enc(id)}`),
  pdf: (id) => api.get(`/payslips/${enc(id)}/download`, { as: 'blob' }),
};

// Process 0.7 — UC-16, UC-17
export const reports = {
  hr: (params) => api.get(`/reports/hr${qs(params)}`),
  financial: (params) => api.get(`/reports/financial${qs(params)}`),
};
