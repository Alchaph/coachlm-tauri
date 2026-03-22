import { useState, useCallback } from "react";
import { Check, X } from "lucide-react";

interface Toast {
  message: string;
  type: "success" | "error";
}

export function useToast() {
  const [toast, setToast] = useState<Toast | null>(null);

  const showToast = useCallback((message: string, type: "success" | "error") => {
    setToast({ message, type });
    const duration = type === "error" ? 5000 : 3000;
    setTimeout(() => { setToast(null); }, duration);
  }, []);

  const toastElement = toast ? (
    <div aria-live="assertive" role="status">
      <div className={`toast toast-${toast.type}`}>
        {toast.type === "success" ? <Check size={16} /> : <X size={16} />}
        {toast.message}
      </div>
    </div>
  ) : null;

  return { toast, showToast, toastElement };
}
