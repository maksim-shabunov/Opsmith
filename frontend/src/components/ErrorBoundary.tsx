import { Component } from "react";
import type { ReactNode, ErrorInfo } from "react";
import { Button } from "@/components/ui/button";
import { AlertCircle } from "lucide-react";

interface Props {
  children: ReactNode;
  /** Optional label shown in the fallback card */
  label?: string;
  /** Called when the user clicks "Reset view" */
  onReset?: () => void;
}

interface State {
  hasError: boolean;
  message: string;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, message: "" };

  static getDerivedStateFromError(error: unknown): State {
    return {
      hasError: true,
      message: error instanceof Error ? error.message : String(error),
    };
  }

  componentDidCatch(error: unknown, info: ErrorInfo) {
    console.error("[ErrorBoundary]", error, info.componentStack);
  }

  reset() {
    this.setState({ hasError: false, message: "" });
    this.props.onReset?.();
  }

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div className="m-6 flex max-w-xl flex-col items-start gap-3 rounded-xl border border-destructive/25 bg-destructive/[0.05] p-6">
        <div className="flex items-center gap-2 text-destructive">
          <AlertCircle className="size-4 shrink-0" />
          <span className="text-md font-medium">
            {this.props.label ?? "Something went wrong rendering this tool"}
          </span>
        </div>
        {this.state.message && (
          <p className="w-full break-all rounded-md border border-border bg-card px-3 py-2 font-mono text-xs leading-relaxed text-muted-foreground">
            {this.state.message}
          </p>
        )}
        <Button
          size="sm"
          variant="outline"
          onClick={() => this.reset()}
        >
          Reset view
        </Button>
      </div>
    );
  }
}
