import { useState, useCallback, useRef } from "react";

export type ToastVariant = "default" | "success" | "error";

export interface Toast {
  id: number;
  message: string;
  variant: ToastVariant;
}

let _nextId = 0;

export function useToast() {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const timers = useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map());

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
    const t = timers.current.get(id);
    if (t) { clearTimeout(t); timers.current.delete(id); }
  }, []);

  const toast = useCallback(
    (message: string, variant: ToastVariant = "default", duration = 3500) => {
      const id = _nextId++;
      setToasts((prev) => [...prev, { id, message, variant }]);
      timers.current.set(
        id,
        setTimeout(() => dismiss(id), duration)
      );
    },
    [dismiss]
  );

  return { toasts, toast, dismiss };
}
