'use strict';
const config = require('./config');
const { getDb, closeDb } = require('./db');
const { createApp } = require('./app');

getDb(); // open the database and apply the schema before accepting requests
const server = createApp().listen(config.port, () => {
  console.log(`OEMS API listening on http://localhost:${config.port}/api (timezone ${config.timezone})`);
});

function shutdown() {
  server.close(() => {
    closeDb();
    process.exit(0);
  });
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
