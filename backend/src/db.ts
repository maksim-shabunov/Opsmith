import Database from "better-sqlite3";
import path from "path";
import { fileURLToPath } from "url";
import { SAMPLE_TOOL_SCHEMA, SAMPLE_ROWS } from "../../shared/tool-schema.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = path.join(__dirname, "..", "..", "opsmith.db");

const db = new Database(DB_PATH);

// Enable WAL mode for better concurrency
db.pragma("journal_mode = WAL");

// Create tables
db.exec(`
  CREATE TABLE IF NOT EXISTS tools (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT NOT NULL,
    schema_json TEXT NOT NULL,
    created_at INTEGER NOT NULL DEFAULT (unixepoch())
  );

  CREATE TABLE IF NOT EXISTS tool_rows (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tool_id TEXT NOT NULL REFERENCES tools(id) ON DELETE CASCADE,
    data_json TEXT NOT NULL
  );
`);

// Seed sample tool on first run
const existing = db
  .prepare("SELECT id FROM tools WHERE id = ?")
  .get(SAMPLE_TOOL_SCHEMA.id);

if (!existing) {
  const insertTool = db.prepare(`
    INSERT INTO tools (id, name, description, schema_json)
    VALUES (?, ?, ?, ?)
  `);
  insertTool.run(
    SAMPLE_TOOL_SCHEMA.id,
    SAMPLE_TOOL_SCHEMA.name,
    SAMPLE_TOOL_SCHEMA.description,
    JSON.stringify(SAMPLE_TOOL_SCHEMA)
  );

  const insertRow = db.prepare(`
    INSERT INTO tool_rows (tool_id, data_json) VALUES (?, ?)
  `);
  for (const row of SAMPLE_ROWS) {
    insertRow.run(SAMPLE_TOOL_SCHEMA.id, JSON.stringify(row));
  }

  console.log("Seeded sample tool:", SAMPLE_TOOL_SCHEMA.name);
}

export default db;
