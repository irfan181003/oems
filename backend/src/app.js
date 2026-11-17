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

  app.use('/api', api);
  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}

module.exports = { createApp };
