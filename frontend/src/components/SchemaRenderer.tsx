import { useCallback, useEffect, useRef, useState } from "react";
import type { ToolSchema, FieldType } from "@opsmith/shared";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { evaluateExpression } from "@/lib/evaluate";
import { cn } from "@/lib/utils";
import { FunctionSquare, Inbox } from "lucide-react";

const ROW_LIMIT = 100;

const NUMERIC_TYPES: Set<FieldType | undefined> = new Set([
  "number",
  "currency",
  "percent",
]);

/** Long enough that the cell may clip — only these get a tooltip. */
const TRUNCATE_HINT_LENGTH = 22;

interface SchemaRendererProps {
  schema: ToolSchema;
  rows: Record<string, unknown>[];
  newColumnIds?: Set<string>;
}

function formatFieldValue(value: unknown, type: FieldType | undefined): string {
  try {
    if (value === null || value === undefined) return "—";
    if (type === "currency") {
      const n = Number(value);
      if (!isFinite(n)) return "—";
      return `$${n.toFixed(2)}`;
    }
    if (type === "percent") return `${value}%`;
    if (type === "boolean") return value ? "Yes" : "No";
    if (type === "number") {
      const n = Number(value);
      if (!isFinite(n)) return "—";
      return Number.isInteger(n) ? String(n) : n.toFixed(2);
    }
    return String(value);
  } catch {
    return "—";
  }
}

/** Text that clips gracefully, and reveals itself on hover when it does. */
function CellText({
  text,
  className,
}: {
  text: string;
  className?: string;
}) {
  const body = (
    <span className={cn("block truncate", className)}>{text}</span>
  );

  if (text.length <= TRUNCATE_HINT_LENGTH) return body;

  return (
    <Tooltip delayDuration={350}>
      <TooltipTrigger asChild>{body}</TooltipTrigger>
      <TooltipContent side="top" align="start">
        {text}
      </TooltipContent>
    </Tooltip>
  );
}

function ComputedCell({
  value,
  type,
}: {
  value: unknown;
  type: FieldType | undefined;
}) {
  if (value === null || value === undefined) {
    return <span className="text-muted-foreground/60">—</span>;
  }
  if (type === "boolean") {
    const yes = Boolean(value);
    return (
      <Badge dot size="sm" variant={yes ? "success" : "soft"}>
        {yes ? "Yes" : "No"}
      </Badge>
    );
  }
  return (
    <span className="font-medium">{formatFieldValue(value, type)}</span>
  );
}

/** Tracks whether a scroll container has content hidden off its right edge. */
function useOverflowRight() {
  const ref = useRef<HTMLDivElement>(null);
  const [more, setMore] = useState(false);

  const measure = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    setMore(el.scrollWidth - el.clientWidth - el.scrollLeft > 4);
  }, []);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [measure]);

  return { ref, more, onScroll: measure };
}

export function SchemaRenderer({
  schema,
  rows,
  newColumnIds,
}: SchemaRendererProps) {
  const visibleRows = rows.slice(0, ROW_LIMIT);
  const truncated = rows.length > ROW_LIMIT;
  const totalCols = schema.fields.length + schema.computed.length;
  const scroller = useOverflowRight();

  /* First column pins on horizontal scroll so wide tools stay legible.
     Each site supplies its own background so the pinned cell keeps matching
     the band it sits in. */
  const stickyFirst =
    "sticky left-0 after:pointer-events-none after:absolute after:inset-y-0 " +
    "after:right-0 after:w-px after:bg-border";

  return (
    /* sizes to its rows, then caps at the viewport and scrolls */
    <div className="relative flex max-h-full min-h-0 flex-col overflow-hidden rounded-xl border border-border bg-card shadow-sm">
      {/* tells you there are more columns to the right, and gets out of the way */}
      <div
        aria-hidden
        className={cn(
          "pointer-events-none absolute inset-y-0 right-0 z-40 w-12",
          "bg-gradient-to-l from-foreground/[0.055] to-transparent",
          "transition-opacity duration-200",
          scroller.more ? "opacity-100" : "opacity-0"
        )}
      />

      <div
        ref={scroller.ref}
        onScroll={scroller.onScroll}
        className="min-h-0 flex-1 overflow-auto scrollbar-subtle"
      >
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              {schema.fields.map((col, i) => {
                const isNum = NUMERIC_TYPES.has(col.type);
                return (
                  <TableHead
                    key={col.id}
                    scope="col"
                    className={cn(
                      "sticky top-0 z-20 bg-table-head",
                      isNum ? "text-right" : "text-left",
                      i === 0 && `${stickyFirst} z-30 bg-table-head`,
                      newColumnIds?.has(col.id) && "animate-column-land"
                    )}
                  >
                    <span className="block whitespace-nowrap">{col.label}</span>
                  </TableHead>
                );
              })}

              {schema.computed.map((col, i) => {
                const isNum = NUMERIC_TYPES.has(col.type);
                return (
                  <TableHead
                    key={col.id}
                    scope="col"
                    className={cn(
                      "sticky top-0 z-20 bg-computed-head",
                      /* the seam between entered data and calculated data */
                      i === 0 && "border-l border-l-border",
                      isNum ? "text-right" : "text-left",
                      newColumnIds?.has(col.id) && "animate-column-land"
                    )}
                  >
                    <span
                      className={cn(
                        "flex items-center gap-1.5 whitespace-nowrap",
                        isNum && "justify-end"
                      )}
                    >
                      <Tooltip delayDuration={200}>
                        <TooltipTrigger asChild>
                          <span
                            className="inline-flex cursor-help items-center text-primary/70 transition-colors hover:text-primary"
                            aria-label={`Computed from ${col.expression}`}
                          >
                            <FunctionSquare className="size-3.5" />
                          </span>
                        </TooltipTrigger>
                        <TooltipContent side="top">
                          <span className="text-muted-foreground">
                            Computed ·{" "}
                          </span>
                          <code className="font-mono">{col.expression}</code>
                        </TooltipContent>
                      </Tooltip>
                      <span className="text-foreground/75">{col.label}</span>
                    </span>
                  </TableHead>
                );
              })}
            </TableRow>
          </TableHeader>

          <TableBody>
            {visibleRows.length === 0 ? (
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={totalCols || 1} className="h-auto border-b-0">
                  <div className="flex flex-col items-center gap-2.5 px-6 py-16 text-center">
                    <span className="flex size-10 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                      <Inbox className="size-5" />
                    </span>
                    <p className="text-base font-medium text-foreground">
                      No rows yet
                    </p>
                    <p className="max-w-xs text-sm text-muted-foreground">
                      The structure is ready — this tool just has no data in it
                      yet.
                    </p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              visibleRows.map((row, i) => (
                <TableRow key={(row._rowId as number | undefined) ?? i}>
                  {schema.fields.map((field, fi) => {
                    const text = formatFieldValue(row[field.id], field.type);
                    const isNum = NUMERIC_TYPES.has(field.type);
                    return (
                      <TableCell
                        key={field.id}
                        className={cn(
                          isNum ? "text-right" : "text-left",
                          fi === 0 &&
                            `${stickyFirst} z-10 bg-card font-medium group-hover/row:bg-table-hover`,
                          newColumnIds?.has(field.id) && "animate-column-land"
                        )}
                      >
                        <CellText
                          text={text}
                          className={cn(
                            isNum ? "num max-w-[160px]" : "max-w-[220px]",
                            text === "—" && "text-muted-foreground/60"
                          )}
                        />
                      </TableCell>
                    );
                  })}

                  {schema.computed.map((c, ci) => {
                    const result = evaluateExpression(c.expression, row);
                    const isNum = NUMERIC_TYPES.has(c.type);
                    return (
                      <TableCell
                        key={c.id}
                        className={cn(
                          "bg-computed-cell group-hover/row:bg-computed-cell-hover",
                          ci === 0 && "border-l border-l-border",
                          isNum ? "text-right num" : "text-left",
                          newColumnIds?.has(c.id) && "animate-column-land"
                        )}
                      >
                        <ComputedCell value={result} type={c.type} />
                      </TableCell>
                    );
                  })}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <div className="flex shrink-0 items-center justify-between gap-4 border-t border-border bg-card px-4 py-2.5">
        <p className="text-xs text-muted-foreground">
          {rows.length === 0 ? (
            "No rows"
          ) : truncated ? (
            <>
              Showing <span className="num font-medium text-foreground">{ROW_LIMIT}</span>{" "}
              of <span className="num font-medium text-foreground">{rows.length}</span>{" "}
              rows
            </>
          ) : (
            <>
              <span className="num font-medium text-foreground">
                {rows.length}
              </span>{" "}
              {rows.length === 1 ? "row" : "rows"}
            </>
          )}
        </p>
        {schema.computed.length > 0 && (
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <FunctionSquare className="size-3.5 text-primary/70" />
            <span className="num font-medium text-foreground">
              {schema.computed.length}
            </span>{" "}
            {schema.computed.length === 1 ? "column" : "columns"} recalculated
            live
          </p>
        )}
      </div>
    </div>
  );
}
