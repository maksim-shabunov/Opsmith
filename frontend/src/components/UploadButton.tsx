import { useRef, useState } from "react";
import type { RefObject } from "react";
import { Button } from "@/components/ui/button";
import { Loader2, Upload } from "lucide-react";

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:8787";

interface UploadButtonProps {
  onGrid?: (grid: unknown[][], sheetName: string) => void;
  /** Optional ref forwarded to the visible button so external callers can trigger a click */
  triggerRef?: RefObject<HTMLButtonElement | null>;
}

export function UploadButton({ onGrid, triggerRef }: UploadButtonProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function triggerClick() {
    fileRef.current?.click();
  }

  async function handleFile(file: File) {
    setUploading(true);
    setError(null);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch(`${API_URL}/api/upload`, {
        method: "POST",
        body: form,
      });
      if (!res.ok) throw new Error(`Upload failed: ${res.status}`);
      const json = (await res.json()) as { grid: unknown[][]; sheetName: string };
      onGrid?.(json.grid, json.sheetName);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="flex items-center gap-2.5">
      {error && (
        <span className="max-w-[16rem] truncate text-xs text-destructive" title={error}>
          {error}
        </span>
      )}
      <Button
        ref={triggerRef as RefObject<HTMLButtonElement>}
        variant="outline"
        size="sm"
        disabled={uploading}
        onClick={triggerClick}
      >
        {uploading ? <Loader2 className="animate-spin" /> : <Upload />}
        {uploading ? "Uploading…" : "Upload spreadsheet"}
      </Button>
      <input
        ref={fileRef}
        type="file"
        accept=".xlsx,.xls,.csv"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void handleFile(f);
          e.target.value = "";
        }}
      />
    </div>
  );
}
