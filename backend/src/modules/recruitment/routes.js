'use strict';
// Process 0.4 Manage Recruitment — UC-09, UC-10, UC-19 · FR-9, FR-10, FR-19 · NFR-9, NFR-10, NFR-19
// All recruitment data is restricted to the Recruitment Officer (NFR-9, NFR-19).
const { authenticate } = require('../../middleware/auth');
const { requireRole } = require('../../middleware/rbac');

function mount(api) {
  const gate = [authenticate, requireRole('Recruitment Officer')];
  api.use('/vacancies', ...gate, require('./vacancies').router);
  api.use('/candidates', ...gate, require('./candidates').router);
  api.use('/interviews', ...gate, require('./interviews').router);
  api.use('/offers', ...gate, require('./offers').router);
}

module.exports = { mount };
