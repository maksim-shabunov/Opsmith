import { Parser } from "expr-eval";

const parser = new Parser();

/** Field id → declared type, so the scope can be coerced faithfully. */
export type FieldTypes = Record<string, string | undefined>;

export interface ComputedColumn {
  id: string;
  expression: string;
  type?: string;
}

const TRUE_TOKENS = new Set(["true", "yes", "y", "t", "1", "x", "on", "✓"]);
const FALSE_TOKENS = new Set(["false", "no", "n", "f", "0", "off", "-", "—", ""]);

/**
 * Coerce a spreadsheet cell to a real boolean.
 *
 * Spreadsheets store booleans as "Yes"/"No" text, and a bare `Boolean("No")`
 * is `true` — so truthiness alone silently inverts half the data. Returns null
 * when the value isn't recognisably boolean, so callers can fall back rather
 * than guess.
 */
export function toBoolean(value: unknown): boolean | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value !== 0;
  const s = String(value).trim().toLowerCase();
  if (TRUE_TOKENS.has(s)) return true;
  if (FALSE_TOKENS.has(s)) return false;
  return null;
}

/** Excel stores dates as days since 1899-12-30, which reach us as bare numbers. */
const EXCEL_EPOCH_UTC = Date.UTC(1899, 11, 30);
const EXCEL_SERIAL_MIN = 20000; // ~1954, below this a number is unlikely to be a date
const EXCEL_SERIAL_MAX = 60000; // ~2064

/**
 * Render a date cell as YYYY-MM-DD.
 * Handles Excel serial numbers, ISO strings, and anything Date can parse;
 * returns null when the value isn't a date, so callers can show it verbatim.
 */
export function formatDateValue(value: unknown): string | null {
  if (value === null || value === undefined || value === "") return null;

  const serial =
    typeof value === "number"
      ? value
      : typeof value === "string" && /^\d+(\.\d+)?$/.test(value.trim())
        ? Number(value)
        : null;

  if (serial !== null) {
    if (serial < EXCEL_SERIAL_MIN || serial > EXCEL_SERIAL_MAX) return null;
    const d = new Date(EXCEL_EPOCH_UTC + Math.round(serial * 86400000));
    return isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
  }

  const parsed = new Date(String(value));
  return isNaN(parsed.getTime()) ? null : parsed.toISOString().slice(0, 10);
}

/** "$1,240.50" / "37%" → 1240.5 / 37. Returns null if it isn't a number. */
function toNumberish(value: string): number | null {
  const cleaned = value.trim().replace(/[$€£,\s]/g, "").replace(/%$/, "");
  if (cleaned === "" || isNaN(Number(cleaned))) return null;
  return Number(cleaned);
}

/** Build the variable scope a formula sees for one row. */
function buildScope(
  row: Record<string, unknown>,
  fieldTypes?: FieldTypes
): Record<string, unknown> {
  const scope: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(row)) {
    if (fieldTypes?.[k] === "boolean") {
      const b = toBoolean(v);
      scope[k] = b === null ? v : b;
      continue;
    }
    if (typeof v === "string") {
      const n = toNumberish(v);
      scope[k] = n === null ? v : n;
      continue;
    }
    scope[k] = v;
  }
  return scope;
}

function run(expr: string, scope: Record<string, unknown>) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const result = parser.evaluate(expr, scope as any);
  // Guard: treat NaN / ±Infinity as evaluation failures
  if (typeof result === "number" && !isFinite(result)) return null;
  return result;
}

/**
 * Evaluate an expr-eval expression against a data row.
 * Returns null on any error (bad expression, missing variable, etc.).
 */
export function evaluateExpression(
  expr: string,
  row: Record<string, unknown>,
  fieldTypes?: FieldTypes
): unknown | null {
  try {
    return run(expr, buildScope(row, fieldTypes));
  } catch {
    return null;
  }
}

/**
 * Evaluate every computed column for a row, letting each one build on the
 * results of the others ("rush surcharge = 15% of total cost").
 *
 * Resolution repeats until a pass produces nothing new, so columns work in any
 * order. Anything still unresolved — a genuine typo, or a circular reference —
 * settles at null instead of looping.
 */
export function evaluateComputedColumns(
  computed: ComputedColumn[],
  row: Record<string, unknown>,
  fieldTypes?: FieldTypes
): Record<string, unknown> {
  const scope = buildScope(row, fieldTypes);
  const results: Record<string, unknown> = {};
  const pending = [...computed];

  let progressed = true;
  while (pending.length > 0 && progressed) {
    progressed = false;
    for (let i = pending.length - 1; i >= 0; i--) {
      const col = pending[i];
      let value: unknown;
      try {
        value = run(col.expression, scope);
      } catch {
        continue; // probably depends on a column we haven't resolved yet
      }
      results[col.id] = value;
      if (value !== null && value !== undefined) {
        scope[col.id] = col.type === "boolean" ? toBoolean(value) ?? value : value;
      }
      pending.splice(i, 1);
      progressed = true;
    }
  }

  for (const col of pending) results[col.id] = null;
  return results;
}
