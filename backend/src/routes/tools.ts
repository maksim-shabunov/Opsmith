import { Hono } from "hono";
import { randomUUID } from "crypto";
import db from "../db.js";
import {
  SAMPLE_TOOL_SCHEMA,
  SAMPLE_ROWS,
  ToolSchemaSchema,
} from "../../../shared/tool-schema.js";
import type { ToolSchema } from "../../../shared/tool-schema.js";
import {
  callOpenRouter,
  stripFences,
} from "../lib/openrouter.js";
import {
  evaluateComputedColumns,
  formatDateValue,
  toBoolean,
} from "../lib/evaluate.js";

const tools = new Hono();

// Global error guard — catch any unhandled throw in a route handler
tools.onError((err, c) => {
  console.error("[tools route error]", err);
  return c.json({ error: "Internal server error", detail: String(err) }, 500);
});

// ── helpers ──────────────────────────────────────────────────────────────────

function persistTool(schema: ToolSchema, dataRows: Record<string, unknown>[]) {
  const upsertTool = db.prepare(`
    INSERT INTO tools (id, name, description, schema_json)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE
      SET name=excluded.name,
          description=excluded.description,
          schema_json=excluded.schema_json
  `);
  const insertRow = db.prepare(
    "INSERT INTO tool_rows (tool_id, data_json) VALUES (?, ?)"
  );

  db.transaction(() => {
    upsertTool.run(
      schema.id,
      schema.name,
      schema.description,
      JSON.stringify(schema)
    );
    for (const row of dataRows) {
      insertRow.run(schema.id, JSON.stringify(row));
    }
  })();
}

/**
 * Trim a grid to at most maxRows × maxCols to stay within token budget.
 */
function trimGrid(
  grid: unknown[][],
  maxRows = 25,
  maxCols = 20
): unknown[][] {
  return grid.slice(0, maxRows).map((row) =>
    (row as unknown[]).slice(0, maxCols)
  );
}

/** Convert a header string to a camelCase id. */
function toCamelCase(header: string): string {
  return header
    .trim()
    .replace(/[^a-zA-Z0-9 _-]/g, "")
    .replace(/[\s_-]+(.)/g, (_, c: string) => c.toUpperCase())
    .replace(/^(.)/, (_, c: string) => c.toLowerCase())
    .replace(/^[^a-zA-Z]/, "x");
}

/**
 * Convert grid data rows to keyed objects using the generated schema's field ids.
 * Maps by column order: header row → field id, subsequent rows → values.
 */
function gridToRows(
  grid: unknown[][],
  schema: ToolSchema
): Record<string, unknown>[] {
  if (grid.length < 2) return [];
  const headers = (grid[0] as unknown[]).map((h) =>
    toCamelCase(String(h ?? ""))
  );
  const fieldIds = schema.fields.map((f) => f.id);

  return grid.slice(1).map((row) => {
    const obj: Record<string, unknown> = {};
    fieldIds.forEach((fid, fi) => {
      // match field id to header position by id equality or fallback to column order
      const headerIdx = headers.indexOf(fid);
      const val = headerIdx >= 0 ? (row as unknown[])[headerIdx] : (row as unknown[])[fi];
      obj[fid] = val ?? "";
    });
    return obj;
  });
}

/**
 * expr-eval is not JavaScript. Spelling this out stops the model reaching for
 * `&&` / `||` / `!`, which are parse errors and render as blank cells.
 */
const EXPRESSION_RULES = `Expression language (expr-eval — NOT JavaScript):
- Arithmetic: + - * / % ^ and parentheses
- Comparison: == != < <= > >=
- Boolean operators are the WORDS "and", "or", "not". Never use && || !
- Conditionals use the ternary form: condition ? valueIfTrue : valueIfFalse
- Functions allowed: min, max, abs, round, ceil, floor
- String equality must be quoted: serviceType == "AC Repair"
- A boolean field is already true/false — write "rushJob and completed", NOT "rushJob == \\"Yes\\""
- An expression may reference field ids AND the ids of other computed columns
  (e.g. rushSurcharge can use totalCost). Define a column before the ones that use it.
- Never reference a column that does not exist, and never let a column reference itself.`;

const SYSTEM_PROMPT = `You are an operations analyst. Given a raw spreadsheet grid (first row = headers, remaining rows = data), infer a ToolSchema JSON object for a small business internal tool.

Rules:
- Return ONLY valid JSON. No prose, no markdown fences, no explanation.
- The JSON must match this TypeScript type exactly:
  {
    "id": string,           // kebab-case slug, unique
    "name": string,         // human-readable tool name
    "description": string,  // 1-sentence description
    "fields": [
      {
        "id": string,         // camelCase of the header
        "label": string,      // original header text
        "type": "text"|"number"|"currency"|"percent"|"select"|"date"|"boolean",
        "required"?: boolean,
        "options"?: string[]  // only for type "select", list the unique values seen
      }
    ],
    "computed": [
      {
        "id": string,
        "label": string,
        "expression": string,  // expr-eval expression using field ids; operators + - * / , comparisons, parens, min/max/abs/round only
        "type"?: "text"|"number"|"currency"|"percent"|"select"|"date"|"boolean"
      }
    ]
  }

Type inference rules:
- If all non-empty values are numbers (possibly with $ or ,) → "currency" if $ present, else "number"
- If values end in % → "percent" (store numeric portion)
- If ≤ 6 distinct non-empty string values across rows → "select" with those as options
- If values look like dates → "date"
- If values are yes/no/true/false → "boolean"
- Otherwise → "text"

${EXPRESSION_RULES}

Propose 1–3 useful computed columns.`;

async function callAndParse(
  messages: Parameters<typeof callOpenRouter>[0]
): Promise<{ schema: ToolSchema } | { error: string; raw: string }> {
  let raw: string;
  try {
    raw = await callOpenRouter(messages);
  } catch (e) {
    return { error: (e as Error).message, raw: "" };
  }

  const cleaned = stripFences(raw);
  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    return { error: "Model returned non-JSON", raw };
  }

  const result = ToolSchemaSchema.safeParse(parsed);
  if (result.success) return { schema: result.data };
  return { error: result.error.message, raw };
}

// ── routes ───────────────────────────────────────────────────────────────────

// GET /api/tools — list all tools (id, name, description)
// Skips any row whose schema_json fails to parse — logs a warning instead of crashing
tools.get("/", (c) => {
  const rows = db
    .prepare(
      "SELECT id, name, description, schema_json, created_at FROM tools ORDER BY created_at DESC"
    )
    .all() as {
    id: string;
    name: string;
    description: string;
    schema_json: string;
    created_at: number;
  }[];

  const valid = rows.filter((row) => {
    try {
      const parsed = JSON.parse(row.schema_json);
      const result = ToolSchemaSchema.safeParse(parsed);
      if (!result.success) {
        console.warn(`[tools] Skipping tool "${row.id}" — schema invalid:`, result.error.message);
        return false;
      }
      return true;
    } catch {
      console.warn(`[tools] Skipping tool "${row.id}" — schema_json unparseable`);
      return false;
    }
  });

  return c.json({
    tools: valid.map(({ id, name, description, created_at }) => ({
      id, name, description, created_at,
    })),
  });
});

// GET /api/tools/:id — get full tool schema + rows
tools.get("/:id", (c) => {
  const id = c.req.param("id");
  const tool = db
    .prepare("SELECT schema_json FROM tools WHERE id = ?")
    .get(id) as { schema_json: string } | undefined;

  if (!tool) return c.json({ error: "Tool not found" }, 404);

  let schema: ToolSchema;
  try {
    const parsed = JSON.parse(tool.schema_json);
    const result = ToolSchemaSchema.safeParse(parsed);
    if (!result.success) {
      return c.json({ error: "Tool schema is invalid", detail: result.error.message }, 422);
    }
    schema = result.data;
  } catch {
    return c.json({ error: "Tool schema could not be read" }, 500);
  }

  const rawRows = db
    .prepare("SELECT id, data_json FROM tool_rows WHERE tool_id = ?")
    .all(id) as { id: number; data_json: string }[];

  const data = rawRows.flatMap((r) => {
    try {
      return [{ _rowId: r.id, ...(JSON.parse(r.data_json) as Record<string, unknown>) }];
    } catch {
      return []; // skip unparseable rows silently
    }
  });

  return c.json({ schema, data });
});

// POST /api/tools — save a new schema
tools.post("/", async (c) => {
  const body = (await c.req.json()) as ToolSchema;
  const existing = db.prepare("SELECT id FROM tools WHERE id = ?").get(body.id);

  if (existing) {
    db.prepare(
      "UPDATE tools SET name=?, description=?, schema_json=? WHERE id=?"
    ).run(body.name, body.description, JSON.stringify(body), body.id);
  } else {
    db.prepare(
      "INSERT INTO tools (id, name, description, schema_json) VALUES (?,?,?,?)"
    ).run(body.id, body.name, body.description, JSON.stringify(body));
  }

  return c.json({ ok: true, id: body.id });
});

// POST /api/tools/generate — real generation via OpenRouter
// Falls back to hardcoded sample if OPENROUTER_API_KEY is unset (offline demo).
tools.post("/generate", async (c) => {
  const body = (await c.req.json()) as {
    grid: unknown[][];
    hint?: string;
  };

  // ── Offline fallback ──────────────────────────────────────────────────────
  if (!process.env.OPENROUTER_API_KEY) {
    const schema = { ...SAMPLE_TOOL_SCHEMA, id: `demo-${Date.now()}` };
    const dataRows = gridToRows(body.grid ?? [], schema);
    persistTool(schema, dataRows);
    return c.json({ schema, rowCount: dataRows.length });
  }

  // ── Build prompt ──────────────────────────────────────────────────────────
  const trimmed = trimGrid(body.grid ?? []);
  const gridText = trimmed.map((row) => (row as unknown[]).join("\t")).join("\n");

  const userContent = body.hint
    ? `Spreadsheet data:\n\n${gridText}\n\nAdditional hint: ${body.hint}`
    : `Spreadsheet data:\n\n${gridText}`;

  const messages: Parameters<typeof callOpenRouter>[0] = [
    { role: "system", content: SYSTEM_PROMPT },
    { role: "user", content: userContent },
  ];

  // ── First attempt ─────────────────────────────────────────────────────────
  let result = await callAndParse(messages);

  // ── One repair retry if invalid ───────────────────────────────────────────
  if ("error" in result && result.raw) {
    const repairMessages: Parameters<typeof callOpenRouter>[0] = [
      ...messages,
      { role: "assistant", content: result.raw },
      {
        role: "user",
        content: `Your response failed Zod validation with this error:\n${result.error}\n\nPlease return corrected JSON only, no prose, no fences.`,
      },
    ];
    result = await callAndParse(repairMessages);
  }

  if ("error" in result) {
    return c.json({ error: result.error, raw: result.raw }, 422);
  }

  // ── Assign fresh id, persist, return ─────────────────────────────────────
  const schema: ToolSchema = {
    ...result.schema,
    id: `tool-${randomUUID().slice(0, 8)}`,
  };
  const dataRows = gridToRows(body.grid ?? [], schema);
  persistTool(schema, dataRows);

  return c.json({ schema, rowCount: dataRows.length });
});

const EDIT_SYSTEM_PROMPT = `You edit an existing Opsmith ToolSchema.
You are given the current schema as JSON and a plain-language instruction.
Return the COMPLETE updated ToolSchema as JSON only — no prose, no fences.
Preserve all existing fields and computed columns unless the instruction implies changing them.
Keep ids stable for unchanged items. The top-level "id" field must remain unchanged.
A new computed column must be appended AFTER any column it references.

${EXPRESSION_RULES}`;

// POST /api/tools/:id/edit — real NL schema edit via OpenRouter
tools.post("/:id/edit", async (c) => {
  const id = c.req.param("id");
  const row = db
    .prepare("SELECT schema_json FROM tools WHERE id = ?")
    .get(id) as { schema_json: string } | undefined;

  if (!row) return c.json({ error: "Tool not found" }, 404);

  const { instruction } = (await c.req.json()) as { instruction: string };
  if (!instruction?.trim()) return c.json({ error: "instruction is required" }, 400);

  const currentSchema = JSON.parse(row.schema_json) as ToolSchema;

  const messages: Parameters<typeof callOpenRouter>[0] = [
    { role: "system", content: EDIT_SYSTEM_PROMPT },
    {
      role: "user",
      content: `Current schema:\n${JSON.stringify(currentSchema, null, 2)}\n\nInstruction: ${instruction}`,
    },
  ];

  let result = await callAndParse(messages);

  // One repair retry
  if ("error" in result && result.raw) {
    const repairMessages: Parameters<typeof callOpenRouter>[0] = [
      ...messages,
      { role: "assistant", content: result.raw },
      {
        role: "user",
        content: `Your response failed Zod validation:\n${result.error}\n\nReturn corrected JSON only, no prose, no fences. The "id" field must stay "${id}".`,
      },
    ];
    result = await callAndParse(repairMessages);
  }

  if ("error" in result) {
    return c.json({ error: result.error, raw: result.raw }, 422);
  }

  // Force the id to stay stable regardless of what the model returned
  const updated: ToolSchema = { ...result.schema, id };

  db.prepare(
    "UPDATE tools SET name=?, description=?, schema_json=? WHERE id=?"
  ).run(updated.name, updated.description, JSON.stringify(updated), id);

  return c.json({ schema: updated });
});

// POST /api/tools/:id/data — save rows for a tool
tools.post("/:id/data", async (c) => {
  const id = c.req.param("id");
  const tool = db.prepare("SELECT id FROM tools WHERE id = ?").get(id);
  if (!tool) return c.json({ error: "Tool not found" }, 404);

  const body = (await c.req.json()) as { rows: Record<string, unknown>[] };

  const insert = db.prepare(
    "INSERT INTO tool_rows (tool_id, data_json) VALUES (?, ?)"
  );
  const insertMany = db.transaction((rows: Record<string, unknown>[]) => {
    for (const row of rows) {
      insert.run(id, JSON.stringify(row));
    }
  });
  insertMany(body.rows);

  return c.json({ ok: true, inserted: body.rows.length });
});

// GET /api/tools/:id/export — CSV download with all fields + evaluated computed cols
tools.get("/:id/export", (c) => {
  const id = c.req.param("id");
  const toolRow = db
    .prepare("SELECT schema_json FROM tools WHERE id = ?")
    .get(id) as { schema_json: string } | undefined;
  if (!toolRow) return c.json({ error: "Tool not found" }, 404);

  const schema = JSON.parse(toolRow.schema_json) as ToolSchema;
  const dataRows = db
    .prepare("SELECT data_json FROM tool_rows WHERE tool_id = ? ORDER BY id")
    .all(id) as { data_json: string }[];

  const rows = dataRows.map((r) => JSON.parse(r.data_json) as Record<string, unknown>);

  // Build CSV
  const slugName = schema.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  const headers = [
    ...schema.fields.map((f) => f.label),
    ...schema.computed.map((c) => c.label),
  ];

  function csvCell(v: unknown): string {
    const s = v === null || v === undefined ? "" : String(v);
    return s.includes(",") || s.includes('"') || s.includes("\n")
      ? `"${s.replace(/"/g, '""')}"`
      : s;
  }

  const lines: string[] = [headers.map(csvCell).join(",")];

  const fieldTypes = Object.fromEntries(
    schema.fields.map((f) => [f.id, f.type])
  );

  for (const row of rows) {
    // Mirrors the table: computed columns may build on one another.
    const computedValues = evaluateComputedColumns(
      schema.computed,
      row,
      fieldTypes
    );
    const cells = [
      ...schema.fields.map((f) => {
        const v = row[f.id];
        if (f.type === "currency") return csvCell(`$${Number(v).toFixed(2)}`);
        if (f.type === "percent") return csvCell(`${v}%`);
        if (f.type === "boolean") {
          const b = toBoolean(v);
          return csvCell(b === null ? v : b ? "Yes" : "No");
        }
        if (f.type === "date") return csvCell(formatDateValue(v) ?? v);
        return csvCell(v);
      }),
      ...schema.computed.map((comp) => {
        const result = computedValues[comp.id];
        if (result === null || result === undefined) return "";
        if (comp.type === "currency") return csvCell(`$${Number(result).toFixed(2)}`);
        if (comp.type === "percent") return csvCell(`${result}%`);
        if (comp.type === "boolean")
          return csvCell((toBoolean(result) ?? Boolean(result)) ? "Yes" : "No");
        if (comp.type === "number") {
          const n = Number(result);
          return csvCell(Number.isInteger(n) ? String(n) : n.toFixed(2));
        }
        return csvCell(result);
      }),
    ];
    lines.push(cells.join(","));
  }

  const csv = lines.join("\r\n");

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${slugName}.csv"`,
    },
  });
});

// POST /api/demo/reset — wipes user-created tools, re-seeds the known-good sample
tools.post("/demo/reset", (c) => {
  // Delete everything EXCEPT the seeded sample (we'll just delete all and re-seed)
  db.transaction(() => {
    db.prepare("DELETE FROM tool_rows").run();
    db.prepare("DELETE FROM tools").run();

    // Re-seed sample tool
    db.prepare(
      "INSERT INTO tools (id, name, description, schema_json) VALUES (?, ?, ?, ?)"
    ).run(
      SAMPLE_TOOL_SCHEMA.id,
      SAMPLE_TOOL_SCHEMA.name,
      SAMPLE_TOOL_SCHEMA.description,
      JSON.stringify(SAMPLE_TOOL_SCHEMA)
    );

    const insertRow = db.prepare(
      "INSERT INTO tool_rows (tool_id, data_json) VALUES (?, ?)"
    );
    for (const row of SAMPLE_ROWS) {
      insertRow.run(SAMPLE_TOOL_SCHEMA.id, JSON.stringify(row));
    }
  })();

  return c.json({ ok: true, message: "Demo reset to clean state" });
});

export default tools;
