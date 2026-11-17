# Project: Office Employee Management System (Group 02)
- Source of truth: docs/BACKEND_PROMPT.md, docs/requirements.txt (Assignment 2), docs/dd.txt (Assignment 3.2 Data Dictionary).
- Never invent features, tables, columns, roles or rules. If the documents are silent, use the numbered assumption in BACKEND_PROMPT.md section 12 or ask me.
- Table/column names and ID formats are exactly as in Data Dictionary section 8 / section 7.
- Backend: Node 20 + Express + SQLite (better-sqlite3), in backend/. Frontend later, in frontend/.
- Work in phases (BACKEND_PROMPT.md section 11). After each phase: run tests, git commit, report, then STOP and wait for me.
- Tag handlers with `// UC-xx | FR-xx | Process 0.x.y | BR-xx | NFR-xx`.
- Never commit .env, node_modules or the database file.