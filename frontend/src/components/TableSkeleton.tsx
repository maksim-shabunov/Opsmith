import { cn } from "@/lib/utils";

/** Column widths that read as a data table rather than a generic grey block. */
const COLS = ["w-32", "w-16", "w-20", "w-20", "w-14", "w-24", "w-20"];
const ROWS = 8;

function Bar({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "relative block h-3 overflow-hidden rounded-sm bg-muted",
        className
      )}
    >
      <span className="absolute inset-0 -translate-x-full animate-shimmer bg-gradient-to-r from-transparent via-card/70 to-transparent" />
    </span>
  );
}

export function TableSkeleton() {
  return (
    <div
      aria-busy="true"
      aria-label="Loading tool"
      className="flex h-full min-h-0 flex-col gap-5 px-6 pb-6 pt-5"
    >
      <div className="space-y-2.5">
        <Bar className="h-5 w-56" />
        <Bar className="h-3 w-96 max-w-full" />
      </div>

      <div className="min-h-0 flex-1 overflow-hidden rounded-xl border border-border bg-card shadow-sm">
        <div className="flex h-10 items-center gap-8 border-b border-border bg-table-head px-4">
          {COLS.map((w, ci) => (
            <Bar key={ci} className={cn("h-2.5", w)} />
          ))}
        </div>
        {Array.from({ length: ROWS }).map((_, i) => (
          <div
            key={i}
            className="flex h-11 items-center gap-8 border-b border-border/60 px-4"
            style={{ opacity: 1 - i * 0.09 }}
          >
            {COLS.map((w, ci) => (
              <Bar key={ci} className={w} />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
