import { CheckCircle2, Info, X, XCircle } from "lucide-react";
import type { Toast, ToastVariant } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

const accents: Record<ToastVariant, string> = {
  default: "text-muted-foreground",
  success: "text-success",
  error: "text-destructive",
};

const icons: Record<ToastVariant, React.ReactNode> = {
  default: <Info className="size-4 shrink-0" />,
  success: <CheckCircle2 className="size-4 shrink-0" />,
  error: <XCircle className="size-4 shrink-0" />,
};

interface ToastContainerProps {
  toasts: Toast[];
  dismiss: (id: number) => void;
}

export function ToastContainer({ toasts, dismiss }: ToastContainerProps) {
  if (toasts.length === 0) return null;
  return (
    <div className="pointer-events-none fixed bottom-5 right-5 z-50 flex w-[21rem] flex-col gap-2">
      {toasts.map((t) => (
        <div
          key={t.id}
          role="status"
          className={cn(
            "pointer-events-auto flex items-start gap-2.5 rounded-lg border border-border bg-card px-3.5 py-3",
            "text-sm text-foreground shadow-lg",
            "animate-in slide-in-from-bottom-3 fade-in-0 duration-250 ease-out"
          )}
        >
          <span className={cn("mt-px", accents[t.variant])}>
            {icons[t.variant]}
          </span>
          <span className="flex-1 leading-snug">{t.message}</span>
          <button
            onClick={() => dismiss(t.id)}
            aria-label="Dismiss notification"
            className={cn(
              "-mr-1 -mt-0.5 shrink-0 rounded p-1 text-muted-foreground/60",
              "transition-colors hover:bg-muted hover:text-foreground",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/45"
            )}
          >
            <X className="size-3.5" />
          </button>
        </div>
      ))}
    </div>
  );
}
