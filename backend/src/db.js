'use strict';
const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');
const config = require('./config');

const SCHEMA_FILE = path.join(__dirname, '..', 'db', 'schema.sql');

/** Open a database file (or ':memory:'), enable FK checks and apply the schema. */
function openDb(file = config.dbFile) {
  if (file !== ':memory:') fs.mkdirSync(path.dirname(file), { recursive: true });
  const db = new Database(file);
  if (file !== ':memory:') db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  db.exec(fs.readFileSync(SCHEMA_FILE, 'utf8'));
  return db;
}

let instance = null;

/** Shared connection used by the application (one per process). */
function getDb() {
  if (!instance) instance = openDb(config.dbFile);
  return instance;
}

function closeDb() {
  if (instance) {
    instance.close();
    instance = null;
  }
}

module.exports = { openDb, getDb, closeDb };
