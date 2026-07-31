import { Parser } from "expr-eval";

const parser = new Parser();

/**
 * Evaluate an expr-eval expression against a data row.
 * Numeric-looking string values are coerced to Number.
 * Returns null on any error — never throws.
 *
 * Used by both the CSV export endpoint and (mirrored in) the frontend evaluator.
 */
export function evaluateExpression(
  expr: string,
  row: Record<string, unknown>
): unknown | null {
  try {
    const scope: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(row)) {
      if (typeof v === "string" && v.trim() !== "" && !isNaN(Number(v))) {
        scope[k] = Number(v);
      } else {
        scope[k] = v;
      }
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = parser.evaluate(expr, scope as any);
    // Guard: treat NaN / ±Infinity as evaluation failures
    if (typeof result === "number" && !isFinite(result)) return null;
    return result;
  } catch {
    return null;
  }
}
