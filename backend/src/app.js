'use strict';
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const morgan = require('morgan');
const config = require('./config');
const dates = require('./lib/dates');
const { ok } = require('./lib/result');
const { notFoundHandler, errorHandler } = require('./middleware/errors');

const authRoutes = require('./modules/auth/routes');
const attendanceRoutes = require('./modules/attendance/routes');
const leaveRoutes = require('./modules/leave/routes');
const profileRoutes = require('./modules/profile/routes');
const employeeRoutes = require('./modules/employees/routes');
const retirementRoutes = require('./modules/retirement/routes');
const recruitment = require('./modules/recruitment/routes');
const payrollRoutes = require('./modules/payroll/routes');
const salaryRoutes = require('./modules/salary/routes');
const payslipRoutes = require('./modules/payslips/routes');
const reportRoutes = require('./modules/reports/routes');

function createApp() {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', false);

  // Section 9 security: helmet, CORS limited to CORS_ORIGIN, JSON body limit 100 kb.
  app.use(helmet());
  app.use(cors({ origin: config.corsOrigin }));
  app.use(express.json({ limit: '100kb' }));
  // Request line only (method, URL, status, time) - bodies are never logged (section 9).
  if (config.env !== 'test') app.use(morgan(':method :url :status :response-time ms'));

  const api = express.Router();

  // Public health check
  api.get('/health', (req, res) =>
    ok(res, { message: 'Service is running', data: { status: 'ok', server_time: dates.nowTs(), timezone: config.timezone } })
  );

  api.use('/auth', authRoutes);
  api.use('/attendance', attendanceRoutes); // Process 0.1
  api.use('/leaves', leaveRoutes); // Process 0.2
  api.use('/profile', profileRoutes); // Process 0.3.3
  api.use('/employees', employeeRoutes); // Process 0.3.1, 0.3.2
  api.use('/retirement-plans', retirementRoutes); // Process 0.3.4
  recruitment.mount(api); // Process 0.4: /vacancies, /candidates, /interviews, /offers
  api.use('/payroll', payrollRoutes); // Process 0.5.1-0.5.4
  api.use('/salary', salaryRoutes); // UC-11 View Salary (A-4)
  api.use('/payslips', payslipRoutes); // Process 0.6
  api.use('/reports', reportRoutes); // Process 0.7

  app.use('/api', api);
  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}

module.exports = { createApp };
