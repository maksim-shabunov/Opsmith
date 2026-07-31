import { useEffect, useRef, useState } from "react";
import type { ToolSchema } from "@opsmith/shared";
import { SchemaRenderer } from "@/components/SchemaRenderer";
import { UploadButton } from "@/components/UploadButton";
import { ToastContainer } from "@/components/ToastContainer";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { RefineBar } from "@/components/RefineBar";
import { EmptyState } from "@/components/EmptyState";
import { GridPreview } from "@/components/GridPreview";
import { TableSkeleton } from "@/components/TableSkeleton";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Wrench,
  Table2,
  AlertCircle,
  Download,
  RotateCcw,
} from "lucide-react";
import { cn } from "@/lib/utils";

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:8787";

// Rotating status labels for Generate
const GENERATE_LABELS = [
  "Reading your sheet…",
  "Inferring columns…",
  "Building tool…",
];

interface ToolSummary {
  id: string;
  name: string;
  description: string;
  created_at: number;
}

interface ToolDetail {
  schema: ToolSchema;
  data: Record<string, unknown>[];
}

interface GridPreview {
  grid: unknown[][];
  sheetName: string;
}

/** Compact label/value pair used in the tool header. */
function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex flex-col gap-0.5 px-1">
      <span className="num text-sm font-semibold leading-none text-foreground">
        {value}
      </span>
      <span className="text-2xs uppercase leading-none text-muted-foreground">
        {label}
      </span>
    </div>
  );
}

export default function App() {
  const { toasts, toast, dismiss } = useToast();

  const [tools, setTools] = useState<ToolSummary[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [toolDetail, setToolDetail] = useState<ToolDetail | null>(null);
  const [loadingTools, setLoadingTools] = useState(true);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [gridPreview, setGridPreview] = useState<GridPreview | null>(null);
  const [generating, setGenerating] = useState(false);
  const [generateLabel, setGenerateLabel] = useState(0);
  const [generateError, setGenerateError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Refine state
  const [refineInput, setRefineInput] = useState("");
  const [refining, setRefining] = useState(false);
  const [refineError, setRefineError] = useState<string | null>(null);
  const [newColumnIds, setNewColumnIds] = useState<Set<string>>(new Set());
  const highlightTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const labelTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  // Load tool list
  useEffect(() => {
    setLoadingTools(true);
    fetch(`${API_URL}/api/tools`)
      .then((r) => r.json())
      .then((d: { tools: ToolSummary[] }) => {
        setTools(d.tools);
        if (d.tools.length > 0 && !selectedId) {
          setSelectedId(d.tools[0].id);
        }
      })
      .catch(() => setError("Could not reach backend. Is it running?"))
      .finally(() => setLoadingTools(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Load selected tool detail
  useEffect(() => {
    if (!selectedId) return;
    setLoadingDetail(true);
    setToolDetail(null);
    setRefineError(null);
    setNewColumnIds(new Set());
    fetch(`${API_URL}/api/tools/${selectedId}`)
      .then((r) => r.json())
      .then((d: ToolDetail) => setToolDetail(d))
      .catch(() => setError("Failed to load tool."))
      .finally(() => setLoadingDetail(false));
  }, [selectedId]);

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      if (highlightTimer.current) clearTimeout(highlightTimer.current);
      if (labelTimer.current) clearInterval(labelTimer.current);
    };
  }, []);

  function startLabelRotation() {
    setGenerateLabel(0);
    let i = 0;
    labelTimer.current = setInterval(() => {
      i = (i + 1) % GENERATE_LABELS.length;
      setGenerateLabel(i);
    }, 1400);
  }

  function stopLabelRotation() {
    if (labelTimer.current) { clearInterval(labelTimer.current); labelTimer.current = null; }
  }

  async function handleGenerate() {
    if (!gridPreview) return;
    setGenerating(true);
    setGenerateError(null);
    startLabelRotation();

    try {
      const res = await fetch(`${API_URL}/api/tools/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ grid: gridPreview.grid }),
      });

      const json = (await res.json()) as
        | { schema: ToolSchema; rowCount: number }
        | { error: string; raw?: string };

      if (!res.ok || "error" in json) {
        const msg = "error" in json ? json.error : `Server error ${res.status}`;
        setGenerateError(msg);
        toast(msg, "error");
        return;
      }

      const { schema } = json;
      const summary: ToolSummary = {
        id: schema.id,
        name: schema.name,
        description: schema.description,
        created_at: Date.now() / 1000,
      };
      setTools((prev) => [summary, ...prev.filter((t) => t.id !== schema.id)]);
      setGridPreview(null);
      setSelectedId(schema.id);
      toast("Tool created", "success");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Generation failed";
      setGenerateError(msg);
      toast(msg, "error");
    } finally {
      setGenerating(false);
      stopLabelRotation();
    }
  }

  async function handleRefine() {
    if (!selectedId || !toolDetail || !refineInput.trim()) return;
    setRefining(true);
    setRefineError(null);

    const prevFieldIds = new Set([
      ...toolDetail.schema.fields.map((f) => f.id),
      ...toolDetail.schema.computed.map((c) => c.id),
    ]);

    try {
      const res = await fetch(`${API_URL}/api/tools/${selectedId}/edit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ instruction: refineInput.trim() }),
      });

      const json = (await res.json()) as
        | { schema: ToolSchema }
        | { error: string; raw?: string };

      if (!res.ok || "error" in json) {
        const msg = "error" in json ? json.error : `Server error ${res.status}`;
        setRefineError(msg);
        toast(msg, "error");
        return;
      }

      const { schema } = json;

      // Highlight newly added columns
      const added = new Set(
        [
          ...schema.fields.map((f) => f.id),
          ...schema.computed.map((c) => c.id),
        ].filter((id) => !prevFieldIds.has(id))
      );
      setNewColumnIds(added);
      if (highlightTimer.current) clearTimeout(highlightTimer.current);
      if (added.size > 0) {
        highlightTimer.current = setTimeout(() => setNewColumnIds(new Set()), 2000);
      }

      // Update sidebar name if changed
      setTools((prev) =>
        prev.map((t) =>
          t.id === schema.id
            ? { ...t, name: schema.name, description: schema.description }
            : t
        )
      );

      // Hot-swap schema, keep existing rows
      setToolDetail((prev) => (prev ? { ...prev, schema } : prev));
      setRefineInput("");
      toast("Tool updated", "success");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Refinement failed";
      setRefineError(msg);
      toast(msg, "error");
    } finally {
      setRefining(false);
    }
  }

  function handleExport() {
    if (!selectedId) return;
    window.open(`${API_URL}/api/tools/${selectedId}/export`, "_blank");
  }

  async function handleDemoReset() {
    try {
      const res = await fetch(`${API_URL}/api/tools/demo/reset`, { method: "POST" });
      if (!res.ok) throw new Error(`Reset failed: ${res.status}`);
      // Reload tool list and clear current selection
      setSelectedId(null);
      setToolDetail(null);
      setGridPreview(null);
      setError(null);
      const d = (await fetch(`${API_URL}/api/tools`).then((r) => r.json())) as {
        tools: ToolSummary[];
      };
      setTools(d.tools);
      if (d.tools.length > 0) setSelectedId(d.tools[0].id);
      toast("Demo reset to clean state", "success");
    } catch (e) {
      toast(e instanceof Error ? e.message : "Reset failed", "error");
    }
  }

  // Called by empty-state CTA — UploadButton exposes a trigger ref
  const uploadTriggerRef = useRef<HTMLButtonElement>(null);

  const showEmptyState =
    !toolDetail && !loadingDetail && !loadingTools && !gridPreview && !error && tools.length === 0;

  return (
    <TooltipProvider delayDuration={300} skipDelayDuration={200}>
      <div className="flex h-[100dvh] w-full overflow-hidden bg-background font-sans text-foreground">
        {/* ── Sidebar ── */}
        <aside className="flex w-[260px] shrink-0 flex-col border-r border-sidebar-border bg-sidebar">
          <div className="flex h-14 shrink-0 items-center gap-2.5 px-4">
            <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-xs">
              <Wrench className="size-4" strokeWidth={2} />
            </span>
            <span className="text-md font-semibold tracking-[-0.016em] text-sidebar-accent-foreground">
              Opsmith
            </span>
          </div>

          <nav className="scrollbar-subtle flex-1 overflow-y-auto px-2.5 pb-3">
            <div className="flex items-center justify-between px-2 pb-2 pt-1">
              <span className="text-2xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                Tools
              </span>
              {!loadingTools && tools.length > 0 && (
                <span className="num text-2xs font-medium text-muted-foreground/70">
                  {tools.length}
                </span>
              )}
            </div>

            {loadingTools && (
              <div className="space-y-1 px-1">
                {[0, 1, 2].map((i) => (
                  <div
                    key={i}
                    className="h-8 animate-pulse rounded-md bg-foreground/[0.045]"
                    style={{ opacity: 1 - i * 0.25 }}
                  />
                ))}
              </div>
            )}

            <div className="space-y-0.5">
              {tools.map((t) => {
                const active = selectedId === t.id;
                return (
                  <Tooltip key={t.id} delayDuration={600}>
                    <TooltipTrigger asChild>
                      <button
                        onClick={() => {
                          setSelectedId(t.id);
                          setGridPreview(null);
                          setGenerateError(null);
                        }}
                        aria-current={active ? "page" : undefined}
                        className={cn(
                          "flex w-full items-center gap-2.5 rounded-md px-2 py-[7px] text-left text-sm",
                          "transition-[background-color,color,box-shadow] duration-150 ease-out",
                          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/45 focus-visible:ring-offset-1 focus-visible:ring-offset-sidebar",
                          active
                            ? "bg-sidebar-accent font-medium text-sidebar-accent-foreground shadow-xs ring-1 ring-sidebar-border"
                            : "text-sidebar-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground"
                        )}
                      >
                        <Table2
                          className={cn(
                            "size-4 shrink-0 transition-colors",
                            active ? "text-primary" : "text-muted-foreground/70"
                          )}
                          strokeWidth={1.75}
                        />
                        <span className="truncate">{t.name}</span>
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="right" align="center">
                      <span className="font-medium">{t.name}</span>
                      {t.description && (
                        <span className="mt-0.5 block text-muted-foreground">
                          {t.description}
                        </span>
                      )}
                    </TooltipContent>
                  </Tooltip>
                );
              })}
            </div>

            {!loadingTools && tools.length === 0 && (
              <p className="px-2 py-2 text-xs leading-relaxed text-muted-foreground">
                No tools yet. Upload a spreadsheet to build your first one.
              </p>
            )}
          </nav>

          <div className="flex shrink-0 items-center justify-between border-t border-sidebar-border px-3 py-2.5">
            <span className="font-mono text-2xs text-muted-foreground/70">
              v0.1.0
            </span>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={() => void handleDemoReset()}
                  className={cn(
                    "flex items-center gap-1.5 rounded-md px-1.5 py-1 text-2xs text-muted-foreground",
                    "transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/45"
                  )}
                >
                  <RotateCcw className="size-3" />
                  Reset demo
                </button>
              </TooltipTrigger>
              <TooltipContent side="top" align="end">
                Wipe all tools and restore the sample
              </TooltipContent>
            </Tooltip>
          </div>
        </aside>

        {/* ── Main area ── */}
        <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
          {/* Top header bar */}
          <header className="flex h-14 shrink-0 items-center gap-3 border-b border-border bg-card px-6">
            <div className="flex min-w-0 items-center gap-2 text-sm">
              <span className="shrink-0 text-muted-foreground">Tools</span>
              {(toolDetail || gridPreview) && (
                <>
                  <span className="shrink-0 text-border" aria-hidden>
                    /
                  </span>
                  <span className="truncate font-medium text-foreground">
                    {gridPreview
                      ? `Upload · ${gridPreview.sheetName}`
                      : toolDetail?.schema.name}
                  </span>
                </>
              )}
            </div>

            <div className="ml-auto flex shrink-0 items-center gap-2">
              {/* Export CSV — only when tool is open */}
              {toolDetail && !gridPreview && (
                <Button size="sm" variant="ghost" onClick={handleExport}>
                  <Download />
                  Export CSV
                </Button>
              )}
              <UploadButton
                triggerRef={uploadTriggerRef}
                onGrid={(grid, sheetName) => {
                  setGridPreview({ grid, sheetName });
                  setToolDetail(null);
                  setSelectedId(null);
                  setGenerateError(null);
                }}
              />
            </div>
          </header>

          {/* Content */}
          <main className="flex min-h-0 flex-1 flex-col overflow-hidden">
            {error && (
              <div className="mx-6 mt-5 flex shrink-0 items-start gap-2.5 rounded-lg border border-destructive/25 bg-destructive/[0.06] px-3.5 py-3 text-sm text-destructive">
                <AlertCircle className="mt-px size-4 shrink-0" />
                <span className="leading-relaxed">{error}</span>
              </div>
            )}

            {(loadingDetail || (loadingTools && !gridPreview)) && (
              <TableSkeleton />
            )}

            {/* Grid preview */}
            {gridPreview && !loadingDetail && (
              <GridPreview
                grid={gridPreview.grid}
                sheetName={gridPreview.sheetName}
                generating={generating}
                statusLabel={GENERATE_LABELS[generateLabel]}
                error={generateError}
                onGenerate={() => void handleGenerate()}
              />
            )}

            {/* Tool view */}
            {toolDetail && !gridPreview && (
              <ErrorBoundary
                label="Something went wrong rendering this tool"
                onReset={() => {
                  setToolDetail(null);
                  setSelectedId(null);
                }}
              >
                <div className="flex h-full min-h-0 flex-col gap-4 px-6 pb-6 pt-5">
                  <div className="flex shrink-0 flex-wrap items-start justify-between gap-x-6 gap-y-3">
                    <div className="min-w-0">
                      <h1 className="truncate text-xl font-semibold tracking-[-0.016em] text-foreground">
                        {toolDetail.schema.name}
                      </h1>
                      <p className="mt-1 max-w-2xl text-sm leading-relaxed text-muted-foreground">
                        {toolDetail.schema.description}
                      </p>
                    </div>

                    <div className="flex shrink-0 items-center gap-3 rounded-lg border border-border bg-card px-3.5 py-2 shadow-xs">
                      <Stat
                        label="Fields"
                        value={toolDetail.schema.fields.length}
                      />
                      <span className="h-7 w-px bg-border" aria-hidden />
                      <Stat
                        label="Computed"
                        value={toolDetail.schema.computed.length}
                      />
                      <span className="h-7 w-px bg-border" aria-hidden />
                      <Stat label="Rows" value={toolDetail.data.length} />
                    </div>
                  </div>

                  <div className="shrink-0">
                    <RefineBar
                      value={refineInput}
                      onChange={setRefineInput}
                      onSubmit={() => void handleRefine()}
                      busy={refining}
                      error={refineError}
                    />
                  </div>

                  <div className="min-h-0 flex-1">
                    <SchemaRenderer
                      schema={toolDetail.schema}
                      rows={toolDetail.data}
                      newColumnIds={newColumnIds}
                    />
                  </div>
                </div>
              </ErrorBoundary>
            )}

            {/* Empty state */}
            {showEmptyState && (
              <EmptyState onUpload={() => uploadTriggerRef.current?.click()} />
            )}

            {/* No selection (tools exist but none selected) */}
            {!toolDetail && !loadingDetail && !gridPreview && !error && tools.length > 0 && !selectedId && (
              <div className="flex h-full flex-col items-center justify-center gap-3 px-6 text-center">
                <span className="flex size-11 items-center justify-center rounded-xl border border-border bg-card text-muted-foreground shadow-xs">
                  <Table2 className="size-5" strokeWidth={1.75} />
                </span>
                <div className="space-y-1">
                  <p className="text-md font-medium text-foreground">
                    Nothing open
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Pick a tool from the sidebar, or upload a new spreadsheet.
                  </p>
                </div>
              </div>
            )}
          </main>
        </div>

        {/* Toast layer */}
        <ToastContainer toasts={toasts} dismiss={dismiss} />
      </div>
    </TooltipProvider>
  );
}
