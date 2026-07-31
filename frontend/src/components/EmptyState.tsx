import { Button } from "@/components/ui/button";
import { ArrowRight, FileSpreadsheet, Upload, Wrench } from "lucide-react";

interface EmptyStateProps {
  onUpload: () => void;
}

const STEPS = ["Upload your sheet", "We read the columns", "Totals stay live"];

export function EmptyState({ onUpload }: EmptyStateProps) {
  return (
    <div className="relative flex h-full items-center justify-center overflow-hidden px-6 py-10">
      {/* a soft pool of light behind the mark — depth without decoration */}
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-1/2 size-[46rem] -translate-x-1/2 -translate-y-[58%] rounded-full bg-[radial-gradient(circle,hsl(var(--primary)/0.06),transparent_62%)]"
      />

      <div className="relative flex w-full max-w-xl flex-col items-center text-center animate-fade-in-up">
        <div className="relative mb-7">
          <span
            aria-hidden
            className="absolute inset-0 rounded-2xl bg-primary/10 blur-lg"
          />
          <span className="relative flex size-14 items-center justify-center rounded-2xl border border-border bg-card shadow-md">
            <Wrench className="size-6 text-primary" strokeWidth={1.75} />
          </span>
        </div>

        <h1 className="text-2xl font-semibold text-foreground">
          Turn a messy spreadsheet into a working tool
        </h1>
        <p className="mt-2.5 max-w-[30rem] text-md leading-relaxed text-muted-foreground">
          Upload the file you already keep your numbers in. Opsmith works out the
          fields, the types, and the formulas between them.
        </p>

        <Button size="lg" className="mt-7" onClick={onUpload}>
          <Upload />
          Upload spreadsheet
        </Button>

        <p className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground">
          <FileSpreadsheet className="size-3.5" />
          Accepts .xlsx, .xls and .csv
        </p>

        <div className="mt-10 flex w-full items-center justify-center gap-4 border-t border-border/70 pt-6">
          {STEPS.map((step, i) => (
            <div key={step} className="flex items-center gap-4">
              {i > 0 && (
                <ArrowRight
                  aria-hidden
                  className="size-3.5 shrink-0 text-border"
                />
              )}
              <p className="whitespace-nowrap text-xs text-muted-foreground">
                <span className="mr-1.5 font-mono text-2xs text-primary/70">
                  0{i + 1}
                </span>
                {step}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
