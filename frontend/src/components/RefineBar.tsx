import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { AlertCircle, CornerDownLeft, Loader2, Sparkles } from "lucide-react";

interface RefineBarProps {
  value: string;
  onChange: (v: string) => void;
  onSubmit: () => void;
  busy: boolean;
  error: string | null;
}

/**
 * The headline interaction: describe a change in plain language and the tool
 * rewrites itself. Presentation only — all state lives in App.
 */
export function RefineBar({
  value,
  onChange,
  onSubmit,
  busy,
  error,
}: RefineBarProps) {
  return (
    <div className="space-y-2">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          onSubmit();
        }}
      >
        <div
          className={cn(
            "group relative flex items-center gap-2.5 overflow-hidden rounded-xl border bg-card py-1.5 pl-3 pr-1.5 shadow-sm",
            "transition-[border-color,box-shadow] duration-200 ease-out",
            "focus-within:border-primary/45 focus-within:ring-[3px] focus-within:ring-ring/15",
            error ? "border-destructive/40" : "border-border",
            busy && "border-primary/35"
          )}
        >
          {/* light sweeps across the bar while the model is working */}
          {busy && (
            <span
              aria-hidden
              className="pointer-events-none absolute inset-0 -translate-x-full animate-shimmer bg-gradient-to-r from-transparent via-primary/[0.07] to-transparent"
            />
          )}

          <span
            aria-hidden
            className={cn(
              "relative flex size-7 shrink-0 items-center justify-center rounded-md",
              "bg-primary/10 text-primary transition-colors",
              busy && "bg-primary/15"
            )}
          >
            <Sparkles className="size-3.5" />
          </span>

          <input
            value={value}
            onChange={(e) => onChange(e.target.value)}
            disabled={busy}
            aria-label="Refine this tool"
            placeholder="Add a 10% rush surcharge column…"
            className={cn(
              "relative h-8 min-w-0 flex-1 bg-transparent text-base text-foreground outline-none",
              /* the wrapper owns the focus treatment — no ring on the field itself */
              "focus-visible:ring-0 focus-visible:ring-offset-0",
              "placeholder:text-muted-foreground/70 disabled:cursor-not-allowed disabled:opacity-70"
            )}
          />

          {value.trim() && !busy && (
            <kbd className="relative hidden shrink-0 items-center gap-1 rounded border border-border bg-muted px-1.5 py-1 text-2xs font-medium text-muted-foreground sm:inline-flex">
              <CornerDownLeft className="size-3" />
            </kbd>
          )}

          <Button
            type="submit"
            size="sm"
            className="relative h-8 shrink-0 px-3"
            disabled={busy || !value.trim()}
          >
            {busy ? (
              <>
                <Loader2 className="animate-spin" />
                Rewriting…
              </>
            ) : (
              "Refine"
            )}
          </Button>
        </div>
      </form>

      {error ? (
        <p className="flex items-start gap-1.5 pl-0.5 text-xs text-destructive">
          <AlertCircle className="mt-px size-3.5 shrink-0" />
          <span>{error}</span>
        </p>
      ) : (
        <p className="pl-0.5 text-xs text-muted-foreground">
          {busy
            ? "Reading the schema and applying your change…"
            : "Describe a change in plain English — new columns are calculated the moment they appear."}
        </p>
      )}
    </div>
  );
}
