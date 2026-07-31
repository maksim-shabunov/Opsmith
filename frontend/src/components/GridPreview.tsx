import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { AlertCircle, Loader2, Sparkles } from "lucide-react";

const PREVIEW_ROWS = 20;

interface GridPreviewProps {
  grid: unknown[][];
  sheetName: string;
  generating: boolean;
  statusLabel: string;
  error: string | null;
  onGenerate: () => void;
}

/** Step between "file picked" and "tool exists" — show them what was read. */
export function GridPreview({
  grid,
  sheetName,
  generating,
  statusLabel,
  error,
  onGenerate,
}: GridPreviewProps) {
  const [headerRow, ...bodyRows] = grid;
  const visible = bodyRows.slice(0, PREVIEW_ROWS);
  const hidden = Math.max(0, bodyRows.length - visible.length);

  return (
    <div className="flex h-full min-h-0 flex-col gap-4 px-6 pb-6 pt-5">
      <div className="flex shrink-0 flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-xl font-semibold tracking-[-0.016em] text-foreground">
            Review what we read
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            <span className="num font-medium text-foreground">
              {grid.length}
            </span>{" "}
            rows from sheet{" "}
            <span className="font-mono text-xs text-foreground">
              {sheetName}
            </span>
            . Generate a tool and Opsmith infers the fields and formulas.
          </p>
        </div>

        <Button onClick={onGenerate} disabled={generating} className="shrink-0">
          {generating ? (
            <>
              <Loader2 className="animate-spin" />
              {statusLabel}
            </>
          ) : (
            <>
              <Sparkles />
              Generate tool
            </>
          )}
        </Button>
      </div>

      {error && (
        <div className="flex shrink-0 items-start gap-2.5 rounded-lg border border-destructive/25 bg-destructive/[0.06] px-3.5 py-3 text-sm text-destructive">
          <AlertCircle className="mt-px size-4 shrink-0" />
          <span className="leading-relaxed">{error}</span>
        </div>
      )}

      <div className="min-h-0 flex-1">
        <div
          className={cn(
            "relative flex max-h-full flex-col overflow-hidden rounded-xl border border-border bg-card shadow-sm",
            "transition-opacity duration-300",
            generating && "opacity-75"
          )}
        >
          {generating && (
            <span
              aria-hidden
              className="absolute inset-x-0 top-0 z-40 h-0.5 overflow-hidden bg-primary/12"
            >
              <span className="block h-full w-1/4 animate-indeterminate bg-primary" />
            </span>
          )}

          <div className="min-h-0 flex-1 overflow-auto scrollbar-subtle">
            <table className="w-full border-separate border-spacing-0 text-xs">
              <tbody>
                {headerRow && (
                  <tr>
                    <th className="sticky left-0 top-0 z-30 w-10 border-b border-r border-border bg-muted px-2 py-2 text-2xs font-medium text-muted-foreground/70" />
                    {(headerRow as unknown[]).map((cell, ci) => (
                      <th
                        key={ci}
                        className="sticky top-0 z-20 whitespace-nowrap border-b border-r border-border bg-table-head px-3 py-2 text-left text-xs font-medium text-foreground last:border-r-0"
                      >
                        {String(cell ?? "")}
                      </th>
                    ))}
                  </tr>
                )}
                {visible.map((row, ri) => (
                  <tr key={ri} className="group/row hover:bg-table-hover">
                    <td className="sticky left-0 z-10 border-b border-r border-border bg-muted/60 px-2 py-1.5 text-right align-top font-mono text-2xs text-muted-foreground/70 group-hover/row:bg-muted">
                      {ri + 1}
                    </td>
                    {(row as unknown[]).map((cell, ci) => (
                      <td
                        key={ci}
                        className="max-w-[220px] truncate border-b border-r border-border/60 px-3 py-1.5 text-left align-top text-muted-foreground last:border-r-0"
                      >
                        {String(cell ?? "")}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {hidden > 0 && (
            <p className="shrink-0 border-t border-border bg-card px-4 py-2.5 text-xs text-muted-foreground">
              <span className="num font-medium text-foreground">{hidden}</span>{" "}
              more rows not shown in this preview
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
